/* ================================================================
   通用交互流程：确认框 / 选将 / 武将详情 / 出征
   供 Map / City / Battle 三个场景共用
   ================================================================ */
"use strict";

const Flow = {
  /* ---------- 确认框 ---------- */
  confirm(scene, title, text, onYes, yesLabel){
    const m = UI.modal(scene, 430, 190, title);
    UI.txt(m.body, 26, 52, text, 14, "#3a2c1e", { wrap: 378, lineSpacing: 5 });
    m.body.add(UI.button(scene, 74, 138, 120, 36, yesLabel || "确 定", () => { m.close(); Sfx.ok(); onYes(); }, { size: 15, fill: PAL.gold }));
    m.body.add(UI.button(scene, 236, 138, 120, 36, "取 消", () => { m.close(); Sfx.click(); }, { size: 15 }));
    return m;
  },

  /* ---------- 选择列表 ---------- */
  pick(scene, title, items, cb, o){
    o = o || {};
    const h = Math.min(o.h || 480, 120 + items.length*(o.rowH || 46) + 60);
    const m = UI.modal(scene, o.w || 460, h, title);
    const list = UI.listBox(scene, 20, 48, (o.w || 460) - 40, h - 108, o.rowH || 46);
    m.body.add(list.container);
    if(!items.length){
      list.add(UI.txt(scene, 10, 10, "（无可选项）", 14, "#8a7a62"));
    }
    items.forEach(it => {
      const row = scene.add.container(0, 0);
      row.rowH = o.rowH || 46;
      const w = (o.w || 460) - 48;
      const g = scene.add.graphics();
      const bg = it.color != null ? it.color : PAL.parch2;
      g.fillStyle(PAL.ink, 1); g.fillRect(0, 0, w, (o.rowH || 46) - 6);
      g.fillStyle(bg, 1); g.fillRect(2, 2, w - 4, (o.rowH || 46) - 10);
      row.add(g);
      if(it.face) row.add(UI.face(scene, 8, 7, 32, it.face[0], it.face[1], it.face[2], it.face[3], it.face[4]));
      const tx = it.face ? 48 : 12;
      row.add(UI.txt(scene, tx, 8, it.label, it.size || 15, "#241a12"));
      if(it.sub) row.add(UI.txt(scene, tx, 28, it.sub, 11, "#6b5a44"));
      if(it.right) row.add(UI.txt(scene, w - 12, 14, it.right, 12, "#8a3a1a", { ox: 1 }));
      const hit = scene.add.zone(0, 0, w, (o.rowH || 46) - 6).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on("pointerover", () => { g.clear(); g.fillStyle(PAL.ink, 1); g.fillRect(0, 0, w, (o.rowH || 46) - 6);
        g.fillStyle(PAL.gold, 1); g.fillRect(2, 2, w - 4, (o.rowH || 46) - 10); });
      hit.on("pointerout", () => { g.clear(); g.fillStyle(PAL.ink, 1); g.fillRect(0, 0, w, (o.rowH || 46) - 6);
        g.fillStyle(bg, 1); g.fillRect(2, 2, w - 4, (o.rowH || 46) - 10); });
      hit.on("pointerdown", () => {
        if(!list.hitOK(row)){ Sfx.no(); return; }
        m.close(); Sfx.click(); cb(it);
      });
      row.add(hit);
      row._hit = hit;
      list.add(row);
    });
    list.reflow();
    m.body.add(UI.button(scene, (o.w || 460)/2 - 60, h - 52, 120, 34, "取 消", () => { m.close(); Sfx.click(); }, { size: 14 }));
    return m;
  },

  /* ---------- 选一名将领 ---------- */
  pickGeneral(scene, gens, title, cb){
    const items = gens.map(g => ({
      key: g.name,
      face: [g.name, Core.gForce(g), Core.gIntel(g), g.type, g.lord],
      label: `${g.name}　Lv${g.lv}　${TROOP[g.type].name}`,
      sub: `武 ${Core.gForce(g)}　智 ${Core.gIntel(g)}　兵 ${g.troop}　体 ${g.hp}　忠 ${g.loyal}`,
      right: g.acted ? "已行动" : ""
    }));
    return this.pick(scene, title, items, it => cb(Core.S.gens[it.key]), { w: 480, rowH: 48 });
  },

  /* ---------- 武将详情 ---------- */
  genDetail(scene, name, isCap){
    const g = Core.S.gens[name];
    if(!g){ UI.toast(scene, "查无此人", "warn"); return; }
    const b = Core.genItemBonus(g);
    const m = UI.modal(scene, 470, 400, (isCap ? "【俘虏】" : "") + g.name);
    m.body.add(UI.face(scene, 24, 52, 96, g.name, Core.gForce(g), Core.gIntel(g), g.type, g.lord));
    m.body.add(this.add_frame(scene, 20, 50, 100, 100));
    const rows = [
      ["武力", `${g.f0}${b.f ? " +" + b.f + "(道具)" : ""} = ${Core.gForce(g)}`],
      ["智力", `${g.i0}${b.i ? " +" + b.i + "(道具)" : ""} = ${Core.gIntel(g)}`],
      ["兵种", TROOP[g.type].name + `（移动${TROOP[g.type].mp} 射程${TROOP[g.type].range}）`],
      ["等级", `Lv ${g.lv}　经验 ${g.exp || 0}`],
      ["兵力", `${g.troop} / 上限 ${Core.maxTroop(g)}`],
      ["忠诚", g.lord === Core.S.player ? String(g.loyal) : "—"],
      ["体力", String(g.hp)],
      ["道具", g.items.join("、") || "无"],
      ["驻地", CITY[g.city] ? CITY[g.city].n : "—"]
    ];
    rows.forEach((r, i) => {
      m.body.add(UI.txt(scene, 136, 54 + i*26, r[0], 14, "#6b5a44"));
      m.body.add(UI.txt(scene, 186, 54 + i*26, r[1], 14, "#241a12"));
    });
    m.body.add(UI.txt(scene, 136, 54 + rows.length*26 + 6,
      "可用计谋：" + (Core.availableStratagems({ g, lv: g.lv }).join("、") || "暂无"), 12, "#8a3a1a"));
    m.body.add(UI.button(scene, (470 - 110)/2, 344, 110, 34, "关 闭", () => { m.close(); Sfx.click(); }, { size: 14 }));
    return m;
  },
  add_frame(scene, x, y, w, h){
    const g = scene.add.graphics();
    g.lineStyle(2, PAL.ink, 1); g.strokeRect(x, y, w, h);
    g.lineStyle(1, PAL.gold, 1); g.strokeRect(x + 3, y + 3, w - 6, h - 6);
    return g;
  },

  /* ---------- 出征 ---------- */
  expedition(scene, from, to){
    const gs = Core.gensAt(from, Core.S.player).filter(g => g.troop > 0);
    if(!gs.length){
      UI.toast(scene, `${CITY[from].n} 无带兵将领，请先【征兵】后【分配】兵力`, "warn");
      return;
    }
    const sel = [];
    const m = UI.modal(scene, 620, 520, `出征 · ${CITY[to].n}`);
    m.body.add(UI.txt(scene, 26, 52,
      `守方：${Core.lordName(Core.S.cities[to].owner)}　最多 10 将，勾选后点【出征】`, 13, "#6b5a44"));

    const list = UI.listBox(scene, 20, 78, 580, 356, 50);
    m.body.add(list.container);
    const rows = [];
    gs.forEach(g => {
      const row = scene.add.container(0, 0);
      row.rowH = 50;
      const w = 580 - 8;
      const g2 = scene.add.graphics();
      const paint = on => {
        g2.clear();
        g2.fillStyle(PAL.ink, 1); g2.fillRect(0, 0, w, 44);
        g2.fillStyle(on ? PAL.gold : PAL.parch2, 1); g2.fillRect(2, 2, w - 4, 40);
        if(on){ g2.lineStyle(2, PAL.red, 1); g2.strokeRect(3, 3, w - 6, 38); }
      };
      paint(false);
      row.add(g2);
      row.add(UI.face(scene, 8, 6, 32, g.name, Core.gForce(g), Core.gIntel(g), g.type, g.lord));
      row.add(UI.txt(scene, 48, 7, `${g.name}　${TROOP[g.type].name}`, 15, "#241a12"));
      row.add(UI.txt(scene, 48, 28, `武${Core.gForce(g)} 智${Core.gIntel(g)} Lv${g.lv}`, 11, "#6b5a44"));
      row.add(UI.txt(scene, w - 12, 14, `兵 ${g.troop}`, 14, "#8a3a1a", { ox: 1 }));
      const hit = scene.add.zone(0, 0, w, 44).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => {
        if(!list.hitOK(row)){ Sfx.no(); return; }
        const i = sel.indexOf(g.name);
        if(i >= 0){ sel.splice(i, 1); paint(false); }
        else { if(sel.length >= 10){ UI.toast(scene, "最多 10 将", "warn"); return; } sel.push(g.name); paint(true); }
        Sfx.click();
      });
      row.add(hit);
      row._hit = hit;
      rows.push(row);
      list.add(row);
    });
    list.reflow();

    m.body.add(UI.button(scene, 150, 452, 130, 40, "出 征", () => {
      if(!sel.length){ UI.toast(scene, "至少选一将", "warn"); return; }
      m.close(); Sfx.fanfare();
      UI.fadeTo(scene, "Battle", { from, to, names: sel.slice() });
    }, { size: 16, fill: PAL.red }));
    m.body.add(UI.button(scene, 340, 452, 130, 40, "取 消", () => { m.close(); Sfx.click(); }, { size: 16 }));
    return m;
  }
};
