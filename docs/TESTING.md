# docs/TESTING.md — 测试与验证

> 没有构建工具，测试全部是 node 直跑的脚本；E2E 需要本地 HTTP 服务。

## 命令

```bash
cd sanguo-baye/phaser

# ① 语法检查（改完立刻跑，无打包器兜底）
node -e "new Function(require('fs').readFileSync('js/core.js','utf8'))"

# ② 逻辑测试
node smoke.js        # 60 月内政推进 + 30 日战棋，检查不崩、状态自洽
node strat-test.js   # 计谋与状态异常专项（20 项）
node duel-test.js    # 单挑专项 + 100 场战斗节奏蒙特卡洛

# ③ E2E（需先起服务）
python -m http.server 8157
node e2e.js          # Playwright：标题→剧本→君主→地图→城池→开垦→出征→战斗→计谋→单挑
```

E2E 依赖 `playwright`（devDependency）。若 `node_modules` 缺失，在 `sanguo-baye/` 下 `npm i`。

## 测试怎么写

逻辑测试用 `new Function` 把源码当字符串求值，绕过浏览器环境：

```js
const fs = require('fs');
const src = ['js/data.js','js/core.js'].map(f => fs.readFileSync(f,'utf8')).join('\n;\n');
const { Core, CITY, TROOP } = new Function(src + '; return {Core, CITY, TROOP};')();
```

因为 `core.js` 不碰 DOM/Phaser，这套办法成立。**一旦在 core.js 里用了 Phaser API，所有逻辑测试当场失效**——这是 §1 约束 2 存在的理由。

## 各测试覆盖什么

| 脚本 | 覆盖 | 关键断言 |
|------|------|----------|
| `smoke.js` | 内政长跑 + 战棋 | 60 月不抛异常、势力不消失、30 日战斗收敛 |
| `strat-test.js` | 29 计谋 + 6 状态 | 伤害生效、状态施加/递减、陷阱触发、治疗、天气限制、AI 施计 |
| `duel-test.js` | 单挑 + 节奏 | 有限回合终止、回合不超上限、生擒/败者离场、AI 搦战路径、攻方胜率 45%~96% |
| `e2e.js` | 端到端交互 | 全流程点击可达、0 console 错误、产出 `shots/*.png` |

## 写测试的两个纪律

1. **每轮循环复位战场状态**：`acted / dead / ghost / captured / ghp / brk / st`，否则上一轮的俘虏状态污染下一轮，产生假失败（踩过，见 AGENT.md §6-8）。
2. **蒙特卡洛断言给区间不给点**：`duel-test.js` 的胜率断言是 45%~96% 区间，单次越界先复跑 2~3 次再改数值。

## 截图即验证

`shots/` 下的截图是回归基线：

| 截图 | 场景 |
|------|------|
| `01-title.png` | 标题 |
| `04-map.png` | 大地图 |
| `07-city.png` | 城池内政 |
| `10-battle.png` / `12-battle-moved.png` | 战棋 |
| `30-stratagem.png` | 计谋面板 |
| `40-duel.png` / `41-duel-result.png` | 单挑 |
| `hd-title.png` | 高清化对照 |

改 UI 后重跑 E2E，对比截图确认没有布局退化。
