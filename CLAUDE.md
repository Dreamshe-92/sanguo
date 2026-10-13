# CLAUDE.md

本项目的权威协作说明在 **[AGENT.md](./AGENT.md)**，请先完整阅读它再动手。

摘要（不够，去读原文）：

- 项目：网页复刻《三国霸业》，Phaser 3，零构建，`file://` 双击可玩。
- 主线代码在 `sanguo-baye/phaser/`，分层 `data → core → art/ui/flow → scenes`。
- `js/core.js` 是纯逻辑层，**不得引用 Phaser 或 DOM**（否则所有 node 测试失效）。
- 布局只用逻辑坐标 1152×720，禁止使用 `this.scale.width/height`。
- 新增 js 文件必须登记到 `phaser/index.html`。
- 改完必须跑：`node smoke.js` / `node strat-test.js` / `node duel-test.js`，UI 改动另跑 `node e2e.js`。
- 进度见 [PROGRESS.md](./PROGRESS.md)，路线图见 [docs/ROADMAP.md](./docs/ROADMAP.md)，数据字典见 [docs/DATA.md](./docs/DATA.md)。
