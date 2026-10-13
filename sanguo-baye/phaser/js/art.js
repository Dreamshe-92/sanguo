/* ================================================================
   像素美术生成器 —— 全部纹理程序化绘制，无外部图片依赖
   逻辑像素 → 实际像素 放大 SC 倍，保证像素质感
   ================================================================ */
"use strict";

const Art = {
  SC: 2,                 // 地形/单位放大倍数（20 逻辑像素 → 40 实际像素）
  TILE_L: 20,            // 地形逻辑边长
  UNIT_L: 20,
  FACE_L: 16,            // 头像逻辑边长
  FACE_SC: 3,            // 头像 → 48px

  /* 装甲/服饰配色 */
  ARMOR: { "步":"#4a6fa5", "弓":"#5f9a3e", "骑":"#a55b3a", "水":"#3e8a9a", "极":"#c9a227", "玄":"#7a4a9a" },
  SKIN: ["#f5d0a8","#e8b98c","#d2a074","#f7ddc0"],
  HAIR: ["#241a12","#4a3524","#6b5140","#8a8a8a","#33241a"],

  /* ---------- 建立画布纹理 ---------- */
  cv(scene, key, lw, lh, sc){
    const s = sc || this.SC;
    if(scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, lw*s, lh*s);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    const P = (x, y, w, h, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x*s), Math.round(y*s), Math.max(1, Math.round(w*s)), Math.max(1, Math.round(h*s)));
    };
    return { tex, ctx, P, s };
  },

  init(scene){
    this.terrain(scene);
    this.units(scene);
    this.misc(scene);
  },

  /* ================= 地形瓦片 20×20 逻辑 ================= */
  terrain(scene){
    const L = this.TILE_L;
    const defs = [
      /* 0 平原 */ { c:"#b9c47c", c2:"#a3b066", dot:"#8d9a56", hi:"#ccd692" },
      /* 1 草原 */ { c:"#93c46a", c2:"#7fb055", dot:"#5f8f42", hi:"#a8d67e" },
      /* 2 山地 */ { c:"#9a8a68", c2:"#7a6a4c", dot:"#5f4f36", hi:"#b8a884" },
      /* 3 森林 */ { c:"#5c8f4a", c2:"#4a7a3c", dot:"#2f5c33", hi:"#70a85c" },
      /* 4 河流 */ { c:"#4a86c0", c2:"#3a6ea5", dot:"#2f5f95", hi:"#7fb0e0" },
      /* 5 村庄 */ { c:"#c9b077", c2:"#b09a62", dot:"#8a7550", hi:"#dcc490" },
      /* 6 营寨 */ { c:"#a89070", c2:"#8f7858", dot:"#6f4a2a", hi:"#c0a888" },
      /* 7 城池 */ { c:"#9a9aa4", c2:"#7f7f8c", dot:"#55555f", hi:"#b6b6c0" }
    ];
    for(let ti = 0; ti < 8; ti++){
      const d = defs[ti];
      const { tex, P, ctx } = this.cv(scene, "t" + ti, L, L);
      P(0, 0, L, L, d.c);
      // 底部/右侧暗边，制造块面感
      P(0, L - 2, L, 2, d.c2); P(L - 2, 0, 2, L, d.c2);
      // 顶部高光
      P(0, 0, L, 1, d.hi);

      if(ti === 0 || ti === 1){
        // 田垄 / 草簇
        for(let k = 0; k < 4; k++){
          const yy = 4 + k*4;
          P(2, yy, L - 8 + (k % 2)*4, 1, d.dot);
        }
        [[3,6],[14,9],[7,15],[16,3]].forEach(([x, y]) => {
          P(x, y, 1, 2, d.dot); P(x - 1, y + 1, 1, 1, d.dot); P(x + 1, y + 1, 1, 1, d.dot);
        });
      }
      if(ti === 2){
        // 阶梯状山峰（两座）
        const peak = (cx, base, h, w) => {
          for(let i = 0; i < h; i++){
            const ww = Math.max(1, Math.round(w*(i + 1)/h));
            P(cx - Math.floor(ww/2), base - i, ww, 1, i > h - 3 ? "#e8e8ee" : d.dot);
          }
        };
        peak(7, 15, 9, 12);
        peak(15, 17, 6, 9);
        P(0, 17, L, 3, d.c2);
      }
      if(ti === 3){
        // 树林（三棵）
        const tree = (cx, cy, dark) => {
          P(cx, cy + 2, 1, 3, "#6b4a2a");
          P(cx - 3, cy - 1, 7, 1, dark);
          P(cx - 4, cy, 9, 1, dark);
          P(cx - 3, cy + 1, 7, 1, dark);
          P(cx - 2, cy + 2, 5, 1, d.dot);
          P(cx - 2, cy - 2, 5, 1, dark);
        };
        tree(5, 6, "#3f7a38"); tree(14, 10, "#3f7a38"); tree(9, 15, "#356a30");
      }
      if(ti === 4){
        // 水波
        for(let k = 0; k < 4; k++){
          const yy = 3 + k*4;
          P(2 + (k % 2)*3, yy, 7, 1, d.hi);
          P(11 + (k % 2)*2, yy + 2, 6, 1, d.hi);
        }
        P(0, 0, L, 2, "#6fa5d8");
      }
      if(ti === 5){
        // 村庄：两间屋
        const house = (x, y) => {
          P(x, y + 3, 6, 4, "#e0d0a8"); P(x, y + 3, 6, 1, "#c4b088");
          P(x - 1, y, 8, 2, "#8a4a32"); P(x, y - 1, 6, 2, "#a55b3a");
          P(x + 2, y + 5, 2, 2, "#6b4a2a");
        };
        house(2, 5); house(11, 11);
        P(0, 17, L, 3, "#b09a62");
      }
      if(ti === 6){
        // 营寨：栅栏 + 军旗
        P(0, 5, L, 1, "#6f4a2a"); P(0, 6, L, 1, "#8a5a34");
        for(let x = 1; x < L; x += 4) P(x, 3, 1, 5, "#7a4a2a");
        P(6, 10, 8, 7, "#d9c48c"); P(6, 10, 8, 1, "#b09a62");
        P(9, 1, 1, 9, "#6b4a2a"); P(10, 1, 4, 3, "#a83232");
      }
      if(ti === 7){
        // 城池：石墙 + 垛口 + 城门 + 角楼
        P(0, 8, L, 12, d.c); P(0, 8, L, 1, d.hi);
        for(let x = 0; x < L; x += 4) P(x, 6, 2, 3, d.c);   // 垛口
        P(0, 4, 3, 12, d.c2); P(L - 3, 4, 3, 12, d.c2);     // 角楼
        P(0, 3, 3, 1, "#a83232"); P(L - 3, 3, 3, 1, "#a83232");
        P(7, 12, 6, 8, "#4a3826");                            // 城门
        P(7, 11, 6, 1, "#8a5a34");
        P(9, 14, 2, 6, "#2b2118");
      }
      // 细网格描边，保证格子可辨
      ctx.strokeStyle = "rgba(30,22,14,0.16)"; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, L*this.SC - 1, L*this.SC - 1);
      tex.refresh();
    }
  },

  /* ================= 兵种单位 20×20 逻辑 ================= */
  units(scene){
    const L = this.UNIT_L;
    ["步","弓","骑","水","极","玄"].forEach(tp => {
      [0, 1].forEach(side => {
        const { tex, P } = this.cv(scene, "u_" + tp + "_" + side, L, L);
        const dark  = side === 0 ? "#1e3a6e" : "#6e1c1c";
        const main  = side === 0 ? "#2f5f9e" : "#a83232";
        const lite  = side === 0 ? "#8fb8e8" : "#e88a7a";
        const armor = this.ARMOR[tp];
        const skin  = "#f0c8a0";

        P(5, 18, 10, 1, "rgba(20,14,8,0.30)");                 // 影
        P(6, 15, 8, 3, main); P(5, 17, 10, 1, dark);           // 阵营底盘
        P(7, 13, 2, 3, "#3a3a44"); P(11, 13, 2, 3, "#3a3a44"); // 腿
        P(6, 8, 8, 6, armor);                                   // 身体
        P(6, 8, 8, 2, main);                                    // 披肩
        P(5, 9, 1, 4, armor); P(14, 9, 1, 4, armor);            // 手臂
        P(7, 4, 6, 5, skin);                                    // 头
        P(7, 4, 6, 1, "#dcae86");
        P(6, 3, 8, 2, main); P(7, 2, 6, 1, lite);               // 盔
        P(8, 6, 1, 1, "#20202a"); P(12, 6, 1, 1, "#20202a");    // 眼
        P(8, 5, 2, 1, "#3a2a1a"); P(11, 5, 2, 1, "#3a2a1a");    // 眉

        if(tp === "骑"){ // 战马
          P(4, 12, 12, 4, "#7a5535"); P(4, 12, 12, 1, "#96683f");
          P(4, 15, 2, 3, "#5f4028"); P(14, 15, 2, 3, "#5f4028");
          P(15, 9, 3, 2, "#5f4028"); P(15, 8, 2, 2, "#7a5535");
          P(6, 8, 8, 2, main);
        }
        if(tp === "弓"){ // 长弓
          P(15, 4, 1, 9, "#8a6a3a"); P(15, 4, 1, 1, "#d9d9c0"); P(15, 12, 1, 1, "#d9d9c0");
          P(13, 5, 3, 1, "#e8e8d0");
        }
        if(tp === "水"){ // 战船 + 桨
          P(3, 15, 14, 3, "#5b9bd5"); P(3, 15, 14, 1, "#8fc4ee"); P(4, 17, 12, 1, "#2f5f95");
          P(16, 8, 1, 7, "#8a6a3a"); P(15, 14, 3, 2, "#a5824a");
        }
        if(tp === "极"){ // 双刀 + 金甲
          P(3, 3, 1, 10, "#e8c84a"); P(16, 3, 1, 10, "#e8c84a");
          P(3, 2, 2, 2, "#f5e88a"); P(15, 2, 2, 2, "#f5e88a");
          P(7, 2, 6, 1, "#e8c84a"); P(6, 8, 8, 1, "#f0d878");
        }
        if(tp === "玄"){ // 道冠 + 符箓
          P(6, 1, 8, 2, "#b07ae8"); P(7, 0, 6, 1, "#d9b0f5");
          P(9, 0, 2, 2, "#f5e88a");
          P(4, 7, 1, 6, "#b07ae8"); P(15, 7, 1, 6, "#b07ae8");
          P(16, 5, 2, 2, "#e8d8f5");
        }
        if(tp === "步"){ // 盾 + 枪
          P(3, 7, 2, 6, "#c9c9b0"); P(3, 7, 2, 1, "#8a8a78");
          P(16, 3, 1, 11, "#8a6a3a"); P(15, 2, 3, 2, "#d9d9c0");
        }
        tex.refresh();
      });
    });
  },

  /* ================= 杂项 ================= */
  misc(scene){
    // 旗帜 8×6 逻辑（白底，运行时染色）
    {
      const { tex, P } = this.cv(scene, "flag", 8, 6, 3);
      P(0, 0, 8, 6, "#ffffff");
      P(0, 0, 8, 1, "rgba(0,0,0,0.18)");
      P(0, 5, 8, 1, "rgba(0,0,0,0.18)");
      tex.refresh();
    }
    // 城池图标（大地图用）16×16 逻辑
    {
      const { tex, P } = this.cv(scene, "castle", 16, 16, 2);
      P(1, 1, 14, 14, "#f2e5c4");
      P(1, 1, 14, 1, "#c7ae83"); P(1, 14, 14, 1, "#c7ae83");
      P(2, 7, 12, 7, "#8a8578"); P(2, 7, 12, 1, "#a8a398");
      for(let x = 2; x < 14; x += 3) P(x, 5, 2, 2, "#8a8578");
      P(2, 2, 3, 12, "#6f6a60"); P(11, 2, 3, 12, "#6f6a60");
      P(2, 1, 3, 1, "#a83232"); P(11, 1, 3, 1, "#a83232");
      P(6, 10, 4, 4, "#4a3826"); P(6, 9, 4, 1, "#8a5a34");
      tex.refresh();
    }
    // 光点（选中/高亮）
    {
      const { tex, P } = this.cv(scene, "spark", 6, 6, 2);
      P(2, 0, 2, 6, "#ffffff"); P(0, 2, 6, 2, "#ffffff");
      P(1, 1, 4, 4, "#ffffff");
      tex.refresh();
    }
    // 天气粒子：雨滴 / 冰雹 / 风线
    {
      const { tex, P } = this.cv(scene, "rain", 2, 10, 2);
      P(0, 0, 2, 10, "#cfe4f5"); P(0, 0, 1, 10, "#ffffff");
      tex.refresh();
    }
    {
      const { tex, P } = this.cv(scene, "hail", 4, 4, 2);
      P(0, 0, 4, 4, "#f2f8ff"); P(1, 1, 2, 2, "#ffffff");
      tex.refresh();
    }
    {
      const { tex, P } = this.cv(scene, "wind", 20, 2, 2);
      P(0, 0, 20, 2, "rgba(255,255,255,0.75)");
      tex.refresh();
    }
  },

  /* ================= 武将头像 16×16 逻辑 → 48px ================= */
  faceKey(name, force, intel, troop, lordIdx){
    return "face_" + name + "_" + force + "_" + intel + "_" + troop + "_" + (lordIdx == null ? "x" : lordIdx);
  },
  makeFace(scene, name, force, intel, troop, lordIdx){
    const key = this.faceKey(name, force, intel, troop, lordIdx);
    if(scene.textures.exists(key)) return key;
    const L = this.FACE_L, h = hash32(name);
    const { tex, P } = this.cv(scene, key, L, L, this.FACE_SC);
    const fac = lordIdx != null && lordIdx >= 0 ? facColor(lordIdx) : 0x8a8578;
    const facC = "#" + fac.toString(16).padStart(6, "0");

    P(0, 0, L, L, facC);                       // 势力色外框
    P(1, 1, L - 2, L - 2, "#cbb189");          // 深色底（衬托脸庞）
    P(2, 2, L - 4, L - 4, "#dbc49c");
    P(2, 2, L - 4, 1, "#e8d6b2");
    P(2, 13, L - 4, 1, "#b89a70");
    const armor = this.ARMOR[troop] || "#6b6b6b";
    const skin = this.SKIN[h % 4];

    P(3, 13, 10, 3, armor);                    // 甲胄
    P(3, 13, 10, 1, "#ffffff33");
    P(4, 12, 8, 1, armor);
    P(7, 12, 2, 1, "#dfcaa0");                 // 领口
    P(7, 10, 2, 2, skin);                      // 颈
    P(4, 3, 8, 8, skin);                       // 脸
    P(3, 4, 1, 6, skin); P(12, 4, 1, 6, skin);
    P(4, 9, 8, 2, "#00000018");                // 下颌阴影

    if(force >= 95){                            // 猛将：铁盔 + 红缨
      P(3, 2, 10, 2, "#8a8a94"); P(4, 1, 8, 1, "#b0b0ba");
      P(3, 2, 10, 1, "#ffffff40");
      P(7, 0, 2, 2, "#c93a3a"); P(6, 1, 1, 1, "#c93a3a"); P(9, 1, 1, 1, "#c93a3a");
      P(2, 3, 1, 5, "#6f6f7a"); P(13, 3, 1, 5, "#6f6f7a");
    } else if(intel >= 90){                     // 谋士：高冠 + 羽扇色领
      P(3, 2, 10, 2, "#3a3a4a"); P(5, 0, 6, 2, "#4a4a5c");
      P(7, 0, 2, 1, "#d9c86a"); P(3, 2, 10, 1, "#ffffff22");
      P(4, 12, 8, 1, "#e8e0c8");
    } else {                                    // 常服：发髻
      const hc = this.HAIR[h % this.HAIR.length];
      P(3, 2, 10, 2, hc); P(3, 2, 1, 5, hc); P(12, 2, 1, 5, hc);
      P(2, 1, 1, 2, hc); P(13, 1, 1, 2, hc);
    }
    P(5, 6, 1, 1, "#20202a"); P(10, 6, 1, 1, "#20202a");   // 眼
    P(6, 8, 4, 1, "#00000012");
    if(force >= 85){ P(4, 5, 3, 1, "#2b2118"); P(9, 5, 3, 1, "#2b2118"); }  // 浓眉
    else { P(5, 5, 1, 1, "#3a2a1a"); P(10, 5, 1, 1, "#3a2a1a"); }
    if(force >= 88 || (h >> 3) % 3 === 0){                                   // 须髯
      P(5, 9, 6, 1, "#3a2a1a"); P(6, 10, 4, 1, "#3a2a1a");
    }
    P(7, 9, 2, 1, "#8a5a4a");                  // 口
    tex.refresh();
    return key;
  }
};
