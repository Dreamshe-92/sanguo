# GEMINI.md

本项目的权威协作说明在 **[AGENT.md](./AGENT.md)**。动手前请完整阅读。

要点：

- Phaser 3 网页复刻《三国霸业》，零构建，双击 `sanguo-baye/phaser/index.html` 即可运行。
- `js/core.js` 为纯逻辑层，禁止引用 Phaser / DOM。
- 逻辑坐标固定 1152×720，相机 zoom=2，禁止使用 `this.scale.width/height`。
- 新增 js 文件需登记到 `sanguo-baye/phaser/index.html`。
- 提交前跑 `node smoke.js` / `node strat-test.js` / `node duel-test.js`。
- 进度与数据字典见 [PROGRESS.md](./PROGRESS.md) 与 [docs/DATA.md](./docs/DATA.md)。
