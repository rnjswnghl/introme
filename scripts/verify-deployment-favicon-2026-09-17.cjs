const { chromium } = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const report = {
    url: 'https://intro.rnjswnghl.chatgpt.site/',
    checkedAt: new Date().toISOString(),
    expectedTitle: 'Intro_J',
    expectedIcon: 'assets/favicon.svg',
    viewports: [],
  };

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    const failedRequests = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => failedRequests.push(request.url()));

    const response = await page.goto(`${report.url}?release=d3e3cdd#intro`, { waitUntil: 'networkidle' });
    const title = await page.title();
    const icon = await page.locator('link[rel="icon"]').getAttribute('href');
    const iconResponse = await page.request.get(new URL(icon, page.url()).href);
    const iconBody = await iconResponse.text();
    const intro = await page.locator('#panel-intro').isVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );

    await page.screenshot({
      path: `docs/screenshots/T01-deployment-favicon-${viewport.width}.png`,
      fullPage: false,
    });

    await page.locator('#tab-projects').click();
    const click = await page.locator('#panel-projects').isVisible();
    await page.locator('#tab-about').focus();
    await page.keyboard.press('Enter');
    const enter = await page.locator('#panel-about').isVisible();
    await page.locator('#tab-intro').focus();
    await page.keyboard.press('Space');
    const space = await page.locator('#panel-intro').isVisible();

    if (viewport.width === 1366) {
      await page.screenshot({
        path: 'docs/screenshots/T01-deployment-favicon-interaction.png',
        fullPage: false,
      });
    }

    report.viewports.push({
      ...viewport,
      status: response.status(),
      title,
      icon,
      iconStatus: iconResponse.status(),
      iconType: iconResponse.headers()['content-type'],
      iconHasJH: iconBody.includes('>J<') && iconBody.includes('>H<'),
      intro,
      click,
      enter,
      space,
      overflow,
      errors,
      failedRequests,
    });
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(
    'docs/T01-deployment-favicon-2026-09-17-validation.json',
    `${JSON.stringify(report, null, 2)}\n`,
  );

  const failed = report.viewports.some((item) => (
    item.status !== 200 ||
    item.title !== report.expectedTitle ||
    item.icon !== report.expectedIcon ||
    item.iconStatus !== 200 ||
    item.iconType !== 'image/svg+xml' ||
    !item.iconHasJH ||
    !item.intro ||
    !item.click ||
    !item.enter ||
    !item.space ||
    item.overflow ||
    item.errors.length ||
    item.failedRequests.length
  ));

  console.log(JSON.stringify(report, null, 2));
  if (failed) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
