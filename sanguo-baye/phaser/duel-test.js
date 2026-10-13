/* 单挑系统专项测试 + 战斗节奏模拟（纯逻辑，无浏览器） */
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "js");
const src = ["data.js", "core.js"].map(f => fs.readFileSync(path.join(dir, f), "utf8")).join("\n;\n");
const { Core, DUEL, CITY, TROOP } = new Function(src + "; return {Core, DUEL, CITY, TROOP};")();

let pass = 0, fail = 0;
const ok = (cond, msg) => { if(cond){ pass++; console.log("  ✔ " + msg); } else { fail++; console.log("  ✘ " + msg); } };

const FROM = "luoyang", TO = "puyang";          // 曹操据濮阳，守将充足
let origOwner = 1, atk = [], roster = [];

function freshGame(){
  Core.chosenScen = 0;
  Core.startGame(0);
  origOwner = Core.S.cities[TO].owner;
  atk = ["吕布", "张辽", "华雄"].map(n => Core.S.gens[n]);
  roster = Object.values(Core.S.gens).filter(g => g.city === TO && g.lord === origOwner);
}

let U = null, D = null;
function setup(){
  /* 复原上一场单挑的后果：被擒归队、被斩复册、俘名单清空、城池归属还原 */
  atk.concat(roster).forEach(g => {
    if(!g) return;
    g.captured = false; g.away = false; g.troop = 1200; g.hp = 100; g.city = TO;
    if(!Core.S.gens[g.name]) Core.S.gens[g.name] = g;
  });
  Core.S.factions.forEach(f => {
    f.captives = (f.captives || []).filter(n => !(roster.some(g => g.name === n) || atk.some(g => g.name === n)));
  });
  Core.S.cities[TO].owner = origOwner;
  Core.beginBattle(FROM, TO, ["吕布", "张辽", "华雄"]);
  U = Core.battle.units.find(x => x.side === 0 && x.g.name === "吕布");
  D = Core.battle.units.find(x => x.side === 1 && !x.ghost && x.g.name !== "吕布");
  [U, D].forEach(x => {
    x.acted = false; x.dead = false; x.moved = false; x.ghost = false; x.captured = false;
    x.ghp = x.ghpMax; x.brk = 1; x.st = {}; x.buff = null;
    x.g.troop = 1200; x.g.hp = 100; x.g.captured = false;
  });
  D.x = U.x + 1; D.y = U.y;
}

console.log("【单挑资格】");
freshGame(); setup();
ok(Core.canDuel(U, D).ok, `相邻可单挑（${U.g.name} vs ${D.g.name}）`);
ok(!Core.canDuel(U, Object.assign({}, D, { x: U.x + 3 })).ok, "不相邻不可单挑");
ok(Core.duelTargets(U).length >= 1, `duelTargets 返回目标（${Core.duelTargets(U).length} 个）`);
U.acted = true;
ok(!Core.canDuel(U, D).ok, "已行动者不可发起单挑");
U.acted = false;
D.ghost = true;
ok(!Core.canDuel(U, D).ok, "无名贼军无从单挑");
D.ghost = false;

console.log("\n【单挑回合逻辑】");
const duel0 = Core.beginDuel(U, D);
ok(!!duel0 && duel0.max === DUEL.maxRound, `开单挑成功（上限 ${duel0.max} 合）`);
let r0 = Core.duelRound(duel0, "退");
ok(r0.over && duel0.res.kind === "retreat", `「脱身」立即结束（${duel0.res.kind}）`);
ok(U.acted && D.acted, "双方消耗行动");

/* 300 场满血对砍：全部终止、结果分布、败者必须退场 */
freshGame();
let kinds = { kill: 0, capture: 0, escape: 0, retreat: 0, draw: 0 };
let terminates = true, maxRounds = 0, capped = true;
for(let i = 0; i < 300; i++){
  setup();
  const du = Core.beginDuel(U, D);
  let guard = 0;
  while(!du.over && guard++ < 24){ Core.duelRound(du, "攻"); }
  if(!du.over){ terminates = false; break; }
  maxRounds = Math.max(maxRounds, Math.min(du.round - 1, du.max));
  if(du.round > du.max + 1) capped = false;
  kinds[du.res.kind] = (kinds[du.res.kind] || 0) + 1;
  const loserUnit = du.res.loser === U.g.name ? U : D;
  if((du.res.kind === "capture" || du.res.kind === "kill") && !loserUnit.dead){
    capped = false; console.log("    ! 被擒/阵斩者仍在场：" + du.res.loser);
  }
}
ok(terminates, "300 场单挑全部在有限回合内分出结果");
ok(capped && maxRounds <= DUEL.maxRound, `回合数不超上限、败者必退场（最长 ${maxRounds} 合）`);
ok(kinds.capture > 0, `出现生擒（${kinds.capture} 次）`);
console.log(`  分布：生擒 ${kinds.capture}　败逃 ${kinds.escape}　阵斩 ${kinds.kill}　脱身 ${kinds.retreat}　平手 ${kinds.draw}`);

console.log("\n【武力差距影响】");
let wins = 0;
const N = 200;
for(let i = 0; i < N; i++){
  setup();
  const du = Core.beginDuel(U, D);
  let guard = 0;
  while(!du.over && guard++ < 24){ Core.duelRound(du, "攻"); }
  if(du.res.winner === U.g.name) wins++;
}
ok(wins/N > 0.6, `吕布(112) 胜率 ${(wins/N*100).toFixed(0)}%（应明显过半）`);

console.log("\n【守备 / 必杀可改变战局】");
let dealtGuard = 0, dealtPlain = 0;
for(let i = 0; i < 120; i++){
  setup();
  const du = Core.beginDuel(U, D);
  Core.duelRound(du, "守");
  dealtGuard += U.ghpMax - U.ghp;
  setup();
  const du2 = Core.beginDuel(U, D);
  Core.duelRound(du2, "攻");
  dealtPlain += U.ghpMax - U.ghp;
}
ok(dealtGuard < dealtPlain, `守备减伤生效（守备均伤 ${(dealtGuard/120).toFixed(1)} vs 强攻均伤 ${(dealtPlain/120).toFixed(1)}）`);

console.log("\n【敌方主动搦战路径】");
let duels = 0;
freshGame();
Core.beginBattle(FROM, TO, ["吕布", "张辽", "华雄"]);
Core.battle.units.filter(x => x.side === 1).forEach(x => { x.g.f0 = 95; x.ghp = x.ghpMax = 100; });
for(let i = 0; i < 60 && !Core.battle.over; i++){
  Core.battle.units.forEach(x => { x.acted = false; x.moved = false; if(x.side === 0) x.ghp = x.ghpMax; });
  const ev = Core.enemyPhase();
  duels += ev.filter(e => e.type === "duel").length;
  Core.battle.turn = 1;                       // 阻止 30 日结束，专注测单挑路径
}
console.log(`  60 日内 AI 发起单挑 ${duels} 次`);
ok(duels > 0, "AI 猛将会主动向玩家搦战");

console.log("\n【战斗节奏模拟】100 场攻城战");
let win = 0, turns = 0, grainOut = 0;
for(let t = 0; t < 100; t++){
  freshGame();
  Core.beginBattle(FROM, TO, ["吕布", "张辽", "华雄", "李傕", "郭汜", "樊稠"]);
  const bb = Core.battle;
  let day = 0;
  while(!bb.over && day < 30){
    day++;
    bb.units.filter(x => x.side === 0 && !x.dead).forEach(x => {
      x.acted = false; x.moved = false;
      const pool = bb.units.filter(v => v.side === 1 && !v.dead);
      if(!pool.length) return;
      const tgt = pool.sort((p, q) =>
        (Math.abs(p.x - x.x) + Math.abs(p.y - x.y)) - (Math.abs(q.x - x.x) + Math.abs(q.y - x.y)))[0];
      const rng = TROOP[x.g.type].range;
      const need = Math.abs(tgt.x - x.x) + Math.abs(tgt.y - x.y) - rng;
      for(let s = 0; s < Math.max(0, Math.min(4, need)); s++){
        const dx = Math.sign(tgt.x - x.x), dy = Math.sign(tgt.y - x.y);
        const mv = Math.abs(tgt.x - x.x) > Math.abs(tgt.y - x.y) ? [dx, 0] : [0, dy];
        const nx = x.x + mv[0], ny = x.y + mv[1];
        if(nx < 0 || ny < 0 || nx >= Core.BW || ny >= Core.BH) break;
        if(bb.units.some(v => !v.dead && v !== x && v.x === nx && v.y === ny)) break;
        x.x = nx; x.y = ny;
      }
      if(Math.abs(tgt.x - x.x) + Math.abs(tgt.y - x.y) <= rng) Core.attackUnit(x, tgt);
    });
    if(bb.over) break;
    Core.enemyPhase();
    Core.checkBattleEnd();
  }
  if(bb.over && bb.attWin){ win++; turns += bb.turn; }
  else if(/粮尽/.test(bb.log[bb.log.length - 1] || "")) grainOut++;
}
console.log(`  攻方胜率 ${win}%　平均耗时 ${win ? (turns/win).toFixed(1) : "-"} 日　粮尽败退 ${grainOut} 场`);
ok(win >= 45, `攻方胜率 ${win}%（30 日内应可攻克，目标 45%~95%）`);
ok(win <= 98, `攻方胜率 ${win}%（不宜逼近必胜，保留守方压力）`);

console.log(`\n通过 ${pass} 项，失败 ${fail} 项 —— ${fail === 0 ? "全部通过 ✔" : "存在问题 ✘"}`);
process.exit(fail === 0 ? 0 : 1);
