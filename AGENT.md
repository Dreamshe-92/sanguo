# AGENT.md — 给接手的 AI Agent / 开发者

> 这是本仓库的**唯一权威协作说明**。任何 Agent 在动手改代码前必须先读完本文件。
> 文件里写的是**事实与约束**，不是建议。与代码冲突时以代码为准，但请顺手修正本文件。

---

## 0. 一句话定位

复刻步步高电子词典《三国霸业》的**网页版战棋 + 内政模拟**，用 Phaser 3 实现，目标是在浏览器里还原原版 4 剧本 / 38 城 / 194 武将条目 + 88 在野 / 内政外交指令 / 29 计谋 / 战棋攻城 / 单挑的完整体验。

**Fun Hypothesis**：玩家爽点在于"用有限的内政行动点数把一个弱势力滚成霸业"——决策密度来自"这个月这 6 个将领的行动点该投给开垦还是征兵"，张力来自"出征只有 30 日粮草，打不下就得撤"。

---

## 1. 不可妥协的约束（违反即退回）

| # | 约束 | 原因 |
|---|------|------|
| 1 | **必须能 `file://` 双击打开直接玩** | 无构建步骤、无模块化 import、无 fetch 外部资源。Phaser 已 vendored 在 `phaser/vendor/` |
| 2 | **`Core`（js/core.js）不得引用 Phaser / DOM** | 规则层是纯逻辑，测试脚本用 `new Function(src)` 在 node 里裸跑它 |
| 3 | **逻辑坐标固定 1152×720，不得使用 `this.scale.width/height`** | 相机统一 zoom=2（RENDER_SCALE），混用会导致高清化失效、布局错位 |
| 4 | **新增 js 文件必须登记到 `phaser/index.html` 的 script 列表** | 没有打包器，漏登记 = 运行时 `undefined` |
| 5 | **任何数据/规则改动必须同步 `docs/DATA.md` 并跑测试** | 数据表是全局契约，30+ 处引用 |
| 6 | **不引入构建工具、不引入 npm 运行时依赖** | playwright 仅用于 E2E，属 devDependency |

---

## 2. 目录地图

```
sanguo-baye/
├── index.html              # 早期单文件版（黑白/彩色像素），保留作为对照产物
├── phaser/                 # ★ 当前主线：Phaser 3 高清像素版
│   ├── index.html          # 入口，script 加载顺序即依赖顺序
│   ├── vendor/phaser.min.js# Phaser 3.80.1（离线内置，勿改勿升）
│   ├── js/
│   │   ├── data.js         # 纯数据：CITY/TROOP/TERRAIN/STRATAGEM/STATUS/DUEL/ITEMS/SCENARIOS/PAL + 工具函数
│   │   ├── core.js         # ★ 规则层：内政指令 / 月度结算 / AI / 战棋 / 计谋 / 单挑
│   │   ├── art.js          # 程序化像素绘制（地形、单位、头像），无外部美术资源
│   │   ├── ui.js           # 通用 UI 组件（txt/button/panel/modal/list/bar）+ WebAudio 音效 Sfx
│   │   ├── flow.js         # 流程控制：toast / 选择弹窗 / 确认框
│   │   ├── scene-*.js      # 六个场景：boot → title → select → map → city → battle
│   │   └── main.js         # Phaser.Game 配置 + 全局相机 zoom 注入
│   ├── smoke.js            # 逻辑冒烟：60 月内政 + 30 日战棋
│   ├── strat-test.js       # 计谋 / 状态异常专项（20 项）
│   ├── duel-test.js        # 单挑专项 + 战斗节奏蒙特卡洛（100 场）
│   ├── e2e.js              # Playwright 端到端 + 截图
│   └── shots/              # 验证截图（README 引用）
└── research/               # 原版逆向资料（大件在 research-assets 分支，见 §9 版权说明）
```

---

## 3. 分支策略

| 分支 | 内容 | 说明 |
|------|------|------|
| `main` | 游戏本体 + 全部文档 + research 轻量资料（约 6MB） | **默认分支，日常开发在这里** |
| `research-assets` | `sanguo-baye/research/baye-sanguo/`，第三方解包原版工程（约 118MB） | 只读资料分支，不参与开发；首次克隆不需要它 |

`main` 的 `.gitignore` 里排除了 `sanguo-baye/research/baye-sanguo/`，所以该目录只在 `research-assets` 分支上存在。
**改游戏代码只在 `main` 上做**；需要查原版资料时 `git checkout research-assets -- <path>` 取单文件即可，不必切分支。

## 4. 架构分层与依赖方向

```
data.js  ──────────────────────────────┐  (被所有人依赖，不依赖任何人)
   │                                   │
core.js  (纯逻辑 + 事件总线)  ─────────┤
   │                                   │
art.js / ui.js / flow.js  (表现组件) ──┤
   │                                   │
scene-*.js  (组装：读 Core 状态 → 画 UI → 调 Core 指令)
   │
main.js  (启动)
```

**依赖只能向下。** 典型错误：在 `core.js` 里调 `UI.toast()`（应该用 `this.emit("toast", {...})`）、在 `data.js` 里引用 `Core`（应该把常量提到 data）。

### 事件总线（`Core.on` / `Core.emit`）
场景层订阅，规则层只管发：

| 事件 | 载荷 | 用途 |
|------|------|------|
| `toast` | `{msg, kind}` | 提示条 |
| `refresh` | — | 城池/地图数据变了，UI 重绘 |
| `blog` | `string` | 战斗日志新增一行 |
| `battlehit` | `{a, d, dmg}` | 战场受击，播动画 |

### 全局对象速查
| 对象 | 位置 | 职责 |
|------|------|------|
| `Core` | core.js | 全部游戏规则与状态（`Core.S` 存档态、`Core.battle` 战斗态） |
| `UI` | ui.js | `UI.txt/button/panel/modal/list/bar/scroll` |
| `Art` | art.js | `Art.tile/unit/face(...)` 程序化像素纹理 |
| `Flow` | flow.js | `Flow.pick/confirm/ask/toast` |
| `Sfx` | ui.js | WebAudio 合成音效，`Sfx.click/no/hit/die` |
| `PAL` | data.js | 配色常量（`PAL.gold/green/red/...`） |

---

## 5. 坐标系（最容易踩的坑）

- **逻辑画布**：`LW=1152, LH=720`（data.js 末尾）
- **实际画布**：`LW*RENDER_SCALE × LH*RENDER_SCALE = 2304×1440`
- **相机**：每个场景 `create` 时自动 `setZoom(2)` + `centerOn(LW/2, LH/2)`（main.js 里对 Scene 原型做了注入）
- 所以：**写布局只用逻辑坐标 0..1152 / 0..720**，绝对不要读 `this.scale.width`。
- **战场格子**：`Core.BW=17, Core.BH=11`；格子逻辑边长 `Art.TILE_L=20`，实际绘制 40px（`Art.SC=2`）。

---

## 6. 数据契约（改之前先看 `docs/DATA.md`）

`data.js` 里的表都是全局常量，字段是隐式契约：

- `CITIES`（数组）→ `CITY`（id→对象映射，**运行时查城一律用 `CITY`**）
  - 元素形如 `[id, 名称, x, y, [邻接id...]]`
- `TROOP`：兵种 `{atk, mp, range, ...}`，键为 `"步"/"弓"/"骑"/"水"/"极"/"玄"`
- `TERRAIN`：数组，索引即战场 tile 值；含 `defMod`（地形减伤）、`bad`（不利兵种）
- `STRATAGEM`：29 计谋，`{lv, mp, rng, dmg, heal, status, trap, buff, weather, intel, vs, troop, needTerrain, needRiver, banWeather, desc}`
- `STATUS`：6 种状态异常（混乱/禁咒/定身/燃烧/奇门/潜踪）
- `DUEL`：单挑参数（回合上限、体力、行动伤害系数等）
- `SCENARIOS`：4 剧本，含势力/城池/武将初始配置

**武将对象 `g`** 的关键字段：`name, lord, city, f0, i0, lv, troop, hp, type, items, away, acted, captured`。
派生值一律走 `Core` 的方法，不要手算：
`Core.gForce(g)` / `Core.gIntel(g)` / `Core.maxTroop(g)` / `Core.genItemBonus(g)`。

---

## 7. 已知坑位清单（血泪，别重蹈）

1. **Phaser `GeometryMask` 不随容器变换**——计谋面板的列表遮罩必须把 shape 留在场景根，并在 `clamp/reflow` 里手动 `syncMask()` 同步世界坐标。直接 setMask 会被裁一半。
2. **列表行在可视区外仍可点击**，会挡住下层按钮 → `ui.js` 的 `hitOK/syncHits` + `row._hit` 会禁用越界行的 `input.enabled`。新增列表必须接入。
3. **10~12px 中文小字下缘被裁** → `UI.txt` 统一加了 `padding:{x:1,y:4}`。别在别处裸调 `scene.add.text`。
4. **`captureGen()` 不会置 `dead`**——单挑/战斗里生擒单位必须手动 `u.dead = true`，否则被擒的武将还站在场上。
5. **出征前必须筛"有带兵将领的己方邻接城"**，空城静默失败会让玩家以为按钮坏了（scene-map.js `doAttackTo/doAttack`）。
6. **`beginBattle` 的守方名单要按 `lord` 过滤**，否则同一武将可能同时出现在攻守两侧。
7. **布设类计谋**（陷阱等）`target` 判定要包含 `st.trap`，否则 `useStratagem` 找不到目标而无法施放。
8. **测试里的战场状态要手动复位**（`acted/dead/ghost/captured/ghp/brk/st`），否则上一轮的俘虏状态会污染下一轮，产生假失败。
9. `duel-test.js` 的节奏模拟是蒙特卡洛，**允许随机波动**；断言区间是 45%~96%，不要因为一次 43% 就去调数值。

---

## 8. 修改纪律（每次提交都要做到）

```bash
cd sanguo-baye/phaser

# ① 语法检查（无构建，用 node 兜底）
node -e "new Function(require('fs').readFileSync('js/core.js','utf8'))"

# ② 逻辑测试（必须全绿）
node smoke.js        # 60 月内政 + 30 日战棋
node strat-test.js   # 计谋 / 状态异常 20 项
node duel-test.js    # 单挑 + 100 场节奏模拟

# ③ E2E（需先起本地服务，端口见 e2e.js 顶部）
python -m http.server 8157
node e2e.js          # 走通 标题→剧本→君主→地图→城池→开垦→出征→战斗→计谋→单挑，0 console 错误
```

**提交信息格式**：`[模块] 动词：一句话说明`，例如 `[battle] 修复单挑生擒后单位未移除`。
**改数据必改文档**：动 `data.js` 就要同步 `docs/DATA.md` 和 `PROGRESS.md` 的"数值口径"一节。

---

## 9. 版权与合规

- 本项目是**学习性质的复刻**，不是官方产品。
- `research/` 内含第三方解包的原版工程、ROM 派生数据与字体，**仅用于逆向研究**。
- 不得将本仓库内容用于商业分发；收到权利人通知应立即移除相关资源。
- 新增代码必须是**自研实现**，不要从商业 ROM 里直接搬运美术/音频二进制。

---

## 10. 当前进度

见 **`PROGRESS.md`**（已完成 / 进行中 / 未实现 / 已知问题），以及 **`docs/ROADMAP.md`**（下一步优先级排序）。
**开工前先看这两个文件**，避免重复劳动或改到别人正在动的地方。

---

## 11. 交叉引用

- 架构细节与场景流转 → `docs/ARCHITECTURE.md`
- 数据表字段字典 → `docs/DATA.md`
- 测试与验证流程 → `docs/TESTING.md`
- 进度与路线图 → `PROGRESS.md` / `docs/ROADMAP.md`
- 面向人类的介绍 → `README.md`
