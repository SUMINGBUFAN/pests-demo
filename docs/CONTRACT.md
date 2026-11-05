# CONTRACT · 接口与运行契约

> 适用范围：本地网页演示（`code/web_app.py` + `code/templates/index.html` + 两个 `.bat`）。
> 数据来源：本文件每个字段、每条文案都逐条抄自代码，并在括号里标注 `文件:行号`；未凭印象撰写。
> **生效规则（唯一一句）：改接口 / 改端口前先改本页，代码随后跟随；未改本页的改动视为违规。**

---

## 1 端口唯一来源

### 1.1 事实

| 项 | 值 | 出处 |
|---|---|---|
| 默认端口 | `5000` | `code/web_app.py:312` — `ap.add_argument("--port", type=int, default=5000)` |
| 默认监听地址 | `127.0.0.1`（不是 0.0.0.0） | `code/web_app.py:311` |
| CLI 覆盖 | `python code/web_app.py --port 5050` | `code/web_app.py:311-313` |
| 环境变量 `PESTS_PORT` | **只在两个 bat 内生效**：脚本把它转成 `--port` 传给 python | `启动网页.bat:11`、`诊断自检.bat:9` |
| bat 位置参数 | `启动网页.bat 5050` | `启动网页.bat:10` |
| 实际优先级（按 bat 赋值顺序） | `PESTS_PORT` > `--port` > 位置参数 > `5000` | `启动网页.bat:8-11`（`PESTS_PORT` 最后赋值，所以最高） |

**重要区分**：

- `python code/web_app.py` **不读** `PESTS_PORT`，只认 `--port`。
- `诊断自检.bat` **不读** `--port`、也不读位置参数，只认 `PESTS_PORT`。
- `启动网页.bat` 三种都认，但 `PESTS_PORT` 会覆盖命令行。

### 1.2 禁止静默顺延；冲突必须显式报错

`check_port(host, port)`（`code/web_app.py:296-306`）在 `app.run` 之前先 bind 一次，失败立刻抛 `SystemExit`，进程退出码 1，**不会自动 +1 顺延**。实测原文：

```
[error] 无法在 127.0.0.1:5097 启动：端口已被占用或被拦截（[WinError 10013] 以一种访问权限不允许的方式做了一个访问套接字的尝试。）。
        请关闭占用该端口的程序，或改用其它端口：python code/web_app.py --port 5098
```

（实测逐字抄录：先占住 5097 再启动，退出码 1，未起第二个服务。已知边界见 §7 第 13 条。）

### 1.3 硬规则

1. **新增代码不得再出现端口字面量**（`5000`/`5001`/`5050`…）。端口只能来自 `--port` 或两个 bat 的 `PORT` 变量。
2. 现存三处 `5000` 字面量登记为唯一豁免：`web_app.py:312`（argparse 默认值）、`启动网页.bat:8`、`诊断自检.bat:8`。要改默认端口，只改这三处 + 本页。
3. 端口被占用时只允许「报错 + 提示换端口」，**不允许自动换端口再继续**。

---

## 2 地址唯一来源

### 2.1 页面一律同源相对路径

四个请求全部写成 `API_BASE + '/<path>'`：

| 请求 | 位置 |
|---|---|
| `GET /healthz` | `code/templates/index.html:321` |
| `POST /predict` | `code/templates/index.html:433` |
| `POST /predict_batch` | `code/templates/index.html:525` |
| `POST /sample` | `code/templates/index.html:553` |

`API_BASE` 的唯一来源是：

```html
<meta name="api-base" content="">
```

（`code/templates/index.html:6`，默认空 = 同源。读取逻辑同文件 `:233-234`。）

### 2.2 `file://` 拦截

`var LOCKED = /^\s*file:/i.test(location.protocol);`（`index.html:231`）。直接双击 html 打开时页面进入锁定态：

- 状态条：`演示数据（后端未连接）`
- 横幅：`当前是直接打开文件（file://），页面不会工作。` + `请双击项目根目录的 启动网页.bat，等浏览器自动打开后再用。`
- `#file`、`#batch-run`、`#sample-test`、`#sample-holdout` 全部 `disabled`

（已实测，见 `docs/ACCEPTANCE.md` E1。）

### 2.3 硬规则

1. 页面里不得出现 `http://127.0.0.1:5000` 这类绝对地址。
2. 要换后端地址，只改 `<meta name="api-base">` 的 `content`，不改 JS 里的任何路径。
3. 新增请求必须沿用 `API_BASE + '/...'` 写法，并用 `apiFetch` / `apiFetchRetry` 走统一错误分层。

---

## 3 接口表

约定：服务默认 `http://127.0.0.1:5000`；除 404 等框架级错误外，失败响应统一是 JSON `{"error": "..."}`。
下列 `curl` 示例在项目根目录执行（Windows 自带 `curl.exe`）。

### 3.1 `GET /`

| 项 | 内容 |
|---|---|
| 方法/路径 | `GET /` |
| 入参 | 无 |
| 成功返回 | `200 text/html`，渲染 `templates/index.html` |
| 失败返回 | 无业务失败分支；`outputs/dataset_stats.json` 或权重缺失时进程在启动期 `SystemExit`，服务根本不会起来 |
| 出处 | `code/web_app.py:175-193` |

成功返回的模板变量（`web_app.py:177-193`）：

| 变量 | 类型 | 含义 | 当前实际值 |
|---|---|---|---|
| `classes` | `list[tuple[int, str, str]]` | 7 组 `(类别序号, 中文名, 英文名)` | 7 项 |
| `model_name` | `str` | `f"{arch} · {RUN_NAME}"` | `se_residual · P2_se_residual_cosine` |
| `weights_rel` | `str` | 权重相对路径 | `outputs/P2_se_residual_cosine/best_model.pth` |
| `summary_rel` | `str` | 训练汇总相对路径 | `outputs/P2_se_residual_cosine/summary.json` |
| `holdout_csv_rel` | `str` | holdout 汇总相对路径 | `outputs/holdout/eval_val466.csv` |
| `img_size` | `int` | 输入边长 | `224` |
| `val_acc` | `float \| None` | 验证集准确率（来自 summary.json） | `99.16` |
| `val_n` | `int \| None` | 验证集张数（从 CSV 列名 `val836_acc` 的数字解析） | `836` |
| `holdout` | `dict` | `{"acc": float, "n": int, "errors": int}`（来自 CSV，run 名必须等于 `P2_se_residual_cosine`） | `{"acc": 99.79, "n": 466, "errors": 1}` |
| `epochs` | `int` | 总轮数 | `40` |
| `best_epoch` | `int` | 最优轮次 | `30` |
| `seed` | `int` | 随机种子 | `42` |
| `params_m` | `float` | 参数量（百万） | `2.799` |
| `device` | `str` | `"cuda"` 或 `"cpu"` | 本机 `cuda` |

```bash
curl.exe -s -o page.html -w "HTTP %{http_code}  %{size_download} bytes\n" http://127.0.0.1:5000/
```

### 3.2 `GET /healthz`

| 项 | 内容 |
|---|---|
| 方法/路径 | `GET /healthz` |
| 入参 | 无 |
| 成功返回 | `200 application/json` |
| 失败返回 | 无业务失败分支；服务未启动时 curl 退出码 7（连接失败） |
| 出处 | `code/web_app.py:196-206` |

| 字段 | 类型 | 含义 |
|---|---|---|
| `ok` | `bool` | 恒为 `true`（没有「模型未加载」的 false 分支，见 §7 第 11 条） |
| `app` | `str` | 固定 `"pests-web"`，bat 与自检脚本靠它识别「是不是本项目」 |
| `model` | `str` | `meta["arch"]`，当前 `"se_residual"` |
| `device` | `str` | `"cuda"` / `"cpu"` |
| `port` | `int \| None` | **取自请求头 `Host` 的端口**，不是 socket 实际绑定端口（见 §7 第 6 条） |

```bash
curl.exe -s http://127.0.0.1:5000/healthz
```

### 3.3 `POST /predict`

| 项 | 内容 |
|---|---|
| 方法/路径 | `POST /predict`，`multipart/form-data` |
| 入参 | `file`：文件，**必填**，字段名必须正好是 `file`；扩展名 ∈ `.jpg/.jpeg/.png/.bmp`；单张 ≤ 10MB |
| 成功返回 | `200 application/json` |
| 失败返回 | `400` / `413` / `500`，见下表与 §4 |
| 出处 | `code/web_app.py:209-222`（入参校验 `150-163`、推理 `128-147`） |

| 成功字段 | 类型 | 含义 |
|---|---|---|
| `predicted_class` | `int` | top1 类别序号，`0..6` |
| `class_cn` | `str` | top1 中文类名，取自 `dataset_stats.json` 的 `class_names_cn` |
| `class_en` | `str` | top1 英文类名（形如 `Apple___Apple_scab`） |
| `confidence` | `float` | top1 概率，**百分数**，`round(prob*100, 2)`，范围 0–100 |
| `top3` | `list[dict]` | 长度 3，每项 `{class_index:int, class_cn:str, class_en:str, prob:float}` |
| `probs` | `list[dict]` | 长度 7，按 `prob` 降序，结构与 `top3` 每项相同 |

| 失败 | 响应 |
|---|---|
| 没有 `file` 字段 | `400 {"error": "未收到文件，请选择图片后再试"}` |
| 扩展名不在白名单 | `400 {"error": "不支持的格式 .txt，请上传 jpg/png/bmp 图片"}` |
| 空文件 | `400 {"error": "文件为空"}` |
| 单张 > 10MB | `400 {"error": "图片超过 10MB 上限"}`（**是 400，不是 413**） |
| 无法解码 | `400 {"error": "这张文件不是可读的图片（无法解码，请确认是 JPG / PNG / BMP）"}` |
| 请求体 > 64MB | `413 {"error": "请求体超过 64MB 上限（批量请分批上传）"}` |
| 推理异常 | `500 {"error": "推理失败：<异常文本>"}` |

```bash
curl.exe -s -F "file=@data/Pests_dataset/test/1.jpg" http://127.0.0.1:5000/predict
```

### 3.4 `POST /predict_batch`

| 项 | 内容 |
|---|---|
| 方法/路径 | `POST /predict_batch`，`multipart/form-data` |
| 入参 | `files`：文件，**必填，可重复出现**，≥ 1 张；字段名必须正好是 `files`；单张 ≤ 10MB；整个请求体 ≤ 64MB |
| 成功返回 | `200 application/json`，**即使部分图片失败也返回 200** |
| 失败返回 | `400`（一张都没有）/ `413`（请求体超限）/ `500` |
| 出处 | `code/web_app.py:225-241` |

成功返回结构：

```json
{"items": [ ... ]}
```

每个 item 恒有两个字段：`name`（`str`，原始文件名）、`ok`（`bool`）。其余字段按 `ok` 分两种形态：

| `ok` | 额外字段 | 类型 |
|---|---|---|
| `true` | `predicted_class` / `class_cn` / `class_en` / `confidence` / `top3` / `probs` | 与 §3.3 成功字段完全一致 |
| `false` | `error` | `str`（该单张失败原因，取自 `read_upload` 的 ValueError 原文） |

失败返回：

| 触发 | 响应 |
|---|---|
| 没有任何 `files` | `400 {"error": "未收到文件，请选择 1 张以上图片"}` |
| 请求体 > 64MB | `413 {"error": "请求体超过 64MB 上限（批量请分批上传）"}` |
| 循环外层异常 | `500 {"error": "批量推理失败：<异常文本>"}` |

```bash
curl.exe -s -F "files=@data/Pests_dataset/test/1.jpg" -F "files=@data/Pests_dataset/test/2.jpg" http://127.0.0.1:5000/predict_batch
```

### 3.5 `POST /sample`

| 项 | 内容 |
|---|---|
| 方法/路径 | `POST /sample`，`multipart/form-data`（`application/x-www-form-urlencoded` 亦可） |
| 入参 | `source`：字符串，**选填**，默认 `"test"`；有效值只有 `"test"` 与 `"holdout"`，其它值按 `test` 处理 |
| 成功返回 | `200 application/json`，固定抽 `min(12, 图片总数)` 张 |
| 失败返回 | `400`（目录缺失 / 目录里没有可用图片） |
| 出处 | `code/web_app.py:244-288` |

`source=test`（默认，`data/Pests_dataset/test`，1213 张无标签）：

| 字段 | 类型 | 含义 |
|---|---|---|
| `items` | `list[dict]` | 12 项 |
| `total_in_test` | `int` | test 目录图片总数，当前 `1213` |
| `source` | `str` | 固定 `"test"` |

item 字段：`name`(str)、`ok`(bool)、`thumb`(str，`data:image/jpeg;base64,...` 缩略图)，成功项再加 §3.3 的 6 个推理字段；失败项为 `{"name", "ok":false, "error"}`。

`source=holdout`（`data/Pests_dataset/val`，466 张带标签）：

| 字段 | 类型 | 含义 |
|---|---|---|
| `items` | `list[dict]` | 12 项 |
| `total` | `int` | holdout 目录图片总数，当前 `466`（**注意不叫 `total_in_test`**） |
| `source` | `str` | 固定 `"holdout"` |

item 在 test 形态之上多三个真值字段：`truth_class`(int，目录名前缀)、`truth_cn`(str)、`truth_en`(str)。

失败返回：

| 触发 | 响应 |
|---|---|
| holdout 目录不存在 | `400 {"error": "找不到 holdout 目录: <绝对路径>"}` |
| holdout 目录无图 | `400 {"error": "holdout 目录中没有可用图片"}` |
| test 目录不存在 | `400 {"error": "找不到测试集目录: <绝对路径>"}` |
| test 目录无图 | `400 {"error": "测试集目录中没有可用图片"}` |

```bash
curl.exe -s -X POST -F "source=test"    http://127.0.0.1:5000/sample
curl.exe -s -X POST -F "source=holdout" http://127.0.0.1:5000/sample
```

---

## 4 错误语义表

### 4.1 服务端

| HTTP | 触发条件 | 响应体原文 | 页面应显示的原话 | 出处 |
|---|---|---|---|---|
| 400 | 缺 `file` 字段 | `未收到文件，请选择图片后再试` | 单图错误区原文照显：`未收到文件，请选择图片后再试` | `web_app.py:212-213` |
| 400 | 扩展名不在白名单 | `不支持的格式 <ext>，请上传 jpg/png/bmp 图片` | 原文照显（`<ext>` 已是 `.txt` 这种带点的形式） | `web_app.py:152-154` |
| 400 | 空文件 | `文件为空` | `文件为空` | `web_app.py:156-157` |
| 400 | 单张 > 10MB | `图片超过 10MB 上限` | `图片超过 10MB 上限` | `web_app.py:158-159` |
| 400 | 无法解码 | `这张文件不是可读的图片（无法解码，请确认是 JPG / PNG / BMP）` | 原文照显 | `web_app.py:160-163` |
| 400 | 批量一张都没传 | `未收到文件，请选择 1 张以上图片` | 批量区显示 `⚠ 未收到文件，请选择 1 张以上图片` | `web_app.py:229-230` |
| 413 | 请求体 > 64MB（`MAX_CONTENT_LENGTH`） | `请求体超过 64MB 上限（批量请分批上传）` | 原文照显（批量区带 `⚠ ` 前缀） | `web_app.py:52, 291-293` |
| 500 | 单图推理异常 | `推理失败：<异常文本>` | 原文照显 | `web_app.py:218-222` |
| 500 | 批量推理异常 | `批量推理失败：<异常文本>` | 原文照显 | `web_app.py:238-240` |

**换算提醒**：单张 >10MB 走的是 `read_upload` 的 ValueError → **400**；413 只在请求体总量 >64MB 时出现。两者不要混。

### 4.2 前端侧（没有 HTTP 状态码）

前端把失败分成三种 `kind`（`index.html:236-272`），只有 `network` 会重试一次（`:275-281`）：

| kind | 触发 | 页面应显示的原话 |
|---|---|---|
| `network` | `fetch` 抛 TypeError（服务没起 / 端口不对 / 连接被拒） | 错误区正文 = `无法连接本地服务。请确认那个黑色命令行窗口还开着；若已关闭，请重新双击项目根目录的 启动网页.bat。 如果窗口里打印的地址是 5001 或 5002，请用那个地址重新打开页面。`；附注 = `这一条是「页面连不上后端」，不是图片本身的问题。`；并显示「重新检测连接 / 重新打开页面」两个按钮 |
| `timeout` | `AbortController` 触发（单图/批量/抽样超时 60s） | `推理超时，请重试。`；附注 = `首次请求可能赶上模型刚加载，稍等片刻再试。` |
| `http` | 收到非 2xx | 优先显示响应体里的 `data.error`；没有则是 `服务返回 HTTP <code> · <statusText>` |

顶部状态条三态（`index.html:290-302`），只由 `/healthz` 的结果决定：

| 状态 | 文案 | 细节 |
|---|---|---|
| `ok` | `真实服务（端口 <port>）` | `模型 se_residual 已加载，识别结果为真实推理。` |
| `demo` | `演示数据（后端未连接）` | `当前是直接打开的静态页面，不能推理。` |
| `offline` | `未连接` | `后端没有响应，点「重新探活」再试。` |

注意：页面**不会自动轮询**。服务停掉后，状态条仍停在 `ok`，必须点 `#status-retry`（「重新探活」）才转 `未连接`。

---

## 5 产物约定

### 5.1 `outputs/<run>/summary.json`

网页只读其中 7 个键（`web_app.py:78-90` 用 `.get()`，缺键不崩），但训练链路写的是完整 18 个键（实测 `P2_se_residual_cosine`）：

| 键 | 类型 | 网页是否使用 | 当前值 |
|---|---|---|---|
| `run_name` | `str` | 否 | `P2_se_residual_cosine` |
| `model` | `str` | 是 → `meta["arch"]` | `se_residual` |
| `pretrained` | `bool` | 否 | — |
| `aug` | `str` | 否 | — |
| `balanced` | `bool` | 否 | — |
| `scheduler` | `str` | 否 | — |
| `label_smooth` | `float` | 否 | — |
| `img_size` | `int` | 是 | `224` |
| `batch_size` | `int` | 否 | `32` |
| `lr` | `float` | 否 | `0.0001` |
| `epochs` | `int` | 是 | `40` |
| `seed` | `int` | 是 | `42` |
| `params_M` | `float` | 是 → 页面 `params_m` | `2.799` |
| `best_val_acc` | `float` | 是 → 页面 `val_acc` | `99.16` |
| `best_epoch` | `int` | 是 | `30` |
| `final_val_acc` | `float` | 否 | `99.04` |
| `time_min` | `float` | 否 | `25.0` |
| `class_names` | `list` | 否 | 7 项 |

### 5.2 `outputs/holdout/eval_val466.csv`

UTF-8 with BOM（`utf-8-sig` 读取）。列名固定 15 列，**顺序即列名**：

```
run, arch, params_M, val836_acc, holdout_acc, delta_pp, n_holdout, errors,
recall_Apple___Apple_scab, recall_Apple___Black_rot, recall_Apple___Cedar_apple_rust,
recall_Apple___healthy, recall_Grape___Black_rot, recall_Grape___healthy,
recall_Grape___Leaf_blight_(Isariopsis_Leaf_Spot)
```

- 一个 run 一行，共 8 行。
- 网页只取 `run == "P2_se_residual_cosine"` 的那一行（`web_app.py:92-105`）。
- `val_n` 由 `val836_acc` 列名里的数字解析（`web_app.py:97-99`）——**改列名会直接让页面验证集张数变成空值**。
- P2 行实测：`val836_acc=99.16, holdout_acc=99.79, delta_pp=0.63, n_holdout=466, errors=1`。

### 5.3 `outputs/dataset_stats.json`

网页读 `class_names_cn`、`class_names_en`（`web_app.py:64-67`），顺序即类别序号 `0..6`。当前中文名：

```
0 苹果-黑星病(Scab)          4 葡萄-黑腐病(Black rot)
1 苹果-黑腐病(Black rot)     5 葡萄-健康
2 苹果-雪松锈病(Cedar apple rust)  6 葡萄-叶枯病(Leaf blight)
3 苹果-健康
```

### 5.4 run 目录名不得修改（硬规则）

`outputs/<run>/` 的目录名是**路径主键**，被三处按名字硬编码读取：

1. `code/web_app.py:38` — `RUN_NAME = "P2_se_residual_cosine"`，权重 `RUN_DIR/"best_model.pth"`、`RUN_DIR/"summary.json"`；
2. `code/eval_holdout.py` — 逐 run 读 `outputs/<run>/best_model.pth` 复评；
3. 报告生成链路按 run 名读 `summary.json` / `metrics.json` / `curves.png`。

改名后果：网页启动直接 `SystemExit`（找不到 `best_model.pth`，`web_app.py:111-113`）；holdout CSV 与报告里的数字对不上路径，复现断链。

**结论：任何情况下不要改 `outputs/` 下既有 run 目录名，也不要改 `eval_val466.csv` 的 `run` 列值。**

---

## 6 版本与变更规则

**改接口 / 改端口前先改本页，代码随后跟随；未改本页的改动视为违规。**

配套：每次改动在 `CHANGELOG.md` 加一条；验收按 `docs/ACCEPTANCE.md` 跑完对应分组才算完成。

---

## 7 代码与既有描述不一致（只记录，本轮未改代码）

> 以下 13 条均为「代码实际行为」与「注释 / 文案 / 口头描述」不一致。按用户要求**只记录，不修改**；是否修由用户决定。

| # | 现象 | 证据 | 影响 |
|---|---|---|---|
| 1 | `PESTS_PORT` 只在两个 bat 生效，`web_app.py` 只认 `--port` | `web_app.py:309-313` 无 `os.environ` 读取；`启动网页.bat:11`、`诊断自检.bat:9` | 直接 `python code/web_app.py` 时设 `PESTS_PORT` 无效 |
| 2 | 前端提示「窗口里打印的地址是 5001 或 5002，请用那个地址」暗示会自动顺延 | `index.html:229-230`；而 `check_port()` 从不顺延（`web_app.py:296-306`） | 用户可能误以为换端口是自动的；该句是历史遗留 |
| 3 | `诊断自检.bat` 只认 `PESTS_PORT`，不认 `--port`/位置参数；但第 120 行建议「运行 启动网页.bat --port 5050」 | `诊断自检.bat:8-9`、`:120` | 按提示换到 5050 后，自检脚本仍去探 5000，结论会误报「服务未运行」 |
| 4 | 「批量最多 12 张」只是前端 `files.slice(0, 12)` | `index.html:512`；后端 `/predict_batch` 无张数上限（`web_app.py:228-241`，仅 64MB 请求体） | 直接调接口可传任意张数；文档/UI 的「最多 12 张」不是接口约束 |
| 5 | 单张 >10MB 返回 **400**，不是 413 | `web_app.py:158-159`（ValueError → 400）；413 仅由 64MB 请求体触发（`:52,291-293`） | 若按「体积超限=413」写客户端分支会漏判 |
| 6 | `/healthz` 的 `port` 取自 `Host` 请求头 | `web_app.py:199, 205` | 经代理或改 Host 时返回的端口不是真实绑定端口（注释却写「运行时实际端口」） |
| 7 | `/sample` 两分支顶层键不一致：test 用 `total_in_test`，holdout 用 `total` | `web_app.py:273, 288` | 前端已分别处理（`index.html:556-557`），第三方调用方容易踩空 |
| 8 | `/predict_batch` 部分失败仍返回 **200**，失败项无 `class_cn`/`confidence`，无顶层 `error` | `web_app.py:232-241` | 调用方必须逐项判断 `ok`，不能只看 HTTP 状态 |
| 9 | 上传只按扩展名校验，不校验 Content-Type / 文件魔数 | `web_app.py:152-154`（只看 `Path(f.filename).suffix`） | 任意内容改名 `.jpg` 都能进解码环节；解码失败才 400 |
| 10 | `web_app.py:22` 注释称「相对定位，不写死盘符」，但 `code/config.py` 的 `PROJECT_ROOT` 是绝对路径 | `web_app.py:22`；`config.py` 的 `PROJECT_ROOT`；`web_app.py:33` 注释也承认「config 中的绝对路径本模块不使用」 | 仅复用 `IMG_SIZE/MEAN/STD`，web_app 本身确实不写死盘符；`config.py` 是例外 |
| 11 | `/healthz` 永远 `ok: true`，没有「模型未加载」的 false 分支 | `web_app.py:201`；`load_model()` 失败直接 `SystemExit`（`:111-113`） | 探活成功就等于模型已加载，不存在「服务在但模型坏」的中间态 |
| 12 | `启动网页.bat` 注释写「默认 5000；可用 `--port` 或 `PESTS_PORT` 覆盖」，但实际 `PESTS_PORT` 最后赋值、优先级最高，会覆盖命令行 `--port` | `启动网页.bat:7-11` | 同时给 `--port 5050` 和 `PESTS_PORT=5000` 时，最终用 5000 |
| 13 | `check_port()` 先 `SO_REUSEADDR` 再 bind：当占用方也设了 `SO_REUSEADDR` 时，Windows 允许第二次 bind 成功，冲突**不会被拦截** | `web_app.py:299-302`；实测：占用方设 `SO_REUSEADDR` 时 web_app 可持续运行 180s；占用方不设时正常 `WinError 10013` + 退出码 1 | 「占用冲突必须显式报错」在 Windows + 双方都 `SO_REUSEADDR` 的边界下不成立；bat 层的 `/healthz` 探测不受影响 |
