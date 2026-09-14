const { chromium } = require('playwright');
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
    { width: 320, height: 700, name: '320' },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on('console', (message) => {
      if (message.type() === 'error') result.consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) => result.failedRequests.push(request.url()));
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await page.screenshot({
      path: `docs/screenshots/T01-reference-${viewport.name}.png`,
      fullPage: true,
    });
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      tabs: [...document.querySelectorAll('.folio-tab')].map((tab) => ({
        text: tab.textContent.trim(),
        href: tab.getAttribute('href'),
      })),
      fonts: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
      imagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      h1Count: document.querySelectorAll('h1').length,
      anchorsValid: [...document.querySelectorAll('a[href^="#"]')].every((link) => {
        const id = link.getAttribute('href').slice(1);
        return id === '' || document.getElementById(id);
      }),
    }));
    await page.locator('.folio-tab').nth(1).focus();
    metrics.tabFocusOutline = await page.locator('.folio-tab').nth(1).evaluate((tab) => getComputedStyle(tab).outlineStyle !== 'none');
    result.viewports.push({ ...viewport, ...metrics });
    await page.close();
  }

  fs.writeFileSync('docs/T01-reference-validation.json', `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();
  if (result.consoleErrors.length || result.failedRequests.length || result.viewports.some((item) => item.overflow !== 0 || !item.imagesLoaded || item.h1Count !== 1 || !item.anchorsValid || !item.tabFocusOutline)) {
    process.exitCode = 1;
  }
})();
