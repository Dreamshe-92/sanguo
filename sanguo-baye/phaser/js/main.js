/* ================= 游戏入口 ================= */
"use strict";

const GAME_W = LW * RENDER_SCALE, GAME_H = LH * RENDER_SCALE;

const gameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_W,
  height: GAME_H,
  backgroundColor: "#14100c",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: { antialias: false, powerPreference: "high-performance" },
  scene: [BootScene, TitleScene, SelectScene, MapScene, CityScene, BattleScene]
};

/* 所有场景统一按 RENDER_SCALE 放大相机，使 1152×720 的逻辑布局铺满高分辨率画布 */
(function applyHiDpiZoom(){
  const list = [BootScene, TitleScene, SelectScene, MapScene, CityScene, BattleScene];
  list.forEach(S => {
    if(!S || !S.prototype) return;
    const orig = S.prototype.create;
    S.prototype.create = function(...args){
      this.cameras.main.setZoom(RENDER_SCALE);
      this.cameras.main.centerOn(LW/2, LH/2);
      return orig ? orig.apply(this, args) : undefined;
    };
  });
})();

window.addEventListener("load", () => { window.game = new Phaser.Game(gameConfig); });
