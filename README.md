# 农作物叶片病虫害识别（7 类 · 结构/增强/调度/数据消融）

一句话定位：在课程 `Pests_dataset`（苹果、葡萄 2 种作物 7 类叶片）上，用一条统一的训练/评估链路跑 16 组对照实验，产出可复现的准确率、单因素消融表与 13 页课堂实验报告。

## 目录结构（两级）

```
病虫害\
├─ README.md
├─ data\
│  └─ Pests_dataset\{Train, val, test}      原始数据（只读）
├─ code\
│  ├─ train.py  eval_holdout.py  evaluate.py  summarize.py
│  ├─ models.py  datasets.py  engine.py  config.py  io_utils.py  visualize.py
│  ├─ build_report.py  report_content.py  render_snippet.py
│  ├─ web_app.py  test.py  prepare_data.py  print_struct.py  run_extra.py
│  ├─ analysis\  static\  templates\  report_src\
│  └─ legacy\                               旧流水线（14 个脚本 + runs\）
├─ outputs\
│  ├─ E1_simple_baseline\  E2_resnet18_pretrained\  … P6_small_none_cos40\   19 个目录（16 组实验 + smoke/analysis/holdout）
│  ├─ figures\                              数据集图与旧流水线图表
│  └─ ablation_table.md  summary_table.md  dataset_stats.json  log_*.txt …
├─ docs\
│  ├─ 文件引用地图.md  文件清单.md  _proj_doc.txt  _template.txt
└─ 交付物\
   ├─ 课堂实验报告-25003130516-庄锦泰.docx / .pdf
   └─ 答辩速查.md / .html
```

## 快速开始

前置：Windows + Python（torch/torchvision、flask、python-docx、PyMuPDF）；数据位于 `data\Pests_dataset\`。

### 1. 训练一个 run

```powershell
python code\train.py --model simple --run-name E1_simple_baseline
```

产物先写入 `outputs\_current_run\`（`summary.json` / `best_model.pth` / `metrics.json` / `curves.png`），
训练结束后归档：

```powershell
New-Item -ItemType Directory -Force outputs\E1_simple_baseline | Out-Null
Move-Item outputs\_current_run\* outputs\E1_simple_baseline\
```

完整 16 组实验矩阵见 `code\legacy\run_all.sh`（bash）。

### 2. 独立 holdout 复评（val 466 张）

```powershell
python code\eval_holdout.py
```

逐 run 读 `outputs\<run>\best_model.pth` 复评，CSV 写入 `outputs\holdout\eval_val466.csv`。

### 3. 启动网页演示

```powershell
python code\web_app.py
```

浏览器打开 `http://127.0.0.1:5000`（端口被占用时加 `--port 5001`）。

### 4. 重建报告

```powershell
python code\build_report.py
```

生成 `交付物\课堂实验报告-25003130516-庄锦泰.docx`；再导出 PDF：

```powershell
$word=New-Object -ComObject Word.Application; $word.Visible=$false
$doc="C:\Users\14207\Desktop\病虫害\交付物\课堂实验报告-25003130516-庄锦泰.docx"
$pdf="C:\Users\14207\Desktop\病虫害\交付物\课堂实验报告-25003130516-庄锦泰.pdf"
$d=$word.Documents.Open($doc,$false,$true); $d.ExportAsFixedFormat($pdf,17)
$d.Close($false); $word.Quit()
```

## 数据来源与规模

- 课程提供的 `Pests_dataset.zip`：苹果、葡萄 2 种作物，7 类叶片（苹果黑星病、苹果黑腐病、苹果雪松锈病、苹果健康、葡萄黑腐病、葡萄健康、葡萄叶枯病）。
- Train **4173** 张（带标签）；val **466** 张（带标签，主链路训练期验证集）；test **1213** 张（无标签）。
- val 466 与 Train 无 MD5 重叠，故另作独立 holdout 复评（P2 在 val 836 上 99.16%，在 holdout 466 上 99.79%）。

## 已知限制

1. **单 seed，不可判小于 1 张图的差值**：val 836 张上 1 张 = 0.12pp，SE 模块的 −0.12pp 正好落在分辨率内，只能写「未带来可测收益」，不能写负贡献；要判方向至少需 3–5 个 seed。
2. **只覆盖 7 类**：小类样本极少（雪松锈 val 仅 22 张，1 张 = 4.55pp），跨作物、跨病种泛化未验证。
3. **Grad-CAM 是事后解释**：热区落在叶片上但块状弥散，只能说明「决策依据来自叶片纹理/色泽」，不等于定位到病斑，也不构成因果归因。

## 流程纪律（新增入口）

- 一键冒烟：`python tools\smoke_test.py`（退出码 0 才算通过；优先 Playwright，未安装则自动退化到 HTTP 级并打印退化说明）。
- 改接口/端口前先读 `docs\CONTRACT.md`，验收照 `docs\ACCEPTANCE.md` 跑，变更写进 `CHANGELOG.md`（每改一次加一条）。
