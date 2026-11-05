# ACCEPTANCE · 验收清单

> 规则：**没过不算完成。** 改动涉及哪一组，就把该组所有条目跑到「已验」；确实只能人工操作的标「需人工点」，并在提交说明里写明谁点的、点了什么。
> 状态定义：
> - **已验**：本轮实际执行过命令，并核对了输出（证据写在「实际结果」里）。
> - **未验**：命令已给出，但本轮没跑（通常是需要构造异常或会破坏现场）。
> - **需人工点**：必须在真实桌面上双击 / 肉眼观察，脚本替代不了。
>
> 环境：Windows + PowerShell，项目根目录 `C:\Users\14207\Desktop\病虫害`。

---

## A 服务启动

### A1 默认端口 5000 启动

- 改动/检查点：什么都没改，直接起服务。
- 命令：
```powershell
python code\web_app.py
```
- 期望输出（两行 `[info]`，端口必须是 5000）：
```
[info] 模型: se_residual | 输入: 224x224 | 验证集: 99.16% | holdout: 99.79% | 设备: cuda | fp32
[info] 访问地址: http://127.0.0.1:5000  (Ctrl+C 结束)
```
- 状态：**已验**。实际结果：两行完全一致（设备 `cuda`），`/healthz` 返回 `port=5000`。

### A2 `--port` 覆盖

- 改动/检查点：换端口不换代码。
- 命令：
```powershell
python code\web_app.py --port 5050
```
另开一个窗口：
```powershell
curl.exe -s http://127.0.0.1:5050/healthz
```
- 期望输出：`{"app":"pests-web","device":"cuda","model":"se_residual","ok":true,"port":5050}`
- 状态：**已验**。实际结果：`tools/smoke_test.py` 每次用随机空闲端口以 `--port` 启动，`/healthz` 的 `port` 与传入值一致。

### A3 `PESTS_PORT` 覆盖（经 bat）

- 改动/检查点：不改命令行，用环境变量换端口。
- 命令：
```powershell
$env:PESTS_PORT = "5050"
.\启动网页.bat
```
- 期望输出：窗口打印 `[info] 访问地址: http://127.0.0.1:5050`，浏览器自动打开 5050。
- 状态：**需人工点**（bat 会 `pause` 并等前台 python，脚本无法无人值守跑完）。
- 备注：`PESTS_PORT` 只被 bat 读取，`python code/web_app.py` 不认它（见 `docs/CONTRACT.md` §7 第 1 条）。

### A4 `/healthz` 就绪

- 命令：
```powershell
curl.exe -s -w "`nHTTP %{http_code}`n" http://127.0.0.1:5000/healthz
```
- 期望输出：`HTTP 200`，JSON 含 `ok/app/model/device/port` 五个字段。
- 状态：**已验**。实际结果：`{"app":"pests-web","device":"cuda","model":"se_residual","ok":true,"port":5000}`。

---

## B 幂等双击

### B1 服务已在运行时再双击 `启动网页.bat`

- 命令：先 A1 或 A2 起服务，然后**再双击一次** `启动网页.bat`。
- 期望输出：
```
[成功] 服务已在运行: http://127.0.0.1:5000/
        未启动第二个实例；模型 se_residual 在线，直接使用。
```
随后浏览器打开，窗口 `pause`，退出码 0。
- 状态：**需人工点**。
- 判定依据：`启动网页.bat:18-25` 用 `/healthz` 响应里是否同时含 `pests-web` 与 `se_residual` 判 `SELF`；`:34-42` 打印上面两行并 `exit /b 0`。

### B2 首次双击自动打开浏览器

- 命令：服务未运行时双击 `启动网页.bat`。
- 期望输出：等端口就绪后自动 `start "" http://127.0.0.1:<PORT>/`，页面顶部状态条为 `真实服务（端口 <PORT>）`。
- 状态：**需人工点**。

---

## C 端口被他人占用

### C1 bat 探测到「不是本项目」的占用

- 命令：用一个非本项目程序占住 5000（例如另起一个 Flask），然后双击 `启动网页.bat`。
- 期望输出：
```
[错误] 端口 5000 被其他程序占用，不会自动换端口。
        该端口在监听，但不是本项目（/healthz 无有效响应）。
        请换一个端口手动启动，例如:
            启动网页.bat --port 5050
```
退出码 1，**不会**自动启动 5001。
- 状态：**需人工点**。判定依据 `启动网页.bat:44-57`。

### C2 直接跑 python 时的显式报错（不做静默顺延）

- 命令（先用 Python 占住 5097，再启动服务）：
```powershell
python -c "import socket,subprocess,sys;s=socket.socket();s.bind(('127.0.0.1',5097));s.listen(1);p=subprocess.Popen([sys.executable,'code/web_app.py','--port','5097']);print('exit',p.wait())"
```
- 期望输出：
```
[error] 无法在 127.0.0.1:5097 启动：端口已被占用或被拦截（[WinError 10013] 以一种访问权限不允许的方式做了一个访问套接字的尝试。）。
        请关闭占用该端口的程序，或改用其它端口：python code/web_app.py --port 5098
exit 1
```
- 状态：**已验**。实际结果逐字一致，退出码 1，未起第二个服务。

### C3 边界：占用方也设置了 `SO_REUSEADDR`

- 命令：
```powershell
python -c "import socket,subprocess,sys;time=__import__('time');s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('127.0.0.1',5096));s.listen(1);p=subprocess.Popen([sys.executable,'code/web_app.py','--port','5096']);time.sleep(30);print('alive',p.poll() is None);p.kill()"
```
- 期望：按契约应报错退出。
- 实际结果：**未拦截**，服务进程存活 30s（`alive True`）。
- 状态：**已验（确认为已知缺陷，记录在 CONTRACT §7 第 13 条，本轮不改）**。
- 说明：bat 层的 `/healthz` 探测仍能识别「不是本项目」，因此双击入口不受影响；只有直接跑 python 的边界场景会漏检。

---

## D 断连提示

### D1 服务停掉后点「重新探活」→ 状态条转「未连接」

- 命令：
```powershell
python tools\smoke_test.py
```
- 期望输出：`✓ 9 断连提示`，`#status-text = 未连接`，`#banner-msg = 无法连接本地服务…`。
- 状态：**已验**。实际结果：smoke 第 8 步 `子进程退出码 = 1`，第 9 步状态条 `未连接`、横幅首句 `无法连接本地服务`。
- 说明：页面**不自动轮询**，必须点 `#status-retry` 才会重探（`index.html:574-592`）。

### D2 单图请求遇到网络层失败时的附注

- 命令：服务停掉后，在仍打开的页面里拖入一张图。
- 期望输出：错误区正文 = `无法连接本地服务…`，附注 = `这一条是「页面连不上后端」，不是图片本身的问题。`，并出现「重新检测连接 / 重新打开页面」按钮。
- 状态：**未验**（smoke 只覆盖状态条，不覆盖单图错误区）。
- 判定依据 `index.html:414-422`。

### D3 超时文案

- 命令：把后端卡住超过 60s（例如在推理前 `sleep 70`，需临时改代码，不在本清单范围）；或断网模拟。
- 期望输出：错误区正文 `推理超时，请重试。`，附注 `首次请求可能赶上模型刚加载，稍等片刻再试。`
- 状态：**需人工点**（本轮不改代码，无法在不改 `web_app.py` 的前提下构造）。

---

## E `file://` 拦截

### E1 直接打开 `code/templates/index.html`

- 命令：
```powershell
python -c "from playwright.sync_api import sync_playwright;from pathlib import Path;u=Path(r'code\templates\index.html').resolve().as_uri();p=sync_playwright().start();b=p.chromium.launch();g=b.new_page();g.goto(u);print(g.inner_text('#status-text'));print(g.inner_text('#banner-msg'));print(g.eval_on_selector('#file','e=>e.disabled'), g.eval_on_selector('#batch-run','e=>e.disabled'));b.close();p.stop()"
```
（或直接双击 html，肉眼观察。）
- 期望输出：
```
演示数据（后端未连接）
当前是直接打开文件（file://），页面不会工作。
True True
```
- 状态：**已验**。实际结果与上面三行完全一致（`#file` 与 `#batch-run` 均 `disabled`）。
- 判定依据 `index.html:231, 336-342, 597-599`。

---

## F 单图识别

### F1 正常图片

- 命令：
```powershell
curl.exe -s -F "file=@data/Pests_dataset/test/1.jpg" http://127.0.0.1:5000/predict
```
- 期望输出：`200`，JSON 含 `predicted_class / class_cn / class_en / confidence / top3 / probs`，`confidence` 是 0–100 的两位小数。
- 状态：**已验**。实际结果：smoke 第 5 步上传 `1.jpg`，`#one-cn` 为 7 类中文名之一，`#one-conf` 为合法百分数。

### F2 单张超过 10MB

- 命令：
```powershell
python -c "import os,pathlib;pathlib.Path(os.environ['TEMP'],'big11.jpg').write_bytes(b'\xff'*(11*1024*1024))"
curl.exe -s -w "`nHTTP %{http_code}`n" -F "file=@$env:TEMP\big11.jpg" http://127.0.0.1:5000/predict
```
- 期望输出：`HTTP 400` + `{"error":"图片超过 10MB 上限"}`
- 状态：**已验**。实际结果完全一致。

### F3 非白名单扩展名

- 命令：
```powershell
python -c "import os,pathlib;pathlib.Path(os.environ['TEMP'],'a.txt').write_text('hello')"
curl.exe -s -w "`nHTTP %{http_code}`n" -F "file=@$env:TEMP\a.txt" http://127.0.0.1:5000/predict
```
- 期望输出：`HTTP 400` + `{"error":"不支持的格式 .txt，请上传 jpg/png/bmp 图片"}`
- 状态：**已验**。实际结果完全一致。

### F4 扩展名对但内容不可解码

- 命令：
```powershell
python -c "import os,pathlib;pathlib.Path(os.environ['TEMP'],'bad.jpg').write_bytes(b'not-an-image')"
curl.exe -s -w "`nHTTP %{http_code}`n" -F "file=@$env:TEMP\bad.jpg" http://127.0.0.1:5000/predict
```
- 期望输出：`HTTP 400` + `{"error":"这张文件不是可读的图片（无法解码，请确认是 JPG / PNG / BMP）"}`
- 状态：**已验**。实际结果完全一致。

### F5 请求里没有 `file` 字段

- 命令：
```powershell
curl.exe -s -X POST -w "`nHTTP %{http_code}`n" http://127.0.0.1:5000/predict
```
- 期望输出：`HTTP 400` + `{"error":"未收到文件，请选择图片后再试"}`
- 状态：**已验**。实际结果完全一致。

---

## G 批量识别

### G1 正常 2 张

- 命令：
```powershell
curl.exe -s -F "files=@data/Pests_dataset/test/1.jpg" -F "files=@data/Pests_dataset/test/2.jpg" http://127.0.0.1:5000/predict_batch
```
- 期望输出：`200`，`items` 长度 2，每项都有 `name / ok:true / class_cn / confidence`。
- 状态：**已验**。实际结果：smoke 第 6 步 `items=2`，两项均 `ok:true`。

### G2 选 13 张时前端只发前 12 张

- 命令：页面上选择 13 张图，点「开始识别」。
- 期望输出：结果区页脚 `共 12 张，成功 12 张`；网络面板里 `/predict_batch` 只带 12 个 `files`。
- 状态：**需人工点**。判定依据 `index.html:512`（`files.slice(0, 12)`，仅前端限制）。

### G3 一张都没传

- 命令：
```powershell
curl.exe -s -X POST -w "`nHTTP %{http_code}`n" http://127.0.0.1:5000/predict_batch
```
- 期望输出：`HTTP 400` + `{"error":"未收到文件，请选择 1 张以上图片"}`
- 状态：**已验**。实际结果完全一致。

### G4 好坏混合（部分失败仍 200）

- 命令：
```powershell
python -c "import os,pathlib;pathlib.Path(os.environ['TEMP'],'a.txt').write_text('hello')"
curl.exe -s -F "files=@data/Pests_dataset/test/1.jpg" -F "files=@$env:TEMP\a.txt" http://127.0.0.1:5000/predict_batch
```
- 期望输出：`HTTP 200`，`items` 两项；第一项 `ok:true`，第二项 `ok:false` 且 `error` 为 `不支持的格式 .txt，请上传 jpg/png/bmp 图片`。
- 状态：**已验**。实际结果：`200 [('1.jpg', True, None), ('bad.txt', False, '不支持的格式 .txt，请上传 jpg/png/bmp 图片')]`。

---

## H 随机抽样

### H1 `source=test`（1213 张无标签）

- 命令：
```powershell
curl.exe -s -X POST -F "source=test" http://127.0.0.1:5000/sample
```
- 期望输出：`200`，`items` 长度 12，`total_in_test=1213`，`source="test"`。
- 状态：**已验**。实际结果：`200 test 1213 12`。

### H2 `source=holdout`（466 张带标签）

- 命令：
```powershell
curl.exe -s -X POST -F "source=holdout" http://127.0.0.1:5000/sample
```
- 期望输出：`200`，`items` 长度 12，`total=466`，`source="holdout"`，每项额外含 `truth_class / truth_cn / truth_en`。
- 状态：**已验**。实际结果：`200 holdout 466 12 ['truth_class','truth_cn','truth_en']`。

---

## I `/healthz`

### I1 字段齐全

- 命令：
```powershell
curl.exe -s http://127.0.0.1:5000/healthz
```
- 期望输出：`ok/app/model/device/port` 五个键，`app="pests-web"`，`model="se_residual"`。
- 状态：**已验**（A4 同一条命令）。

### I2 `port` 与实际监听端口一致

- 命令：A2 里用 `--port 5050` 启动，再看 `/healthz` 的 `port`。
- 期望输出：`5050`。
- 状态：**已验**（smoke 第 2 步断言 `heal["port"] == port`，随机端口下通过）。

### I3 经代理 / 伪造 `Host` 时的表现

- 命令：
```powershell
curl.exe -s -H "Host: 127.0.0.1:9999" http://127.0.0.1:5000/healthz
```
- 期望输出：按契约应返回真实端口 `5000`。
- 实际：会返回 `9999`（`port` 取自 `request.host`）。
- 状态：**已验（确认为已知缺陷，记录在 CONTRACT §7 第 6 条，本轮不改）**。

---

## J 报告 13 页核对

报告路径：`交付物\课堂实验报告-25003130516-庄锦泰.pdf`

### J1 页数 = 13

- 命令：
```powershell
python -c "import fitz;d=fitz.open(r'交付物\课堂实验报告-25003130516-庄锦泰.pdf');print('pages',d.page_count)"
```
- 期望输出：`pages 13`
- 状态：**已验**。

### J2 图注 = 19 条（编号 1–19 连续）

- 命令：
```powershell
python -c "import fitz,re;d=fitz.open(r'交付物\课堂实验报告-25003130516-庄锦泰.pdf');t=''.join(p.get_text() for p in d);print('figs',len(re.findall(r'图\s*\d+\s{2}',t)))"
```
- 期望输出：`figs 19`
- 状态：**已验**。说明：正则要求「图 + 数字 + 两个空白」，正文里单独引用「图 19」只有一个空白，不会被误计。

### J3 表题 = 6 条（编号 1–6 连续）

- 命令：
```powershell
python -c "import fitz,re;d=fitz.open(r'交付物\课堂实验报告-25003130516-庄锦泰.pdf');t=''.join(p.get_text() for p in d);print('tabs',len(re.findall(r'表\s*\d+\s{2}',t)))"
```
- 期望输出：`tabs 6`
- 状态：**已验**。

### J4 SE 措辞已改

- 命令：
```powershell
python -c "import fitz;d=fitz.open(r'交付物\课堂实验报告-25003130516-庄锦泰.pdf');t=''.join(p.get_text() for p in d);print('SE','未带来可测收益' in t,'neg','负贡献' in t)"
```
- 期望输出：`SE True neg False`
- 状态：**已验**。实际结果 `SE True neg False`。

### J5 一次跑完四项

- 命令：
```powershell
python -c "import fitz,re;d=fitz.open(r'交付物\课堂实验报告-25003130516-庄锦泰.pdf');t=''.join(p.get_text() for p in d);print('pages',d.page_count);print('figs',len(re.findall(r'图\s*\d+\s{2}',t)));print('tabs',len(re.findall(r'表\s*\d+\s{2}',t)));print('SE','未带来可测收益' in t,'neg','负贡献' in t)"
```
- 期望输出：`pages 13 / figs 19 / tabs 6 / SE True neg False`
- 状态：**已验**。

---

## K 一键冒烟

### K1 `tools/smoke_test.py` 全绿

- 命令：
```powershell
python tools\smoke_test.py
```
- 期望输出：9 步全部 `✓`，末行 `结果: 9 通过 / 0 失败 / 0 退化跳过`，退出码 0。
- 状态：**已验**。实际结果见 `CHANGELOG.md` 对应条目的运行输出。
- 注意：若本机没装 Playwright，会自动退化为 HTTP 级冒烟（第 4、9 步标「退化」），此时 `0 退化跳过` 会变成 `2 退化跳过`，退出码仍以「失败数 = 0」为准。
