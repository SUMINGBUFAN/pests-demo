# -*- coding: utf-8 -*-
"""端到端冒烟测试：一条命令验证「起服务 → 探活 → 页面 → 单图 → 停服务 → 断连」。

运行：
    python tools/smoke_test.py

端口：默认自动挑一个空闲端口；可用环境变量 PESTS_PORT 指定。
      若指定端口已被占用，本脚本会失败退出——与 code/web_app.py 的 check_port()
      一样「显式报错、不静默顺延」。

两种模式：
  * Playwright 模式（本机默认）：真实打开 Chromium，断言顶部状态条、上传图片看渲染结果、
    停服务后点「重新探活」看断连文案。
  * HTTP 退化模式（未安装 playwright / chromium 启动失败时自动启用）：只用 urllib + 子进程。
    退化点：不打开浏览器、不校验页面 JS 渲染（状态条、结果区、断连提示）；
    改为校验 GET / 的 HTML 片段、/predict、/predict_batch、/sample 的 JSON 字段，
    以及停服务后端口不可达。运行时会在第 4、5(页面部分)、9 步明确标注「退化跳过」。

退出码：0 = 全部通过；1 = 有失败。
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "code" / "web_app.py"
TEST_DIR = ROOT / "data" / "Pests_dataset" / "test"
STATS = ROOT / "outputs" / "dataset_stats.json"
EXTS = {".jpg", ".jpeg", ".png", ".bmp"}

RESULTS = []          # [(ok|None(skip), title, evidence)]
LOGS = []


def report(ok, title, evidence=""):
    RESULTS.append((ok, title, evidence))
    mark = {True: "✓", False: "✗", None: "—"}[ok]
    line = f"{mark} {title}"
    print(line, flush=True)
    for ev in evidence.splitlines():
        print(f"    {ev}", flush=True)


def pick_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def http_json(method, url, body=None, headers=None, timeout=30):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            data = None
        return e.code, data


def http_text(url, timeout=10):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return r.status, r.read().decode("utf-8", "replace")


def multipart(fields, files):
    """手搓 multipart，避免依赖 requests。files = [(field, path), ...]"""
    boundary = "----smoke" + uuid.uuid4().hex
    body = bytearray()
    for k, v in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, p in files:
        p = Path(p)
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; '
                 f'filename="{p.name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()
        body += p.read_bytes() + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return bytes(body), {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def drain(proc):
    for line in proc.stdout:
        LOGS.append(line.rstrip("\n"))


def wait_ready(base, proc, timeout=180):
    deadline = time.time() + timeout
    last = ""
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError("服务进程提前退出，退出码 %s" % proc.returncode)
        try:
            code, data = http_json("GET", base + "/healthz", timeout=2)
            if code == 200 and isinstance(data, dict) and data.get("ok") is True:
                return data
            last = f"HTTP {code}"
        except Exception as exc:
            last = str(exc)
        time.sleep(0.5)
    raise RuntimeError(f"/healthz 在 {timeout}s 内未就绪（最后状态: {last}）")


def main():
    print("=" * 68)
    print(" 端到端冒烟测试 · 农作物病虫害识别与分类")
    print("=" * 68)

    port = int(os.environ.get("PESTS_PORT") or pick_free_port())
    base = f"http://127.0.0.1:{port}"
    print(f"[info] 端口: {port}（{'环境变量 PESTS_PORT' if os.environ.get('PESTS_PORT') else '自动挑空闲端口'}）")

    if not APP.exists():
        report(False, "1 服务启动", f"找不到 {APP}")
        return finish()
    if not TEST_DIR.exists():
        report(False, "1 服务启动", f"找不到测试集目录 {TEST_DIR}")
        return finish()
    imgs = sorted(p for p in TEST_DIR.iterdir() if p.suffix.lower() in EXTS)
    if not imgs:
        report(False, "1 服务启动", f"{TEST_DIR} 下没有可用图片")
        return finish()
    probe_img = imgs[0]

    proc = subprocess.Popen(
        [sys.executable, str(APP), "--port", str(port)],
        cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace", bufsize=1,
    )
    threading.Thread(target=drain, args=(proc,), daemon=True).start()

    pw = browser = page = None
    try:
        # ---- 1 服务启动 ----
        try:
            heal = wait_ready(base, proc)
        except Exception as exc:
            report(False, "1 服务启动", str(exc) + ("\n服务输出:\n" + "\n".join(LOGS[-15:]) if LOGS else ""))
            if proc.poll() is None:
                proc.terminate()
            return finish()

        startup = [ln for ln in LOGS if ln.startswith("[info]")]
        report(True, "1 服务启动", "\n".join(startup[-3:]) or "(无 [info] 行)")

        # ---- 2 /healthz 就绪 ----
        ok_hz = (heal.get("app") == "pests-web"
                 and heal.get("port") == port
                 and isinstance(heal.get("device"), str))
        report(ok_hz, "2 /healthz 就绪",
               f"JSON: {json.dumps({k: heal.get(k) for k in ('ok', 'app', 'model', 'device', 'port')}, ensure_ascii=False)}")

        # ---- 3 打开页面 ----
        status, html = http_text(base + "/")
        page_ok = status == 200 and 'name="api-base"' in html and 'id="status-text"' in html
        report(page_ok, "3 打开页面", f"GET / -> HTTP {status}，{len(html)} 字节，含 meta[api-base] 与 #status-text")

        # ---- 浏览器部分 ----
        try:
            from playwright.sync_api import sync_playwright
            pw = sync_playwright().start()
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(base + "/", wait_until="load", timeout=30000)
            page.wait_for_function(
                "() => document.querySelector('#status-text').textContent.indexOf('正在检测') === -1",
                timeout=15000,
            )
        except Exception as exc:
            if page:
                page = None
            if browser:
                try:
                    browser.close()
                except Exception:
                    pass
                browser = None
            if pw:
                try:
                    pw.stop()
                except Exception:
                    pass
                pw = None
            print(f"[warn] Playwright 不可用，退化为 urllib HTTP 级冒烟：{type(exc).__name__}: {exc}")
            report(None, "4 状态条「真实服务」", "退化：未打开浏览器，跳过 JS 渲染校验")

        if page is not None:
            # ---- 4 状态条 ----
            text = page.inner_text("#status-text").strip()
            detail = page.inner_text("#status-detail").strip()
            report("真实服务" in text and "se_residual" in detail,
                   "4 状态条「真实服务」", f"#status-text = {text}\n#status-detail = {detail}")

            # ---- 5 单图 ----
            try:
                page.set_input_files("#file", str(probe_img))
                page.wait_for_function(
                    "() => { const b = document.querySelector('#one-body');"
                    " return b && !b.hidden && document.querySelector('#one-cn').textContent.trim() !== '—'; }",
                    timeout=90000,
                )
                cn = page.inner_text("#one-cn").strip()
                conf = page.inner_text("#one-conf").strip()
                stats = json.loads(STATS.read_text(encoding="utf-8"))
                hit = cn in stats["class_names_cn"] and _is_float(conf)
                report(hit, "5 单图识别（页面渲染）",
                       f"上传 {probe_img.name} → #one-cn = {cn}；#one-conf = {conf}%")
            except Exception as exc:
                report(False, "5 单图识别（页面渲染）",
                       f"{type(exc).__name__}: {exc}\n页面错误区: {page.inner_text('#one-error').strip()[:120]}")
        else:
            # 退化：HTTP 级验证 /predict
            body, hd = multipart({}, [("file", probe_img)])
            code, data = http_json("POST", base + "/predict", body, hd, timeout=90)
            stats = json.loads(STATS.read_text(encoding="utf-8"))
            hit = (code == 200 and isinstance(data, dict)
                   and data.get("class_cn") in stats["class_names_cn"]
                   and _is_float(data.get("confidence")))
            ev = (f"POST /predict -> HTTP {code}；class_cn={data.get('class_cn')}，"
                  f"confidence={data.get('confidence')}" if isinstance(data, dict)
                  else f"POST /predict -> HTTP {code}；{data}")
            report(hit, "5 单图识别（HTTP 退化）", ev)

        # ---- 6 批量 ----
        body, hd = multipart({}, [("files", str(p)) for p in imgs[:2]])
        code, data = http_json("POST", base + "/predict_batch", body, hd, timeout=120)
        items = (data or {}).get("items") if isinstance(data, dict) else None
        ok_batch = (code == 200 and isinstance(items, list) and len(items) == 2
                    and all(i.get("ok") is True and "class_cn" in i and "confidence" in i for i in items))
        report(ok_batch, "6 批量识别 /predict_batch",
               f"POST 2 张 -> HTTP {code}；items={len(items) if isinstance(items, list) else items}；"
               f"首项={items[0].get('class_cn') if isinstance(items, list) and items else '—'}")

        # ---- 7 抽样 ----
        body, hd = multipart({"source": "test"}, [])
        code, data = http_json("POST", base + "/sample", body, hd, timeout=180)
        ok_sample = (code == 200 and isinstance(data, dict) and isinstance(data.get("items"), list)
                     and len(data["items"]) == 12 and isinstance(data.get("total_in_test"), int))
        report(ok_sample, "7 随机抽样 /sample",
               f"POST source=test -> HTTP {code}；items={len(data.get('items', [])) if isinstance(data, dict) else '—'}；"
               f"total_in_test={data.get('total_in_test') if isinstance(data, dict) else '—'}")

        # ---- 8 停服务 ----
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=10)
        report(proc.poll() is not None, "8 停服务", f"子进程退出码 = {proc.poll()}")

        # ---- 9 断连 ----
        if page is not None:
            try:
                page.click("#status-retry")
                page.wait_for_function(
                    "() => document.querySelector('#status-text').textContent.trim() === '未连接'",
                    timeout=20000,
                )
                text = page.inner_text("#status-text").strip()
                banner = page.inner_text("#banner-msg").strip()
                report(text == "未连接" and "无法连接本地服务" in banner,
                       "9 断连提示", f"#status-text = {text}\n#banner-msg = {banner[:40]}…")
            except Exception as exc:
                report(False, "9 断连提示",
                       f"{type(exc).__name__}: {exc}\n#status-text = {page.inner_text('#status-text').strip()}")
        else:
            try:
                http_json("GET", base + "/healthz", timeout=3)
                report(False, "9 断连提示（HTTP 退化）", "服务停止后端口仍可访问")
            except Exception as exc:
                report(True, "9 断连提示（HTTP 退化）",
                       f"服务停止后 /healthz 不可达：{type(exc).__name__}（退化：未校验页面文案）")
    finally:
        if page is not None:
            try:
                page.close()
            except Exception:
                pass
        if browser is not None:
            try:
                browser.close()
            except Exception:
                pass
        if pw is not None:
            try:
                pw.stop()
            except Exception:
                pass
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()

    return finish()


def _is_float(v):
    try:
        f = float(v)
        return 0.0 <= f <= 100.0
    except (TypeError, ValueError):
        return False


def finish():
    passed = sum(1 for ok, _, _ in RESULTS if ok is True)
    failed = sum(1 for ok, _, _ in RESULTS if ok is False)
    skipped = sum(1 for ok, _, _ in RESULTS if ok is None)
    print("-" * 68)
    print(f"结果: {passed} 通过 / {failed} 失败 / {skipped} 退化跳过")
    print("=" * 68)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
