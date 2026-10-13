// 彩色像素版 E2E：彩色渲染校验 + 出征战斗交互 + 画面模式切换
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'research', 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('file:///E:/ai-plan/Games/sanguo-baye/index.html');
  await page.waitForTimeout(400);

  await page.click('text=开始游戏');
  await page.click('.scen-card >> nth=0');   // 董卓弄权
  await page.click('.fac-card >> nth=0');    // 董卓
  await page.waitForTimeout(600);

  // 1) 大地图：城池旗色 + 头像
  const mapInfo = await page.evaluate(() => {
    const flags = Array.from(document.querySelectorAll('.flag')).map(f => f.style.background);
    const avatars = Array.from(document.querySelectorAll('.city-node .avatar'));
    return { flagCount: flags.length, distinctFlags: [...new Set(flags)].length,
      avatarCount: avatars.length, avatarSample: avatars.length ? avatars[0].src.slice(0, 30) : '' };
  });
  console.log('1) 大地图:', JSON.stringify(mapInfo));
  await page.screenshot({ path: path.join(OUT, '60-map-color.png') });

  // 2) 武将详情含头像
  await page.click('.city-node.player >> nth=0');
  await page.waitForTimeout(300);
  await page.click('text=进入城池');
  await page.waitForTimeout(300);
  await page.click('.genline >> nth=0');
  await page.waitForTimeout(300);
  const hasPortrait = await page.evaluate(() => {
    const img = document.querySelector('#modalbox img.avatar');
    return img ? { w: img.naturalWidth, h: img.naturalHeight, isPng: img.src.startsWith('data:image/png') } : null;
  });
  console.log('2) 武将详情头像:', JSON.stringify(hasPortrait));
  await page.screenshot({ path: path.join(OUT, '61-portrait.png') });
  await page.evaluate(() => closeModal());
  await page.waitForTimeout(200);
  const modalClosed = await page.evaluate(() => !document.getElementById('modal').classList.contains('active'));
  console.log('   弹窗已关闭:', modalClosed);

  // 3) 出征 → 战斗（彩色战棋）
  await page.evaluate(() => cmdChuZheng());          // 打开出征目标选择
  await page.waitForTimeout(400);
  await page.click('#modalbox .gen-row >> nth=0');   // 目标城
  await page.waitForTimeout(500);
  await page.click('#explist .gen-row >> nth=0');    // 选将1（UI 点击验证）
  await page.click('#explist .gen-row >> nth=1');    // 选将2
  const selInfo = await page.evaluate(() => window._exp ? window._exp.sel.join(',') || '空' : 'no-exp');
  console.log('   UI 勾选出征将领:', selInfo);
  await page.evaluate(() => {
    if (!window._exp) return;
    if (!window._exp.sel.length) {
      const names = Object.keys(S.gens).filter(n => {
        const g = S.gens[n]; return g.lord === S.player && g.city === window._exp.from && g.troop > 0;
      }).slice(0, 2);
      window._exp.sel = names;
    }
    launchBattle();
  });
  await page.waitForTimeout(1000);
  const inBattle = await page.evaluate(() => document.getElementById('battlescreen').classList.contains('active'));
  console.log('3) 进入战斗:', inBattle);

  const palette = await page.evaluate(() => {
    const c = document.getElementById('battlecanvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const set = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = `${d[i]},${d[i+1]},${d[i+2]}`; set.set(k, (set.get(k) || 0) + 1);
    }
    return { distinct: set.size, top: [...set.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6) };
  });
  console.log('   战斗画面颜色数:', palette.distinct, '主色:', JSON.stringify(palette.top));
  await page.screenshot({ path: path.join(OUT, '62-battle-color.png') });

  // 4) 战斗交互：移动 → 结束回合 → 敌方行动
  await page.click("#battlecmd >> text=移动");
  const box = await page.locator('#battlecanvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.16, box.y + box.height * 0.35);
  await page.waitForTimeout(400);
  await page.click("#battlecmd >> text=结束回合");
  await page.waitForTimeout(1200);
  const logText = await page.textContent('#battlelog');
  console.log('4) 战斗日志行数:', logText.trim().split('\n').filter(Boolean).length);
  console.log('   日志尾部:', logText.trim().split('\n').slice(-2).join(' | ').slice(0, 120));

  // 5) 画面模式切换 → 黑白
  await page.click("#battlecmd >> text=画面");
  await page.waitForTimeout(500);
  const mono = await page.evaluate(() => {
    const c = document.getElementById('battlecanvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - d[i+1]) > 10 || Math.abs(d[i+1] - d[i+2]) > 10) colored++;
    return { coloredPixels: colored, label: document.getElementById('btn-mono').textContent };
  });
  console.log('5) 黑白模式:', JSON.stringify(mono));
  await page.screenshot({ path: path.join(OUT, '63-battle-mono.png') });

  // 回彩色并退出战斗
  await page.click("#battlecmd >> text=画面");
  await page.waitForTimeout(300);
  await page.click("#battlecmd >> text=全军撤退");
  await page.waitForTimeout(2200);

  console.log('console 错误数:', errors.length);
  errors.slice(0, 6).forEach(e => console.log('  ERR:', e.slice(0, 160)));
  await page.screenshot({ path: path.join(OUT, '64-after-battle.png') });
  await browser.close();
  if (errors.length) process.exit(2);
})().catch(e => { console.error('E2E FAIL:', e.message); process.exit(1); });
