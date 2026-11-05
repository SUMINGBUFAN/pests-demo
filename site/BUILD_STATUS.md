# BUILD_STATUS

- 阶段: 2 · 验证完成
- 时间: 2026-11-05
- 状态: done

## 已完成
- site/index.html：纯静态页，无 Jinja；顶部 sticky 诚实横幅；三指标占位由 JS 填充
- site/content.json：全部人话文案（标题/副标题/封面语/7 类中拉丁名/按钮/页脚/适用边界）
- site/assets/style.css：移动优先，零外部字体、零 CDN
- site/assets/app.js：content 注入 + 内置兜底；懒加载；来源/类别/判错筛选；文件名搜索；详情概率与真值；随机 12 张
- site/data/manifest.json 842,228 B
- site/data/snapshot_stats.json 1,551 B
- site/data/thumbs/ 1,679 张，26,752,719 B

## 体积
- site/ 合计 1,686 个文件，27,656,347 B（26.38 MB）

## 8 条验证（Playwright，http://127.0.0.1:8090/）
1. PASS 控制台 0 错误（console_error=0 pageerror=0）
2. PASS 无跨域：请求域名仅 `127.0.0.1:8090`
3. PASS 首屏 DOM 卡片 24（≥12）
4. PASS 筛选：1679 → holdout 466；1679 → 苹果黑星病 172；1679 → 只看判错 1
5. PASS 搜索 `0 (239).JPG` 命中 1 张
6. PASS `holdout:0019`：预测苹果黑腐病，真值苹果黑星病，显示「✕ 不一致」
7. PASS 390×844：html/body scrollWidth=clientWidth=390，首屏 12 卡，<44px 控件 0
8. PASS `file://`：24 张内置样例 + 离线提示 + 演示模式文案

## 附加
- 首屏首卡可交互：`performance.now` 260 ms；goto→首卡墙钟 275 ms（本地）
- 随机抽样 12 张可用；懒加载 24 → 48；test 显示「真值：未提供」；holdout 一致样本显示「✓ 一致」
