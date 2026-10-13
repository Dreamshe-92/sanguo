/* Phaser 版 E2E 冒烟测试：走通 标题→剧本→君主→地图→城池→战斗 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "shots");
if(!fs.existsSync(OUT)) fs.mkdirSync(OUT);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
  const errors = [];
  page.on("console", m => { if(m.type() === "error") errors.push("[console] " + m.text().slice(0, 200)); });
  page.on("pageerror", e => errors.push("[pageerror] " + String(e.message).slice(0, 240)));

  await page.goto("http://localhost:8157/index.html", { waitUntil: "networkidle" });
  await sleep(2500);

  // 画布坐标 → 页面坐标
  const rect = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  });
  const G = (x, y) => ({ x: rect.left + x*rect.w/1152, y: rect.top + y*rect.h/720 });
  const click = async (x, y, wait = 700) => { const p = G(x, y); await page.mouse.click(p.x, p.y); await sleep(wait); };
  const shot = n => page.screenshot({ path: path.join(OUT, n) });
  const scene = () => page.evaluate(() => game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key).join(","));

  const step = async (name) => console.log(`  · ${name} → 场景 [${await scene()}]`);

  await shot("01-title.png"); await step("标题");

  await click(576, 328); await sleep(900);           // 开始游戏
  await shot("02-scenario.png"); await step("剧本选择");

  await click(260, 170); await sleep(900);            // 剧本 1
  await shot("03-ruler.png"); await step("君主选择");

  await click(144, 124); await sleep(1800);           // 君主 1（董卓）
  await shot("04-map.png"); await step("大地图");

  // 点击己方城池（洛阳）
  const p = await page.evaluate(() => {
    const s = game.scene.getScene("Map");
    const c = CITY[Core.allCitiesOf(Core.S.player)[0]];
    return s.T(c.x, c.y);
  });
  await click(p[0], p[1], 900);
  await shot("05-map-selected.png"); await step("选中城池");

  // 结束本月
  await click(1152 - 62, 20, 1200);
  await shot("06-map-nextmonth.png"); await step("结束本月");

  // 进入城池
  await click(998, 589, 1200);
  await shot("07-city.png"); await step("城池内政");

  // 开垦（内政组第 1 项）
  await click(426, 109, 900);
  await shot("08-pick-general.png"); await step("选择将领");
  await click(576, 192, 1200);                        // 选第一名将领
  await shot("09-city-after.png"); await step("开垦完成");

  // 回到地图
  await click(1152 - 86, 23, 1200);
  await step("返回地图");

  // 直接发起一场战斗（取相邻敌城）
  const battleInfo = await page.evaluate(() => {
    const s = game.scene.getScene("Map");
    const mine = Core.allCitiesOf(Core.S.player)[0];
    const target = CITY[mine].adj.find(a => Core.S.cities[a].owner !== Core.S.player);
    if(!target) return null;
    const names = Core.gensAt(mine, Core.S.player).filter(g => g.troop > 0).slice(0, 3).map(g => g.name);
    return { from: mine, to: target, names, cityName: CITY[target].n };
  });
  if(!battleInfo){ console.log("  ! 未找到邻接敌城，跳过战斗"); }
  else {
    console.log(`  · 出征 ${battleInfo.cityName}（${battleInfo.names.join("、")}）`);
    await page.evaluate(b => game.scene.start("Battle", b), battleInfo);
    await sleep(2200);
    await shot("10-battle.png"); await step("战斗开始");

    // —— 单挑流程：把一名敌将挪到我方猛将身旁，打开单挑面板打几个回合 ——
    const duelInfo = await page.evaluate(() => {
      const s = game.scene.getScene("Battle");
      const b = Core.battle;
      if(b.over) return null;
      const u = b.units.filter(x => x.side === 0 && !x.dead).sort((p, q) => Core.gForce(q.g) - Core.gForce(p.g))[0];
      const d = b.units.find(x => x.side === 1 && !x.dead && !x.ghost);
      if(!u || !d) return null;
      u.x = clamp(d.x - 1, 0, Core.BW - 1); u.y = d.y;
      s.syncUnits();
      b.sel = u; s.refreshCmd(); s.drawMarks();
      return { name: u.g.name, foe: d.g.name, btnX: s.gx(u.x), btnY: s.gy(u.y) };
    });
    if(duelInfo){
      console.log(`  · 单挑：${duelInfo.name} → ${duelInfo.foe}`);
      await click(duelInfo.btnX, duelInfo.btnY, 500);      // 选中
      await click(342, 529, 900);                          // 「单挑」按钮
      await shot("40-duel.png"); await step("单挑面板");
      for(let i = 0; i < 4; i++){
        await click(196 + 106, 80 + 484, 700);             // 强攻（结束后按钮已禁用，点击无效）
      }
      await sleep(900);
      await shot("41-duel-result.png"); await step("单挑结果");
      await click(196 + 390, 80 + 484, 900);               // 收兵
      await shot("42-duel-after.png"); await step("单挑收兵");
    }

    // 选中第一个单位并移动
    const up = await page.evaluate(() => {
      const s = game.scene.getScene("Battle");
      const u = Core.battle.units.find(x => x.side === 0 && !x.dead);
      return { x: s.gx(u.x), y: s.gy(u.y), name: u.g.name };
    });
    await click(up.x, up.y, 600);
    await shot("11-battle-selected.png");

    // 移动到右侧一格
    const mv = await page.evaluate(() => {
      const s = game.scene.getScene("Battle");
      const u = Core.battle.sel;
      const r = Core.reach(u);
      if(!r.length) return null;
      // 选一个尽量靠右的格子
      r.sort((a, b) => b[0] - a[0]);
      const t = r[0];
      return { x: s.gx(t[0]), y: s.gy(t[1]) };
    });
    if(mv){ await click(mv.x, mv.y, 900); await shot("12-battle-moved.png"); }

    // 结束回合（右下）
    await click(862 + 98 + 44, 529, 2600);
    await shot("13-battle-enemy.png"); await step("敌方回合");

    // 打几轮
    for(let i = 0; i < 3; i++){
      const alive = await page.evaluate(() => !Core.battle.over);
      if(!alive) break;
      await click(862 + 98 + 44, 529, 2400);
    }
    await shot("14-battle-later.png"); await step("多回合后");
  }

  console.log("\n=== 错误汇总 ===");
  if(errors.length === 0) console.log("0 个错误 ✔");
  else errors.slice(0, 20).forEach(e => console.log(e));
  console.log("最终场景:", await scene());
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error("FATAL", e); process.exit(2); });
