/* 纯逻辑冒烟测试：60 个月结算 + AI 攻伐 + 战棋攻城 */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "js/data.js"), "utf8")
           + fs.readFileSync(path.join(__dirname, "js/core.js"), "utf8");
const { Core, CITY, TROOP } = new Function(src + "\nreturn { Core, CITY, TROOP };")();

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? "  ✔ " : "  ✘ ") + msg); if(!cond) fails++; };

// 开局
Core.chosenScen = 0;
Core.startGame(0);
ok(Object.keys(Core.S.cities).length === 38, `开局城池 38（实际 ${Object.keys(Core.S.cities).length}）`);
ok(Object.keys(Core.S.gens).length >= 140, `武将规模 ≥140（实际 ${Object.keys(Core.S.gens).length}）`);
ok(Core.allCitiesOf(0).length === 3, "董卓 3 城");

// 60 个月结算
let err = null;
try{ for(let i = 0; i < 60 && !Core.S.gameover; i++) Core.endMonth(); }
catch(e){ err = e; }
ok(!err, "60 个月结算无异常" + (err ? " — " + err.message : ""));
ok(Core.S.year >= 190, `时间推进到 ${Core.S.year} 年`);
const alive = Core.S.factions.filter(f => !f.dead).length;
ok(alive >= 1, `存活势力 ${alive} 家`);

// 若玩家已败，重开一局再做战斗测试
if(Core.allCitiesOf(Core.S.player).length === 0){ Core.chosenScen = 0; Core.startGame(0); }

// 战棋攻城（若长期饥荒导致无兵，先补充兵力）
Core.allCitiesOf(Core.S.player).forEach(cid => {
  Core.gensAt(cid, Core.S.player).forEach(g => { if(g.troop < 500) g.troop = 800 + Math.floor(Math.random()*400); });
});
const mine = Core.allCitiesOf(Core.S.player).find(c => CITY[c].adj.some(a => Core.S.cities[a].owner !== Core.S.player));
const target = CITY[mine].adj.find(a => Core.S.cities[a].owner !== Core.S.player);
const names = Core.gensAt(mine, Core.S.player).filter(g => g.troop > 0).slice(0, 3).map(g => g.name);
ok(!!target && names.length > 0, `可出征：${CITY[mine].n} → ${CITY[target].n}（${names.join("、")}）`);

err = null;
try{
  Core.beginBattle(mine, target, names);
  ok(Core.battle.units.length >= 4, `战场单位 ${Core.battle.units.length}`);
  // 自动打满 30 日
  for(let d = 0; d < 40 && !Core.battle.over; d++){
    Core.battle.units.filter(u => u.side === 0 && !u.dead).forEach(u => {
      if(u.acted) return;
      const foes = Core.battle.units.filter(v => v.side === 1 && !v.dead);
      if(!foes.length) return;
      const t = foes[0];
      if(Math.abs(u.x - t.x) + Math.abs(u.y - t.y) <= TROOP[u.g.type].range) Core.attackUnit(u, t);
      else u.acted = true;
    });
    if(Core.battle.over) break;
    Core.enemyPhase();
  }
  ok(Core.battle.over, `战斗结束（${Core.battle.log[Core.battle.log.length - 1] || ""}）`);
}catch(e){ err = e; }
ok(!err, "战棋流程无异常" + (err ? " — " + err.stack.split("\n")[0] : ""));

// 存档（Node 无 localStorage，浏览器内可用）
const hasLS = typeof localStorage !== "undefined";
if(hasLS){ ok(Core.save(), "存档成功"); ok(Core.hasSave(), "读档可用"); }
else console.log("  · Node 环境无 localStorage，跳过存档检查（浏览器内可用）");

console.log(fails === 0 ? "\n全部通过 ✔" : `\n${fails} 项失败 ✘`);
process.exit(fails ? 1 : 0);
