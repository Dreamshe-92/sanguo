/* ================= 启动场景：生成全部像素纹理 ================= */
"use strict";

class BootScene extends Phaser.Scene {
  constructor(){ super("Boot"); }

  create(){
    const W = LW, H = LH;
    this.add.rectangle(0, 0, W, H, 0x1b1510).setOrigin(0);
    const t = UI.txt(this, W/2, H/2 - 20, "三 國 霸 業", 30, "#d9a441", { ox: 0.5, shadow: false });
    const barBg = this.add.graphics();
    barBg.fillStyle(0x4a3826, 1); barBg.fillRect(W/2 - 130, H/2 + 14, 260, 12);
    const bar = this.add.graphics();
    UI.txt(this, W/2, H/2 + 36, "正在点兵…", 12, "#8a7a62", { ox: 0.5, shadow: false });

    // 让出一帧，保证加载画面能绘制出来
    this.time.delayedCall(60, () => {
      Art.init(this);
      Sfx.init();
      bar.clear(); bar.fillStyle(PAL.gold, 1); bar.fillRect(W/2 - 130, H/2 + 14, 260, 12);
      this.time.delayedCall(220, () => this.scene.start("Title"));
    });
  }
}
