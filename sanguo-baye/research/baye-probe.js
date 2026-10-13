// 探测 baye.bbkgames.com 网页原版：抓 DOM、网络资源、全局对象、canvas 像素配色
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://baye.bbkgames.com/pc.html?name=%E4%B8%89%E5%9B%BD%E9%9C%B8%E4%B8%9A-%E8%AF%8D%E5%85%B8%E5%8E%9F%E7%89%88';
const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const reqs = [];
  page.on('request', r => reqs.push(r.url()));
  page.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 200)));
  page.on('pageerror', e => console.log('[pageerror]', e.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // 1) DOM 文本
  const domText = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, 'dom.txt'), domText);
  console.log('=== DOM 文本 (前 2000 字) ===');
  console.log(domText.slice(0, 2000));

  // 2) 页面结构
  const info = await page.evaluate(() => {
    const out = { canvases: [], imgs: [], globals: [] };
    document.querySelectorAll('canvas').forEach(c => out.canvases.push({ w: c.width, h: c.height, cls: c.className, id: c.id }));
    document.querySelectorAll('img').forEach(i => out.imgs.push({ src: i.src.slice(0, 160), w: i.naturalWidth, h: i.naturalHeight }));
    // 找可疑全局对象
    for (const k in window) {
      try {
        const v = window[k];
        if (v && (typeof v === 'object') && !(v instanceof Element) && k.length < 30 && /baye|game|game_|BAYE|Game|app|App|_app|core/i.test(k)) {
          out.globals.push({ k, type: typeof v, keys: Object.keys(v).slice(0, 40) });
        }
      } catch (e) {}
    }
    return out;
  });
  console.log('=== canvases ===', JSON.stringify(info.canvases));
  console.log('=== imgs ===', JSON.stringify(info.imgs).slice(0, 1500));
  console.log('=== globals ===', JSON.stringify(info.globals).slice(0, 3000));

  // 3) 网络资源清单
  fs.writeFileSync(path.join(OUT, 'requests.txt'), reqs.join('\n'));
  const jsFiles = reqs.filter(u => /\.(js|json|bin|dat|png|zip)(\?|$)/.test(u));
  console.log('=== 资源文件 (前40) ===');
  jsFiles.slice(0, 40).forEach(u => console.log(' ', u));
  fs.writeFileSync(path.join(OUT, 'assets.txt'), jsFiles.join('\n'));

  // 4) canvas 像素配色直方图
  const palette = await page.evaluate(() => {
    const res = [];
    document.querySelectorAll('canvas').forEach((c, ci) => {
      try {
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, Math.min(c.width, 400), Math.min(c.height, 400)).data;
        const map = {};
        for (let i = 0; i < d.length; i += 4) {
          const k = `${d[i]},${d[i+1]},${d[i+2]}`;
          map[k] = (map[k] || 0) + 1;
        }
        const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12);
        res.push({ canvas: ci, w: c.width, h: c.height, top });
      } catch (e) { res.push({ canvas: ci, err: e.message }); }
    });
    return res;
  });
  console.log('=== canvas 配色直方图 ===', JSON.stringify(palette).slice(0, 3000));

  await page.screenshot({ path: path.join(OUT, '01-initial.png') });
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
