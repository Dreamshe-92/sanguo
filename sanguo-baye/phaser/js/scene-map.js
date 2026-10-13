/* ================= 主地图场景 ================= */
"use strict";

class MapScene extends Phaser.Scene {
  constructor(){ super("Map"); }

  create(data){
    const W = LW, H = LH;
    this.MX = 8; this.MY = 46; this.MW = 836; this.MH = 620;
    this.PX = 852; this.PY = 46; this.PW = 292; this.PH = 620;

    this.drawBackdrop(W, H);
    this.buildTopbar(W);
    this.buildMapFrame();
    this.computeTransform();
    this.drawGeo();

    this.linkLayer = this.add.container(0, 0);
    this.cityLayer = this.add.container(0, 0);
    this.infoLayer = this.add.container(this.PX, this.PY);
    this.genList = UI.listBox(this, this.PX + 8, this.PY + 292, this.PW - 16, 214, 38);

    this.logOpen = false;
    this.logLayer = this.add.container(0, 0).setVisible(false);

    this.buildCities();
    this.refreshInfo();
    this.refreshTop();
    this.refreshLog();

    // 事件订阅
    this._onRefresh = () => { this.buildCities(); this.refreshInfo(); this.refreshTop(); };
    this._onToast = d => UI.toast(this, d.msg, d.kind);
    this._onLog = () => this.refreshLog();
    this._onOver = r => this.showEnding(r);
    Core.on("refresh", this._onRefresh).on("toast", this._onToast).on("log", this._onLog).on("gameover", this._onOver);
    this.events.once("shutdown", () => {
      Core._ev.refresh = (Core._ev.refresh || []).filter(f => f !== this._onRefresh);
      Core._ev.toast = (Core._ev.toast || []).filter(f => f !== this._onToast);
      Core._ev.log = (Core._ev.log || []).filter(f => f !== this._onLog);
      Core._ev.gameover = (Core._ev.gameover || []).filter(f => f !== this._onOver);
    });

    // 首次进入引导
    if(!this._greeted){ this._greeted = true; this.time.delayedCall(400, () => UI.toast(this, "点击己方城池下达内政指令", "info")); }
  }

  /* ---------------- 背景 ---------------- */
  drawBackdrop(W, H){
    const g = this.add.graphics();
    for(let y = 0; y < H; y += 6){ g.fillStyle(y % 12 === 0 ? 0x3a3020 : 0x322a1c, 1); g.fillRect(0, y, W, 6); }
    g.fillStyle(0x241a12, 0.5); g.fillRect(0, 0, W, 6);
  }

  /* ---------------- 顶栏 ---------------- */
  buildTopbar(W){
    UI.panel(this, 0, 0, W, 40, { fill: PAL.parch2, notch: false });
    this.add.graphics().fillStyle(PAL.gold, 1).fillRect(0, 38, W, 2);
    this.tbDate  = UI.txt(this, 14, 11, "", 15, "#241a12");
    this.tbLord  = UI.txt(this, 132, 11, "", 15, "#8a3a1a");
    this.tbRes   = UI.txt(this, 268, 11, "", 14, "#241a12");
    this.tbCnt   = UI.txt(this, 470, 11, "", 14, "#241a12");

    const mk = (x, w, label, fn, fill) => UI.button(this, x, 4, w, 32, label, fn, { size: 13, fill });
    mk(W - 112, 100, "结束本月 ▶", () => this.doEndMonth(), PAL.gold);
    mk(W - 190, 70, "情报", () => { this.logOpen = !this.logOpen; this.logLayer.setVisible(this.logOpen); this.refreshLog(); Sfx.click(); });
    mk(W - 268, 70, "存档", () => { UI.toast(this, Core.save() ? "已存档" : "存档失败", Core.save() ? "good" : "bad"); Sfx.click(); });
    mk(W - 346, 70, "说明", () => { Sfx.click(); this.showHelp(); });
    const snd = mk(W - 424, 70, "音效：" + (Sfx.on ? "开" : "关"), () => {
      Sfx.on = !Sfx.on; snd.setLabel("音效：" + (Sfx.on ? "开" : "关")); Sfx.click();
    });
  }

  refreshTop(){
    const t = Core.playerTotals(), sc = SCENARIOS[Core.S.scen];
    this.tbDate.setText(`${Core.S.year} 年 ${Core.S.month} 月`);
    this.tbLord.setText(`${Core.playerFac().lord} 军`);
    this.tbRes.setText(`金 ${t.gold}　粮 ${t.grain}　兵 ${t.troop}`);
    this.tbCnt.setText(`城 ${t.cities}/${CITIES.length}　将 ${t.gen}　余 ${Math.max(0, sc.year + sc.years - Core.S.year)} 年`);
  }

  /* ---------------- 地图外框 ---------------- */
  buildMapFrame(){
    UI.panel(this, this.MX, this.MY, this.MW, this.MH, { fill: 0xe8d9b4 });
    // 羊皮纸纹理
    const g = this.add.graphics();
    g.fillStyle(0x241a12, 0.055);
    for(let i = 0; i < 260; i++){
      const x = this.MX + 6 + ((i*151) % (this.MW - 12));
      const y = this.MY + 6 + ((i*283) % (this.MH - 12));
      g.fillRect(x, y, 2, 2);
    }
    // 边框内描金
    g.lineStyle(2, PAL.gold, 0.5);
    g.strokeRect(this.MX + 6, this.MY + 6, this.MW - 12, this.MH - 12);
    UI.panel(this, this.PX, this.PY, this.PW, this.PH, { fill: PAL.parch });
  }

  computeTransform(){
    const xs = CITIES.map(c => c[2]), ys = CITIES.map(c => c[3]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    this.s = Math.min((this.MW - 64)/(maxX - minX), (this.MH - 64)/(maxY - minY));
    this.ox = this.MX + (this.MW - (maxX - minX)*this.s)/2 - minX*this.s;
    this.oy = this.MY + (this.MH - (maxY - minY)*this.s)/2 - minY*this.s;
  }
  T(x, y){ return [this.ox + x*this.s, this.oy + y*this.s]; }

  /* ---------------- 地图上的装饰地理 ---------------- */
  drawGeo(){
    const g = this.add.graphics();
    const line = (pts, color, w) => {
      g.lineStyle(w + 2, 0x241a12, 0.30);
      g.beginPath();
      pts.forEach((p, i) => { const q = this.T(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      g.strokePath();
      g.lineStyle(w, color, 0.85);
      g.beginPath();
      pts.forEach((p, i) => { const q = this.T(p[0], p[1]); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      g.strokePath();
    };
    // 黄河
    line([[10,150],[120,120],[260,105],[400,120],[520,165],[610,205],[700,240],[800,262]], 0x9ab8cf, 5);
    // 长江
    line([[70,430],[180,438],[300,430],[420,432],[520,420],[620,404],[720,384],[810,366]], 0x9ab8cf, 5);
    // 山脉（阶梯三角剪影）
    const ridge = (pts, color) => {
      g.fillStyle(color, 0.55);
      pts.forEach(p => {
        const q = this.T(p[0], p[1]);
        const w = 16*this.s, h = 13*this.s;
        for(let i = 0; i < 6; i++){
          const ww = Math.max(2, w*(i + 1)/6);
          g.fillRect(q[0] - ww/2, q[1] + h - i*(h/6), ww, h/6 + 1);
        }
      });
    };
    ridge([[60,250],[95,238],[130,262],[175,300],[210,318]], 0x8a7a58);          // 陇山/秦岭
    ridge([[330,96],[372,84],[410,100],[300,175],[340,190]], 0x8a7a58);          // 太行
    ridge([[300,540],[340,560],[420,556],[500,560]], 0x8a7a58);                  // 南岭
    ridge([[640,470],[680,486],[700,506]], 0x8a7a58);                            // 武夷
    // 海域（东海）
    const sea = this.add.graphics();
    sea.fillStyle(0x7fa8bd, 0.28);
    sea.beginPath();
    [[820,300],[900,340],[880,430],[930,470],[900,560],[1000,600]].forEach((p, i) => {
      const q = this.T(p[0], p[1]); i ? sea.lineTo(q[0], q[1]) : sea.moveTo(q[0], q[1]);
    });
    sea.lineTo(this.MX + this.MW, this.MY + this.MH); sea.lineTo(this.MX + this.MW, this.MY);
    sea.closePath(); sea.fillPath();
    sea.setMask(this.mapMask());

    // 标题题跋
    UI.txt(this, this.MX + 18, this.MY + this.MH - 30, "三 國 霸 業 · 全 圖", 16, "#8a7a58");
  }
  mapMask(){
    const s = this.make.graphics({ add: false });
    s.fillStyle(0xffffff);
    s.fillRect(this.MX + 3, this.MY + 3, this.MW - 6, this.MH - 6);
    return s.createGeometryMask();
  }

  /* ---------------- 城池节点 ---------------- */
  buildCities(){
    this.linkLayer.removeAll(true);
    this.cityLayer.removeAll(true);
    // 连线
    const lg = this.add.graphics();
    CITIES.forEach(c => {
      c[4].forEach(aid => {
        const a = CITY[aid];
        if(!a || a.x < c[2]) return;
        const p = this.T(c[2], c[3]), q = this.T(a.x, a.y);
        lg.lineStyle(2, 0x4a3826, 0.42); lg.lineBetween(p[0], p[1], q[0], q[1]);
      });
    });
    this.linkLayer.add(lg);
    this.linkLayer.setMask(this.mapMask());

    CITIES.forEach(c => {
      const st = Core.S.cities[c[0]], p = this.T(c[2], c[3]);
      const node = this.add.container(p[0], p[1]);
      const mine = st.owner === Core.S.player;
      const col = st.owner < 0 ? 0x9a9488 : facColor(st.owner);
      const dark = st.owner < 0 ? 0x6e6a60 : this.shade(col, -0.35);
      const g = this.add.graphics();
      g.fillStyle(0x241a12, 0.32); g.fillRect(-21, -6, 44, 18);
      g.fillStyle(PAL.ink, 1);     g.fillRect(-22, -9, 44, 18);
      g.fillStyle(col, 1);         g.fillRect(-20, -7, 40, 14);
      g.fillStyle(0xffffff, 0.24); g.fillRect(-20, -7, 40, 2);
      g.fillStyle(dark, 1);        g.fillRect(-20, -7, 3, 14);
      if(mine){ g.lineStyle(2, PAL.gold, 1); g.strokeRect(-23, -10, 46, 20); }
      node.add(g);
      const t = UI.txt(this, 0, 0, c[1], 11, "#ffffff", { ox: 0.5, oy: 0.5, shadow: false });
      t.setStroke("#1a130c", 3);
      node.add(t);

      const hit = this.add.zone(-22, -9, 44, 18).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on("pointerover", () => { this.tweens.add({ targets: node, scaleX: 1.14, scaleY: 1.14, duration: 110 }); Sfx.hover(); });
      hit.on("pointerout",  () => this.tweens.add({ targets: node, scaleX: 1, scaleY: 1, duration: 110 }));
      hit.on("pointerdown", () => { Sfx.click(); Core.curCity = c[0]; this.buildCities(); this.refreshInfo(); });
      node.add(hit);

      if(Core.curCity === c[0]){
        const ring = this.add.graphics();
        ring.lineStyle(2, PAL.gold, 1); ring.strokeRect(-26, -13, 52, 26);
        node.add(ring);
        this.tweens.add({ targets: ring, alpha: { from: 1, to: 0.25 }, duration: 620, yoyo: true, repeat: -1 });
      }
      if(mine) this.tweens.add({ targets: node, y: p[1] - 1, duration: 900 + (c[2] % 5)*120, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

      this.cityLayer.add(node);
    });
    this.cityLayer.setMask(this.mapMask());
  }
  shade(hex, amt){
    const r = (hex >> 16) & 255, gg = (hex >> 8) & 255, b = hex & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(v + 255*amt)));
    return (f(r) << 16) | (f(gg) << 8) | f(b);
  }

  /* ---------------- 右侧情报面板 ---------------- */
  refreshInfo(){
    this.infoLayer.removeAll(true);
    const cid = Core.curCity;
    const L = this.infoLayer;
    if(!cid){
      L.add(UI.txt(this, 16, 14, "情 报", 20, "#241a12"));
      L.add(UI.txt(this, 16, 52, "点击大地图上的城池，\n查看其内政与驻将。\n\n金色边框为我方城池，\n点击可进入城池下达指令。", 13, "#6b5a44", { lineSpacing: 6 }));
      this.genList.container.setVisible(false);
      return;
    }
    this.genList.container.setVisible(true);
    const st = Core.S.cities[cid], c = CITY[cid], mine = st.owner === Core.S.player;
    const own = st.owner >= 0 ? Core.gensAt(cid, st.owner) : [];
    const faceG = own[0];

    L.add(UI.txt(this, 16, 12, c.n, 24, "#241a12"));
    L.add(UI.txt(this, 16, 42, Core.lordName(st.owner), 13, "#8a3a1a"));
    if(faceG) L.add(UI.face(this, 232, 10, 44, faceG.name, Core.gForce(faceG), Core.gIntel(faceG), faceG.type, st.owner));
    L.add(this.add.graphics().fillStyle(PAL.gold, 1).fillRect(16, 62, this.PW - 32, 2));

    if(mine || st.recon || st.owner < 0){
      const rows = mine
        ? [["农业", st.ag], ["商业", st.bu], ["民忠", st.loy], ["防灾", st.df]]
        : [["农业", st.ag], ["商业", st.bu], ["民忠", st.loy], ["守军", own.reduce((a, g) => a + g.troop, 0) + st.reserve]];
      rows.forEach((r, i) => {
        const y = 74 + i*24;
        L.add(UI.txt(this, 16, y, r[0], 13, "#6b5a44"));
        L.add(UI.bar(this, 60, y + 3, 140, 9, r[1]/100, i === 2 ? PAL.green : PAL.blue));
        L.add(UI.txt(this, 208, y, String(Math.round(r[1])), 12, "#241a12"));
      });
      if(mine){
        L.add(UI.txt(this, 16, 176, `人口 ${st.pop}　金 ${st.gold}　粮 ${st.grain}　预备 ${st.reserve}`, 12, "#3a2c1e"));
      }
    } else {
      L.add(UI.txt(this, 16, 80, "（未侦察 —— 先派将领侦察此城）", 13, "#8a7a62"));
    }

    L.add(UI.txt(this, 16, 210, mine ? "驻城将领（点击查看）" : "守军概况", 14, "#241a12"));
    L.add(this.add.graphics().fillStyle(PAL.ink, 0.3).fillRect(16, 232, this.PW - 32, 1));

    // 将领列表
    this.genList.clear();
    const gs = mine ? Core.gensAt(cid, Core.S.player) : own;
    gs.forEach(g => {
      const row = this.add.container(0, 0);
      row.rowH = 38;
      const w = this.PW - 40;
      const bg = this.add.graphics();
      const paint = hov => {
        bg.clear();
        bg.fillStyle(PAL.ink, 1); bg.fillRect(0, 0, w, 32);
        bg.fillStyle(hov ? PAL.gold : (g.acted ? 0xc9bda0 : PAL.parch2), 1); bg.fillRect(2, 2, w - 4, 28);
      };
      paint(false);
      row.add(bg);
      row.add(UI.face(this, 6, 5, 22, g.name, Core.gForce(g), Core.gIntel(g), g.type, g.lord));
      row.add(UI.txt(this, 34, 5, g.name + (g.acted ? " ✔" : ""), 13, g.acted ? "#8a7a62" : "#241a12"));
      row.add(UI.txt(this, 34, 20, `武${Core.gForce(g)} 智${Core.gIntel(g)} 兵${g.troop}`, 10, "#6b5a44"));
      const hit = this.add.zone(0, 0, w, 32).setOrigin(0);
      if(mine){
        hit.setInteractive({ useHandCursor: true });
        hit.on("pointerover", () => { if(this.genList.hitOK(row)) paint(true); });
        hit.on("pointerout", () => paint(false));
        hit.on("pointerdown", () => { if(!this.genList.hitOK(row)){ Sfx.no(); return; } Sfx.click(); Flow.genDetail(this, g.name); });
      }
      row.add(hit);
      row._hit = hit;
      this.genList.add(row);
    });
    if(!gs.length) this.genList.add(UI.txt(this, 8, 8, "（空城无将）", 12, "#8a7a62"));
    this.genList.reflow();

    // 命令按钮
    const bw = (this.PW - 40)/2, by = 524;
    if(mine){
      L.add(UI.button(this, 16, by, this.PW - 32, 38, "进 入 城 池 ▶", () => {
        Sfx.ok(); UI.fadeTo(this, "City", { cid });
      }, { size: 16, fill: PAL.gold }));
      L.add(UI.button(this, 16, by + 46, bw, 32, "侦 察 邻 城", () => this.doRecon(cid), { size: 13 }));
      L.add(UI.button(this, 24 + bw, by + 46, bw, 32, "出 征 邻 城", () => this.doAttack(cid), { size: 13, fill: PAL.red }));
    } else {
      const adjMine = c.adj.filter(a => Core.S.cities[a].owner === Core.S.player);
      if(adjMine.length){
        L.add(UI.button(this, 16, by, this.PW - 32, 38, "出 征 此 城", () => {
          Sfx.ok(); this.doAttackTo(cid);
        }, { size: 16, fill: PAL.red }));
      }
      if(st.owner >= 0 && !st.recon){
        L.add(UI.button(this, 16, by + 46, this.PW - 32, 32, "侦 察 此 城", () => this.doRecon(cid), { size: 13 }));
      }
    }
  }

  doRecon(cid){
    const c = CITY[cid];
    const from = cid && Core.S.cities[cid].owner === Core.S.player ? cid : c.adj.find(a => Core.S.cities[a].owner === Core.S.player);
    if(!from){ UI.toast(this, "无相邻我方城池", "warn"); return; }
    const gs = Core.freeGens(from).filter(g => g.hp >= 10);
    if(!gs.length){ UI.toast(this, "无空闲将领可派遣", "warn"); return; }
    Flow.pickGeneral(this, gs, "派遣侦察（耗体力 10）", g => {
      Core.cmdRecon(cid, g); Core.refresh(); UI.toast(this, `已侦察 ${c.n}`, "good");
    });
  }
  /* 从相邻我方城出征此城：优先选真正有兵的城，避免取到空城导致点了没反应 */
  doAttackTo(cid){
    const adjMine = CITY[cid].adj.filter(a => Core.S.cities[a].owner === Core.S.player);
    if(!adjMine.length){ UI.toast(this, "无相邻我方城池", "warn"); Sfx.no(); return; }
    const ready = adjMine.filter(a => Core.gensAt(a, Core.S.player).some(g => g.troop > 0));
    if(!ready.length){
      UI.toast(this, `${adjMine.map(a => CITY[a].n).join("、")} 无带兵将领，请先征兵并分配`, "warn");
      Sfx.no(); return;
    }
    if(ready.length === 1){ Flow.expedition(this, ready[0], cid); return; }
    Flow.pick(this, "选择出征出发城", ready.map(a => ({
      key: a, label: CITY[a].n,
      sub: "带兵将领 " + Core.gensAt(a, Core.S.player).filter(g => g.troop > 0).length + " 人",
      right: "兵力 " + Core.gensAt(a, Core.S.player).reduce((s, g) => s + g.troop, 0)
    })), it => Flow.expedition(this, it.key, cid), { w: 420, rowH: 48 });
  }

  doAttack(cid){
    if(!Core.gensAt(cid, Core.S.player).some(g => g.troop > 0)){
      UI.toast(this, `${CITY[cid].n} 无带兵将领，请先【征兵】后【分配】`, "warn");
      Sfx.no(); return;
    }
    const targets = CITY[cid].adj.filter(a => Core.S.cities[a].owner !== Core.S.player);
    if(!targets.length){ UI.toast(this, "相邻无目标城池", "warn"); return; }
    Flow.pick(this, "选择出征目标", targets.map(a => ({
      key: a, label: CITY[a].n, sub: "守方：" + Core.lordName(Core.S.cities[a].owner),
      right: `守军 ${Core.S.cities[a].owner >= 0 ? Core.gensAt(a, Core.S.cities[a].owner).reduce((s, g) => s + g.troop, 0) + Core.S.cities[a].reserve : Core.S.cities[a].reserve}`
    })), it => Flow.expedition(this, cid, it.key), { w: 420, rowH: 48 });
  }

  doEndMonth(){
    if(Core.S.gameover) return;
    Sfx.ok();
    Core.endMonth();
    UI.toast(this, `${Core.S.year} 年 ${Core.S.month} 月 · 结算完毕`, "good");
    this.refreshTop(); this.buildCities(); this.refreshInfo();
  }

  /* ---------------- 情报日志 ---------------- */
  refreshLog(){
    this.logLayer.removeAll(true);
    if(!this.logOpen) return;
    const w = 760, h = 240, x = this.MX + 30, y = this.MY + this.MH - h - 30;
    this.logLayer.add(UI.panel(this, x, y, w, h, { fill: 0xf5eed6 }));
    this.logLayer.add(UI.txt(this, x + 14, y + 10, "情 报 日志", 16, "#241a12"));
    const list = UI.listBox(this, x + 10, y + 38, w - 20, h - 52, 20);
    this.logLayer.add(list.container);
    Core.S.log.slice(-40).reverse().forEach(l => {
      const row = this.add.container(0, 0); row.rowH = 20;
      row.add(UI.txt(this, 6, 3, l, 12, l.indexOf("⚠") >= 0 ? "#a83232" : "#3a2c1e"));
      list.add(row);
    });
    list.reflow();
    this.logLayer.setDepth(600);
  }

  /* ---------------- 结局 ---------------- */
  showEnding(r){
    const titles = { win: "◆ 天 下 一 统 ◆", lose: "◆ 霸 业 成 空 ◆", timeup: "◆ 时 限 已 至 ◆" };
    const texts = {
      win: `${r.lord} 席卷宇内，三十八城尽入彀中。\n\n${r.year} 年 ${r.month} 月 · 霸业功成`,
      lose: `${r.lord} 兵败身死，天下与你再无干系。\n\n${r.year} 年 ${r.month} 月`,
      timeup: `${SCENARIOS[Core.S.scen].years} 年期满，你保有 ${r.mine}/${r.total} 城。\n\n` +
              `历史评价：${r.mine > r.total/2 ? "雄踞一方，虽败犹荣" : "泯然众诸侯矣"}`
    };
    const m = UI.modal(this, 520, 280, titles[r.kind]);
    UI.txt(m.body, 0, 70, texts[r.kind], 16, "#3a2c1e", { ox: 0.5, align: "center", wrap: 460, lineSpacing: 8 })
      .setX(260);
    m.body.add(UI.button(this, 170, 196, 180, 40, "再 开 新 局", () => { m.close(); this.scene.start("Title"); }, { size: 16, fill: PAL.gold }));
    r.kind === "win" ? Sfx.fanfare() : Sfx.no();
  }

  showHelp(){
    const m = UI.modal(this, 640, 500, "游 戏 说 明");
    const lines = [
      "【目标】在时限内攻取全部 38 城，一统天下；城池尽失则霸业成空。",
      "【流程】每将每月可执行一条指令，完成后点【结束本月】结算：",
      "　　3/6/9/12 月征税、6/10 月收粮、每月消耗兵粮；",
      "　　并可能发生旱灾、水灾、暴动与饥荒。",
      "【内政】开垦→农业、招商→商业、治理→防灾、出巡→民忠、搜索→人才/道具。",
      "　　征兵数 = 民忠 × 20；带兵上限 = 武×10 + 智×10 + 等级×100。",
      "【军备】征兵入预备役后【分配】给将领；出征限 10 将，战棋决胜，",
      "　　30 日内不克则守方胜。",
      "【兵种】步（山林地强）/ 弓（射程 2）/ 骑（平原快攻）/ 水（河战无敌）",
      "　　/ 极（全项最强）/ 玄（计谋大师）。站错地形攻防暴跌。",
      "【天气】晴→计谋威力最大；雨天只能水淹；冰雹封印大部分计谋。",
      "【忠诚】每月 -1，低于 40 可能叛逃；宴请 +1、赏赐 +8、没收 -20。",
      "　　敌方低忠之将可【招揽】【策反】。",
      "【交易】1 粮 = 5 金。粮上限 65536，溢出会归零，切勿囤积。",
      "【人才】全国散落 80+ 名在野武将，靠【搜索】陆续发掘。",
      "",
      "数据取自原版 ROM（38 城 / 187 将名录 / 计谋表）与社区资料，",
      "部分数值为推测，欢迎反馈调参。"
    ];
    lines.forEach((s, i) => UI.txt(m.body, 26, 54 + i*23, s, 13, i === 0 ? "#8a3a1a" : "#3a2c1e"));
    m.body.add(UI.button(this, 270, 452, 100, 32, "关 闭", () => { m.close(); Sfx.click(); }, { size: 14 }));
  }
}
