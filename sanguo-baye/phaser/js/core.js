/* ================================================================
   三国霸业 · 核心规则层（纯逻辑，不触碰 DOM / Phaser）
   UI 层通过 Core.on(...) 订阅事件来刷新画面。
   ================================================================ */
"use strict";

const Core = {
  S: null,
  curCity: null,
  battle: null,
  chosenScen: 0,
  GOLD_CAP: 30000,
  GRAIN_CAP: 65536,

  _ev: {},
  on(ev, fn){ (this._ev[ev] = this._ev[ev] || []).push(fn); return this; },
  emit(ev, d){ (this._ev[ev] || []).forEach(f => { try{ f(d); }catch(e){ console.error(ev, e); } }); },

  log(t){
    if(!this.S) return;
    this.S.log.push(`【${this.S.year}年${this.S.month}月】${t}`);
    if(this.S.log.length > 200) this.S.log.shift();
    this.emit("log", t);
  },
  toast(msg, kind){ this.emit("toast", { msg, kind: kind || "info" }); },
  refresh(){ this.emit("refresh"); },

  /* ---------------- 开局 ---------------- */
  startGame(fi){
    const sc = SCENARIOS[this.chosenScen];
    const s = { scen: this.chosenScen, year: sc.year, month: sc.month, player: fi,
      factions: [], gens: {}, cities: {}, gameover: false, log: [] };
    sc.factions.forEach(f => s.factions.push({ lord: f.lord, dead: false, captives: [] }));
    if(sc.fix) sc.fix(sc);
    sc.factions.forEach((f, idx) => {
      f.cities.forEach(cid => {
        s.cities[cid] = { owner: idx, ag: 40 + rand(30), bu: 40 + rand(30), loy: 60 + rand(20),
          df: 50 + rand(20), pop: 150000 + rand(150000), gold: 800 + rand(1500),
          grain: 2500 + rand(3000), reserve: 0, recon: false,
          search: this.buildSearchList(sc, cid, idx) };
      });
      f.gens.forEach(g => {
        if(s.gens[g[0]]) return;
        s.gens[g[0]] = { name: g[0], f0: g[1], i0: g[2], type: g[3], lv: g[4],
          exp: 0, hp: 100, troop: Math.min(g[1]*10 + g[2]*10 + g[4]*100, 1200 + g[4]*400),
          loyal: 80 + rand(15), lord: idx, city: f.cities[0], items: [], acted: false, away: false };
      });
    });
    CITIES.forEach(c => { if(!s.cities[c[0]]) s.cities[c[0]] = { owner: -1, ag: 30 + rand(30), bu: 30 + rand(30),
      loy: 50 + rand(20), df: 30 + rand(30), pop: 80000 + rand(120000), gold: 400 + rand(800),
      grain: 1200 + rand(2000), reserve: 0, recon: false, search: this.buildSearchList(sc, c[0], -1) }; });
    Object.entries(sc.wild || {}).forEach(([cid, list]) => {
      if(!s.cities[cid]) return;
      list.forEach(g => { if(g[1] > 0 && !s.gens[g[0]]) this._mkWild(s, g, cid); });
    });
    const allIds = Object.keys(s.cities);
    SUPP_GENS.forEach(g => { if(!s.gens[g[0]]) this._mkWild(s, g, pick(allIds)); });
    this.S = s;
    this.log(`${sc.name}开场。你选择了 ${s.factions[fi].lord}。天下三十八城，逐鹿中原！`);
    this.curCity = s.factions[fi].cities ? null : null;
    this.emit("start");
    return s;
  },
  _mkWild(s, g, cid){
    s.gens[g[0]] = { name: g[0], f0: g[1], i0: g[2], type: g[3] || "步", lv: 1, exp: 0, hp: 100, troop: 0,
      loyal: 70 + rand(10), lord: -2, city: cid, items: [], acted: false, away: false };
  },
  buildSearchList(sc, cid, ownerIdx){
    const list = [];
    ((sc.wild && sc.wild[cid]) || []).forEach(g => { if(g[1] > 0) list.push({ t: "g", n: g[0] }); });
    ((sc.items && sc.items[cid]) || []).forEach(i => { if(ITEMS[i]) list.push({ t: "i", n: i }); });
    for(let k = 0; k < 2; k++) list.push({ t: "g", n: "__gold" });
    return list;
  },

  /* ---------------- 取值 ---------------- */
  genItemBonus(g){
    let f = 0, i = 0, mv = 0;
    (g.items || []).forEach(n => { const it = ITEMS[n]; if(!it) return;
      if(it.t === "武") f += it.v; if(it.t === "智") i += it.v; if(it.t === "移") mv += it.v; });
    return { f, i, mv };
  },
  gForce(g){ return g.f0 + this.genItemBonus(g).f; },
  gIntel(g){ return g.i0 + this.genItemBonus(g).i; },
  maxTroop(g){ return this.gForce(g)*10 + this.gIntel(g)*10 + g.lv*100; },
  gensAt(cid, lord){ return Object.values(this.S.gens).filter(g => g.city === cid && g.lord === lord && !g.away && !this.isPrisoner(g)); },
  isPrisoner(g){ return typeof g.city === "string" && g.city.startsWith("__prison"); },
  playerFac(){ return this.S.factions[this.S.player]; },
  allCitiesOf(fi){ return Object.keys(this.S.cities).filter(c => this.S.cities[c].owner === fi); },
  lordName(fi){ return fi < 0 ? "无主" : (this.S.factions[fi] ? this.S.factions[fi].lord : "—"); },
  freeGens(cid){ return this.gensAt(cid, this.S.player).filter(g => !g.acted); },
  powerOf(fi){
    let p = 0;
    this.allCitiesOf(fi).forEach(c => { p += this.gensAt(c, fi).reduce((a, g) => a + g.troop, 0) + this.S.cities[c].reserve*0.5; });
    return p;
  },
  playerTotals(){
    let gold = 0, grain = 0, gen = 0, troop = 0;
    this.allCitiesOf(this.S.player).forEach(c => {
      gold += this.S.cities[c].gold; grain += this.S.cities[c].grain;
      const gs = this.gensAt(c, this.S.player); gen += gs.length;
      gs.forEach(g => troop += g.troop);
    });
    return { gold, grain, gen, troop, cities: this.allCitiesOf(this.S.player).length };
  },

  /* ---------------- 内政指令 ---------------- */
  spend(g, hp, gold, cid){
    g.hp -= hp; g.acted = true;
    if(gold && cid) this.S.cities[cid].gold = Math.max(0, this.S.cities[cid].gold - gold);
  },
  cmdKaiKen(g){
    if(g.hp < 20) return this.toast(`${g.name} 体力不足（需20）`, "warn");
    const st = this.S.cities[this.curCity];
    if(st.gold < 200) return this.toast("金钱不足（需200）", "warn");
    const gain = 2 + Math.floor(this.gIntel(g)/25) + rand(3);
    st.ag = Math.min(100, st.ag + gain);
    this.spend(g, 20, 200, this.curCity);
    this.log(`${g.name} 在 ${CITY[this.curCity].n} 开垦，农业 +${gain}。`);
    return true;
  },
  cmdZhaoShang(g){
    if(g.hp < 20) return this.toast(`${g.name} 体力不足（需20）`, "warn");
    const st = this.S.cities[this.curCity];
    if(st.gold < 200) return this.toast("金钱不足（需200）", "warn");
    const gain = 2 + Math.floor(this.gIntel(g)/25) + rand(3);
    st.bu = Math.min(100, st.bu + gain);
    this.spend(g, 20, 200, this.curCity);
    this.log(`${g.name} 在 ${CITY[this.curCity].n} 招商，商业 +${gain}。`);
    return true;
  },
  cmdZhiLi(g){
    if(g.hp < 15) return this.toast(`${g.name} 体力不足（需15）`, "warn");
    const st = this.S.cities[this.curCity];
    st.df = Math.min(100, st.df + 4);
    this.spend(g, 15, 0, null);
    this.log(`${g.name} 治理 ${CITY[this.curCity].n}，防灾 +4。`);
    return true;
  },
  cmdChuXun(g){
    if(g.hp < 15) return this.toast(`${g.name} 体力不足（需15）`, "warn");
    const st = this.S.cities[this.curCity];
    st.loy = Math.min(100, st.loy + 4);
    this.spend(g, 15, 0, null);
    this.log(`${g.name} 出巡 ${CITY[this.curCity].n}，民忠 +4。`);
    return true;
  },
  cmdSouSuo(g){
    if(g.hp < 20) return this.toast(`${g.name} 体力不足（需20）`, "warn");
    this.spend(g, 20, 0, null);
    const st = this.S.cities[this.curCity];
    const wildHere = Object.values(this.S.gens).filter(x => x.lord === -2 && x.city === this.curCity);
    if(!st.search.length && wildHere.length && Math.random() < 0.55){
      const w = pick(wildHere);
      w.lord = this.S.player; w.loyal = 55 + rand(20); w.acted = false;
      this.log(`${g.name} 在 ${CITY[this.curCity].n} 访得在野之士 ${w.name}（武${this.gForce(w)} 智${this.gIntel(w)}），其欣然来投！`);
      return { kind: "gen", name: w.name };
    }
    if(st.search.length && Math.random() < 0.7){
      const idx = rand(st.search.length), found = st.search.splice(idx, 1)[0];
      if(found.t === "i"){
        if(g.items.length < 3){ g.items.push(found.n);
          this.log(`${g.name} 在 ${CITY[this.curCity].n} 搜索到【${found.n}】，已装备！`);
          return { kind: "item", name: found.n };
        } else this.log(`${g.name} 搜索到【${found.n}】，但道具已满，弃之。`);
      } else if(found.n === "__gold"){
        const amt = 200 + rand(400); st.gold += amt;
        this.log(`${g.name} 搜索到隐藏金库，金 +${amt}。`);
        return { kind: "gold", amount: amt };
      } else {
        const w = this.S.gens[found.n];
        if(w && w.lord === -2){ w.lord = this.S.player; w.city = this.curCity; w.loyal = 60 + rand(20);
          this.log(`${g.name} 寻得在野武将 ${found.n}，其归顺！`); return { kind: "gen", name: found.n };
        } else this.log(`${g.name} 一无所获。`);
      }
    } else this.log(`${g.name} 在 ${CITY[this.curCity].n} 搜索，一无所获。`);
    return { kind: "none" };
  },
  cmdZhengBing(){
    const st = this.S.cities[this.curCity];
    const n = Math.floor(st.loy*20), cost = n*2;
    const gs = this.freeGens(this.curCity).sort((a, b) => this.gIntel(b) - this.gIntel(a));
    if(!gs.length) return this.toast("本城无空闲将领", "warn");
    if(st.gold < cost) return this.toast(`金钱不足（需 ${cost}）`, "warn");
    if(n <= 0) return this.toast("民忠过低，无人应征", "warn");
    st.gold -= cost; st.reserve += n; st.loy = Math.max(0, st.loy - 2);
    gs[0].hp = Math.max(0, gs[0].hp - 20); gs[0].acted = true;
    this.log(`${CITY[this.curCity].n} 征兵 ${n}（预备役 ${st.reserve}）。`);
    return true;
  },
  cmdFenPei(name){
    const st = this.S.cities[this.curCity], g = this.S.gens[name];
    const cap = this.maxTroop(g) - g.troop, n = Math.min(cap, st.reserve, 1500);
    if(n <= 0) return this.toast("无可分配兵力", "warn");
    g.troop += n; st.reserve -= n; g.acted = true;
    this.log(`${g.name} 获得 ${n} 兵（${g.troop}/${this.maxTroop(g)}）。`);
    return n;
  },
  cmdLveDuo(){
    const st = this.S.cities[this.curCity], gs = this.freeGens(this.curCity);
    const gg = Math.floor(st.gold*0.3), gr = Math.floor(st.grain*0.3);
    st.gold -= gg; st.grain -= gr; st.loy = Math.floor(st.loy/2);
    st.ag = Math.max(0, st.ag - 15); st.bu = Math.max(0, st.bu - 15);
    if(gs.length){ gs[0].hp = Math.max(0, gs[0].hp - 20); gs[0].acted = true; }
    this.log(`${CITY[this.curCity].n} 遭掠夺：金 -${gg} 粮 -${gr}，民怨沸腾。`);
    return true;
  },
  cmdYanQing(g){
    const st = this.S.cities[this.curCity];
    if(st.gold < 100) return this.toast("金钱不足（需100）", "warn");
    st.gold -= 100; g.hp = Math.min(100, g.hp + 50); g.loyal = Math.min(100, g.loyal + 1);
    this.log(`设宴款待 ${g.name}，体力恢复、忠诚 +1。`);
    return true;
  },
  cmdShangCi(g){
    const st = this.S.cities[this.curCity];
    if(st.gold < 500) return this.toast("金钱不足（需500）", "warn");
    st.gold -= 500; g.loyal = Math.min(100, g.loyal + 8);
    this.log(`重赏 ${g.name}，忠诚 +8。`);
    return true;
  },
  cmdMeiShou(g){
    const st = this.S.cities[this.curCity];
    st.gold += 300; g.loyal = Math.max(0, g.loyal - 20);
    this.log(`没收 ${g.name} 财物充公（金 +300），其忠诚 -20。`);
    return true;
  },
  cmdJiaoYi(buy, amt){
    const st = this.S.cities[this.curCity];
    if(buy){ if(st.gold < amt*5) return this.toast("金钱不足", "warn");
      st.gold -= amt*5; st.grain = Math.min(this.GRAIN_CAP, st.grain + amt); }
    else { if(st.grain < amt) return this.toast("粮草不足", "warn");
      st.grain -= amt; st.gold = Math.min(this.GOLD_CAP, st.gold + amt*5); }
    this.log(`${CITY[this.curCity].n} ${buy ? "买入" : "卖出"}粮食 ${amt}。`);
    return true;
  },
  cmdShuSong(to){
    const st = this.S.cities[this.curCity];
    const gg = Math.floor(st.gold/2), gr = Math.floor(st.grain/2);
    if(gg + gr <= 0) return this.toast("无物资可输送", "warn");
    st.gold -= gg; st.grain -= gr;
    if(Math.random() < 0.1){ this.log(`输送往 ${CITY[to].n} 的队伍遇袭，物资尽失！`); return "lost"; }
    const t = this.S.cities[to];
    t.gold = Math.min(this.GOLD_CAP, t.gold + gg); t.grain = Math.min(this.GRAIN_CAP, t.grain + gr);
    this.log(`输送 ${gg} 金 ${gr} 粮 至 ${CITY[to].n}。`);
    return true;
  },
  cmdYiDong(to, g){
    if(g.hp < 10) return this.toast(`${g.name} 体力不足`, "warn");
    g.hp = Math.max(0, g.hp - 10); g.acted = true; g.city = to;
    this.log(`${g.name} 移动至 ${CITY[to].n}。`);
    return true;
  },
  cmdLiJian(cid, g){
    const st = this.S.cities[this.curCity];
    if(st.gold < 200) return this.toast("金钱不足（需200）", "warn");
    const target = this.pickEnemyGen(cid); if(!target) return this.toast("敌城无将", "warn");
    st.gold -= 200; g.acted = true; g.hp = Math.max(0, g.hp - 10);
    const cut = 8 + Math.floor(this.gIntel(g)/12) + rand(6);
    target.loyal = Math.max(0, target.loyal - cut);
    this.log(`${g.name} 离间 ${target.name}，其忠诚 -${cut}（现 ${target.loyal}）。`);
    return { target: target.name, cut };
  },
  cmdZhaoLan(cid, g){
    const st = this.S.cities[this.curCity];
    if(st.gold < 500) return this.toast("金钱不足（需500）", "warn");
    const target = this.pickEnemyGen(cid); if(!target) return this.toast("敌城无将", "warn");
    st.gold -= 500; g.acted = true; g.hp = Math.max(0, g.hp - 10);
    let p = clamp(70 - target.loyal + (this.gIntel(g) - this.gIntel(target))/10, 2, 70);
    if(Math.random()*100 < p){
      target.lord = this.S.player; target.city = this.curCity; target.loyal = 55 + rand(15); target.acted = false;
      this.log(`成功！${target.name} 弃暗投明，来投 ${CITY[this.curCity].n}！`);
      return { ok: true, target: target.name };
    }
    this.log(`${g.name} 游说 ${target.name} 失败。`);
    return { ok: false, target: target.name };
  },
  cmdCeFan(cid, g){
    const st = this.S.cities[this.curCity];
    if(st.gold < 300) return this.toast("金钱不足（需300）", "warn");
    const target = this.pickEnemyGen(cid); if(!target) return this.toast("敌城无将", "warn");
    st.gold -= 300; g.acted = true; g.hp = Math.max(0, g.hp - 10);
    let p = clamp(60 - target.loyal, 2, 55);
    if(Math.random()*100 < p){
      target.lord = -2; target.acted = false;
      this.log(`${target.name} 被策反，弃官而去（沦为在野）。`);
      return { ok: true, target: target.name };
    }
    this.log(`策反 ${target.name} 失败。`);
    return { ok: false, target: target.name };
  },
  cmdQuanXiang(){
    const adj = CITY[this.curCity].adj.map(a => this.S.cities[a].owner).filter(o => o >= 0 && o !== this.S.player);
    if(!adj.length) return this.toast("相邻无敌势力", "warn");
    const fi = adj[0];
    if(this.powerOf(this.S.player) < this.powerOf(fi)*2) return this.toast("实力不足以威慑对方（需2倍于敌）", "warn");
    if(Math.random()*100 < 45){
      this.allCitiesOf(fi).forEach(c => { this.S.cities[c].owner = this.S.player; this.S.cities[c].recon = true; });
      Object.values(this.S.gens).forEach(g => { if(g.lord === fi){ g.lord = this.S.player; g.loyal = 50 + rand(20); g.acted = false; } });
      this.S.factions[fi].dead = true;
      this.log(`兵威之下，${this.S.factions[fi].lord} 举城归降！不战而屈人之兵！`);
      return { ok: true, lord: this.S.factions[fi].lord };
    }
    this.log(`劝降 ${this.S.factions[fi].lord} 被拒。`);
    return { ok: false, lord: this.S.factions[fi].lord };
  },
  pickEnemyGen(cid){
    const own = this.S.cities[cid].owner;
    const gs = own >= 0 ? this.gensAt(cid, own) : [];
    return gs.length ? pick(gs) : null;
  },
  cmdZhaoXiang(name){
    const fac = this.playerFac();
    const gs = this.freeGens(this.curCity).sort((a, b) => this.gIntel(b) - this.gIntel(a));
    const g = this.S.gens[name], talker = gs[0];
    if(!talker) return this.toast("本城无空闲将领", "warn");
    let p = clamp(35 + this.gIntel(talker)/2 - this.gForce(g)/4 + (g.i0 > 90 ? 10 : 0), 5, 85);
    talker.acted = true; talker.hp = Math.max(0, talker.hp - 10);
    if(Math.random()*100 < p){
      fac.captives = fac.captives.filter(x => x !== name);
      g.lord = this.S.player; g.city = this.curCity; g.loyal = 45 + rand(20); g.acted = false; g.away = false; g.captured = false;
      this.log(`${name} 感其恩义，投降归顺！`);
      return { ok: true };
    }
    this.log(`招降 ${name} 被拒。`);
    return { ok: false };
  },
  cmdChuZhan(name){
    const fac = this.playerFac();
    fac.captives = fac.captives.filter(x => x !== name);
    delete this.S.gens[name];
    Object.values(this.S.gens).forEach(g => { if(g.lord === this.S.player) g.loyal = Math.max(0, g.loyal - 3); });
    this.log(`${name} 被处斩。三军震悚。`);
    return true;
  },
  cmdLiuFang(name){
    const g = this.S.gens[name];
    const neutral = Object.keys(this.S.cities).filter(c => this.S.cities[c].owner < 0);
    g.lord = -2; g.city = neutral.length ? pick(neutral) : g.city; g.troop = 0;
    this.log(`${name} 被流放，成为 ${CITY[g.city] ? CITY[g.city].n : "他乡"} 在野武将。`);
    return true;
  },
  cmdRecon(cid, g){
    if(g.hp < 10) return this.toast(`${g.name} 体力不足`, "warn");
    g.hp = Math.max(0, g.hp - 10); g.acted = true;
    this.S.cities[cid].recon = true;
    this.log(`${g.name} 侦察了 ${CITY[cid].n}。`);
    return true;
  },

  /* ---------------- 月度结算 ---------------- */
  endMonth(){
    if(this.S.gameover) return [];
    const m = this.S.month, events = [];
    Object.entries(this.S.cities).forEach(([cid, st]) => {
      if(st.owner < 0) return;
      if(m === 3 || m === 6 || m === 9 || m === 12){
        const tax = Math.floor(st.bu*st.pop/8000);
        st.gold = Math.min(this.GOLD_CAP, st.gold + tax);
        if(st.owner === this.S.player) events.push(`${CITY[cid].n} 征得税金 ${tax}。`);
      }
      if(m === 6 || m === 10){
        const harv = Math.floor(st.ag*st.pop/5000);
        st.grain = Math.min(this.GRAIN_CAP, st.grain + harv);
        if(st.owner === this.S.player) events.push(`${CITY[cid].n} 收获粮草 ${harv}。`);
      }
      let eat = 0;
      this.gensAt(cid, st.owner).forEach(g => eat += Math.ceil(g.troop/25));
      eat += Math.ceil(st.reserve/50);
      st.grain -= eat;
      if(st.grain < 0){
        st.grain = 0; st.pop = Math.floor(st.pop*0.85); st.loy = Math.max(0, st.loy - 15);
        st.ag = Math.max(0, st.ag - 10); st.bu = Math.max(0, st.bu - 10);
        this.gensAt(cid, st.owner).forEach(g => g.troop = Math.floor(g.troop*0.85));
        if(st.owner === this.S.player) events.push(`⚠ ${CITY[cid].n} 粮尽，饥荒！人口兵力锐减。`);
      }
      if(st.loy >= 60) st.pop = Math.min(2000000, Math.floor(st.pop*1.003));
      st.loy = Math.max(0, st.loy - 1);
      if(Math.random() < 0.06 && st.df < 90){
        if(Math.random() < 0.5){ st.ag = Math.max(0, st.ag - 12); st.grain = Math.floor(st.grain*0.85); st.pop = Math.floor(st.pop*0.95);
          if(st.owner === this.S.player) events.push(`⚠ ${CITY[cid].n} 旱灾！农业、粮食、人口受损。`); }
        else { st.bu = Math.max(0, st.bu - 12); st.gold = Math.floor(st.gold*0.85); st.grain = Math.floor(st.grain*0.9);
          if(st.owner === this.S.player) events.push(`⚠ ${CITY[cid].n} 水灾！商业、金钱受损。`); }
      }
      if(Math.random() < 0.05 && st.loy < 50){
        st.reserve = Math.floor(st.reserve*0.5); st.loy = Math.max(0, st.loy - 5);
        if(st.owner === this.S.player) events.push(`⚠ ${CITY[cid].n} 民变暴动！预备役溃散。`);
      }
    });
    Object.values(this.S.gens).forEach(g => {
      if(g.lord < 0) return;
      g.hp = Math.min(100, g.hp + 20);
      if(g.lord !== this.S.player || g.name !== this.S.factions[this.S.player].lord) g.loyal = Math.max(0, g.loyal - 1);
      if(this.isPrisoner(g)) return;
      if(g.city && this.S.cities[g.city] && this.S.cities[g.city].owner !== g.lord && g.lord >= 0){
        const own = this.allCitiesOf(g.lord);
        if(own.length) g.city = own[0]; else g.lord = -2;
      }
      g.acted = false;
      const wasLord = g.lord;
      if(wasLord >= 0 && g.loyal < 40 && g.name !== this.S.factions[wasLord].lord && Math.random() < 0.05){
        g.lord = -2;
        if(wasLord === this.S.player) events.push(`⚠ ${g.name} 忠诚过低，叛逃而去！`);
      }
    });
    this.aiTurn();
    this.S.month++; if(this.S.month > 12){ this.S.month = 1; this.S.year++; }
    events.forEach(e => this.log(e));
    this.log("—— 月度结算完毕 ——");
    this.refresh();
    this.checkEnd();
    return events;
  },
  aiTurn(){
    this.S.factions.forEach((fac, fi) => {
      if(fi === this.S.player || fac.dead) return;
      const cities = this.allCitiesOf(fi);
      if(!cities.length) return;
      cities.forEach(cid => {
        const st = this.S.cities[cid];
        const gs = this.gensAt(cid, fi).filter(g => g.hp >= 30);
        if(!gs.length) return;
        const g = pick(gs); g.acted = true;
        const roll = Math.random();
        if(roll < 0.3) st.ag = Math.min(100, st.ag + 3);
        else if(roll < 0.6) st.bu = Math.min(100, st.bu + 3);
        else if(roll < 0.7) st.loy = Math.min(100, st.loy + 4);
        else if(roll < 0.8) st.df = Math.min(100, st.df + 4);
        else if(st.gold >= st.loy*4){
          const n = Math.floor(st.loy*20*0.8), cost = n*2;
          if(st.gold >= cost){ st.gold -= cost; st.reserve += n; st.loy = Math.max(0, st.loy - 2); }
        }
        this.gensAt(cid, fi).forEach(g2 => {
          const cap = this.maxTroop(g2);
          if(g2.troop < cap && st.reserve > 0){ const n = Math.min(cap - g2.troop, st.reserve); g2.troop += n; st.reserve -= n; }
        });
      });
      if(Math.random() < 0.35){
        const cands = [];
        cities.forEach(cid => { CITY[cid].adj.forEach(a => { const o = this.S.cities[a].owner; if(o !== fi) cands.push({ from: cid, to: a, def: o }); }); });
        if(cands.length){
          const t = pick(cands);
          const attG = this.gensAt(t.from, fi).filter(g => g.troop > 200).slice(0, 6);
          if(attG.length){
            const atkPow = attG.reduce((a, g) => a + g.troop + this.gForce(g)*8, 0);
            const defG = this.gensAt(t.to, t.def >= 0 ? t.def : -1);
            const defPow = defG.reduce((a, g) => a + g.troop + this.gForce(g)*8, 0) + 800;
            if(atkPow > defPow*1.15){
              const oldOwner = this.S.cities[t.to].owner;
              const loss = 0.35 + Math.random()*0.2;
              attG.forEach(g => { g.troop = Math.floor(g.troop*(1 - loss)); g.city = t.to; g.acted = true; });
              this.S.cities[t.to].owner = fi;
              this.S.cities[t.to].reserve = Math.floor(this.S.cities[t.to].reserve*0.5);
              if(oldOwner >= 0 && this.allCitiesOf(oldOwner).length === 0) this.eliminateFaction(oldOwner, fi);
              if(oldOwner === this.S.player) this.log(`⚠ 我方 ${CITY[t.to].n} 被 ${this.S.factions[fi].lord} 攻陷！`);
              else this.log(`${this.S.factions[fi].lord} 攻取 ${CITY[t.to].n}。`);
            } else {
              attG.forEach(g => g.troop = Math.floor(g.troop*0.75));
              if(t.def === this.S.player) this.log(`${this.S.factions[fi].lord} 来犯 ${CITY[t.to].n}，被我军击退！`);
            }
          }
        }
      }
    });
  },
  eliminateFaction(fi, byFi){
    this.S.factions[fi].dead = true;
    const lord = this.S.factions[fi].lord;
    (this.S.factions[fi].captives || []).forEach(n => {
      const g = this.S.gens[n]; if(!g) return;
      g.lord = -2; g.city = pick(Object.keys(this.S.cities));
    });
    Object.values(this.S.gens).forEach(g => {
      if(g.lord === fi && !this.isPrisoner(g)){
        if(Math.random() < 0.6){ g.lord = byFi; g.loyal = 40 + rand(20); g.acted = false; g.away = false; g.captured = false;
          if(this.S.factions[byFi]) this.log(`${g.name} 归降 ${this.S.factions[byFi].lord}。`); }
        else { g.lord = -2; g.city = pick(Object.keys(this.S.cities)); g.troop = 0; }
      }
    });
    this.log(`${lord} 势力覆灭！`);
  },
  checkEnd(){
    const total = CITIES.length, mine = this.allCitiesOf(this.S.player).length;
    if(this.S.gameover) return null;
    const sc = SCENARIOS[this.S.scen];
    if(mine === total){ this.S.gameover = true; return this._end("win", mine, total); }
    if(mine === 0){ this.S.gameover = true; return this._end("lose", mine, total); }
    if(this.S.year >= sc.year + sc.years){ this.S.gameover = true; return this._end("timeup", mine, total); }
    return null;
  },
  _end(kind, mine, total){
    const r = { kind, mine, total, year: this.S.year, month: this.S.month, lord: this.S.factions[this.S.player].lord };
    this.emit("gameover", r);
    return r;
  },

  /* ---------------- 存档 ---------------- */
  save(){
    try{ localStorage.setItem("sanguo_baye_phaser", JSON.stringify(this.S)); return true; }
    catch(e){ return false; }
  },
  hasSave(){ try{ return !!localStorage.getItem("sanguo_baye_phaser"); }catch(e){ return false; } },
  load(){
    const d = localStorage.getItem("sanguo_baye_phaser");
    if(!d) return false;
    this.S = JSON.parse(d);
    this.emit("start"); this.refresh(); this.checkEnd();
    return true;
  },

  /* ================= 战棋战斗 ================= */
  BW: 17, BH: 11,
  buildBattleMap(){
    const t = [];
    for(let y = 0; y < this.BH; y++){ t.push([]);
      for(let x = 0; x < this.BW; x++){
        const r = Math.random();
        t[y][x] = r < 0.08 ? 2 : r < 0.20 ? 3 : r < 0.26 ? 4 : r < 0.34 ? 1 : 0;
      } }
    const cx = this.BW - 2, cy = Math.floor(this.BH/2);
    for(let y = cy - 1; y <= cy + 1; y++) for(let x = cx - 1; x <= cx; x++) t[y][x] = 7;
    t[Math.floor(this.BH/2)][Math.floor(this.BW/2)] = 6;
    t[1][Math.floor(this.BW*0.3)] = 5; t[this.BH - 2][Math.floor(this.BW*0.6)] = 5;
    return t;
  },
  beginBattle(fromCid, toCid, genNames){
    const tiles = this.buildBattleMap();
    const att = genNames.map((n, i) => { const g = this.S.gens[n];
      return { g, side: 0, x: 0, y: 0, mp: 0, hp: this.gIntel(g)*2, moved: false, acted: false, main: i === 0, st: {}, recon: false, buff: null }; });
    att.forEach((u, i) => { u.x = 0; u.y = clamp(i*2, 0, this.BH - 1); });
    const defOwner = this.S.cities[toCid].owner;
    let defG = defOwner >= 0 ? this.gensAt(toCid, defOwner) : [];
    if(defG.length === 0){
      defG = [{ name: "义军头领", f0: 60, i0: 40, type: "步", lv: 1, items: [], troop: 800, hp: 100, exp: 0, lord: -2 }];
    }
    const dfc = { x: this.BW - 2, y: Math.floor(this.BH/2) };
    const def = defG.slice(0, 10).map((g, i) => ({
      g, side: 1, x: this.BW - 1 - (i % 2), y: clamp(dfc.y - 4 + i*2, 0, this.BH - 1),
      mp: 0, hp: this.gIntel(g)*2, moved: false, acted: false, ghost: g.lord === -2, main: i === 0, st: {}, recon: false, buff: null }));
    /* 战场武将体力池（单挑 / 鏖战消耗）：由平日体力带入场，下限 50 */
    [...att, ...def].forEach(u => {
      const base = clamp(u.g.hp == null ? 100 : u.g.hp, 50, 100);
      u.ghp = base; u.ghpMax = base; u.brk = 1;
    });
    this.battle = { tiles, units: [...att, ...def], weather: pick(WEATHER), turn: 1, toCid, fromCid,
      attackerLord: this.S.player, over: false, phase: "player", sel: null, traps: [],
      attGrain: this.S.cities[fromCid].grain, log: [] };
    genNames.forEach(n => { this.S.gens[n].away = true; });
    this.blog(`=== 攻打 ${CITY[toCid].n} ===  天气：${this.battle.weather}  第 1 日`);
    this.blog("全歼守军或击斩守方主将即胜；攻方 30 日内不克则败。");
    return this.battle;
  },
  blog(t){ if(this.battle){ this.battle.log.push(t); if(this.battle.log.length > 60) this.battle.log.shift(); this.emit("blog", t); } },
  moveCost(u, x, y){
    const ti = this.battle.tiles[y][x];
    const key = { 0:"plain", 1:"grass", 2:"mount", 3:"forest", 4:"river", 5:"base", 6:"base", 7:"base" }[ti];
    return TROOP[u.g.type].cost[key];
  },
  reach(u){
    if(this.hasStatus(u, "定身")) return [];
    let mp = TROOP[u.g.type].mp + this.genItemBonus(u.g).mv + ((u.buff && u.buff.mv) || 0);
    const ghost = this.hasStatus(u, "奇门");
    const seen = { [u.x + "," + u.y]: 0 }, frontier = [[u.x, u.y, mp]], out = [];
    while(frontier.length){
      const [x, y, m] = frontier.shift();
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if(nx < 0 || ny < 0 || nx >= this.BW || ny >= this.BH) return;
        const blocked = this.battle.units.some(v => !v.dead && v.x === nx && v.y === ny);
        if(blocked && !ghost) return;
        const rem = m - this.moveCost(u, nx, ny), k = nx + "," + ny;
        if(rem >= 0 && (seen[k] === undefined || rem > seen[k])){
          seen[k] = rem;
          if(!blocked) out.push([nx, ny]);
          frontier.push([nx, ny, rem]);
        }
      });
    }
    return out;
  },
  terrMod(u){
    const ti = this.battle.tiles[u.y][u.x], t = TERRAIN[ti], tn = TROOP[u.g.type].name;
    // bad 名单里的兵种适应该地形；不在名单者攻防皆受挫（如骑兵陷山地）
    if(t.bad && !t.bad[tn]) return { atk: t.mAtk, def: t.mDef };
    return { atk: 1, def: t.defMod };
  },
  /* 伤害公式：以守方带兵上限为基准，武力差 + 兵力充足度 + 地形修正。
     设计目标：同级别将领满兵对砍约 4~6 合溃一部，猛将可达 3 合。 */
  calcDamage(a, d){
    const ma = this.terrMod(a), md = this.terrMod(d);
    const FA = this.gForce(a.g), FD = this.gForce(d.g);
    const capA = Math.max(1, this.maxTroop(a.g));
    const capD = Math.max(1, this.maxTroop(d.g));
    const ratio = clamp(a.g.troop/capA, 0, 1);          // 兵力越残，出力越低
    let pct = 0.14 + (FA - FD)/420;
    pct *= (0.45 + ratio*0.80);
    pct *= ma.atk * TROOP[a.g.type].atk;
    pct *= (1 - md.def);
    pct *= rnd(0.85, 1.15);
    return Math.max(10, Math.round(capD*pct));
  },
  unitAt(x, y){ return this.battle.units.find(u => !u.dead && u.x === x && u.y === y); },
  attackUnit(a, d){
    const dmg = this.calcDamage(a, d);
    d.g.troop = Math.max(0, d.g.troop - dmg);
    this.blog(`${a.g.name} 攻击 ${d.g.name}，杀伤 ${dmg}（余兵 ${d.g.troop}）`);
    if(d.g.troop <= 0){
      d.dead = true;
      if(d.ghost) this.blog(`${d.g.name} 全军覆没。`);
      else if(Math.random() < 0.35) this.captureGen(d);
      else this.blog(`${d.g.name} 兵败突围而走。`);
    }
    this.emit("battlehit", { a, d, dmg });
    this.checkBattleEnd();
    return dmg;
  },
  captureGen(d){
    this.blog(`${d.g.name} 兵败被俘！`);
    const winnerLord = d.side === 0 ? this.S.cities[this.battle.toCid].owner : this.battle.attackerLord;
    if(winnerLord >= 0){
      const fac = this.S.factions[winnerLord];
      if(fac && !fac.captives.includes(d.g.name)) fac.captives.push(d.g.name);
      d.g.away = false; d.g.captured = true; d.g.troop = 0; d.g.city = "__prison" + winnerLord;
    }
  },
  /* ---------------- 状态异常 ---------------- */
  hasStatus(u, n){ return !!(u.st && u.st[n] > 0); },
  applyStatus(u, n, turns){
    u.st = u.st || {};
    u.st[n] = Math.max(u.st[n] || 0, turns);
    this.blog(`${u.g.name} 陷入【${n}】${turns} 日`);
  },
  statusList(u){ return Object.keys(u.st || {}).filter(k => u.st[k] > 0); },
  /* 回合结算：持续伤害 + 状态递减 */
  tickStatus(u){
    if(!u || u.dead) return;
    if(this.hasStatus(u, "燃烧")){
      const d = Math.min(u.g.troop, 90 + Math.round(u.g.troop*0.03));
      u.g.troop = Math.max(0, u.g.troop - d);
      this.blog(`${u.g.name} 烈焰焚身，损兵 ${d}（余 ${u.g.troop}）`);
      if(u.g.troop <= 0){ u.dead = true; this.blog(`${u.g.name} 被烈火烧尽！`); this.checkBattleEnd(); return; }
    }
    Object.keys(u.st || {}).forEach(k => {
      u.st[k]--;
      if(u.st[k] <= 0){ delete u.st[k]; this.blog(`${u.g.name} 摆脱【${k}】`); }
    });
  },
  confused(u){ return this.hasStatus(u, "混乱") && Math.random() < 0.45; },
  nearRiver(x, y){
    return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < this.BW && ny < this.BH && this.battle.tiles[ny][nx] === 4;
    });
  },

  availableStratagems(u){
    if(this.hasStatus(u, "禁咒")) return [];
    return Object.keys(STRATAGEM).filter(k => {
      const s = STRATAGEM[k];
      if(s.troop && !s.troop.includes(u.g.type)) return false;
      if(u.g.lv < s.lv) return false;
      if((s.mp || 0) > u.hp) return false;
      return true;
    });
  },
  /* 计谋可用性 + 不可用原因（供界面灰显） */
  stratagemState(u, name){
    const s = STRATAGEM[name], b = this.battle;
    if(!s) return { ok: false, why: "无此计" };
    if(this.hasStatus(u, "禁咒")) return { ok: false, why: "被咒封" };
    if(u.g.lv < s.lv) return { ok: false, why: `需 ${s.lv} 级` };
    if((s.mp || 0) > u.hp) return { ok: false, why: `技力 ${s.mp}` };
    if(s.troop && !s.troop.includes(u.g.type)) return { ok: false, why: `限${s.troop.join("")}兵` };
    if(s.banWeather && s.banWeather.includes(b.weather)) return { ok: false, why: `${b.weather}天不可` };
    if(s.needWeather && !s.needWeather.includes(b.weather)) return { ok: false, why: `需${s.needWeather.join("/")}天` };
    if(s.needTerrain && !s.needTerrain.includes(b.tiles[u.y][u.x])) return { ok: false, why: "地形不符" };
    if(s.needRiver && !this.nearRiver(u.x, u.y)) return { ok: false, why: "需近河" };
    return { ok: true, why: "" };
  },
  useStratagem(u, name, tx, ty){
    const st = STRATAGEM[name], b = this.battle;
    const chk = this.stratagemState(u, name);
    if(!chk.ok){ this.blog(`${name}：${chk.why}`); return false; }
    const self = st.target === "self" || !!st.trap;   // 布设类无需目标
    let target = null;
    if(!self){
      target = this.unitAt(tx, ty);
      if(st.heal || st.target === "ally"){
        if(!target || target.side !== u.side){ this.blog("目标需为友军"); return false; }
      } else if(!target || target.side === u.side){ this.blog("目标无效"); return false; }
      const dist = Math.abs(u.x - tx) + Math.abs(u.y - ty);
      if((st.rng || 0) > 0 && dist > st.rng){ this.blog("距离过远"); return false; }
    }
    if(st.needAlly){
      const ally = b.units.some(v => !v.dead && v !== u && v.side === u.side
        && Math.abs(v.x - u.x) + Math.abs(v.y - u.y) === 1);
      if(!ally){ this.blog("需相邻友军配合"); return false; }
    }
    u.hp -= st.mp || 0; u.acted = true;
    let dmg = 0;
    if(st.trap){
      const put = (x, y) => b.traps.push({ x, y, side: u.side, dmg: st.trap.dmg, status: st.trap.status });
      if(st.trap.cross){ [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => { const nx = u.x + dx, ny = u.y + dy;
        if(nx >= 0 && ny >= 0 && nx < this.BW && ny < this.BH) put(nx, ny); }); }
      else put(u.x, u.y);
      this.blog(`${u.g.name} 布下【${name}】`);
    } else if(st.weather){
      b.weather = pick(["晴","阴","雨","大风"]);
      this.blog(`${u.g.name} 观星改天，天气变为【${b.weather}】！`);
    } else if(st.intel){
      b.units.filter(v => v.side !== u.side).forEach(v => { v.recon = true; });
      this.blog(`谍报：已探明敌军 ${b.units.filter(v => v.side !== u.side && !v.dead).length} 部部署`);
    } else if(st.buff){
      u.buff = Object.assign({}, u.buff, st.buff);
      this.blog(`${u.g.name} 施展【${name}】，移动力 +${st.buff.mv}`);
    } else if(st.heal){
      const cap = this.maxTroop(target.g), before = target.g.troop;
      target.g.troop = Math.min(cap, target.g.troop + st.heal);
      this.blog(`${u.g.name} 施展【${name}】，${target.g.name} 恢复 ${target.g.troop - before} 兵（${target.g.troop}）`);
    } else {
      if(st.selfCost){
        const cost = Math.round(u.g.troop*st.selfCost);
        u.g.troop = Math.max(0, u.g.troop - cost);
        this.blog(`${u.g.name} 死战突击，自身折损 ${cost} 兵`);
      }
      const wMod = { "晴":1.1, "阴":0.95, "雨":0.8, "大风":1.0, "冰雹":0.5 }[b.weather] || 1;
      let base = st.dmg || 0;
      if(st.vs && st.vs[target.g.type]) base *= st.vs[target.g.type];
      dmg = Math.round(base*(0.5 + this.gIntel(u.g)/120)*wMod*this.terrMod(target).atk);
      /* 伤害值随之按守方带兵上限收束：下限 12%（保证有效），上限 55%（避免一击秒杀） */
      const capD = Math.max(1, this.maxTroop(target.g));
      dmg = clamp(dmg, Math.round(capD*0.12), Math.round(capD*0.55));
      target.g.troop = Math.max(0, target.g.troop - dmg);
      this.blog(`${u.g.name} 施展【${name}】，${target.g.name} 损兵 ${dmg}（余 ${target.g.troop}）`);
      if(st.status && st.status.length === 2) this.applyStatus(target, st.status[0], st.status[1]);
      if(target.g.troop <= 0){
        target.dead = true;
        if(Math.random() < 0.35) this.captureGen(target); else this.blog(`${target.g.name} 兵败突围而走。`);
      }
      this.checkBattleEnd();
    }
    this.emit("battlehit", { a: u, d: target, dmg, strat: name });
    return true;
  },
  /* 踏入陷阱 / 石阵 */
  checkTrap(u){
    const b = this.battle;
    const i = b.traps.findIndex(t => t.x === u.x && t.y === u.y && t.side !== u.side);
    if(i < 0) return null;
    const t = b.traps.splice(i, 1)[0];
    const before = u.g.troop;
    u.g.troop = Math.max(0, u.g.troop - t.dmg);
    this.blog(`⚠ ${u.g.name} 触发${t.status ? "石阵" : "陷阱"}，损兵 ${before - u.g.troop}！`);
    if(t.status && t.status.length === 2) this.applyStatus(u, t.status[0], t.status[1]);
    if(u.g.troop <= 0){ u.dead = true; this.blog(`${u.g.name} 阵亡。`); this.checkBattleEnd(); }
    return t;
  },
  /* ================================================================
     单挑：与相邻敌将单骑对决，最多 DUEL.maxRound 回合。
     每回合双方各出一手：强攻 / 必杀 / 守备 / 脱身。
     体力归零者落败 —— 大概率被擒，小概率被阵斩。
     ================================================================ */
  duelTargets(u){
    if(!u || u.dead || !this.battle) return [];
    return this.battle.units.filter(v => !v.dead && v.side !== u.side && !v.ghost
      && Math.abs(v.x - u.x) + Math.abs(v.y - u.y) === 1);
  },
  canDuel(a, d){
    const b = this.battle;
    if(!b || b.over) return { ok: false, why: "战斗已结束" };
    if(!a || !d || a.dead || d.dead) return { ok: false, why: "目标已不在场" };
    if(a.side === d.side) return { ok: false, why: "只能向敌将搦战" };
    if(Math.abs(a.x - d.x) + Math.abs(a.y - d.y) !== 1) return { ok: false, why: "须与敌将相邻" };
    if(a.ghost || d.ghost) return { ok: false, why: "无名贼军无可搦战" };
    if(a.acted) return { ok: false, why: "本回合已行动" };
    if(this.hasStatus(a, "混乱")) return { ok: false, why: "军心混乱，无法出阵" };
    if(this.hasStatus(a, "定身")) return { ok: false, why: "身形被钉，无法出阵" };
    if(this.hasStatus(d, "潜踪")) return { ok: false, why: "敌将行踪不明" };
    return { ok: true, why: "" };
  },
  beginDuel(a, d){
    if(!this.canDuel(a, d).ok) return null;
    return { a, d, round: 1, max: DUEL.maxRound, over: false, res: null };
  },
  /* 每一手的伤害基数 */
  duelDmg(src, dst, act){
    const R = (this.gForce(src.g) + 32)/(this.gForce(dst.g) + 32);
    if(act === "杀") return Math.max(1, Math.round(46*R*rnd(0.62, 1.38)));
    return Math.max(1, Math.round(23*R*rnd(0.82, 1.18)));
  },
  /* 电脑选招 */
  aiDuelAct(x, y){
    const r = this.gForce(x.g)/Math.max(1, this.gForce(y.g));
    const roll = Math.random();
    if(x.ghp < 28){                                   // 力怯，先保命
      if(roll < 0.16) return "退";
      if(roll < 0.66) return "守";
      return r > 1.12 ? "杀" : "攻";
    }
    if(r > 1.20) return roll < 0.56 ? "杀" : "攻";     // 占优，抢攻
    if(r < 0.86) return roll < 0.14 ? "杀" : (roll < 0.60 ? "守" : "攻");
    return roll < 0.32 ? "杀" : (roll < 0.42 ? "守" : "攻");
  },
  _duelCost(u, pct, lines){
    const lost = Math.round(u.g.troop*pct);
    u.g.troop = Math.max(0, u.g.troop - lost);
    if(lost > 0) lines.push(`${u.g.name} 部众溃散 ${lost}（余 ${u.g.troop}）`);
    if(u.g.troop <= 0){ u.dead = true; if(!u.ghost) lines.push(`${u.g.name} 所部尽没！`); }
  },
  _duelRetreat(duel, who, lines){
    const esc = who === "a" ? duel.a : duel.d, other = who === "a" ? duel.d : duel.a;
    lines.push(`${esc.g.name} 虚晃一招，脱离战团。`);
    this._duelCost(esc, 0.12, lines);
    duel.over = true;
    duel.res = { kind: "retreat", winner: other.g.name, loser: esc.g.name, lines };
    this.blog(`单挑中止：${esc.g.name} 抽身罢斗。`);
    esc.acted = true; other.acted = true;
    return { lines, over: true, res: duel.res };
  },
  _duelFinish(duel, win, lose, lines){
    duel.over = true;
    const gap = this.gForce(win.g) - this.gForce(lose.g);
    this._duelCost(lose, 0.55, lines);
    let kind = "escape";
    const killP = clamp(0.03 + gap/500, 0, 0.2);
    if(!lose.ghost && gap >= 25 && Math.random() < killP){
      kind = "kill";
      lose.dead = true;
      lines.push(`★ ${lose.g.name} 被 ${win.g.name} 一合斩于马下！`);
      this.blog(`★ 单挑：${win.g.name} 阵斩 ${lose.g.name}！`);
      if(this.S.gens[lose.g.name] === lose.g){ delete this.S.gens[lose.g.name]; }
      Object.values(this.S.factions).forEach(f => { f.captives = (f.captives || []).filter(n => n !== lose.g.name); });
    } else if(!lose.ghost && Math.random() < 0.68){
      kind = "capture";
      lines.push(`${lose.g.name} 力尽被擒！`);
      lose.dead = true;                    // 被擒者退场（否则仍留在战场上）
      this.captureGen(lose);
      this.blog(`★ 单挑：${win.g.name} 生擒 ${lose.g.name}！`);
    } else {
      lines.push(`${lose.g.name} 拨马逃回本阵。`);
      this.blog(`单挑：${win.g.name} 击败 ${lose.g.name}，后者败回本阵。`);
    }
    win.g.exp = (win.g.exp || 0) + 40 + rand(40);
    this.levelUp(win.g);
    win.ghp = Math.max(1, win.ghp);
    win.acted = true; lose.acted = true;
    duel.res = { kind, winner: win.g.name, loser: lose.g.name, lines };
    this.checkBattleEnd();
    return { lines, over: true, res: duel.res };
  },
  /* 进行一回合：actA 为发起方的选择，应对方由电脑决策 */
  duelRound(duel, actA){
    const a = duel.a, d = duel.d, lines = [];
    if(duel.over) return { lines, over: true, res: duel.res };
    const actB = this.aiDuelAct(d, a);
    lines.push(`◆ 第 ${duel.round} 合`);
    if(actA === "退") return this._duelRetreat(duel, "a", lines);
    if(actB === "退") return this._duelRetreat(duel, "d", lines);
    const aFirst = this.gForce(a.g) + rand(8) >= this.gForce(d.g) + rand(8);
    const seq = aFirst ? [["a", actA, actB], ["d", actB, actA]] : [["d", actB, actA], ["a", actA, actB]];
    for(const [who, act, oppAct] of seq){
      if(duel.over) break;
      const src = who === "a" ? a : d, dst = who === "a" ? d : a;
      if(src.ghp <= 0 || dst.ghp <= 0) continue;
      if(act === "守"){
        src.ghp = Math.min(src.ghpMax, src.ghp + 5);
        lines.push(`${src.g.name} 收刀守备，调息回气（体力 +5）`);
        continue;
      }
      let dmg = this.duelDmg(src, dst, act), crit = false;
      if(act === "杀"){
        const p = clamp(0.52 + (this.gIntel(src.g) - this.gIntel(dst.g))/280, 0.25, 0.82);
        if(Math.random() > p){
          lines.push(`${src.g.name} 倾力一击，却被 ${dst.g.name} 看破！`);
          src.brk = 1.6;                       // 破绽：下一击受创加剧
          continue;
        }
        crit = true;
      }
      const guard = oppAct === "守";
      const bonus = src.brk || 1;
      src.brk = 1;
      dmg = Math.max(1, Math.round(dmg*bonus*(guard ? 0.45 : 1)));
      dst.ghp = Math.max(0, dst.ghp - dmg);
      lines.push(`${src.g.name}${crit ? "使出必杀" : "挥军直取"}，${dst.g.name} 体力 -${dmg}`
        + (guard ? "（格挡）" : "") + (bonus > 1 ? "（趁虚而入）" : ""));
      if(dst.ghp <= 0){
        lines.push(`${dst.g.name} 力竭落马！`);
        return this._duelFinish(duel, src, dst, lines);
      }
    }
    duel.round++;
    if(duel.round > duel.max){
      a.ghp = Math.max(0, a.ghp - 6); d.ghp = Math.max(0, d.ghp - 6);
      lines.push("斗至日暮，旗鼓相当，各自鸣金收兵。");
      this._duelCost(a, 0.10, lines);
      this._duelCost(d, 0.10, lines);
      duel.over = true;
      duel.res = { kind: "draw", winner: null, loser: null, lines };
      this.blog(`单挑：${a.g.name} 与 ${d.g.name} 大战 ${duel.max} 合不分胜负！`);
      a.acted = true; d.acted = true;
      return { lines, over: true, res: duel.res };
    }
    return { lines, over: false, res: null };
  },
  /* 电脑对电脑快速结算（敌军主动搦战时用） */
  autoDuel(x, y){
    const duel = this.beginDuel(x, y);
    if(!duel) return null;
    const lines = [];
    let r = null, guard = 0;
    this.blog(`${x.g.name} 出阵搦战 ${y.g.name}！`);
    while(!duel.over && guard++ < 24){
      r = this.duelRound(duel, this.aiDuelAct(x, y));
      r.lines.forEach(t => lines.push(t));
    }
    return { duel, lines, res: duel.res };
  },
  checkBattleEnd(){
    const b = this.battle; if(!b || b.over) return null;
    const attAlive = b.units.some(u => !u.dead && u.side === 0);
    const defAlive = b.units.some(u => !u.dead && u.side === 1);
    const defMain = b.units.find(u => u.side === 1 && u.main);
    if(!defAlive) return this.battleOver(true, "全歼守军");
    if(defMain && defMain.dead) return this.battleOver(true, "守方主将被歼");
    if(!attAlive) return this.battleOver(false, "攻方全灭");
    if(b.attGrain <= 0) return this.battleOver(false, "攻方粮尽");
    return null;
  },
  battleOver(attWin, reason){
    const b = this.battle; b.over = true; b.attWin = attWin; b.reason = reason;
    const to = b.toCid, from = b.fromCid;
    /* 战场体力（单挑消耗）回写到武将体力 */
    b.units.forEach(u => {
      if(u.ghp != null && this.S.gens[u.g.name] === u.g) u.g.hp = Math.max(1, Math.round(u.ghp));
    });
    const attUnits = b.units.filter(u => u.side === 0);
    if(attWin){
      this.blog(`★ 攻克 ${CITY[to].n}！（${reason}）`);
      const oldOwner = this.S.cities[to].owner;
      this.S.cities[to].owner = b.attackerLord;
      attUnits.filter(u => !u.dead).forEach(u => { u.g.city = to; u.g.away = false; u.g.acted = true;
        u.g.exp = (u.g.exp || 0) + 20 + rand(30); this.levelUp(u.g); });
      b.units.filter(u => u.side === 1 && !u.dead && !u.ghost).forEach(u => { u.g.city = to; u.g.lord = this.S.cities[to].owner === this.S.player ? this.S.player : u.g.lord; });
      if(oldOwner >= 0 && this.allCitiesOf(oldOwner).length === 0) this.eliminateFaction(oldOwner, b.attackerLord);
    } else {
      this.blog(`× 攻势受挫（${reason}），残部退回 ${CITY[from].n}。`);
      attUnits.filter(u => !u.dead).forEach(u => { u.g.city = from; u.g.away = false; u.g.acted = true;
        u.g.troop = Math.floor(u.g.troop*0.8); });
    }
    this.S.cities[from].grain = b.attGrain;
    const res = { attWin, reason, to, from };
    this.emit("battleover", res);
    return res;
  },
  battleRetreat(){
    const b = this.battle;
    b.units.filter(u => u.side === 0 && !u.dead).forEach(u => { u.g.city = b.fromCid; u.g.away = false; });
    return this.battleOver(false, "攻方撤退");
  },
  levelUp(g){
    while(g.exp >= 100*g.lv && g.lv < 30){ g.exp -= 100*g.lv; g.lv++;
      g.f0 = Math.min(120, g.f0 + 2); g.i0 = Math.min(120, g.i0 + 2);
      this.log(`${g.name} 升至 ${g.lv} 级！`); }
  },
  /* AI 施计：高智将领优先用伤害/状态计谋 */
  aiCast(u, tgt){
    const b = this.battle;
    if(this.gIntel(u.g) < 76 || u.hp < 20 || Math.random() > 0.45) return null;
    const list = this.availableStratagems(u).filter(n => {
      const s = STRATAGEM[n];
      return (s.dmg || s.status) && !s.heal && !s.weather && !s.intel && !s.buff && !s.trap;
    }).sort((a, c) => (STRATAGEM[c].dmg || 0) - (STRATAGEM[a].dmg || 0));
    for(const n of list){
      const s = STRATAGEM[n];
      if((s.rng || 0) < Math.abs(u.x - tgt.x) + Math.abs(u.y - tgt.y)) continue;
      if(!this.stratagemState(u, n).ok) continue;
      const before = tgt.g.troop;
      if(this.useStratagem(u, n, tgt.x, tgt.y)) return { type: "strat", unit: u, target: tgt, name: n, dmg: before - tgt.g.troop };
    }
    return null;
  },
  enemyPhase(){
    const b = this.battle;
    const defs = b.units.filter(u => u.side === 1 && !u.dead);
    const events = [];
    for(const u of defs){
      if(b.over) break;
      this.tickStatus(u);
      if(u.dead){ events.push({ type: "dead", unit: u }); continue; }
      if(this.confused(u)){
        this.blog(`${u.g.name} 军心混乱，原地打转！`);
        events.push({ type: "confuse", unit: u });
        continue;
      }
      let pool = b.units.filter(v => v.side === 0 && !v.dead && !this.hasStatus(v, "潜踪"));
      if(!pool.length) pool = b.units.filter(v => v.side === 0 && !v.dead);
      let tgt = null, best = 1e9;
      pool.forEach(v => {
        const d = Math.abs(u.x - v.x) + Math.abs(u.y - v.y);
        if(d < best){ best = d; tgt = v; }
      });
      if(!tgt) continue;
      /* 猛将临阵搦战：相邻有敌将时有概率单挑 */
      const adjA = b.units.filter(v => v.side === 0 && !v.dead && !v.ghost
        && Math.abs(v.x - u.x) + Math.abs(v.y - u.y) === 1);
      if(adjA.length && this.gForce(u.g) >= 84 && !u.acted && Math.random() < 0.30){
        const t2 = adjA.slice().sort((p, q) => this.gForce(q.g) - this.gForce(p.g))[0];
        const dr = this.autoDuel(u, t2);
        if(dr){
          events.push({ type: "duel", unit: u, target: t2, lines: dr.lines, res: dr.res });
          if(this.checkBattleEnd()) return events;
          continue;
        }
      }
      const cast = this.aiCast(u, tgt);
      if(cast){ events.push(cast); continue; }
      const rng = TROOP[u.g.type].range;
      let steps = Math.min(TROOP[u.g.type].mp, best - rng > 0 ? best - rng : 0);
      const path = [];
      while(steps > 0){
        const dx = Math.sign(tgt.x - u.x), dy = Math.sign(tgt.y - u.y);
        let moved = false;
        for(const [mx, my] of (Math.abs(tgt.x - u.x) > Math.abs(tgt.y - u.y) ? [[dx,0],[0,dy]] : [[0,dy],[dx,0]])){
          const nx = u.x + mx, ny = u.y + my;
          if(nx < 0 || ny < 0 || nx >= this.BW || ny >= this.BH) continue;
          if(b.units.some(v => !v.dead && v !== u && v.x === nx && v.y === ny)) continue;
          u.x = nx; u.y = ny; steps--; moved = true; path.push([nx, ny]); break;
        }
        if(!moved) break;
      }
      if(path.length){
        events.push({ type: "move", unit: u, path });
        const trap = this.checkTrap(u);
        if(trap) events.push({ type: "trap", unit: u, trap });
        if(u.dead) continue;
      }
      const d2 = Math.abs(u.x - tgt.x) + Math.abs(u.y - tgt.y);
      if(d2 <= rng){ const dmg = this.attackUnit(u, tgt); events.push({ type: "attack", unit: u, target: tgt, dmg }); }
    }
    if(!b.over){
      b.turn++;
      const attTroops = b.units.filter(u => u.side === 0 && !u.dead).reduce((a, u) => a + u.g.troop, 0);
      b.attGrain = Math.max(0, b.attGrain - Math.ceil(attTroops/70));
      b.weather = Math.random() < 0.4 ? pick(WEATHER) : b.weather;
      this.blog(`—— 第 ${b.turn} 日  天气：${b.weather} ——`);
      if(b.turn > 30){ this.battleOver(false, "三十日不克"); return events; }
    }
    return events;
  }
};
