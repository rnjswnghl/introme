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
    await page.goto('http://127.0.0.1:4173/#intro', { waitUntil: 'networkidle' });

    const introVisible = await page.locator('#panel-intro').isVisible();
    await page.locator('#tab-projects').click();
    const visibleAfterClick = await page.locator('.tab-panel:visible').count();
    const projectNames = [];
    const projectPageHeights = [];
    const projectShots = [];
    const troubleshooting = [];
    for (const tab of await page.locator('.project-tab').all()) {
      await tab.click();
      projectNames.push(await page.locator('.project-detail:visible h3').textContent());
      const shot = page.locator('.project-detail:visible .project-shot');
      projectShots.push(await shot.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0));
      await shot.click();
      projectShots.push(await page.locator('#shot-dialog').evaluate((dialog) => dialog.open));
      await page.locator('[data-close-dialog]').click();
      const details = page.locator('.project-detail:visible .troubleshooting');
      await details.locator('summary').click();
      troubleshooting.push(await details.evaluate((item) => item.open));
      await details.locator('summary').click();
      projectPageHeights.push(await page.evaluate(() => document.documentElement.scrollHeight));
    }
    await page.locator('#tab-projects').focus();
    await page.keyboard.press('ArrowRight');
    const keyboardSelected = await page.locator('#tab-about').getAttribute('aria-selected');
    await page.goto('http://127.0.0.1:4173/#records', { waitUntil: 'networkidle' });
    const hashSelected = await page.locator('#tab-records').getAttribute('aria-selected');
    await page.goto('http://127.0.0.1:4173/#projects', { waitUntil: 'networkidle' });
    await page.locator('#project-tab-hanpage').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `docs/screenshots/T01-tabs-${viewport.name}.png`, fullPage: true });

    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visiblePanels: [...document.querySelectorAll('.tab-panel')].filter((panel) => !panel.hidden).length,
      imagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      fonts: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
      h1Count: document.querySelectorAll('h1').length,
      repositoryLinks: document.querySelectorAll('a[href^="https://github.com/"]').length,
    }));
    result.viewports.push({ ...viewport, introVisible, visibleAfterClick, projectNames, projectPageHeights, projectShots, troubleshooting, keyboardSelected, hashSelected, ...metrics });
    await page.close();
  }

  const noScript = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await noScript.newPage();
  await noScriptPage.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  result.withoutJavaScript = {
    visibleFolderPanels: await noScriptPage.locator('.tab-panel:visible').count(),
    visibleProjectPanels: await noScriptPage.locator('.project-detail:visible').count(),
  };
  await noScript.close();

  fs.writeFileSync('docs/T01-tabbed-validation.json', `${JSON.stringify(result, null, 2)}\n`);
  await browser.close();

  const invalid = result.viewports.some((item) =>
    item.overflow !== 0 || item.visiblePanels !== 1 || item.visibleAfterClick !== 1 ||
    !item.introVisible || !item.imagesLoaded || item.h1Count !== 1 ||
    item.keyboardSelected !== 'true' || item.hashSelected !== 'true' ||
    item.projectNames.join('|') !== '한페이지|FocusMate|On-Wear|DALTOORI' ||
    item.projectShots.some((loaded) => !loaded) || item.troubleshooting.some((opened) => !opened) ||
    (item.width >= 1000 && Math.max(...item.projectPageHeights) > item.height + 8)
  );
  if (invalid || result.consoleErrors.length || result.failedRequests.length ||
      result.withoutJavaScript.visibleFolderPanels !== 4 || result.withoutJavaScript.visibleProjectPanels !== 4) {
    process.exitCode = 1;
  }
})();
