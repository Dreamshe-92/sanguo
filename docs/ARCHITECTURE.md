# docs/ARCHITECTURE.md — 架构说明

## 分层与依赖方向

```
data.js   ── 纯数据 + 工具函数（不依赖任何东西）
   ↓
core.js   ── 规则层：纯逻辑，禁止引用 Phaser / DOM
   ↓
art.js / ui.js / flow.js  ── 表现组件（可依赖 data，不可依赖 scene）
   ↓
scene-*.js  ── 场景组装：读 Core 状态 → 画 UI → 调 Core 指令
   ↓
main.js   ── Phaser.Game 启动配置
```

`index.html` 中的 `<script>` 顺序即依赖顺序，**新增文件必须登记到 index.html**。

## 场景流转

```
BootScene      加载程序化纹理（Art 生成）
   ↓
TitleScene     标题，读档入口
   ↓
SelectScene    剧本 → 君主 两步选择
   ↓
MapScene       大地图：城池、势力、月份结算、指令入口
   ↓  ┌──────────────────────────┐
      ↓                          ↓
CityScene                    BattleScene
城池内政/人事/外交              战棋 + 计谋 + 单挑
```

`main.js` 在启动时对所有 Scene 原型注入：

```js
S.prototype.create = function(...args){
  this.cameras.main.setZoom(RENDER_SCALE);   // = 2
  this.cameras.main.centerOn(LW/2, LH/2);
  return orig.apply(this, args);
};
```

所以场景内一律用 **逻辑坐标 0..1152 / 0..720**。

## Core 状态

| 字段 | 含义 |
|------|------|
| `Core.S` | 全局存档态：`{player, factions[], cities{}, gens{}, gold, grain, year, month}` |
| `Core.curCity` | 当前打开的城池 id |
| `Core.battle` | 战斗态（进入战斗时创建） |
| `Core.chosenScen` | 选中剧本索引 |

`Core.battle`：

```js
{ tiles, units[], weather, turn, toCid, fromCid, attGrain, log[], sel, over, attWin }
```

`battle.units[i]`：

```js
{ g,           // 武将对象引用
  side,        // 0 攻方 / 1 守方
  x, y,        // 网格坐标
  hp,          // 技力（施计消耗）
  ghp,         // 单挑体力
  moved, acted, dead, ghost, captured,
  st,          // 状态异常 {名称: 剩余回合}
  buff,        // 临时增益 {mv: n}
  main,        // 是否主将
  recon }      // 是否被侦察
```

## 事件总线

规则层只 `emit`，场景层订阅后刷新：

| 事件 | 载荷 | 订阅方 |
|------|------|--------|
| `toast` | `{msg, kind}` | Map/City/Battle |
| `refresh` | — | City（数据变了重绘） |
| `blog` | `string` | Battle（战斗日志） |
| `battlehit` | `{a, d, dmg}` | Battle（受击动画） |

## 内政 / 指令一览（core.js）

| 类别 | 方法 | 说明 |
|------|------|------|
| 内政 | `cmdKaiKen` 开垦 / `cmdZhaoShang` 招商 / `cmdZhiLi` 治理 / `cmdChuXun` 出巡 / `cmdSouSuo` 搜索 | 消耗武将行动力，提升城池数值或发现人才 |
| 军备 | `cmdZhengBing` 征兵 / `cmdFenPei` 分配 / `cmdLveDuo` 掠夺 / `cmdChuZhan` 出战 | 兵力与出征准备 |
| 人事 | `cmdYanQing` 宴请 / `cmdShangCi` 赏赐 / `cmdMeiShou` 没收 / `cmdLiuFang` 流放 | 忠诚度与道具 |
| 经济 | `cmdJiaoYi` 交易 / `cmdShuSong` 输送 / `cmdYiDong` 移动 | 钱粮与物资流转 |
| 外交 | `cmdLiJian` 离间 / `cmdZhaoLan` 招揽 / `cmdCeFan` 策反 / `cmdQuanXiang` 劝降 / `cmdZhaoXiang` 招降 | 对敌势力与武将 |
| 侦察 | `cmdRecon` | 战场情报 |
| 结算 | `endMonth` / `aiTurn` / `eliminateFaction` / `checkEnd` | 月度推进与胜负判定 |
| 存档 | `save` / `load` / `hasSave` | localStorage |

## 战斗流程

```
beginBattle(fromCid, toCid, genNames)
   → buildBattleMap()   生成 17×11 地形（城池在右侧，营寨在中）
   → 攻方从左侧入场，守方按 lord 过滤后在城周布防
   ↓
玩家回合：移动 → 攻击 / 计谋 / 单挑 → 结束回合
   ↓
enemyPhase()  AI：tickStatus → 混乱判定 → 移动 → 攻击 / 施计 / 搦战
   ↓
turn++，粮草 -= ceil(总兵力/70)
   ↓
turn > 30 且未克城 → 粮尽退兵；守方全灭 → 攻方占领
```

关键方法：`reach(u)` 可达格（含定身/奇门/buff 判定）、`terrMod(u)` 地形修正、`calcDamage(a,d)`、`useStratagem(u,name,tx,ty)`、`checkTrap(u)`、`canDuel/beginDuel/duelRound`。

## 单挑流程

```
canDuel(a, d)  相邻 + 双方非混乱/定身 + 未被俘
   ↓
beginDuel(a, d)   初始化体力池（ghp = 智力×2）
   ↓
每回合：玩家四选一 → aiDuelAct 出招 → duelDmg 结算 → 播报
   ↓
结束条件：一方体力归零 / 主动脱身 / 达 maxRound(6)
   ↓
结算：生擒(0.68) / 阵斩 / 脱身 / 平手
   ★ 生擒与阵斩都必须手动置 u.dead = true
```

## 表现层

- **art.js**：全部美术由代码生成（地形 tile、单位、武将头像用 `hash32(name)` 作种子保证稳定），仓库内无图片素材。
- **ui.js**：`UI.txt / button / panel / modal / list / bar / scroll`；`Sfx` 用 WebAudio 合成音效（无音频文件）。
- **flow.js**：`Flow.pick / confirm / ask / toast`，统一处理弹窗与选择。

## 为什么不用构建工具

目标是**双击 `index.html` 就能玩**：`file://` 协议下 ES module 会被 CORS 拦截，因此全部用全局 `<script>`；Phaser 已 vendored，无 CDN 依赖。代价是没有模块作用域，靠命名约定与加载顺序约束。
