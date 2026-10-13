/* ================= 战棋战斗场景 ================= */
"use strict";

class BattleScene extends Phaser.Scene {
  constructor(){ super("Battle"); }

  init(data){
    this.from = data.from; this.to = data.to; this.names = data.names;
    this.TS = 40;
    this.GX = 236; this.GY = 52;
    this.mode = "move";
    this.busy = false;
  }

  create(){
    const W = LW, H = LH;
    if(!Core.battle || Core.battle.toCid !== this.to) Core.beginBattle(this.from, this.to, this.names);
    const b = Core.battle;
    this.GW = Core.BW*this.TS; this.GH = Core.BH*this.TS;

    const bg = this.add.graphics();
    for(let y = 0; y < H; y += 6){ bg.fillStyle(y % 12 === 0 ? 0x2a2418 : 0x221d14, 1); bg.fillRect(0, y, W, 6); }

    this.buildHud();
    this.buildGrid();
    this.buildUnits();
    this.buildPanels();
    this.buildCmdBar();
    this.buildLog();
    this.updateWeatherFx();

    this.input.on("pointerdown", p => this.onGridClick(p));

    this._onBlog = () => this.refreshLog();
    this._onOver = r => this.onBattleOver(r);
    this._onToast = d => UI.toast(this, d.msg, d.kind);
    Core.on("blog", this._onBlog).on("battleover", this._onOver).on("toast", this._onToast);
    this.events.once("shutdown", () => {
      ["blog","battleover","toast"].forEach(k => Core._ev[k] = (Core._ev[k] || []).filter(f => f !== this["_on" + k[0].toUpperCase() + k.slice(1)]));
    });

    this.refreshLog();
    this.playerPhase();
  }

  /* ---------------- 顶部 HUD ---------------- */
  buildHud(){
    const W = LW, b = Core.battle;
    UI.panel(this, 0, 0, W, 42, { fill: PAL.parch2, notch: false });
    this.add.graphics().fillStyle(PAL.gold, 1).fillRect(0, 40, W, 2);
    this.hudText = UI.txt(this, 14, 12, "", 15, "#241a12");
    this.hudRight = UI.txt(this, W - 14, 12, "", 15, "#241a12", { ox: 1 });
    this.refreshHud();
  }
  refreshHud(){
    const b = Core.battle;
    const wIcon = { "晴":"☀", "阴":"☁", "雨":"☂", "大风":"≋", "冰雹":"❄" }[b.weather] || "";
    this.hudText.setText(`进攻 ${Core.lordName(b.attackerLord)}　⚔　防守 ${Core.lordName(Core.S.cities[b.toCid].owner)}`);
    const eat = Math.ceil(b.units.filter(u => u.side === 0 && !u.dead).reduce((a, u) => a + u.g.troop, 0)/70);
    const days = eat > 0 ? Math.floor(Math.max(0, b.attGrain)/eat) : 30;
    this.hudRight.setText(`${wIcon} ${b.weather}　第 ${b.turn}/30 日　粮草 ${Math.max(0, b.attGrain)}（约支 ${Math.min(30, days)} 日）`);
  }

  /* ---------------- 战场网格 ---------------- */
  buildGrid(){
    const b = Core.battle;
    this.add.rectangle(this.GX - 4, this.GY - 4, this.GW + 8, this.GH + 8, 0x14100c).setOrigin(0);
    this.tileSprites = [];
    for(let y = 0; y < Core.BH; y++){
      this.tileSprites.push([]);
      for(let x = 0; x < Core.BW; x++){
        const s = this.add.sprite(this.GX + x*this.TS, this.GY + y*this.TS, "t" + b.tiles[y][x]).setOrigin(0).setDepth(0);
        this.tileSprites[y].push(s);
      }
    }
    this.markLayer = this.add.graphics().setDepth(6);
    this.weatherTint = this.add.rectangle(this.GX, this.GY, this.GW, this.GH, 0xffffff, 0).setOrigin(0).setDepth(8);
    // 网格点击区
    this.gridZone = this.add.zone(this.GX, this.GY, this.GW, this.GH).setOrigin(0).setInteractive();
  }

  buildUnits(){
    const b = Core.battle;
    this.unitLayer = this.add.container(0, 0).setDepth(10);
    b.units.forEach(u => {
      const c = this.add.container(this.gx(u.x), this.gy(u.y));
      const plate = this.add.graphics();
      const pc = u.side === 0 ? 0x2f5f9e : 0xa83232;
      plate.fillStyle(0x14100c, 0.45); plate.fillRect(-16, 12, 32, 8);
      plate.fillStyle(pc, 1); plate.fillRect(-15, 13, 30, 6);
      c.add(plate);
      const spr = this.add.sprite(0, 0, "u_" + u.g.type + "_" + u.side).setDisplaySize(38, 38);
      c.add(spr);
      const bar = this.add.graphics();
      c.add(bar);
      const label = UI.txt(this, 0, -20, u.g.name.slice(0, 3), 9, "#ffffff", { ox: 0.5, shadow: false });
      label.setStroke("#14100c", 3);
      c.add(label);
      u.sprite = c; u.barG = bar; u.spr = spr; u.label = label;
      this.unitLayer.add(c);
      this.updateUnitBar(u);
    });
  }
  gx(x){ return this.GX + x*this.TS + this.TS/2; }
  gy(y){ return this.GY + y*this.TS + this.TS/2; }
  updateUnitBar(u){
    if(!u.barG) return;
    u.barG.clear();
    const maxT = Math.max(1, Core.maxTroop(u.g));
    const r = clamp(u.g.troop/maxT, 0, 1);
    u.barG.fillStyle(0x14100c, 1); u.barG.fillRect(-15, -19, 30, 4);
    u.barG.fillStyle(u.side === 0 ? 0x4ac94a : 0xe05a4a, 1); u.barG.fillRect(-14, -18, 28*r, 2);
    /* 体力条（单挑 / 鏖战消耗），金色细条 */
    if(u.ghp != null){
      const gr = clamp(u.ghp/(u.ghpMax || 100), 0, 1);
      u.barG.fillStyle(0x14100c, 1); u.barG.fillRect(-15, -14, 30, 4);
      u.barG.fillStyle(PAL.gold, 1); u.barG.fillRect(-14, -13, 28*gr, 2);
    }
    const sts = Core.statusList(u);
    sts.forEach((k, i) => {
      const def = STATUS[k]; if(!def) return;
      u.barG.fillStyle(0x14100c, 1); u.barG.fillRect(-15 + i*9, 7, 8, 8);
      u.barG.fillStyle(parseInt(def.css.slice(1), 16), 1); u.barG.fillRect(-14 + i*9, 8, 6, 6);
    });
  }

  /* ---------------- 左右面板 ---------------- */
  buildPanels(){
    UI.panel(this, 8, 52, 220, this.GH, { fill: PAL.parch });
    UI.panel(this, 924, 52, 220, this.GH, { fill: PAL.parch });
    const L = this.add.container(8, 52), R = this.add.container(924, 52);
    L.add(UI.txt(this, 14, 10, "攻 方 部 队", 16, "#2f5f9e"));
    L.add(this.add.graphics().fillStyle(PAL.gold, 1).fillRect(14, 32, 192, 2));
    R.add(UI.txt(this, 14, 10, "守 方 部 队", 16, "#a83232"));
    R.add(this.add.graphics().fillStyle(PAL.gold, 1).fillRect(14, 32, 192, 2));

    let ly = 42, ry = 42;
    const cap = 6;                                   // 面板最多显示 6 行（超出折叠，为下方信息区留空间）
    Core.battle.units.forEach(u => {
      const side = u.side, p = side === 0 ? L : R;
      let y = side === 0 ? ly : ry;
      const n = Core.battle.units.filter(v => v.side === side).length;
      if(side === 0 ? ly > 42 + (cap - 1)*36 : ry > 42 + (cap - 1)*36){
        y = 42 + (cap - 1)*36;
        if(!p._more){ p._more = UI.txt(this, 14, y + 32, `…另有 ${n - cap + 1} 支部队`, 11, "#8a7a62"); p.add(p._more); }
        else p._more.setText(`…另有 ${parseInt(p._more.text.match(/\d+/)?.[0] || 0) + 1} 支部队`);
        return;
      }
      const row = this.add.container(14, y);
      const bg = this.add.graphics();
      bg.fillStyle(PAL.ink, 1); bg.fillRect(0, 0, 192, 30);
      bg.fillStyle(PAL.parch2, 1); bg.fillRect(2, 2, 188, 26);
      row.add(bg);
      row.add(UI.face(this, 5, 4, 22, u.g.name, Core.gForce(u.g), Core.gIntel(u.g), u.g.type, u.side === 0 ? Core.S.player : Core.S.cities[this.to].owner));
      row.add(UI.txt(this, 32, 2, u.g.name + (u.main ? " ★" : ""), 12, "#241a12"));
      row.add(UI.txt(this, 32, 17, `${TROOP[u.g.type].name}　兵 ${u.g.troop}`, 10, "#6b5a44"));
      row.add(UI.bar(this, 128, 7, 58, 6, u.g.troop/Math.max(1, Core.maxTroop(u.g)), u.side === 0 ? PAL.green : PAL.red));
      row.add(UI.txt(this, 128, 16, `体 ${Math.round(u.ghp || 0)}`, 9, "#6b5a44"));
      p.add(row);
      u.panelBar = row;
      if(side === 0) ly += 36; else ry += 36;
    });
    // 当前单位信息区：自带背景面板，避免与上方列表/折叠行重叠
    UI.panel(this, 924, 276, 220, this.GH - 224, { fill: PAL.parch });
    this.selInfo = this.add.container(924, 280);
    this.refreshSelInfo();
  }

  refreshSelInfo(){
    this.selInfo.removeAll(true);
    const u = Core.battle.sel;
    const p = this.selInfo;
    p.add(UI.txt(this, 14, 0, "当 前 单 位", 15, "#8a3a1a"));
    p.add(this.add.graphics().fillStyle(PAL.gold, 1).fillRect(14, 22, 192, 2));
    if(!u){ p.add(UI.txt(this, 14, 30, "（未选择）", 13, "#8a7a62")); return; }
    p.add(UI.face(this, 14, 28, 40, u.g.name, Core.gForce(u.g), Core.gIntel(u.g), u.g.type, u.side === 0 ? Core.S.player : Core.S.cities[this.to].owner));
    p.add(UI.txt(this, 62, 28, u.g.name, 16, "#241a12"));
    p.add(UI.txt(this, 62, 48, `${TROOP[u.g.type].name}　Lv${u.g.lv}`, 12, "#6b5a44"));
    const tm = u ? Core.terrMod(u) : { atk: 1 };
    const bad = tm.atk < 1;
    const rows = [
      ["兵力", `${u.g.troop} / ${Core.maxTroop(u.g)}`],
      ["武/智", `${Core.gForce(u.g)} / ${Core.gIntel(u.g)}`],
      ["技力", String(u.hp)],
      ["体力", `${Math.round(u.ghp || 0)} / ${Math.round(u.ghpMax || 100)}`],
      ["地形", (bad ? "⚠ " : "✓ ") + TERRAIN[Core.battle.tiles[u.y][u.x]].n + (bad ? "（不利）" : "")],
      ["机动力", `${TROOP[u.g.type].mp + Core.genItemBonus(u.g).mv}　射程 ${TROOP[u.g.type].range}`]
    ];
    rows.forEach((r, i) => {
      p.add(UI.txt(this, 14, 74 + i*17, r[0], 12, r[0] === "地形" && bad ? "#a83232" : "#6b5a44"));
      p.add(UI.txt(this, 68, 74 + i*17, r[1], 12, "#241a12"));
    });
    const sts = Core.statusList(u);
    if(sts.length){
      p.add(UI.txt(this, 14, 74 + rows.length*17 + 2,
        "状态：" + sts.map(k => (STATUS[k] ? STATUS[k].icon : "") + k).join("　"), 11, "#a83232"));
    }
  }

  /* ---------------- 指令栏 ---------------- */
  buildCmdBar(){
    const W = LW;
    UI.panel(this, 8, 500, W - 16, 56, { fill: PAL.parch2 });
    this.cmdBar = this.add.container(0, 0).setDepth(5);
    this.refreshCmd();
  }
  refreshCmd(){
    this.cmdBar.removeAll(true);
    const b = Core.battle, u = b.sel;
    const BW = 88, PITCH = 94;
    const mk = (i, label, fn, fill) => {
      const btn = UI.button(this, 16 + i*PITCH, 512, BW, 34, label, fn, { size: 14, fill });
      this.cmdBar.add(btn);
      return btn;
    };
    const mkR = (i, label, fn, fill) => {
      const btn = UI.button(this, 862 + i*98, 512, BW, 34, label, fn, { size: 14, fill });
      this.cmdBar.add(btn);
      return btn;
    };
    if(b.over || this.busy){ this.cmdBar.add(UI.txt(this, 20, 520, "战斗进行中…", 14, "#6b5a44")); return; }
    if(!u){
      mkR(0, "结束回合", () => this.endPhase());
      mkR(1, "全军撤退", () => this.doRetreat(), 0xd9b0a8);
      return;
    }
    mk(0, "移动", () => { this.mode = "move"; this.refreshCmd(); this.drawMarks(); },
      this.mode === "move" ? PAL.gold : undefined);
    mk(1, "攻击", () => { this.mode = "attack"; this.refreshCmd(); this.drawMarks(); },
      this.mode === "attack" ? PAL.gold : undefined);
    const usable = Core.availableStratagems(u);
    mk(2, `计谋 (${usable.length})`, () => this.openStratagem(u),
      this.mode.startsWith("strat:") ? PAL.gold : undefined);
    mk(3, "单挑", () => {
      if(!Core.duelTargets(u).length){
        const why = u.acted ? "本回合已行动"
          : Core.hasStatus(u, "定身") ? "身形被钉，无法出阵"
          : Core.hasStatus(u, "混乱") ? "军心混乱，无法出阵"
          : "须先移动到敌将身旁";
        UI.toast(this, why, "warn"); Sfx.no(); return;
      }
      this.openDuel(u);
    }, PAL.redL);
    mkR(0, "待机", () => { u.acted = true; this.nextUnit(); });
    mkR(1, "结束回合", () => this.endPhase());
    mkR(2, "撤退", () => this.doRetreat(), 0xd9b0a8);
  }

  /* ---------------- 战斗日志 ---------------- */
  buildLog(){
    UI.panel(this, 8, 564, LW - 16, 148, { fill: PAL.parch });
    this.logText = UI.txt(this, 20, 574, "", 12, "#3a2c1e", { lineSpacing: 3, wrap: LW - 60 });
    this.refreshLog();
  }
  refreshLog(){
    if(!this.logText) return;
    const b = Core.battle;
    if(!b) return;
    this.logText.setText(b.log.slice(-9).join("\n"));
  }

  /* ---------------- 标记（可移动 / 射程） ---------------- */
  /* 计谋面板：29 计全列，灰显并标注不可用原因 */
  openStratagem(u){
    if(Core.hasStatus(u, "禁咒")){ UI.toast(this, "被咒封，无法施展计谋", "warn"); Sfx.no(); return; }
    const m = UI.modal(this, 540, 560, `计 谋 · ${u.g.name}`);
    m.body.add(UI.txt(this, 24, 50, `技力 ${u.hp}　（灰显为当前不可用，点击查看原因）`, 12, "#6b5a44"));
    const list = UI.listBox(this, 16, 74, 508, 404, 46);
    m.body.add(list.container);
    Object.keys(STRATAGEM).forEach(name => {
      const s = STRATAGEM[name], chk = Core.stratagemState(u, name);
      const w = 500;
      const row = this.add.container(0, 0); row.rowH = 46;
      const g = this.add.graphics();
      const paint = hov => {
        g.clear();
        g.fillStyle(PAL.ink, 1); g.fillRect(0, 0, w, 42);
        g.fillStyle(chk.ok ? (hov ? PAL.gold : PAL.parch2) : 0xc9bda0, 1); g.fillRect(2, 2, w - 4, 38);
        if(chk.ok){ g.lineStyle(1, 0xffffff, 0.3); g.strokeRect(2.5, 2.5, w - 5, 37); }
      };
      paint(false);
      row.add(g);
      row.add(UI.txt(this, 12, 4, name, 15, chk.ok ? "#241a12" : "#8a7a62"));
      row.add(UI.txt(this, 12, 25, s.desc, 10, chk.ok ? "#6b5a44" : "#9a8a72"));
      row.add(UI.txt(this, w - 12, 4, chk.ok ? `技 ${s.mp}` : chk.why, 11, chk.ok ? "#8a3a1a" : "#a83232", { ox: 1 }));
      const kind = s.dmg ? `伤 ${s.dmg}` : s.heal ? `疗 ${s.heal}`
        : s.status ? `${s.status[0]}${s.status[1]}日` : s.trap ? "布设"
        : s.weather ? "改天" : s.intel ? "情报" : s.buff ? "强化" : "辅助";
      row.add(UI.txt(this, w - 12, 25, kind, 10, chk.ok ? "#6b5a44" : "#9a8a72", { ox: 1 }));
      const hit = this.add.zone(0, 0, w, 42).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on("pointerover", () => { if(list.hitOK(row)) paint(true); });
      hit.on("pointerout", () => paint(false));
      hit.on("pointerdown", () => {
        if(!list.hitOK(row)){ Sfx.no(); return; }
        if(!chk.ok){ UI.toast(this, `${name}：${chk.why}`, "warn"); Sfx.no(); return; }
        m.close(); Sfx.ok();
        if(s.target === "self"){
          Core.useStratagem(u, name, u.x, u.y);
          this.refreshHud(); this.refreshSelInfo(); this.drawMarks(); this.refreshCmd();
          if(u.acted) this.nextUnit();
        } else {
          this.mode = "strat:" + name; this.refreshCmd(); this.drawMarks();
          UI.toast(this, `${name}：选择${(s.heal || s.target === "ally") ? "友军" : "敌将"}目标`, "info");
        }
      });
      row.add(hit); row._hit = hit;
      list.add(row);
    });
    list.reflow();
    m.body.add(UI.button(this, 210, 500, 120, 38, "关 闭", () => { m.close(); Sfx.click(); }, { size: 14 }));
  }

  /* ---------------- 单挑：与相邻敌将单骑对决 ---------------- */
  openDuel(u){
    const list = Core.duelTargets(u);
    if(!list.length){ UI.toast(this, "须与敌将相邻方可搦战", "warn"); Sfx.no(); return; }
    const go = d => {
      const chk = Core.canDuel(u, d);
      if(!chk.ok){ UI.toast(this, chk.why, "warn"); Sfx.no(); return; }
      const duel = Core.beginDuel(u, d);
      if(duel){ this.busy = true; this.buildDuelUI(duel, u); }
    };
    if(list.length === 1){ go(list[0]); return; }
    Flow.pick(this, "选择单挑对手", list.map(d => ({
      key: d.g.name,
      face: [d.g.name, Core.gForce(d.g), Core.gIntel(d.g), d.g.type, Core.S.cities[this.to].owner],
      label: `${d.g.name}　${TROOP[d.g.type].name}`,
      sub: `武 ${Core.gForce(d.g)}　智 ${Core.gIntel(d.g)}　兵 ${d.g.troop}　体力 ${Math.round(d.ghp || 0)}`,
      right: d.main ? "主将" : ""
    })), it => { const d = list.find(v => v.g.name === it.key); if(d) go(d); });
  }

  buildDuelUI(duel, initUnit){
    const a = duel.a, d = duel.d;
    const M = UI.modal(this, 760, 560, "单　挑");
    const body = M.body;
    const ownerOf = u => u.side === 0 ? Core.S.player : Core.S.cities[Core.battle.toCid].owner;
    const lines = [`◆ ${a.g.name} 拍马出阵，与 ${d.g.name} 战作一团！`];
    const mkSide = (u, cx) => {
      const c = this.add.container(cx, 0);
      c.add(UI.panel(this, 0, 48, 300, 196, { fill: PAL.parch2 }));
      c.add(UI.face(this, 16, 62, 96, u.g.name, Core.gForce(u.g), Core.gIntel(u.g), u.g.type, ownerOf(u)));
      c.add(Flow.add_frame(this, 14, 60, 100, 100));
      const tx = 126;
      c.add(UI.txt(this, tx, 60, u.g.name, 21, "#241a12"));
      c.add(UI.txt(this, tx, 92, `武力 ${Core.gForce(u.g)}`, 14, "#8a3a1a"));
      c.add(UI.txt(this, tx, 112, `智力 ${Core.gIntel(u.g)}`, 14, "#2f5f9e"));
      c.add(UI.txt(this, tx, 132, `${TROOP[u.g.type].name}　兵 ${u.g.troop}`, 12, "#6b5a44"));
      const hpTxt = UI.txt(this, tx, 154, "", 12, "#241a12");
      c.add(hpTxt);
      const bar = this.add.graphics(); c.add(bar);
      body.add(c);
      return { u, hpTxt, bar, c };
    };
    const sa = mkSide(a, 20), sd = mkSide(d, 440);
    body.add(UI.txt(this, 380, 92, "对", 30, "#8a3a1a", { ox: 0.5 }));
    body.add(UI.txt(this, 380, 132, "阵", 30, "#8a3a1a", { ox: 0.5 }));
    const roundTxt = UI.txt(this, 380, 178, "", 22, "#241a12", { ox: 0.5 });
    body.add(roundTxt);
    body.add(UI.txt(this, 380, 204, "回合", 12, "#6b5a44", { ox: 0.5 }));

    body.add(UI.panel(this, 20, 254, 720, 198, { fill: PAL.parch }));
    const logTxt = UI.txt(this, 36, 266, "", 13, "#3a2c1e", { wrap: 688, lineSpacing: 4 });
    body.add(logTxt);

    const refresh = () => {
      [sa, sd].forEach(s => {
        const r = clamp((s.u.ghp || 0)/(s.u.ghpMax || 100), 0, 1);
        s.hpTxt.setText(`体力 ${Math.round(s.u.ghp || 0)} / ${Math.round(s.u.ghpMax || 100)}`);
        s.bar.clear();
        s.bar.fillStyle(PAL.ink, 1); s.bar.fillRect(16, 176, 268, 14);
        s.bar.fillStyle(0x8a7a62, 1); s.bar.fillRect(18, 178, 264, 10);
        s.bar.fillStyle(r > 0.5 ? PAL.green : (r > 0.25 ? PAL.gold : PAL.red), 1);
        s.bar.fillRect(18, 178, Math.round(264*r), 10);
      });
      roundTxt.setText(`${Math.min(duel.round, duel.max)} / ${duel.max}`);
      logTxt.setText(lines.slice(-10).join("\n"));
    };
    const bump = s => {
      const ox = s.c.x;
      this.tweens.add({ targets: s.c, x: ox + (s.u === duel.a ? 8 : -8), duration: 70, yoyo: true, ease: "Quad.easeOut" });
    };

    const acts = DUEL.acts.map((it, i) => {
      const btn = UI.button(this, 22 + i*182, 462, 168, 44, it.name, () => doRound(it.k), { size: 17 });
      body.add(btn);
      body.add(UI.txt(this, 22 + i*182 + 84, 512, it.desc, 10, "#6b5a44", { ox: 0.5 }));
      return { k: it.k, btn };
    });

    const doRound = actKey => {
      if(duel.over) return;
      const r = Core.duelRound(duel, actKey);
      r.lines.forEach(t => lines.push(t));
      refresh();
      Sfx.hit(); bump(sa); bump(sd);
      if(r.over){
        this.time.delayedCall(520, () => {
          const res = duel.res || {};
          const iWon = res.winner ? res.winner === a.g.name : -1;
          const title = res.kind === "draw" ? `大战 ${duel.max} 合不分胜负`
            : res.kind === "retreat" ? (res.loser === a.g.name ? "自身抽身罢斗" : "敌将怯战退走")
            : iWon === 0 ? (res.kind === "kill" ? "★ 阵斩敌将！" : res.kind === "capture" ? "★ 生擒敌将！" : "★ 大获全胜！")
            : (res.kind === "kill" ? "× 将领阵亡！" : res.kind === "capture" ? "× 将领被擒！" : "× 单挑落败");
          lines.push("★ " + title);
          refresh();
          (iWon === 0 ? Sfx.fanfare : Sfx.no).call(Sfx);
          acts.forEach(x => x.btn.setVisible(false));
          body.add(UI.button(this, 290, 462, 200, 44, "收　兵",
            () => { M.close(); this.afterDuel(initUnit); }, { size: 17, fill: PAL.gold }));
        });
      }
    };
    refresh();
  }

  afterDuel(u){
    this.busy = false;
    this.syncUnits();
    this.refreshLog();
    this.refreshHud();
    this.refreshSelInfo();
    if(Core.battle.over) return;
    if(Core.checkBattleEnd()) return;
    this.nextUnit();
  }

  floatText(x, y, str, size, color){
    const t = UI.txt(this, x, y, str, size || 18, color || "#ffd24a", { ox: 0.5, shadow: false });
    t.setStroke("#241a12", 4); t.setDepth(60);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, ease: "Quad.easeOut", onComplete: () => t.destroy() });
    return t;
  }

  drawMarks(){
    const b = Core.battle;
    this.markLayer.clear();
    if(b.over || this.busy) return;
    const u = b.sel;
    if(!u) return;
    // 选中框
    this.markLayer.lineStyle(3, 0xffe066, 1);
    this.markLayer.strokeRect(this.GX + u.x*this.TS + 1, this.GY + u.y*this.TS + 1, this.TS - 2, this.TS - 2);
    if(this.mode === "move"){
      Core.reach(u).forEach(([x, y]) => {
        this.markLayer.fillStyle(0xffe066, 0.20);
        this.markLayer.fillRect(this.GX + x*this.TS + 2, this.GY + y*this.TS + 2, this.TS - 4, this.TS - 4);
        this.markLayer.lineStyle(2, 0xffe066, 0.75);
        this.markLayer.strokeRect(this.GX + x*this.TS + 2, this.GY + y*this.TS + 2, this.TS - 4, this.TS - 4);
      });
    } else if(this.mode.startsWith("strat:")){
      const s = STRATAGEM[this.mode.slice(6)] || {};
      const rng = s.rng || 0;
      const ally = !!s.heal || s.target === "ally";
      b.units.filter(v => !v.dead && (ally ? (v.side === u.side && v !== u) : v.side !== u.side)).forEach(v => {
        const d = Math.abs(v.x - u.x) + Math.abs(v.y - u.y);
        if(d <= rng){
          this.markLayer.lineStyle(3, ally ? 0x4ac94a : 0xd98ce8, 0.95);
          this.markLayer.strokeRect(this.GX + v.x*this.TS + 1, this.GY + v.y*this.TS + 1, this.TS - 2, this.TS - 2);
        }
      });
    } else {
      const rng = TROOP[u.g.type].range;
      b.units.filter(v => !v.dead && v.side !== u.side).forEach(v => {
        const d = Math.abs(v.x - u.x) + Math.abs(v.y - u.y);
        if(d <= rng){
          this.markLayer.lineStyle(3, 0xff6a4a, 0.95);
          this.markLayer.strokeRect(this.GX + v.x*this.TS + 1, this.GY + v.y*this.TS + 1, this.TS - 2, this.TS - 2);
        }
      });
    }
    // 陷阱 / 石阵
    (b.traps || []).forEach(t => {
      if(t.side !== u.side) return;
      this.markLayer.lineStyle(2, 0xd9a441, 0.85);
      this.markLayer.strokeCircle(this.GX + t.x*this.TS + this.TS/2, this.GY + t.y*this.TS + this.TS/2, 8);
    });
  }

  /* ---------------- 天气特效（自绘精灵，稳定可控） ---------------- */
  updateWeatherFx(){
    const b = Core.battle;
    if(this.fxLayer){ this.fxLayer.destroy(true); this.fxLayer = null; }
    const tints = { "晴": [0xfff0b4, 0.07], "阴": [0x787888, 0.16], "雨": [0x3c6ebe, 0.20], "大风": [0xc8aa3c, 0.12], "冰雹": [0xc8dcf0, 0.18] };
    const t = tints[b.weather] || [0xffffff, 0];
    this.weatherTint.setFillStyle(t[0], t[1]);

    this.fxLayer = this.add.container(0, 0).setDepth(16);
    this.fxItems = [];
    const L = this.GX, T = this.GY, W = this.GW, H = this.GH;
    const push = (o, vx, vy) => { this.fxLayer.add(o); this.fxItems.push({ o, vx, vy, L, T, W, H }); };

    if(b.weather === "雨"){
      for(let i = 0; i < 90; i++){
        const r = this.add.rectangle(L + Math.random()*W, T + Math.random()*H, 2, 10, 0xcfe4f5, 0.62);
        push(r, -1.2, 7 + Math.random()*4);
      }
    } else if(b.weather === "冰雹"){
      for(let i = 0; i < 60; i++){
        const r = this.add.rectangle(L + Math.random()*W, T + Math.random()*H, 4, 4, 0xf2f8ff, 0.9);
        push(r, (Math.random() - 0.5)*1.2, 4 + Math.random()*3);
      }
    } else if(b.weather === "大风"){
      for(let i = 0; i < 14; i++){
        const r = this.add.rectangle(L + Math.random()*W, T + Math.random()*H, 26 + Math.random()*22, 2, 0xffffff, 0.42);
        push(r, 6 + Math.random()*4, (Math.random() - 0.5)*0.8);
      }
    } else if(b.weather === "晴"){
      this.sunGlow = this.add.circle(L + W - 60, T + 46, 30, 0xfff0b4, 0.35).setDepth(16);
      this.fxLayer.add(this.sunGlow);
      this.tweens.add({ targets: this.sunGlow, alpha: 0.18, duration: 1600, yoyo: true, repeat: -1 });
    }
  }
  update(){
    if(!this.fxItems) return;
    for(const it of this.fxItems){
      it.o.x += it.vx; it.o.y += it.vy;
      if(it.o.y > it.T + it.H){ it.o.y = it.T - 12; it.o.x = it.L + Math.random()*it.W; }
      if(it.vx > 2 && it.o.x > it.L + it.W){ it.o.x = it.L - 30; it.o.y = it.T + Math.random()*it.H; }
      if(it.vx < 0 && it.o.x < it.L){ it.o.x = it.L + it.W; }
    }
  }

  /* ---------------- 回合流程 ---------------- */
  playerPhase(){
    const b = Core.battle;
    b.phase = "player";
    const atts = b.units.filter(u => u.side === 0 && !u.dead);
    atts.forEach(u => {
      Core.tickStatus(u);
      u.moved = false; u.acted = false; u.buff = null;
      u.confusedNow = !u.dead && Core.confused(u);
      if(u.confusedNow) Core.blog(`${u.g.name} 军心混乱，本回合难以行动！`);
    });
    this.busy = false;
    this.mode = "move";
    const first = b.units.find(u => u.side === 0 && !u.dead && !u.confusedNow);
    this.selectUnit(first || null);
    if(!first && !b.over) UI.toast(this, "全军混乱，只能结束回合", "warn");
    this.refreshHud();
  }
  selectUnit(u){
    Core.battle.sel = u;
    this.mode = "move";
    this.refreshCmd();
    this.refreshSelInfo();
    this.drawMarks();
  }
  nextUnit(){
    const n = Core.battle.units.find(u => u.side === 0 && !u.dead && !u.acted && !u.confusedNow);
    if(n) this.selectUnit(n); else this.endPhase();
  }

  onGridClick(p){
    const b = Core.battle;
    if(b.over || this.busy) return;
    const x = Math.floor((p.x - this.GX)/this.TS), y = Math.floor((p.y - this.GY)/this.TS);
    if(x < 0 || y < 0 || x >= Core.BW || y >= Core.BH) return;
    const sel = b.sel;
    const tu = Core.unitAt(x, y);
    if(!sel){
      if(tu && tu.side === 0) this.selectUnit(tu);
      return;
    }
    if(this.mode === "move"){
      if(tu){ if(tu.side === 0 && !tu.acted) this.selectUnit(tu); return; }
      if(Core.reach(sel).some(a => a[0] === x && a[1] === y)) this.moveUnit(sel, x, y);
      return;
    }
    if(this.mode === "attack"){
      if(tu && tu.side === 1){
        const d = Math.abs(sel.x - x) + Math.abs(sel.y - y);
        if(d > TROOP[sel.g.type].range){ UI.toast(this, "目标超出攻击距离", "warn"); return; }
        this.doAttack(sel, tu);
      } else UI.toast(this, "请点击敌将", "warn");
      return;
    }
    if(this.mode.startsWith("strat:")){
      const name = this.mode.slice(6);
      const before = tu ? tu.g.troop : 0;
      Core.useStratagem(sel, name, x, y);
      this.refreshLog();
      if(tu && tu.g.troop < before) this.hitFx(tu, before - tu.g.troop, true);
      this.syncUnits();
      if(!b.over && sel.acted) this.nextUnit(); else { this.refreshCmd(); this.drawMarks(); }
    }
  }

  moveUnit(u, x, y){
    this.busy = true;
    const sx = this.gx(x), sy = this.gy(y);
    this.tweens.add({
      targets: u.sprite, x: sx, y: sy, duration: 190, ease: "Quad.easeInOut",
      onComplete: () => {
        u.x = x; u.y = y; u.moved = true;
        const trap = Core.checkTrap(u);
        if(trap){
          this.hitFx(u, trap.dmg, false);
          Sfx.hit();
          this.refreshHud(); this.refreshSelInfo();
          if(u.dead){ if(u.sprite) u.sprite.setVisible(false); this.busy = false; this.nextUnit(); return; }
        }
        this.updateUnitBar(u);
        this.busy = false;
        this.mode = "attack";
        this.refreshCmd();
        this.drawMarks();
      }
    });
    Sfx.blip(320, 0.06, "triangle", 0.04);
  }

  doAttack(a, d){
    this.busy = true;
    const before = d.g.troop;
    const ox = this.gx(a.x), oy = this.gy(a.y);
    const dir = d.x > a.x ? 10 : (d.x < a.x ? -10 : 0);
    const dirY = d.y > a.y ? 10 : (d.y < a.y ? -10 : 0);
    this.tweens.add({ targets: a.sprite, x: ox + dir, y: oy + dirY, duration: 110, yoyo: true, ease: "Quad.easeOut" });
    this.time.delayedCall(130, () => {
      const dmg = Core.attackUnit(a, d);
      Sfx.hit();
      this.hitFx(d, dmg, false);
      this.refreshLog();
      a.acted = true;
      this.syncUnits();
      this.busy = false;
      if(!Core.battle.over) this.nextUnit(); else this.refreshCmd();
    });
  }

  hitFx(target, dmg, magic){
    if(!target.sprite) return;
    const x = this.gx(target.x), y = this.gy(target.y) - 12;
    const t = UI.txt(this, x, y, "-" + dmg, 20, magic ? "#d98ce8" : "#ffd24a", { ox: 0.5, shadow: false });
    t.setStroke("#241a12", 4); t.setDepth(40);
    this.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 760, ease: "Quad.easeOut", onComplete: () => t.destroy() });
    // 火花爆散
    const col = magic ? 0xd98ce8 : 0xffd24a;
    for(let i = 0; i < 10; i++){
      const ang = (Math.PI*2*i)/10 + Math.random()*0.4;
      const dist = 16 + Math.random()*22;
      const sp = this.add.rectangle(x, y, 4, 4, col, 0.95).setDepth(41);
      this.tweens.add({
        targets: sp, x: x + Math.cos(ang)*dist, y: y + Math.sin(ang)*dist,
        alpha: 0, scaleX: 0.2, scaleY: 0.2, duration: 380, ease: "Quad.easeOut",
        onComplete: () => sp.destroy()
      });
    }
    // 受击闪红
    this.tweens.add({ targets: target.spr, tint: 0xff8888, duration: 90, yoyo: true });
  }

  syncUnits(){
    Core.battle.units.forEach(u => {
      if(!u.sprite) return;
      if(u.dead){
        if(!u._gone){
          u._gone = true;
          this.tweens.add({ targets: u.sprite, alpha: 0, angle: 40, y: u.sprite.y + 14, duration: 380,
            onComplete: () => u.sprite.setVisible(false) });
        }
      } else {
        u.sprite.x = this.gx(u.x); u.sprite.y = this.gy(u.y);
      }
      this.updateUnitBar(u);
      if(u.panelBar) u.panelBar.setAlpha(u.dead ? 0.35 : 1);
    });
    this.refreshHud();
  }

  endPhase(){
    if(this.busy || Core.battle.over) return;
    this.busy = true;
    Core.battle.sel = null;
    this.markLayer.clear();
    this.refreshCmd();
    this.refreshSelInfo();
    UI.toast(this, "守方行动…", "info");
    this.time.delayedCall(280, () => {
      const events = Core.enemyPhase();
      this.refreshLog();
      this.animateEnemy(events, 0);
    });
  }

  animateEnemy(events, i){
    if(i >= events.length){
      this.syncUnits();
      this.updateWeatherFx();
      this.refreshLog();
      if(!Core.battle.over){ this.busy = false; this.playerPhase(); }
      return;
    }
    const ev = events[i];
    /* 敌将主动搦战：冲撞三轮 + 结果飘字 */
    if(ev.type === "duel"){
      UI.toast(this, `${ev.unit.g.name} 向 ${ev.target.g.name} 搦战！`, "warn");
      const midX = (this.gx(ev.unit.x) + this.gx(ev.target.x))/2;
      const midY = (this.gy(ev.unit.y) + this.gy(ev.target.y))/2;
      let k = 0;
      const clash = () => {
        if(k++ >= 3){
          const kinds = { kill: "阵斩", capture: "生擒", escape: "击败", retreat: "罢斗", draw: "平手" };
          const res = ev.res || {};
          this.floatText(this.gx(ev.target.x), this.gy(ev.target.y) - 26,
            `单挑·${kinds[res.kind] || "结束"}`, 18, res.winner && res.winner === ev.target.g.name ? "#7ce07c" : "#ff8a6a");
          Sfx.hit();
          this.syncUnits(); this.refreshLog(); this.refreshHud(); this.refreshSelInfo();
          this.time.delayedCall(380, () => this.animateEnemy(events, i + 1));
          return;
        }
        Sfx.blip(170 + k*70, 0.06, "square", 0.05);
        this.tweens.add({ targets: ev.unit.sprite, x: midX, y: midY,
          duration: 110, yoyo: true, ease: "Quad.easeOut", onComplete: clash });
      };
      clash();
      return;
    }
    if(ev.type === "move"){
      let chain = this.tweens.chain({
        targets: ev.unit.sprite,
        tweens: ev.path.map(p => ({ x: this.gx(p[0]), y: this.gy(p[1]), duration: 150, ease: "Linear" }))
      });
      chain.on("complete", () => this.animateEnemy(events, i + 1));
      if(!ev.path.length) this.animateEnemy(events, i + 1);
    } else {
      const a = ev.unit, d = ev.target;
      const ox = this.gx(a.x), oy = this.gy(a.y);
      this.tweens.add({ targets: a.sprite, x: ox + (d.x > a.x ? 8 : -8), y: oy + (d.y > a.y ? 8 : -8),
        duration: 110, yoyo: true, ease: "Quad.easeOut" });
      this.time.delayedCall(140, () => {
        Sfx.hit();
        this.hitFx(d, ev.dmg, false);
        this.syncUnits();
        this.refreshLog();
        this.time.delayedCall(340, () => this.animateEnemy(events, i + 1));
      });
    }
  }

  doRetreat(){
    Flow.confirm(this, "全 军 撤 退", "确定放弃此次攻势？残部将退回出发城池。",
      () => { Core.battleRetreat(); }, "撤 退");
  }

  onBattleOver(r){
    this.busy = true;
    this.markLayer.clear();
    this.syncUnits();
    const win = r.attWin;
    const m = UI.modal(this, 470, 240, win ? "★ 城 破 ★" : "× 攻 城 失 败 ×");
    UI.txt(m.body, 0, 66, win
      ? `我军攻克 ${CITY[r.to].n}！\n${r.reason}`
      : `攻势受挫，残部退回 ${CITY[r.from].n}。\n${r.reason}`,
      17, "#3a2c1e", { ox: 0.5, align: "center", lineSpacing: 8 }).setX(235);
    m.body.add(UI.button(this, 185, 158, 100, 34, "确 定", () => {
      m.close(); Core.battle = null; UI.fadeTo(this, "Map");
    }, { size: 15, fill: PAL.gold }));
    win ? Sfx.fanfare() : Sfx.no();
  }
}
