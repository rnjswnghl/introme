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
    { width: 320, height: 700, name: '320' },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on('console', (message) => {
      if (message.type() === 'error') result.consoleErrors.push(message.text());
    });
    page.on('requestfailed', (request) => result.failedRequests.push(request.url()));
    await page.goto('http://127.0.0.1:4173/#intro', { waitUntil: 'networkidle' });

    const introVisible = await page.locator('#panel-intro').isVisible();
    const userSelect = await page.locator('body').evaluate((body) => getComputedStyle(body).userSelect);
    const evidenceCards = await page.locator('[data-open-project]').count();
    if (viewport.name === '1366' || viewport.name === '1920') {
      await page.screenshot({ path: `docs/screenshots/T01-intro-${viewport.name}.png`, fullPage: true });
    }
    await page.locator('[data-open-project="onwear"]').click();
    const evidenceNavigation =
      await page.locator('#tab-projects').getAttribute('aria-selected') === 'true' &&
      await page.locator('#project-tab-onwear').getAttribute('aria-selected') === 'true';
    await page.goto('http://127.0.0.1:4173/#intro', { waitUntil: 'networkidle' });
    await page.locator('#tab-projects').click();
    const visibleAfterClick = await page.locator('.tab-panel:visible').count();
    const projectNames = [];
    const projectPageHeights = [];
    const projectShots = [];
    const carouselCounts = [];
    const carouselNavigation = [];
    const dialogCarouselNavigation = [];
    const troubleshooting = [];
    for (const tab of await page.locator('.project-tab').all()) {
      await tab.click();
      projectNames.push(await page.locator('.project-detail:visible h3').textContent());
      const carousel = page.locator('.project-detail:visible [data-carousel]');
      const slideCount = await carousel.locator('.carousel-slide').count();
      carouselCounts.push(slideCount);
      projectShots.push(await carousel.locator('.carousel-slide img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)));
      const labels = [];
      for (let index = 0; index < slideCount; index += 1) {
        const shot = carousel.locator('.project-shot:visible');
        labels.push(await carousel.locator('[data-carousel-label]').textContent());
        projectShots.push(await shot.locator('img').evaluate((image) => image.complete && image.naturalWidth > 0));
        await shot.click();
        projectShots.push(await page.locator('#shot-dialog').evaluate((dialog) => dialog.open));
        await page.locator('[data-close-dialog]').click();
        await carousel.locator('[data-carousel-next]').click();
      }
      carouselNavigation.push(new Set(labels).size === slideCount && await carousel.locator('[data-carousel-index]').textContent() === '1');
      const firstShot = carousel.locator('.project-shot:visible');
      await firstShot.click();
      const firstDialogSource = await page.locator('#shot-dialog img').getAttribute('src');
      await page.locator('[data-dialog-next]').click();
      const nextDialogSource = await page.locator('#shot-dialog img').getAttribute('src');
      const inlineAdvanced = await carousel.locator('[data-carousel-index]').textContent() === '2';
      await page.keyboard.press('ArrowLeft');
      const keyboardReturned = await page.locator('#shot-dialog img').getAttribute('src') === firstDialogSource;
      await page.locator('[data-dialog-prev]').click();
      const wrappedToLast = await page.locator('[data-dialog-index]').textContent() === String(slideCount);
      await page.locator('[data-dialog-next]').click();
      await page.locator('[data-close-dialog]').click();
      dialogCarouselNavigation.push(firstDialogSource !== nextDialogSource && inlineAdvanced && keyboardReturned && wrappedToLast);
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
    if (viewport.name === '1366' || viewport.name === '390') {
      await page.locator('#project-tab-daltoori').click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `docs/screenshots/T01-daltoori-${viewport.name}.png`, fullPage: true });
    }

    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      visiblePanels: [...document.querySelectorAll('.tab-panel')].filter((panel) => !panel.hidden).length,
      imagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      fonts: [...document.fonts].map((font) => ({ family: font.family, status: font.status })),
      h1Count: document.querySelectorAll('h1').length,
      repositoryLinks: document.querySelectorAll('a[href^="https://github.com/"]').length,
      brandImages: document.querySelectorAll('.project-brand img').length,
    }));
    result.viewports.push({ ...viewport, introVisible, userSelect, evidenceCards, evidenceNavigation, visibleAfterClick, projectNames, projectPageHeights, projectShots, carouselCounts, carouselNavigation, dialogCarouselNavigation, troubleshooting, keyboardSelected, hashSelected, ...metrics });
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
    !item.introVisible || item.userSelect !== 'none' || item.evidenceCards !== 3 || !item.evidenceNavigation ||
    !item.imagesLoaded || item.h1Count !== 1 || item.brandImages !== 4 ||
    item.keyboardSelected !== 'true' || item.hashSelected !== 'true' ||
    item.projectNames.join('|') !== '한페이지|FocusMate|On-Wear|DALTOORI' ||
    item.carouselCounts.join('|') !== '10|8|7|4' || item.carouselNavigation.some((works) => !works) ||
    item.dialogCarouselNavigation.some((works) => !works) ||
    item.projectShots.some((loaded) => !loaded) || item.troubleshooting.some((opened) => !opened) ||
    (item.width >= 1000 && Math.max(...item.projectPageHeights) > item.height + 8)
  );
  if (invalid || result.consoleErrors.length || result.failedRequests.length ||
      result.withoutJavaScript.visibleFolderPanels !== 4 || result.withoutJavaScript.visibleProjectPanels !== 4) {
    process.exitCode = 1;
  }
})();
