// 完整流程：play.html 设缓存 → 点模式卡 → pc.html 载入引擎 → 导出数据 → 键盘游玩采样
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('pageerror', e => console.log('[pageerror]', String(e.message).slice(0, 160)));

  // 1) 中转页
  await page.goto('https://baye.bbkgames.com/play.html?lib=libs/dat-mod.lib&title=%E4%B8%89%E5%9B%BD%E9%9C%B8%E4%B8%9A-%E8%AF%8D%E5%85%B8%E5%8E%9F%E7%89%88',
    { waitUntil: 'networkidle' });
  await sleep(2000);
  const opts = await page.evaluate(() => Array.from(document.querySelectorAll('.opt')).map(o => ({
    page: o.getAttribute('data-page'), mobile: o.getAttribute('data-mobile'), text: o.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)
  })));
  console.log('模式卡片:', JSON.stringify(opts));
  console.log('localStorage:', await page.evaluate(() => JSON.stringify({ libname: localStorage['baye/libname'], libpath: localStorage['baye/libpath'] })));

  // 2) 点桌面端
  await page.click('.opt[data-page="pc.html"]');
  await page.waitForURL('**/pc.html**', { timeout: 30000 });
  console.log('已跳转:', page.url());

  // 3) 等待引擎就绪（baye 对象 + LCD 有画面）
  let ok = false;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const st = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      let nonBlack = 0, colors = 0;
      if (c) {
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          const set = new Set();
          for (let k = 0; k < d.length; k += 4) {
            if (d[k] + d[k + 1] + d[k + 2] > 60) nonBlack++;
            if (k % 40 === 0) set.add(`${d[k]},${d[k+1]},${d[k+2]}`);
          }
          colors = set.size;
        } catch (e) {}
      }
      return { hasBaye: typeof window.baye === 'object', canvas: !!c,
        w: c ? c.width : 0, h: c ? c.height : 0, nonBlack, colors,
        lib: document.getElementById('lib-name') ? document.getElementById('lib-name').textContent : '' };
    });
    if (st.hasBaye && st.nonBlack > 100) { console.log('引擎就绪 @', i, 's:', JSON.stringify(st)); ok = true; break; }
    if (i % 5 === 0) console.log('等待中...', JSON.stringify(st));
  }
  if (!ok) { console.log('引擎未就绪'); await page.screenshot({ path: path.join(OUT, '99-fail.png') }); await browser.close(); return; }

  // 4) LCD 配色分析（是否彩色）
  const lcd = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const set = new Map(); let colored = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      const k = `${r},${g},${b}`; set.set(k, (set.get(k) || 0) + 1);
      if (Math.abs(r-g) > 6 || Math.abs(g-b) > 6 || Math.abs(r-b) > 6) colored++;
    }
    const top = [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { w: c.width, h: c.height, distinct: set.size, coloredPixels: colored, top };
  });
  console.log('LCD 分析:', JSON.stringify(lcd));

  // 5) 导出数据表
  const dump = await page.evaluate(() => {
    const b = window.baye; if (!b) return { err: 'no baye' };
    const T = (fn, ...a) => { try { return b[fn](...a); } catch (e) { return null; } };
    const out = { fns: Object.keys(b) };
    const pc = T('getPersonCount'); out.personCount = pc;
    if (typeof pc === 'number' && pc > 0 && pc < 5000) {
      out.persons = []; for (let i = 0; i < pc; i++) out.persons.push(T('getPersonName', i));
    }
    const collect = (fn, max) => { const arr = []; for (let i = 0; i < max; i++) { const v = T(fn, i); if (v === null || v === undefined) break; arr.push(v); } return arr; };
    out.cities = collect('getCityName', 80);
    out.tools = collect('getToolName', 120);
    out.skills = collect('getSkillName', 80);
    return out;
  });
  fs.writeFileSync(path.join(OUT, 'baye-data.json'), JSON.stringify(dump, null, 1));
  console.log('API 函数:', (dump.fns || []).join(','));
  console.log('人数:', dump.personCount);
  console.log('武将:', (dump.persons || []).slice(0, 400).join(' '));
  console.log('城池:', (dump.cities || []).join(' '));
  console.log('道具:', (dump.tools || []).join(' '));
  console.log('计谋:', (dump.skills || []).join(' '));

  // 6) 键盘游玩采样：每按一次键记录 LCD 指纹
  const fp = async () => page.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0, nb = 0;
    for (let i = 0; i < d.length; i += 16) { h = (h * 31 + d[i]) % 1e9; if (d[i] > 20) nb++; }
    return { h, nb };
  });
  await page.screenshot({ path: path.join(OUT, '20-title.png') });
  const seq = ['Enter', 'Enter', 'Enter', 'ArrowDown', 'Enter', 'Enter', 'ArrowDown', 'Enter', 'Enter'];
  let prev = (await fp()).h;
  for (let i = 0; i < seq.length; i++) {
    await page.keyboard.press(seq[i]);
    await sleep(1200);
    const f = await fp();
    console.log(`按键[${seq[i]}] #${i} 指纹=${f.h} 变化=${f.h !== prev ? 'YES' : 'no'} 亮点=${f.nb}`);
    prev = f.h;
    await page.screenshot({ path: path.join(OUT, `30-step${i}.png`) });
  }
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
