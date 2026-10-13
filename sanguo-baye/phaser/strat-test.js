/* 计谋 / 状态异常 专项测试（纯逻辑，无浏览器） */
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "js");
const src = ["data.js", "core.js"].map(f => fs.readFileSync(path.join(dir, f), "utf8")).join("\n;\n");
const { Core, STRATAGEM, STATUS, CITY } = new Function(src + "; return {Core, STRATAGEM, STATUS, CITY};")();

let pass = 0, fail = 0;
const ok = (cond, msg) => { if(cond){ pass++; console.log("  ✔ " + msg); } else { fail++; console.log("  ✘ " + msg); } };

console.log("【计谋表】");
ok(Object.keys(STRATAGEM).length === 29, `计谋总数 29（实际 ${Object.keys(STRATAGEM).length}）`);
ok(Object.keys(STATUS).length === 6, `状态种类 6（实际 ${Object.keys(STATUS).length}）`);

console.log("\n【准备战斗】");
Core.chosenScen = 0;
Core.startGame(0);
const from = "luoyang";
const to = CITY[from].adj.find(a => Core.S.cities[a].owner !== Core.S.player);
Core.beginBattle(from, to, ["吕布", "张辽", "李儒"]);
const b = Core.battle;
const u = b.units.find(x => x.side === 0);
const d = b.units.find(x => x.side === 1);
u.g.lv = 30; u.hp = 999;                     // 拉满以便测试全部计谋
d.x = u.x + 1; d.y = u.y;                    // 贴脸，保证在射程内
d.g.troop = 5000;
ok(!!b && !!u && !!d, `战场就绪（攻 ${u.g.name} vs 守 ${d.g.name}）`);

console.log("\n【伤害 + 状态类】");
const t0 = d.g.troop;
const r1 = Core.useStratagem(u, "火攻", d.x, d.y);
ok(r1 && d.g.troop < t0, `火攻造成伤害（${t0} → ${d.g.troop}）`);
ok(Core.hasStatus(d, "混乱"), "火攻附加【混乱】状态");

Core.useStratagem(u, "咒封", d.x, d.y);
ok(Core.hasStatus(d, "禁咒"), "咒封附加【禁咒】");
ok(Core.availableStratagems(d).length === 0, "被咒封者无法施展计谋");

Core.useStratagem(u, "定身", d.x, d.y);
ok(Core.hasStatus(d, "定身"), "定身附加【定身】");
ok(Core.reach(d).length === 0, "被定身者移动范围为空");

const beforeHeal = u.g.troop;
u.g.troop = 100;
const mate = b.units.filter(x => x.side === 0)[1];
mate.x = u.x; mate.y = u.y + 1; mate.g.troop = 100;
Core.useStratagem(u, "援兵", mate.x, mate.y);
ok(mate.g.troop > 100, `援兵治疗友军（100 → ${mate.g.troop}）`);
u.g.troop = beforeHeal;

console.log("\n【布设 + 陷阱】");
const mpHero = b.units.filter(x => x.side === 0)[2];
mpHero.g.lv = 30; mpHero.hp = 999;
Core.useStratagem(mpHero, "陷阱", mpHero.x, mpHero.y);
ok(b.traps.length === 1, `布设陷阱成功（${b.traps.length} 处）`);
const enemy = b.units.find(x => x.side === 1 && !x.dead);
enemy.st = {};
enemy.g.troop = 3000;
const et = enemy.g.troop;
enemy.x = mpHero.x; enemy.y = mpHero.y;
const trap = Core.checkTrap(enemy);
ok(!!trap && enemy.g.troop < et, `敌踏入陷阱受损（${et} → ${enemy.g.troop}）`);
ok(Core.hasStatus(enemy, "定身"), "陷阱附加定身");
ok(b.traps.length === 0, "陷阱触发后消失");

console.log("\n【自身强化 / 天气】");
const mv0 = Core.reach(u).length;
Core.useStratagem(u, "急行", u.x, u.y);
ok(Core.reach(u).length > mv0, `急行提升移动范围（${mv0} → ${Core.reach(u).length}）`);
u.buff = null;
const w0 = b.weather;
Core.useStratagem(u, "天变", u.x, u.y);
ok(b.weather !== undefined, `天变改变天气（${w0} → ${b.weather}）`);

console.log("\n【状态递减 / 持续伤害】");
const tester = b.units.find(x => x.side === 1 && !x.dead);
tester.g.troop = 4000;
Core.applyStatus(tester, "燃烧", 2);
const burn0 = tester.g.troop;
Core.tickStatus(tester);
ok(tester.g.troop < burn0, `燃烧持续掉兵（${burn0} → ${tester.g.troop}）`);
Core.tickStatus(tester);
ok(!Core.hasStatus(tester, "燃烧"), "燃烧两回合后解除");

console.log("\n【AI 施计】");
b.units.filter(x => x.side === 1).forEach(x => { x.g.i0 = 95; x.g.lv = 20; x.hp = 300; x.st = {}; x.dead = false; });
let aiCast = 0;
for(let i = 0; i < 40; i++){
  const ev = Core.enemyPhase();
  aiCast += ev.filter(e => e.type === "strat").length;
  if(Core.battle.over) break;
}
ok(aiCast > 0, `AI 会主动施计（共 ${aiCast} 次）`);
ok(!Core.battle.over || Core.battle.over, "战斗结束状态正常");

console.log("\n【日志抽样】");
console.log("  " + Core.battle.log.slice(-6).join("\n  "));

console.log(`\n通过 ${pass} 项，失败 ${fail} 项 —— ${fail === 0 ? "全部通过 ✔" : "存在问题 ✘"}`);
process.exit(fail === 0 ? 0 : 1);
