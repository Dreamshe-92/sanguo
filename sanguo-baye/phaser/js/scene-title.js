/* ================= 标题画面：黄昏山河 + 行军剪影 ================= */
"use strict";

class TitleScene extends Phaser.Scene {
  constructor(){ super("Title"); }

  create(){
    const W = LW, H = LH;
    this.drawBackdrop(W, H);
    this.drawForeground(W, H);

    /* ---- 标题 ---- */
    const title = this.add.text(W/2, 96, "三國霸業", {
      fontFamily: FONT, fontSize: "76px", color: "#f7e2a8", resolution: 3
    }).setOrigin(0.5);
    title.setStroke("#2b1c10", 10);
    title.setShadow(0, 6, "rgba(0,0,0,0.55)", 0);
    this.tweens.add({ targets: title, y: 90, duration: 2400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    const sub = UI.txt(this, W/2, 152, "步 步 高 学 习 机 · 复 刻 计 划", 15, "#e8cfa0", { ox: 0.5 });
    sub.setShadow(0, 2, "rgba(0,0,0,0.6)", 0);
    this.add.graphics().fillStyle(PAL.gold, 1).fillRect(W/2 - 150, 176, 300, 2);

    /* ---- 名将画廊 ---- */
    const stars = [["吕布",112,36,"极"],["諸葛亮",40,110,"弓"],["關羽",106,90,"步"],
                   ["曹操",75,100,"骑"],["周瑜",62,108,"弓"],["趙雲",105,90,"骑"]];
    // 用简体名匹配数据（头像按名字 hash，此处仅作展示）
    const real = [["吕布",112,36,"极"],["诸葛亮",40,110,"弓"],["关羽",106,90,"步"],
                  ["曹操",75,100,"骑"],["周瑜",62,108,"弓"],["赵云",105,90,"骑"]];
    real.forEach((s, i) => {
      const x = W/2 - 300 + i*104, y = 208;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(0x241a12, 1); g.fillRect(0, 0, 56, 56);
      g.fillStyle(PAL.parch, 1); g.fillRect(2, 2, 52, 52);
      c.add(g);
      c.add(UI.face(this, 4, 4, 48, s[0], s[1], s[2], s[3], i));
      c.add(UI.txt(this, 28, 60, s[0], 12, "#f2e5c4", { ox: 0.5, shadow: false }));
      c.setAlpha(0); c.y = y + 14;
      this.tweens.add({ targets: c, alpha: 1, y: y, delay: 180 + i*90, duration: 380, ease: "Back.easeOut" });
    });

    /* ---- 主菜单 ---- */
    const bw = 260, bh = 44, bx = W/2 - bw/2;
    let by = 306;
    const menu = [
      ["开 始 游 戏", () => this.scene.start("Select")],
      ["读 取 存 档", () => {
        if(Core.load()){ Sfx.ok(); this.scene.start("Map"); }
        else { Sfx.no(); UI.toast(this, "暂无存档", "warn"); }
      }],
      ["游 戏 说 明", () => this.showHelp()],
      ["音 效：" + (Sfx.on ? "开" : "关"), (btn) => {
        Sfx.on = !Sfx.on; btn.setLabel("音 效：" + (Sfx.on ? "开" : "关")); Sfx.click();
      }]
    ];
    menu.forEach((m, i) => {
      const b = UI.button(this, bx, by + i*(bh + 10), bw, bh, m[0], () => m[1](b), { size: 17 });
      b.setAlpha(0);
      this.tweens.add({ targets: b, alpha: 1, delay: 700 + i*80, duration: 260 });
    });

    UI.txt(this, W/2, H - 46,
      "原作：步步高电子辞典《三国霸业》（南方小鬼 / 通宵虫）", 12, "#c9b79a", { ox: 0.5 });
    UI.txt(this, W/2, H - 28,
      "38 城 · 187 将 · 内政外交 · 战棋攻城", 12, "#a8967a", { ox: 0.5 });

    this.input.keyboard.on("keydown-ENTER", () => this.scene.start("Select"));
  }

  /* ---------- 背景：黄昏山河 ---------- */
  drawBackdrop(W, H){
    const g = this.add.graphics();
    // 天空分层
    const bands = [
      [0, 120, 0x2f3358], [120, 70, 0x4a3a5e], [190, 60, 0x6a4055],
      [250, 55, 0x93494a], [305, 50, 0xc06a3e], [355, 45, 0xe0924a]
    ];
    bands.forEach(b => { g.fillStyle(b[2], 1); g.fillRect(0, b[0], W, b[1]); });
    // 落日
    g.fillStyle(0xf0b45a, 1); g.fillCircle(W - 190, 300, 54);
    g.fillStyle(0xf7d089, 1); g.fillCircle(W - 190, 300, 40);
    // 云带
    for(let i = 0; i < 7; i++){
      const cy = 60 + i*38, cw = 120 + (i % 3)*90, cx = (i*173) % W;
      g.fillStyle(0x000000, 0.10 + (i % 3)*0.05);
      g.fillRect(cx, cy, cw, 7);
      g.fillRect(cx + 22, cy - 5, cw - 60, 5);
    }
    // 远山（三层）
    this.range(g, W, 330, 0x3a3450, 1.7, 96);
    this.range(g, W, 386, 0x2b2638, 3.1, 124);
    this.range(g, W, 430, 0x1f1c28, 5.3, 150);
    // 地面
    g.fillStyle(0x181a18, 1); g.fillRect(0, 452, W, H - 452);
    g.fillStyle(0x23261f, 1); g.fillRect(0, 452, W, 6);
  }
  range(g, W, baseY, color, seed, height){
    g.fillStyle(color, 1);
    g.beginPath(); g.moveTo(0, baseY + 200); g.lineTo(0, baseY);
    let x = 0;
    while(x < W + 200){
      const w = 70 + Math.abs(Math.sin(seed + x*0.021))*120;
      const h = height*(0.45 + Math.abs(Math.sin(seed*2.3 + x*0.013))*0.75);
      g.lineTo(x + w/2, baseY - h);
      g.lineTo(x + w, baseY - Math.abs(Math.sin(seed + x*0.03))*8);
      x += w;
    }
    g.lineTo(W, baseY + 200); g.closePath(); g.fillPath();
  }

  /* ---------- 前景：行军剪影 ---------- */
  drawForeground(W, H){
    // 地面剪影上的士兵（用兵种纹理染黑，营造剪影）
    const types = ["步","骑","弓","步","骑","弓","步"];
    for(let i = 0; i < 14; i++){
      const tp = types[i % types.length];
      const spr = this.add.image(-60 + i*76, 500 + (i % 3)*10, "u_" + tp + "_0");
      spr.setTint(0x000000); spr.setAlpha(0.72);
      spr.setScale(1.1 + (i % 2)*0.2);
      this.tweens.add({ targets: spr, x: W + 80, duration: 16000 + i*400, repeat: -1, delay: i*900 });
      this.tweens.add({ targets: spr, y: spr.y - 3, duration: 420, yoyo: true, repeat: -1, delay: i*130 });
    }
    // 前景暗角
    const vg = this.add.graphics();
    vg.fillStyle(0x000000, 0.30); vg.fillRect(0, 0, W, 60);
    vg.fillStyle(0x000000, 0.34); vg.fillRect(0, H - 70, W, 70);
  }

  showHelp(){
    const m = UI.modal(this, 620, 470, "游 戏 说 明");
    const lines = [
      "【目标】在时限内攻取全部 38 城，一统天下；城池尽失则霸业成空。",
      "【流程】每将每月可执行一条指令，完成后点【结束本月】进入结算：",
      "        3/6/9/12 月征税、6/10 月收粮、每月消耗兵粮；",
      "        并可能发生旱灾、水灾、暴动与饥荒。",
      "【内政】开垦→农业、招商→商业、治理→防灾、出巡→民忠、搜索→人才/道具。",
      "        征兵数 = 民忠 × 20；带兵上限 = 武×10 + 智×10 + 等级×100。",
      "【军备】征兵入预备役，【分配】给将领；出征限 10 将，战棋决胜，30 日不克则守方胜。",
      "【兵种】步（山林地强）/ 弓（射程2）/ 骑（平原快攻）/ 水（河战无敌）",
      "        / 极（全项最强）/ 玄（计谋大师）。站错地形攻防暴跌。",
      "【天气】晴→计谋威力最大；雨天只能水淹；冰雹封印大部分计谋。",
      "【忠诚】每月 -1，低于 40 可能叛逃；宴请 +1、赏赐 +8、没收 -20。",
      "        敌方低忠之将可【招揽】【策反】。",
      "【交易】1 粮 = 5 金。粮上限 65536，溢出会归零，切勿囤积。",
      "【人才】全国散落 80+ 名在野武将，靠【搜索】陆续发掘——原版最大长期钩子。",
      "",
      "数据取自原版 ROM（38 城 / 187 将名录 / 计谋表）与社区资料，",
      "部分数值为推测，欢迎反馈调参。"
    ];
    lines.forEach((s, i) => UI.txt(m.body, 26, 56 + i*23, s, 13, i === 0 ? "#8a3a1a" : "#3a2c1e", { lineSpacing: 2 }));
    m.body.add(UI.button(this, (620 - 100)/2, 424, 100, 32, "关 闭", () => { m.close(); Sfx.click(); }, { size: 14 }));
  }
}
