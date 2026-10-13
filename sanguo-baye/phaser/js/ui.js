/* ================================================================
   UI 组件库 —— 复古羊皮纸风格，全部用 Graphics 绘制
   ================================================================ */
"use strict";

/* 像素字体优先（无抗锯齿最锐利）；未安装时回退到黑体系——
   宋体小字号横细竖粗，在 canvas 上抗锯齿后发灰发糊，故排到最后。 */
const FONT = '"Zpix","方正像素12","Fusion Pixel 12px","方正像素14",'
  + '"Microsoft YaHei","微软雅黑","PingFang SC","Noto Sans SC","Source Han Sans SC",'
  + '"Heiti SC","SimHei","黑体","SimSun","宋体",sans-serif';

const Sfx = {
  ctx: null,
  on: true,
  init(){
    try{ this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ this.ctx = null; }
  },
  blip(freq, dur, type, vol){
    if(!this.on || !this.ctx) return;
    try{
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type || "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.05, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.08));
      o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + (dur || 0.08));
    }catch(e){}
  },
  click(){ this.blip(520, 0.05, "square", 0.045); },
  hover(){ this.blip(760, 0.03, "square", 0.02); },
  ok(){ this.blip(660, 0.09, "triangle", 0.06); },
  no(){ this.blip(180, 0.14, "sawtooth", 0.05); },
  hit(){ this.blip(120, 0.12, "sawtooth", 0.06); },
  fanfare(){ [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, "triangle", 0.06), i*90)); }
};

const UI = {
  /* ---------- 文本 ---------- */
  txt(scene, x, y, str, size, color, opts){
    const o = opts || {};
    const t = scene.add.text(x, y, str, {
      fontFamily: FONT,
      /* 10~11px 的 CJK 字形下缘会被测量高度裁掉，且过于细碎，最低 12px */
      fontSize: Math.max(12, size || 14) + "px",
      color: color || "#241a12",
      resolution: 2,
      align: o.align || "left",
      lineSpacing: o.lineSpacing == null ? 4 : o.lineSpacing,
      wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
      padding: { x: 1, y: 2 }
    });
    t.setOrigin(o.ox == null ? 0 : o.ox, o.oy == null ? 0 : o.oy);
    if(o.shadow !== false){
      t.setShadow(1, 1, "rgba(60,45,30,0.28)", 0, false, false);
    }
    return t;
  },

  /* ---------- 面板 ---------- */
  panel(scene, x, y, w, h, o){
    o = o || {};
    const fill = o.fill == null ? PAL.parch : o.fill;
    const border = o.border == null ? PAL.ink : o.border;
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    g.fillStyle(border, o.alpha == null ? 1 : o.alpha); g.fillRect(0, 0, w, h);
    g.fillStyle(fill, o.alpha == null ? 1 : o.alpha); g.fillRect(2, 2, w - 4, h - 4);
    g.lineStyle(1, 0xffffff, 0.28); g.strokeRect(2.5, 2.5, w - 5, h - 5);
    if(o.notch !== false){
      g.fillStyle(PAL.gold, 1);
      [[2,2],[w-8,2],[2,h-8],[w-8,h-8]].forEach(p => g.fillRect(p[0], p[1], 6, 1));
      [[2,2],[w-8,2],[2,h-8],[w-8,h-8]].forEach(p => g.fillRect(p[0], p[1], 1, 6));
    }
    c.add(g);
    return c;
  },

  /* ---------- 按钮 ---------- */
  button(scene, x, y, w, h, label, onClick, o){
    o = o || {};
    const size = o.size || 14;
    const base = o.fill == null ? PAL.parch2 : o.fill;
    const border = o.border == null ? PAL.ink : o.border;
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    const draw = (hover, active) => {
      g.clear();
      g.fillStyle(PAL.ink, 0.35); g.fillRect(1, 2, w, h);          // 投影
      g.fillStyle(border, 1); g.fillRect(0, 0, w, h);
      g.fillStyle(active ? PAL.gold : (hover ? PAL.parch : base), 1);
      g.fillRect(2, 2, w - 4, h - 4);
      g.lineStyle(1, 0xffffff, hover ? 0.5 : 0.25); g.strokeRect(2.5, 2.5, w - 5, h - 5);
    };
    draw(false, false);
    const t = scene.add.text(w/2, h/2, label, {
      fontFamily: FONT, fontSize: size + "px", color: "#241a12", resolution: 2, align: "center"
    }).setOrigin(0.5);
    t.setShadow(1, 1, "rgba(60,45,30,0.25)", 0);
    c.add([g, t]);
    c.setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    let act = !!o.active;
    c.on("pointerover", () => { draw(true, act); scene.tweens.add({ targets: c, scaleX: 1.03, scaleY: 1.03, duration: 90 }); Sfx.hover(); });
    c.on("pointerout",  () => { draw(false, act); scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 90 }); });
    c.on("pointerdown", () => { if(o.disabled) { Sfx.no(); return; } Sfx.click(); onClick && onClick(); });
    if(o.active) draw(false, true);
    c.setActive = v => { act = v; draw(false, v); };
    c.setLabel = v => t.setText(v);
    c.setDisabled = v => { o.disabled = v; t.setAlpha(v ? 0.42 : 1); };
    if(o.disabled) c.setDisabled(true);
    return c;
  },

  /* ---------- 可滚动列表 ---------- */
  listBox(scene, x, y, w, h, rowH, o){
    o = o || {};
    const c = scene.add.container(x, y);
    const bg = this.panel(scene, 0, 0, w, h, { fill: o.fill == null ? PAL.parch : o.fill });
    const inner = scene.add.container(4, 4);
    /* GeometryMask 不跟随容器变换，故遮罩图形留在场景根，
       用容器世界坐标同步位置（兼容直接放场景或放进弹窗） */
    const shape = scene.make.graphics({ x: 0, y: 0, add: true }).setVisible(false);
    shape.fillStyle(0xffffff); shape.fillRect(3, 3, w - 6, h - 6);
    const mask = shape.createGeometryMask();
    inner.setMask(mask);
    const syncMask = () => { const m = c.getWorldTransformMatrix(); shape.setPosition(m.tx + 3, m.ty + 3); };
    c.add([bg, inner]);
    let scroll = 0, maxScroll = 0;
    const api = {
      container: c, inner,
      add(item){ inner.add(item); },
      clear(){ inner.removeAll(true); },
      reflow(){
        let yy = 0;
        inner.list.forEach(el => { el.y = yy; yy += (el.rowH || rowH); });
        maxScroll = Math.max(0, yy - (h - 8));
        api.clamp();
        syncMask();
      },
      clamp(){ scroll = clamp(scroll, 0, maxScroll); inner.y = 4 - scroll; api.syncHits(); syncMask(); },
      scrollBy(d){ scroll = clamp(scroll + d, 0, maxScroll); inner.y = 4 - scroll; api.syncHits(); },
      /* 行是否处于可视区（遮罩只影响渲染，点击需自行判断） */
      hitOK(row){
        const top = y + inner.y + row.y;
        return top >= y + 2 && top + (row.rowH || rowH) <= y + h - 2;
      },
      /* 按可视区开关每行的输入，防止看不见的行挡住下层控件 */
      syncHits(){
        inner.list.forEach(row => {
          if(row._hit && row._hit.input) row._hit.input.enabled = api.hitOK(row);
        });
      },
      onWheel(dy){ api.scrollBy(dy); }
    };
    const onWheel = (pointer, over, dx, dy) => {
      const m = c.getWorldTransformMatrix();
      const lx = pointer.x - m.tx, ly = pointer.y - m.ty;
      if(lx >= 0 && lx <= w && ly >= 0 && ly <= h) api.scrollBy(dy > 0 ? 26 : -26);
    };
    scene.input.on("wheel", onWheel);
    c.once(Phaser.GameObjects.Events.DESTROY, () => scene.input.off("wheel", onWheel));
    return api;
  },

  /* ---------- 头像 ---------- */
  face(scene, x, y, size, name, force, intel, troop, lordIdx){
    const key = Art.makeFace(scene, name, force, intel, troop, lordIdx);
    const img = scene.add.image(x, y, key);
    img.setDisplaySize(size, size);
    img.setOrigin(0, 0);
    return img;
  },

  /* ---------- 弹窗 ---------- */
  modal(scene, w, h, title, o){
    o = o || {};
    const W = LW, H = LH;
    const c = scene.add.container(0, 0).setDepth(900);
    const shade = scene.add.rectangle(0, 0, W, H, 0x140f0a, 0.62).setOrigin(0);
    shade.setInteractive();
    const px = Math.round((W - w)/2), py = Math.round((H - h)/2);
    const p = this.panel(scene, px, py, w, h, { fill: o.fill == null ? PAL.parch : o.fill });
    const items = [shade, p];
    if(title){
      const tb = scene.add.graphics();
      tb.fillStyle(PAL.ink, 1); tb.fillRect(px + 8, py + 10, w - 16, 26);
      tb.fillStyle(PAL.gold, 1); tb.fillRect(px + 8, py + 34, w - 16, 2);
      const tt = this.txt(scene, px + w/2, py + 15, title, 17, "#f2e5c4", { ox: 0.5, shadow: false });
      items.push(tb, tt);
    }
    const body = scene.add.container(px, py);
    items.push(body);
    c.add(items);
    c.body = body;
    c.close = () => {
      scene.tweens.add({ targets: c, alpha: 0, duration: 140, onComplete: () => c.destroy() });
    };
    scene.tweens.add({ targets: c, alpha: { from: 0, to: 1 }, duration: 160 });
    return c;
  },

  /* ---------- 浮动提示 ---------- */
  toast(scene, msg, kind){
    const W = LW;
    const colors = { info: "#241a12", warn: "#8a3a1a", good: "#2a5a2a", bad: "#8a1e1e" };
    const bg = kind === "warn" ? PAL.gold : (kind === "bad" ? 0xd08a7a : PAL.parch);
    const w = Math.max(180, msg.length*15 + 40);
    const c = scene.add.container(Math.round((W - w)/2), 74).setDepth(950);
    const g = scene.add.graphics();
    g.fillStyle(PAL.ink, 1); g.fillRect(0, 0, w, 34);
    g.fillStyle(bg, 1); g.fillRect(2, 2, w - 4, 30);
    const t = this.txt(scene, w/2, 17, msg, 15, colors[kind] || "#241a12", { ox: 0.5, oy: 0.5, shadow: false });
    c.add([g, t]);
    c.setAlpha(0); c.y = 60;
    scene.tweens.add({ targets: c, alpha: 1, y: 74, duration: 160, ease: "Back.easeOut" });
    scene.tweens.add({ targets: c, alpha: 0, y: 54, delay: 1500, duration: 300, onComplete: () => c.destroy() });
    return c;
  },

  /* ---------- 场景切换 ---------- */
  fadeTo(scene, target, data){
    const W = LW, H = LH;
    const r = scene.add.rectangle(0, 0, W, H, 0x140f0a, 1).setOrigin(0).setDepth(2000);
    r.setAlpha(0);
    scene.tweens.add({ targets: r, alpha: 1, duration: 180, onComplete: () => scene.scene.start(target, data) });
  },

  /* ---------- 统计条 ---------- */
  bar(scene, x, y, w, h, ratio, color, bg){
    const g = scene.add.graphics();
    g.fillStyle(PAL.ink, 1); g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(bg == null ? 0x6b5a44 : bg, 1); g.fillRect(x, y, w, h);
    g.fillStyle(color, 1); g.fillRect(x, y, Math.max(0, Math.round(w*clamp(ratio, 0, 1))), h);
    g.fillStyle(0xffffff, 0.22); g.fillRect(x, y, Math.max(0, Math.round(w*clamp(ratio, 0, 1))), 1);
    return g;
  }
};
