// 本地部署原版 → 真实游玩 → 导出 baye.data（武将/城池/道具全表）与流程采样
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:8123';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on('console', m => { const t = m.text(); if (/lib|font|error|fail/i.test(t)) console.log('[c]', t.slice(0, 120)); });
  page.on('pageerror', e => console.log('[pe]', String(e.message).slice(0, 160)));

  await page.goto(BASE + '/choose.html', { waitUntil: 'networkidle' });
  await sleep(1000);
  const first = await page.evaluate(() => {
    const b = document.querySelector('.btn.menu');
    return { text: b.textContent.trim(), onclick: b.getAttribute('onclick') };
  });
  console.log('第一项:', JSON.stringify(first));
  await page.click('.btn.menu');
  await sleep(1500);
  // chooseLib 可能直接跳转或需再选模式
  console.log('URL:', page.url());

  // 若在模式页，点 pc.html
  if (page.url().includes('play.html') || !(await page.$('canvas'))) {
    const opt = await page.$('.opt[data-page="pc.html"]');
    if (opt) { await opt.click(); await page.waitForURL('**/pc.html**', { timeout: 20000 }); }
  }
  await page.waitForSelector('canvas', { timeout: 20000 });
  console.log('进入:', page.url());

  // 等待 LCD 渲染
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const st = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let nb = 0; for (let k = 0; k < d.length; k += 4) if (d[k] > 10) nb++;
      return { nb, w: c.width, h: c.height, data: !!(window.baye && window.baye.data) };
    });
    if (st.nb > 50) { console.log(`渲染就绪 @${i + 1}s:`, JSON.stringify(st)); ready = true; break; }
    if (i % 4 === 3) console.log('等待渲染', JSON.stringify(st));
  }
  if (!ready) { console.log('未渲染'); await page.screenshot({ path: path.join(OUT, '98-norender.png') }); await browser.close(); return; }

  await page.screenshot({ path: path.join(OUT, '40-title.png') });
  console.log('=== 截图 40-title.png（应为标题/主菜单）===');

  // LCD 配色
  const lcd = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const set = new Map(); let colored = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      set.set(`${r},${g},${b}`, (set.get(`${r},${g},${b}`) || 0) + 1);
      if (Math.abs(r - g) > 6 || Math.abs(g - b) > 6) colored++;
    }
    return { w: c.width, h: c.height, distinct: set.size, colored,
      top: [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
  });
  console.log('LCD:', JSON.stringify(lcd));

  // 等待 baye.data 可用（进入游戏后），导出完整数据
  const dumpData = async () => page.evaluate(() => {
    if (!(window.baye && window.baye.data)) return { err: 'no data' };
    const d = window.baye.data;
    const keys = Object.keys(d);
    const out = { keys, personCount: d.g_Persons ? d.g_Persons.length : 0,
      cityCount: d.g_Cities ? d.g_Cities.length : 0 };
    if (d.g_Persons && d.g_Persons[0]) out.personFields = Object.keys(d.g_Persons[0]);
    if (d.g_Cities && d.g_Cities[0]) out.cityFields = Object.keys(d.g_Cities[0]);
    const names = [];
    for (let i = 0; i < out.personCount; i++) { try { names.push(window.baye.getPersonName(i)); } catch (e) { names.push('?'); } }
    out.persons = names;
    const cities = []; for (let i = 0; i < (out.cityCount || 50); i++) { try { const c = window.baye.getCityName(i); if (c) cities.push(c); } catch (e) {} }
    out.cities = cities;
    const tools = []; for (let i = 0; i < 100; i++) { try { const t = window.baye.getToolName(i); if (t) tools.push(t); } catch (e) { break; } }
    out.tools = tools;
    const skills = []; for (let i = 0; i < 60; i++) { try { const s = window.baye.getSkillName(i); if (s) skills.push(s); } catch (e) { break; } }
    out.skills = skills;
    // 取前 12 个武将的完整属性
    out.samplePersons = d.g_Persons ? d.g_Persons.slice(0, 12) : [];
    out.sampleCities = d.g_Cities ? d.g_Cities.slice(0, 8) : [];
    return out;
  });

  // 键盘推进：主菜单 → 时期 → 君主 → 大地图
  const fp = async () => page.evaluate(() => {
    const c = document.querySelector('canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0, nb = 0;
    for (let i = 0; i < d.length; i += 16) { h = (h * 31 + d[i]) % 1e9; if (d[i] > 20) nb++; }
    return { h, nb };
  });
  let prev = (await fp()).h;
  const steps = ['Enter', 'Enter', 'ArrowDown', 'Enter', 'ArrowDown', 'Enter', 'Enter', 'Enter'];
  for (let i = 0; i < steps.length; i++) {
    await page.keyboard.press(steps[i]);
    await sleep(900);
    const f = await fp();
    console.log(`[${i}] ${steps[i]} → 指纹${f.h} 变化:${f.h !== prev ? 'YES' : 'no'} 亮点${f.nb}`);
    prev = f.h;
    await page.screenshot({ path: path.join(OUT, `50-step${i}.png`) });
    const dd = await dumpData();
    if (!dd.err) { console.log('  >>> baye.data 可用！人数:', dd.personCount, '城池:', dd.cityCount); break; }
  }

  // 最终导出
  const data = await dumpData();
  fs.writeFileSync(path.join(OUT, 'baye-data-full.json'), JSON.stringify(data, null, 1));
  if (!data.err) {
    console.log('数据键:', data.keys.join(','));
    console.log('武将字段:', (data.personFields || []).join(','));
    console.log('城池字段:', (data.cityFields || []).join(','));
    console.log('人数:', data.personCount, '城池数:', data.cityCount);
    console.log('武将:', (data.persons || []).join(' '));
    console.log('城池:', (data.cities || []).join(' '));
    console.log('道具:', (data.tools || []).join(' '));
    console.log('计谋:', (data.skills || []).join(' '));
  } else console.log('data 不可用:', data.err);
  await browser.close();
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
