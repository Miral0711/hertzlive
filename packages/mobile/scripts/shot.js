// Dev aid: screenshot a phone screen in the Expo web preview (http://localhost:8081).
//   node scripts/shot.js /mobile/chats/t1 out.png [--as=priya.shah@hertzstudio.demo] [--click="Text"]...
// Needs playwright-core (NODE_PATH=$TMPDIR/shot/node_modules) and Google Chrome. Prints console errors.
const { chromium } = require('playwright-core');
const args = process.argv.slice(2);
const [go, out] = args;
const opt = (n) => args.filter((a) => a.startsWith(`--${n}=`)).map((a) => a.slice(n.length + 3));
const email = opt('as')[0] || 'harshal.patel@hertzstudio.demo';
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'error') logs.push('console.error: ' + m.text().slice(0, 400)); });
  p.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message.slice(0, 400)));
  await p.goto('http://localhost:8081');
  await p.waitForSelector('text=Welcome back', { timeout: 60000 });
  // pick account then sign in
  const accounts = await p.$$('text=/ · /');
  await p.getByText(/·/).first().click();
  await p.getByText(new RegExp('^' + (email.split('.')[0]), 'i')).first().click().catch(() => {});
  await p.locator('input').last().fill('password');
  await p.getByText('Sign in', { exact: true }).last().click();
  await p.waitForTimeout(1500);
  await p.goto('http://localhost:8081/?go=' + encodeURIComponent(go));
  await p.waitForTimeout(4000);
  for (const t of opt('click')) { await p.getByText(t).first().click().catch((e) => logs.push('click failed: ' + t)); await p.waitForTimeout(800); }
  await p.screenshot({ path: out });
  console.log(logs.join('\n') || 'no console errors');
  await b.close();
})();
