// 浏览器端验证：加载页面、无 console 错误、走通 开局→选君主→选城→结束本月
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('file:///E:/ai-plan/Games/sanguo-baye/index.html');
  await page.waitForTimeout(500);
  console.log('标题:', await page.title());

  // 开始游戏 → 选第一个剧本
  await page.click('text=开始游戏');
  await page.waitForTimeout(200);
  await page.click('.scen-card >> nth=0'); // 董卓弄权
  await page.waitForTimeout(200);
  // 选董卓（第一个势力）
  await page.click('.fac-card >> nth=0');
  await page.waitForTimeout(300);
  console.log('城池节点数:', await page.locator('.city-node').count());
  console.log('顶栏:', (await page.textContent('#topbar')).replace(/\s+/g, ' ').trim());

  // 点击我方城池（player 节点）
  await page.click('.city-node.player >> nth=0');
  await page.waitForTimeout(200);
  console.log('侧栏:', (await page.textContent('#sidepanel')).replace(/\s+/g, ' ').slice(0, 120));

  // 进入城池 → 执行一次开垦
  await page.click('text=进入城池');
  await page.waitForTimeout(200);
  await page.click('text=开垦');
  await page.waitForTimeout(200);
  await page.click('#picklist .gen-row >> nth=0');
  await page.waitForTimeout(200);
  console.log('开垦指令执行 OK');

  // 结束本月（回地图）
  await page.click('text=返回地图');
  await page.waitForTimeout(200);
  await page.click('text=结束本月');
  await page.waitForTimeout(500);
  console.log('结束本月 OK, 顶栏:', (await page.textContent('#topbar')).replace(/\s+/g, ' ').trim());

  console.log('console 错误数:', errors.length);
  errors.slice(0, 5).forEach(e => console.log('ERR:', e));
  await page.screenshot({ path: 'screenshot.png' });
  console.log('截图: screenshot.png');
  await browser.close();
  if (errors.length) process.exit(2);
})().catch(e => { console.error('E2E FAIL:', e.message); process.exit(1); });
