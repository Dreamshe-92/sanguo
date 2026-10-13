// 运行原版引擎，通过 baye API 导出权威数据表 + LCD 像素分析 + 键盘游玩流程
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const URL = 'https://baye.bbkgames.com/play.html?lib=libs/dat-mod.lib&title=%E4%B8%89%E5%9B%BD%E9%9C%B8%E4%B8%9A-%E8%AF%8D%E5%85%B8%E5%8E%9F%E7%89%88';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.on('console', m => { if (m.type()==='error') console.log('[err]', m.text().slice(0,150)); });
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0,200)));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);

  // 等待 baye 与 LCD 就绪
  const ready = await page.evaluate(() => ({
    hasBaye: typeof window.baye === 'object',
    fns: typeof window.baye === 'object' ? Object.keys(window.baye) : [],
    canvases: Array.from(document.querySelectorAll('canvas')).map(c => ({ id: c.id, w: c.width, h: c.height })),
    url: location.href
  }));
  console.log('READY:', JSON.stringify(ready));

  // LCD 像素统计（判断是否彩色 / 灰度级数）
  const lcd = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const set = new Set(); let colored = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r=d[i],g=d[i+1],b=d[i+2];
      set.add(`${r},${g},${b}`);
      if (Math.abs(r-g)>8 || Math.abs(g-b)>8 || Math.abs(r-b)>8) colored++;
    }
    const top = [...set].slice(0, 20);
    return { w:c.width, h:c.height, distinctColors:set.size, coloredPixels:colored, sample: top };
  });
  console.log('LCD:', JSON.stringify(lcd));

  // 尝试导出数据表
  const dump = await page.evaluate(() => {
    const b = window.baye;
    if (!b) return { err: 'no baye' };
    const out = {};
    const tryCall = (fn, ...args) => { try { return b[fn](...args); } catch(e) { return 'ERR:' + e.message; } };
    out.personCount = tryCall('getPersonCount');
    const names = [];
    if (typeof out.personCount === 'number') {
      for (let i = 0; i < out.personCount; i++) {
        const n = tryCall('getPersonName', i);
        names.push(n);
      }
    }
    out.persons = names;
    const cities = []; for (let i = 0; i < 60; i++) { const n = tryCall('getCityName', i); if (typeof n === 'string' && n) cities.push(n); }
    out.cities = cities;
    const tools = []; for (let i = 0; i < 60; i++) { const n = tryCall('getToolName', i); if (typeof n === 'string' && n) tools.push(n); }
    out.tools = tools;
    const skills = []; for (let i = 0; i < 60; i++) { const n = tryCall('getSkillName', i); if (typeof n === 'string' && n) skills.push(n); }
    out.skills = skills;
    return out;
  });
  fs.writeFileSync(path.join(OUT, 'baye-data.json'), JSON.stringify(dump, null, 1));
  console.log('PERSON COUNT:', dump.personCount);
  console.log('PERSONS:', (dump.persons||[]).join(' '));
  console.log('CITIES:', (dump.cities||[]).join(' '));
  console.log('TOOLS:', (dump.tools||[]).join(' '));
  console.log('SKILLS:', (dump.skills||[]).join(' '));

  await page.screenshot({ path: path.join(OUT, '10-play.png') });
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
