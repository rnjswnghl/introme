// T08 화면 확인: Chrome DevTools의 가상 인증기(WebAuthn 도메인)로 실제 브라우저 흐름을 돌리고 캡처한다.
// 사용: node scripts/t08-browser-check.cjs [BASE] [캡처 폴더]
const { chromium } = require('playwright');
const fs = require('node:fs');

const BASE = (process.argv[2] || 'http://localhost:4180').replace(/\/$/, '');
const OUT = process.argv[3] || 'docs/screenshots';
const run = Date.now().toString(36).slice(-4);
const username = `demo-${run}`;
const results = [];
const network = [];
const consoleErrors = [];

const check = (id, title, pass, detail) => {
  results.push({ id, title, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${title}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'ko-KR' });
  const page = await context.newPage();
  page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()));
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('response', async (res) => {
    const url = new URL(res.url());
    if (!url.pathname.startsWith('/api/')) return;
    const req = res.request();
    let body = req.postData();
    try { body = JSON.parse(body); } catch {}
    if (body?.response?.response) body = { ...body, response: { id: body.response.id, 필드: Object.keys(body.response.response) } };
    network.push({ method: req.method(), path: url.pathname + url.search, status: res.status(), body: body ?? null });
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const addAuth = async () => (await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })).authenticatorId;

  let auth1 = await addAuth();
  const status = () => page.locator('[data-private-status]').innerText();
  const shot = (name) => page.screenshot({ path: `${OUT}/T08-${name}.png` });

  await page.goto(`${BASE}/#private`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot('01-locked-1366');
  check('B1', '로그인 전: 잠긴 서랍과 경계가 보이고 비공개 내용은 없다',
    await page.locator('[data-auth-view="out"]').isVisible() && !(await page.locator('[data-auth-view="in"]').isVisible()));

  // 등록 취소 흉내: 사용자 확인(UV)을 실패시키면 브라우저가 NotAllowedError를 낸다.
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId: auth1, isUserVerified: false });
  await page.fill('[data-register-form] [name=username]', username);
  await page.fill('[data-register-form] [name=name]', '노트북 Chrome (가상)');
  await page.click('[data-register-form] button[type=submit]');
  await page.waitForFunction(() => document.querySelector('[data-private-status]').dataset.tone === 'error', null, { timeout: 90_000 });
  await shot('02-register-cancelled-1366');
  check('B2', '등록 취소 시 안내가 나오고 서랍은 열리지 않는다', (await status()).includes('저장되지 않았습니다'), await status());
  await cdp.send('WebAuthn.setUserVerified', { authenticatorId: auth1, isUserVerified: true });

  await page.click('[data-register-form] button[type=submit]');
  await page.locator('[data-auth-view="in"]').waitFor();
  await page.waitForSelector('.passkey-item');
  await shot('03-registered-open-1366');
  check('B3', '등록 후 서랍이 열리고 비공개 기록 3건 이상', (await page.locator('.note-item').count()) >= 3);

  // 같은 인증기로 두 번째 패스키 → excludeCredentials 때문에 막힌다.
  await page.click('[data-add-passkey-form] button[type=submit]');
  await page.waitForFunction(() => document.querySelector('[data-private-status]').dataset.tone === 'error', null, { timeout: 30_000 });
  await shot('04-same-device-blocked-1366');
  check('B4', '같은 기기로 두 번째 패스키 등록은 막힌다', (await status()).includes('이미 이 계정의 패스키'), await status());

  // 두 번째 기기 흉내: 첫 인증기의 자격 증명을 보관하고 떼어 낸 뒤 새 인증기를 붙인다.
  const saved = (await cdp.send('WebAuthn.getCredentials', { authenticatorId: auth1 })).credentials;
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: auth1 });
  const auth2 = await addAuth();
  await page.fill('[data-add-passkey-form] [name=name]', '휴대폰 Chrome (가상)');
  await page.click('[data-add-passkey-form] button[type=submit]');
  await page.waitForFunction(() => document.querySelectorAll('.passkey-item').length === 2, null, { timeout: 30_000 });
  await page.locator('.passkey-list').scrollIntoViewIfNeeded();
  await shot('05-two-passkeys-1366');
  check('B5', '패스키 두 개가 이름·등록일과 함께 목록에 보인다', (await page.locator('.passkey-item').count()) === 2);

  // 첫 패스키(노트북) 삭제
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.passkey-item', { hasText: '노트북' }).locator('button').click();
  await page.waitForFunction(() => document.querySelectorAll('.passkey-item').length === 1);
  check('B6', '하나를 지우면 하나 남고, 남은 하나는 지우기 버튼이 잠긴다',
    await page.locator('.passkey-item button').isDisabled(), await page.locator('.passkey-item button').innerText());
  await shot('06-one-left-1366');

  // 로그아웃 → 남은 패스키(휴대폰, auth2)로 로그인
  await page.click('[data-logout]');
  await page.locator('[data-auth-view="out"]').waitFor();
  await shot('07-logged-out-1366');
  await page.fill('[data-login-form] [name=username]', username);
  await page.click('[data-login-form] button[type=submit]');
  await page.locator('[data-auth-view="in"]').waitFor();
  check('B7', '지우고 남은 패스키로 로그인 성공', true);
  await page.click('[data-logout]');
  await page.locator('[data-auth-view="out"]').waitFor();

  // 지운 패스키로 로그인 시도: 휴대폰 인증기를 떼고 노트북 인증기(자격 증명 그대로)를 다시 붙인다.
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: auth2 });
  auth1 = await addAuth();
  for (const credential of saved) await cdp.send('WebAuthn.addCredential', { authenticatorId: auth1, credential });
  await page.click('[data-login-form] button[type=submit]'); // 이름표 없이: 기기에 남은 패스키 사용
  await page.waitForFunction(() => document.querySelector('[data-private-status]').dataset.tone === 'error', null, { timeout: 30_000 });
  await shot('08-deleted-passkey-rejected-1366');
  check('B8', '지운 패스키는 기기에 남아 있어도 들어가지 못한다', !(await page.locator('[data-auth-view="in"]').isVisible()), await status());

  // 화면 크기별 확인
  const overflow = {};
  for (const [w, h] of [[1920, 1080], [390, 844], [320, 640]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/#private`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    overflow[w] = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await shot(`09-locked-${w}`);
  }
  check('B9', '1920·390·320에서 가로 넘침 없음', Object.values(overflow).every((v) => v <= 0), overflow);

  // 키보드로 비공개 탭 열기
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${BASE}/#records`, { waitUntil: 'networkidle' });
  await page.focus('#tab-records');
  await page.keyboard.press('ArrowRight');
  check('B10', '방향키로 비공개 탭에 도달하고 패널이 열린다', await page.locator('#panel-private').isVisible());

  const html = await (await page.request.get(`${BASE}/`)).text();
  check('B11', '로그인 없이 받은 HTML에 사용자 이름표가 없다', !html.includes(username));

  // B8은 일부러 거절당하는 요청이라 브라우저가 401을 콘솔에 남긴다. 그 한 건만 예상된 기록으로 뺀다.
  const unexpected = consoleErrors.filter((text) => !/status of 401/.test(text));
  check('B12', '예상한 401(B8 거절) 외 콘솔 오류 없음', unexpected.length === 0 && consoleErrors.length <= 1, consoleErrors);

  fs.writeFileSync('docs/T08-browser-check.json', JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), username, results, network }, null, 2) + '\n');
  console.log(`${results.filter((r) => r.pass).length}/${results.length} 통과`);
  await browser.close();
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
})();
