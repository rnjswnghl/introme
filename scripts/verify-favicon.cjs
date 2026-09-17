let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}

const fs = require('fs');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const result = { viewports: [], consoleErrors: [], failedRequests: [] };

  for (const viewport of [
    { width: 1366, height: 768, name: '1366' },
    { width: 1920, height: 1080, name: '1920' },
    { width: 390, height: 844, name: '390' },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on('console', (message) => {
      if (message.type() === 'error') result.consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) => result.failedRequests.push(request.url()));

    await page.goto('http://127.0.0.1:4173/#intro', { waitUntil: 'networkidle' });
    const title = await page.title();
    const icon = await page.locator('link[rel="icon"]').getAttribute('href');
    const iconResponse = await page.request.get(new URL(icon, page.url()).href);
    const noHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );

    await page.screenshot({
      path: `docs/screenshots/T01-favicon-${viewport.name}.png`,
      fullPage: false,
    });

    await page.locator('#tab-projects').click();
    const clickWorks = await page.locator('#tab-projects').getAttribute('aria-selected') === 'true';
    await page.locator('#tab-about').focus();
    await page.keyboard.press('Enter');
    const enterWorks = await page.locator('#tab-about').getAttribute('aria-selected') === 'true';
    await page.locator('#tab-intro').focus();
    await page.keyboard.press('Space');
    const spaceWorks = await page.locator('#tab-intro').getAttribute('aria-selected') === 'true';

    result.viewports.push({
      ...viewport,
      title,
      icon,
      iconStatus: iconResponse.status(),
      iconType: iconResponse.headers()['content-type'],
      noHorizontalOverflow,
      clickWorks,
      enterWorks,
      spaceWorks,
    });
    await page.close();
  }

  await browser.close();
  fs.writeFileSync('docs/T01-favicon-validation.json', `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
