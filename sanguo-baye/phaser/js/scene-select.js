/* ================= 剧本 / 君主选择 ================= */
"use strict";

class SelectScene extends Phaser.Scene {
  constructor(){ super("Select"); }

  create(){
    this.drawBg();
    this.showScenarios();
  }

  drawBg(){
    const W = LW, H = LH;
    const g = this.add.graphics();
    for(let i = 0; i < H; i += 4){ g.fillStyle(i % 8 === 0 ? 0xe8d9b4 : 0xe3d3ac, 1); g.fillRect(0, i, W, 4); }
    g.fillStyle(0x241a12, 0.10);
    for(let i = 0; i < 90; i++){
      const x = (i*137) % W, y = (i*271) % H;
      g.fillRect(x, y, 2, 2);
    }
  }

  /* ---------------- 第 1 页：剧本 ---------------- */
  showScenarios(){
    this.children.removeAll(true);
    this.drawBg();
    const sc = this;
    UI.txt(this, LW/2, 26, "选 择 时 期", 30, "#241a12", { ox: 0.5 });
    this.add.graphics().fillStyle(PAL.gold, 1).fillRect(LW/2 - 120, 68, 240, 2);

    SCENARIOS.forEach((s, i) => {
      const cw = 468, ch = 168;
      const x = 30 + (i % 2)*(cw + 28), y = 92 + Math.floor(i/2)*(ch + 26);
      const c = this.add.container(x, y);
      const card = UI.panel(this, 0, 0, cw, ch, { fill: PAL.parch });
      const hit = this.add.zone(0, 0, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      c.add([card, hit]);
      c.add(UI.txt(this, 22, 16, s.name, 26, "#241a12"));
      c.add(this.add.graphics().fillStyle(PAL.gold, 1).fillRect(22, 52, cw - 44, 2));
      c.add(UI.txt(this, 22, 62, s.desc, 13, "#5a4a34", { wrap: cw - 44, lineSpacing: 6 }));
      c.add(UI.txt(this, 22, ch - 34,
        `起始 ${s.year} 年 ${s.month} 月 · 时限 ${s.years} 年 · 势力 ${s.factions.length} 家`,
        12, "#8a3a1a", {}));
      // 装饰：虎符印
      const seal = this.add.graphics();
      seal.fillStyle(PAL.red, 0.85); seal.fillRect(cw - 58, ch - 46, 36, 36);
      seal.fillStyle(PAL.parch, 1); seal.fillRect(cw - 50, ch - 38, 20, 20);
      c.add(seal);

      hit.on("pointerover", () => { this.tweens.add({ targets: c, y: y - 4, duration: 120 }); Sfx.hover(); });
      hit.on("pointerout",  () => { this.tweens.add({ targets: c, y: y, duration: 120 }); });
      hit.on("pointerdown", () => { Sfx.ok(); Core.chosenScen = i; this.showRulers(); });
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, delay: i*70, duration: 260 });
    });

    UI.button(this, LW/2 - 70, 590, 140, 38, "返 回 标 题",
      () => this.scene.start("Title"), { size: 15 });
  }

  /* ---------------- 第 2 页：君主 ---------------- */
  showRulers(){
    this.children.removeAll(true);
    this.drawBg();
    const sc = SCENARIOS[Core.chosenScen], W = LW;
    UI.txt(this, W/2, 20, "选 择 君 主 · " + sc.name, 26, "#241a12", { ox: 0.5 });
    this.add.graphics().fillStyle(PAL.gold, 1).fillRect(W/2 - 160, 58, 320, 2);
    UI.txt(this, W/2, 64, "强主易上手，弱主更具挑战（依演义设定）", 12, "#6b5a44", { ox: 0.5 });

    const cw = 232, ch = 66, gap = 12, cols = 4;
    sc.factions.forEach((f, i) => {
      const col = i % cols, row = Math.floor(i/cols);
      const x = 28 + col*(cw + gap), y = 92 + row*(ch + gap);
      const c = this.add.container(x, y);
      const card = UI.panel(this, 0, 0, cw, ch, { fill: PAL.parch });
      const hit = this.add.zone(0, 0, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      c.add([card, hit]);

      // 势力色边条
      const col2 = facColor(i);
      c.add(this.add.graphics().fillStyle(col2, 1).fillRect(4, 4, 4, ch - 8));
      const first = f.gens[0];
      c.add(UI.face(this, 12, 8, 48, f.lord,
        first ? first[1] : 60, first ? first[2] : 60, first ? first[3] : "步", i));
      c.add(UI.txt(this, 68, 10, f.lord, 19, "#241a12"));
      const diff = f.cities.length >= 3 ? "★ 易" : (f.cities.length === 2 ? "★★ 中" : "★★★ 难");
      c.add(UI.txt(this, 68, 34, `${diff}　${f.cities.length} 城 ${f.gens.length} 将`, 12, "#6b5a44"));
      c.add(UI.txt(this, 68, 48, `兵力 ${f.gens.reduce((a, g) => a + g[1]*10 + g[2]*10 + g[4]*100, 0)}`,
        11, "#8a3a1a"));

      hit.on("pointerover", () => { this.tweens.add({ targets: c, y: y - 3, duration: 110 }); Sfx.hover(); });
      hit.on("pointerout",  () => { this.tweens.add({ targets: c, y: y, duration: 110 }); });
      hit.on("pointerdown", () => {
        Sfx.fanfare();
        Core.startGame(i);
        const firstCity = Core.allCitiesOf(i)[0];
        Core.curCity = firstCity || null;
        UI.fadeTo(this, "Map");
      });
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, delay: i*40, duration: 220 });
    });

    UI.button(this, W/2 - 160, 592, 150, 36, "返 回 上 一 页",
      () => { Sfx.click(); this.showScenarios(); }, { size: 14 });
    UI.button(this, W/2 + 10, 592, 150, 36, "返 回 标 题",
      () => { Sfx.click(); this.scene.start("Title"); }, { size: 14 });
  }
}
