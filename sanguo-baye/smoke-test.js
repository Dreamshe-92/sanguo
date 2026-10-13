// 三国霸业 无头冒烟测试：stub DOM，把测试代码拼进脚本作用域执行
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

function stubEl() {
  return {
    classList: { add(){}, remove(){}, contains(){ return false; } },
    innerHTML: "", style: {}, scrollTop: 0,
    appendChild(){}, setAttribute(){}, addEventListener(){},
    getBoundingClientRect(){ return {left:0,top:0,width:612,height:396}; },
    getContext(){ return new Proxy({}, { get:(t,k)=> (k==="canvas"? {} : ()=>{}), set:()=>true }); },
    toDataURL(){ return "data:image/png;base64,STUB"; },
    width: 48, height: 48,
    onclick: null
  };
}
global.document = {
  getElementById(id){ return els[id] || (els[id]=stubEl()); },
  querySelectorAll(){ return []; },
  createElement(){ return stubEl(); },
  createElementNS(){ return stubEl(); }
};
const els = {};
global.window = global;
global.localStorage = { getItem(){ return null; }, setItem(){}, };
global.alert = m => { throw new Error("ALERT: " + m); };
global.confirm = () => true;
global.setTimeout = () => {};

const test = `
;(function(){
  // ---- 测试 1：开局 ----
  chosenScen = 0;
  startGame(5); // 选袁绍
  console.log("T1 开局 OK：", S.factions[S.player].lord, "城:", allCitiesOf(S.player).join(","));

  // ---- 测试 2：月度循环 60 个月 ----
  for (let i = 0; i < 60; i++) endMonth();
  console.log("T2 60个月结算 OK：", S.year + "年" + S.month + "月",
    "我方城数:", allCitiesOf(S.player).length, "gameover:", S.gameover);

  // ---- 测试 3：出征战斗（自动推演）----
  if (!S.gameover) {
    const mine = allCitiesOf(S.player);
    const from = mine[0];
    const target = CITY[from].adj.find(a => S.cities[a].owner !== S.player);
    if (target) {
      const gs = gensAt(from, S.player).filter(g => g.troop > 0);
      gs.forEach(g => g.troop = Math.min(g.troop, 3000));
      S.cities[from].grain = 60000;
      beginBattle(from, target, gs.slice(0, 6).map(g => g.name), false);
      console.log("T3 战斗开始：", target, "单位数:", battle.units.length, "天气:", battle.weather);
      let guard = 0;
      while (battle && !battle.over && guard++ < 200) {
        battle.units.filter(u => u.side === 0 && !u.dead).forEach(u => {
          const e = battle.units.find(v => v.side === 1 && !v.dead);
          if (e) attackUnit(u, e);
        });
        if (battle && !battle.over) enemyPhase();
        battle && battle.units.filter(u => u.side === 0 && !u.dead).forEach(u => { u.acted = false; });
      }
      console.log("T3 战斗结束：守城归属:", S.cities[target].owner, "(" + lordName(S.cities[target].owner) + ")");
    } else console.log("T3 跳过：无相邻敌城");
  }

  // ---- 测试 4：数值边界 ----
  console.log("T4 各势力:", S.factions.map((f, i) => i + ":" + f.lord + (f.dead ? "(亡)" : "(" + allCitiesOf(i).length + "城)")).join(" "));
  const g0 = Object.values(S.gens)[0];
  console.log("T4 带兵上限:", g0.name, "maxTroop=", maxTroop(g0), "(武" + gForce(g0) + "智" + gIntel(g0) + "级" + g0.lv + ")");
  console.log("ALL SMOKE TESTS PASSED");
})();
`;
try { eval(src + test); } catch (e) { console.error("TEST FAILED:", e); process.exit(1); }
