/* ================= 城池内政场景 ================= */
"use strict";

class CityScene extends Phaser.Scene {
  constructor(){ super("City"); }

  init(data){ this.cid = data && data.cid ? data.cid : Core.curCity; }

  create(){
    Core.curCity = this.cid;
    const W = LW, H = LH;
    const g = this.add.graphics();
    for(let y = 0; y < H; y += 6){ g.fillStyle(y % 12 === 0 ? 0x3a3020 : 0x322a1c, 1); g.fillRect(0, y, W, 6); }

    this.buildHeader();
    this.buildStatus();
    this.buildCommands();
    this.buildLog();

    this._onRefresh = () => this.rebuild();
    this._onToast = d => UI.toast(this, d.msg, d.kind);
    Core.on("refresh", this._onRefresh).on("toast", this._onToast);
    this.events.once("shutdown", () => {
      Core._ev.refresh = (Core._ev.refresh || []).filter(f => f !== this._onRefresh);
      Core._ev.toast = (Core._ev.toast || []).filter(f => f !== this._onToast);
    });
  }

  unbind(){
    if(!this._onRefresh) return;
    Core._ev.refresh = (Core._ev.refresh || []).filter(f => f !== this._onRefresh);
    Core._ev.toast = (Core._ev.toast || []).filter(f => f !== this._onToast);
    this._onRefresh = null; this._onToast = null;
  }
  rebuild(){
    this.unbind();
    this.children.removeAll(true);
    this.create();
  }

  buildHeader(){
    const c = CITY[this.cid], st = Core.S.cities[this.cid];
    const own = st.owner >= 0 ? Core.gensAt(this.cid, st.owner) : [];
    const faceG = own[0];
    UI.panel(this, 0, 0, LW, 46, { fill: PAL.parch2, notch: false });
    this.add.graphics().fillStyle(PAL.gold, 1).fillRect(0, 44, LW, 2);
    if(faceG) this.add.image(14, 6, Art.makeFace(this, faceG.name, Core.gForce(faceG), Core.gIntel(faceG), faceG.type, st.owner)).setDisplaySize(34, 34).setOrigin(0);
    UI.txt(this, 56, 12, `${c.n} —— ${Core.lordName(st.owner)}`, 22, "#241a12");
    UI.txt(this, 340, 18, `人口 ${st.pop}　金 ${st.gold}　粮 ${st.grain}　预备役 ${st.reserve}`, 13, "#6b5a44");
    this.hintText = UI.txt(this, 706, 18, "▸ 将鼠标移到指令上查看说明", 12, "#d9a441");
    UI.button(this, LW - 156, 7, 140, 32, "返 回 地 图",
      () => { Sfx.click(); UI.fadeTo(this, "Map"); }, { size: 14 });
  }

  buildStatus(){
    const st = Core.S.cities[this.cid];
    UI.panel(this, 8, 54, 332, 216, { fill: PAL.parch });
    const p = this.add.container(8, 54);
    p.add(UI.txt(this, 16, 12, "城 市 状 态", 17, "#241a12"));
    p.add(this.add.graphics().fillStyle(PAL.gold, 1).fillRect(16, 36, 300, 2));
    [["农业", st.ag, PAL.green], ["商业", st.bu, PAL.blue], ["民忠", st.loy, PAL.gold], ["防灾", st.df, PAL.purple]]
      .forEach((r, i) => {
        const y = 48 + i*30;
        p.add(UI.txt(this, 16, y, r[0], 14, "#6b5a44"));
        p.add(UI.bar(this, 62, y + 2, 190, 10, r[1]/100, r[2]));
        p.add(UI.txt(this, 262, y, String(Math.round(r[1])), 13, "#241a12"));
      });
    p.add(UI.txt(this, 16, 176, `可征兵　${Math.floor(st.loy*20)}`, 12, "#8a3a1a"));
    p.add(UI.txt(this, 170, 176, `耗金　${Math.floor(st.loy*20)*2}`, 12, "#8a3a1a"));

    UI.panel(this, 8, 278, 332, 300, { fill: PAL.parch });
    this.add.container(8, 278).add([
      UI.txt(this, 16, 10, "驻 城 将 领", 17, "#241a12"),
      this.add.graphics().fillStyle(PAL.gold, 1).fillRect(16, 34, 300, 2)
    ]);
    this.genList = UI.listBox(this, 16, 320, 316, 244, 40);
    this.fillGens();

    UI.panel(this, 8, 586, 332, 126, { fill: PAL.parch });
    this.add.container(8, 586).add([
      UI.txt(this, 16, 8, "俘 虏", 16, "#241a12"),
      this.add.graphics().fillStyle(PAL.gold, 1).fillRect(16, 30, 300, 2)
    ]);
    this.capList = UI.listBox(this, 16, 620, 316, 82, 38);
    this.fillCaps();
  }

  fillGens(){
    this.genList.clear();
    const gs = Core.gensAt(this.cid, Core.S.player);
    gs.forEach(g => {
      const row = this.add.container(0, 0); row.rowH = 40;
      const bg = this.add.graphics();
      const paint = hov => {
        bg.clear();
        bg.fillStyle(PAL.ink, 1); bg.fillRect(0, 0, 308, 34);
        bg.fillStyle(hov ? PAL.gold : (g.acted ? 0xc9bda0 : PAL.parch2), 1); bg.fillRect(2, 2, 304, 30);
      };
      paint(false); row.add(bg);
      row.add(UI.face(this, 6, 5, 24, g.name, Core.gForce(g), Core.gIntel(g), g.type, g.lord));
      row.add(UI.txt(this, 36, 4, `${g.name}　${TROOP[g.type].name}${g.acted ? "　✔ 已行动" : ""}`, 14, g.acted ? "#8a7a62" : "#241a12"));
      row.add(UI.txt(this, 36, 21, `武${Core.gForce(g)} 智${Core.gIntel(g)} Lv${g.lv} 兵${g.troop} 忠${g.loyal} 体${g.hp}`, 10, "#6b5a44"));
      row.add(UI.txt(this, 302, 10, g.items.length ? "◆" + g.items.length : "", 12, "#8a3a1a", { ox: 1 }));
      const hit = this.add.zone(0, 0, 308, 34).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on("pointerover", () => { if(this.genList.hitOK(row)) paint(true); });
      hit.on("pointerout", () => paint(false));
      hit.on("pointerdown", () => { if(!this.genList.hitOK(row)){ Sfx.no(); return; } Sfx.click(); Flow.genDetail(this, g.name); });
      row.add(hit);
      row._hit = hit;
      this.genList.add(row);
    });
    if(!gs.length) this.genList.add(UI.txt(this, 8, 8, "（空城无将）", 13, "#8a7a62"));
    this.genList.reflow();
  }

  fillCaps(){
    this.capList.clear();
    const caps = Core.playerFac().captives;
    caps.forEach(n => {
      const g = Core.S.gens[n];
      const row = this.add.container(0, 0); row.rowH = 38;
      const bg = this.add.graphics();
      bg.fillStyle(PAL.ink, 1); bg.fillRect(0, 0, 308, 32);
      bg.fillStyle(PAL.parch2, 1); bg.fillRect(2, 2, 304, 28);
      row.add(bg);
      if(g) row.add(UI.face(this, 6, 4, 24, g.name, Core.gForce(g), Core.gIntel(g), g.type, g.lord));
      row.add(UI.txt(this, 36, 8, n + "（俘虏）", 14, "#241a12"));
      const hit = this.add.zone(0, 0, 308, 32).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => { if(!this.capList.hitOK(row)){ Sfx.no(); return; } Sfx.click(); Flow.genDetail(this, n, true); });
      row.add(hit);
      row._hit = hit;
      this.capList.add(row);
    });
    if(!caps.length) this.capList.add(UI.txt(this, 8, 6, "（无俘虏）", 12, "#8a7a62"));
    this.capList.reflow();
  }

  buildLog(){
    UI.panel(this, 352, 516, 792, 196, { fill: PAL.parch });
    const p = this.add.container(352, 516);
    p.add(UI.txt(this, 16, 10, "近 期 情 报", 16, "#241a12"));
    p.add(this.add.graphics().fillStyle(PAL.gold, 1).fillRect(16, 32, 760, 2));
    Core.S.log.slice(-8).reverse().forEach((l, i) => {
      p.add(UI.txt(this, 16, 40 + i*19, "· " + l.replace(/^【[^】]*】/, ""), 12,
        l.indexOf("⚠") >= 0 ? "#a83232" : "#3a2c1e"));
    });
  }

  /* ---------------- 指令区 ---------------- */
  buildCommands(){
    const X = 352, W = 792;
    const groups = [
      { t: "内 政", items: [
        ["开垦", "提高农业（体20 金200）", () => this.withGen("开垦：提高农业", g => Core.cmdKaiKen(g))],
        ["招商", "提高商业（体20 金200）", () => this.withGen("招商：提高商业", g => Core.cmdZhaoShang(g))],
        ["搜索", "寻访在野武将与道具（体20）", () => this.withGen("搜索：访才寻宝", g => {
          const r = Core.cmdSouSuo(g);
          if(r && r.kind === "gen") UI.toast(this, `访得 ${r.name}！`, "good");
          else if(r && r.kind === "item") UI.toast(this, `获得【${r.name}】！`, "good");
          else if(r && r.kind === "gold") UI.toast(this, `获金 ${r.amount}`, "good");
          else UI.toast(this, "一无所获…", "info");
        })],
        ["治理", "提高防灾（体15）", () => this.withGen("治理：提高防灾", g => Core.cmdZhiLi(g))],
        ["出巡", "提高民忠（体15）", () => this.withGen("出巡：提高民忠", g => Core.cmdChuXun(g))]
      ]},
      { t: "军 备", items: [
        ["征兵", "民忠 × 20 入预备役", () => {
          const st = Core.S.cities[this.cid], n = Math.floor(st.loy*20);
          Flow.confirm(this, "征 兵", `民忠 ${st.loy} → 可征 ${n} 兵，耗金 ${n*2}，民忠 -2。`,
            () => { if(Core.cmdZhengBing()) UI.toast(this, `征兵 ${n}`, "good"); Core.refresh(); });
        }],
        ["分配", "预备役分给将领", () => {
          const st = Core.S.cities[this.cid];
          if(st.reserve <= 0){ UI.toast(this, "无预备役兵力", "warn"); return; }
          const gs = Core.gensAt(this.cid, Core.S.player).filter(g => g.troop < Core.maxTroop(g));
          if(!gs.length){ UI.toast(this, "无可分兵将领", "warn"); return; }
          Flow.pick(this, `分配预备役（余 ${st.reserve}）`, gs.map(g => ({
            key: g.name, face: [g.name, Core.gForce(g), Core.gIntel(g), g.type, g.lord],
            label: `${g.name}　${TROOP[g.type].name}`, sub: `兵 ${g.troop} / ${Core.maxTroop(g)}`
          })), it => { const n = Core.cmdFenPei(it.key); if(n) UI.toast(this, `${it.key} 得兵 ${n}`, "good"); Core.refresh(); }, { w: 460 });
        }],
        ["掠夺", "榨取本城钱粮，民忠减半", () => {
          Flow.confirm(this, "掠 夺", "夺取本城金钱粮草各 30%，民忠减半，农业商业 -15。确定？",
            () => { Core.cmdLveDuo(); UI.toast(this, "掠夺完成", "warn"); Core.refresh(); }, "掠 夺");
        }],
        ["出征", "攻打相邻城池", () => {
          const targets = CITY[this.cid].adj.filter(a => Core.S.cities[a].owner !== Core.S.player);
          if(!targets.length){ UI.toast(this, "相邻无目标城池", "warn"); return; }
          Flow.pick(this, "出征目标", targets.map(a => ({
            key: a, label: CITY[a].n, sub: "守方：" + Core.lordName(Core.S.cities[a].owner),
            right: `守军 ${(Core.S.cities[a].owner >= 0 ? Core.gensAt(a, Core.S.cities[a].owner).reduce((s, g) => s + g.troop, 0) : 0) + Core.S.cities[a].reserve}`
          })), it => Flow.expedition(this, this.cid, it.key), { w: 420 });
        }]
      ]},
      { t: "外 交", items: [
        ["离间", "降低敌将忠诚（金200）", () => this.diplomacy("离间：降低敌将忠诚", (cid, g) => {
          const r = Core.cmdLiJian(cid, g);
          if(r) UI.toast(this, `${r.target} 忠诚 -${r.cut}`, "good");
        })],
        ["招揽", "招降忠诚 <60 敌将（金500）", () => this.diplomacy("招揽：说客前往", (cid, g) => {
          const r = Core.cmdZhaoLan(cid, g);
          if(r) UI.toast(this, r.ok ? `${r.target} 来投！` : `${r.target} 不为所动`, r.ok ? "good" : "info");
        })],
        ["策反", "使忠诚 <50 敌将下野（金300）", () => this.diplomacy("策反：密使前往", (cid, g) => {
          const r = Core.cmdCeFan(cid, g);
          if(r) UI.toast(this, r.ok ? `${r.target} 弃官而去` : "策反失败", r.ok ? "good" : "info");
        })],
        ["劝降", "威压相邻势力举城归降", () => {
          const r = Core.cmdQuanXiang();
          if(r) UI.toast(this, r.ok ? `${r.lord} 举城归降！` : `${r.lord} 严词拒绝`, r.ok ? "good" : "warn");
          else Core.refresh();
          Core.refresh();
        }]
      ]},
      { t: "人 事", items: [
        ["宴请", "体力 +50 忠诚 +1（金100）", () => this.withGen("宴请：款待将领", g => Core.cmdYanQing(g), false)],
        ["赏赐", "忠诚 +8（金500）", () => this.withGen("赏赐：重赏将领", g => Core.cmdShangCi(g), false)],
        ["没收", "充公 +300 金，忠诚 -20", () => this.withGen("没收：抄没财物", g => Core.cmdMeiShou(g), false)],
        ["招降", "说服俘虏归顺", () => {
          const caps = Core.playerFac().captives;
          if(!caps.length){ UI.toast(this, "无俘虏", "warn"); return; }
          Flow.pick(this, "招降俘虏", caps.map(n => {
            const g = Core.S.gens[n] || { name: n, f0: 60, i0: 60, type: "步", lv: 1 };
            return { key: n, face: [n, Core.gForce(g), Core.gIntel(g), g.type, g.lord], label: n, sub: `武${Core.gForce(g)} 智${Core.gIntel(g)}` };
          }), it => {
            const r = Core.cmdZhaoXiang(it.key);
            if(r) UI.toast(this, r.ok ? `${it.key} 归顺！` : `${it.key} 拒不投降`, r.ok ? "good" : "info");
            Core.refresh();
          }, { w: 440 });
        }],
        ["处斩", "处死俘虏，全军忠诚 -3", () => {
          const caps = Core.playerFac().captives;
          if(!caps.length){ UI.toast(this, "无俘虏", "warn"); return; }
          Flow.pick(this, "处斩俘虏", caps.map(n => ({ key: n, label: n, sub: "三军震悚", color: 0xd9b0a8 })),
            it => { Core.cmdChuZhan(it.key); UI.toast(this, `${it.key} 被处斩`, "warn"); Core.refresh(); }, { w: 400 });
        }],
        ["流放", "逐走本城将领", () => this.withGen("流放：逐走将领", g => {
          Core.cmdLiuFang(g.name); UI.toast(this, `${g.name} 被流放`, "warn");
        }, false)]
      ]},
      { t: "物 资", items: [
        ["交易", "1 粮 = 5 金", () => {
          const st = Core.S.cities[this.cid];
          Flow.pick(this, `交易（金 ${st.gold}　粮 ${st.grain}）`, [
            { key: "b1000", label: "买入 1000 粮", sub: "耗金 5000" },
            { key: "b5000", label: "买入 5000 粮", sub: "耗金 25000" },
            { key: "s1000", label: "卖出 1000 粮", sub: "得金 5000" },
            { key: "s5000", label: "卖出 5000 粮", sub: "得金 25000" }
          ], it => {
            const buy = it.key[0] === "b", amt = parseInt(it.key.slice(1));
            if(Core.cmdJiaoYi(buy, amt)) UI.toast(this, `${buy ? "买入" : "卖出"} ${amt} 粮`, "good");
            Core.refresh();
          }, { w: 420, rowH: 46 });
        }],
        ["输送", "半数钱粮送邻城（10% 被劫）", () => {
          const ts = CITY[this.cid].adj.filter(a => Core.S.cities[a].owner === Core.S.player);
          if(!ts.length){ UI.toast(this, "无相邻我方城池", "warn"); return; }
          Flow.pick(this, "输送至", ts.map(a => ({ key: a, label: CITY[a].n, sub: "输送半数钱粮" })),
            it => { const r = Core.cmdShuSong(it.key);
              UI.toast(this, r === "lost" ? "车队遇袭，物资尽失！" : "输送完成", r === "lost" ? "bad" : "good"); Core.refresh(); }, { w: 400 });
        }],
        ["移动", "将领调往相邻己城", () => {
          const ts = CITY[this.cid].adj.filter(a => Core.S.cities[a].owner === Core.S.player);
          if(!ts.length){ UI.toast(this, "无相邻我方城池", "warn"); return; }
          Flow.pick(this, "移动至", ts.map(a => ({ key: a, label: CITY[a].n, sub: "调将前往" })), it => {
            this.withGen("选择移动的将领（体10）", g => Core.cmdYiDong(it.key, g));
          }, { w: 400 });
        }]
      ]}
    ];

    const bh = 50;
    groups.forEach((grp, gi) => {
      const y = 54 + gi*92;
      const p = this.add.container(X, y);
      p.add(UI.txt(this, 4, 0, grp.t, 16, "#d9a441"));
      p.add(this.add.graphics().fillStyle(PAL.gold, 0.9).fillRect(4, 22, 150, 2));
      const n = grp.items.length;
      const bw = Math.floor((W - (n - 1)*12)/n);
      grp.items.forEach((it, i) => {
        const b = UI.button(this, X + i*(bw + 12), y + 30, bw, bh, it[0], () => { it[2](); Core.refresh(); }, { size: 16 });
        b.on("pointerover", () => { if(this.hintText) this.hintText.setText("▸ " + it[1]); });
        b.on("pointerout", () => { if(this.hintText) this.hintText.setText("▸ 将鼠标移到指令上查看说明"); });
      });
    });
  }

  withGen(title, fn, freeOnly){
    const gs = (freeOnly === false ? Core.gensAt(this.cid, Core.S.player) : Core.freeGens(this.cid));
    if(!gs.length){ UI.toast(this, freeOnly === false ? "本城无将领" : "本城无空闲将领", "warn"); return; }
    Flow.pickGeneral(this, gs, title, g => { fn(g); Core.refresh(); });
  }

  diplomacy(title, fn){
    const adj = CITY[this.cid].adj.filter(a => Core.S.cities[a].owner >= 0 && Core.S.cities[a].owner !== Core.S.player);
    if(!adj.length){ UI.toast(this, "相邻无敌方城池", "warn"); return; }
    Flow.pick(this, "选择目标城池", adj.map(a => ({
      key: a, label: CITY[a].n, sub: Core.lordName(Core.S.cities[a].owner) + " 领地"
    })), it => {
      const gs = Core.freeGens(this.cid);
      if(!gs.length){ UI.toast(this, "本城无空闲将领", "warn"); return; }
      Flow.pickGeneral(this, gs, title, g => { fn(it.key, g); Core.refresh(); });
    }, { w: 420, rowH: 46 });
  }
}
