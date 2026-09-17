const { chromium } = require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const report = { url:'https://intro.rnjswnghl.chatgpt.site/', checkedAt:new Date().toISOString(), viewports:[] };
  try {
    for (const [width,height] of [[1366,768],[1920,1080],[390,844]]) {
      const page = await browser.newPage({viewport:{width,height}, reducedMotion:'reduce'});
      const errors=[], failedRequests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      page.on('requestfailed',r=>failedRequests.push(r.url()));
      const response=await page.goto(report.url,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      const intro=await page.locator('#panel-intro').isVisible();
      await page.screenshot({path:`docs/screenshots/T01-deployment-2026-09-17-${width}.png`,fullPage:true});
      await page.locator('#tab-projects').click();
      const click=await page.locator('#panel-projects').isVisible();
      await page.locator('#tab-intro').focus();
      await page.keyboard.press('Enter');
      const enter=await page.locator('#panel-intro').isVisible();
      await page.locator('#tab-projects').focus();
      await page.keyboard.press('Space');
      const space=await page.locator('#panel-projects').isVisible();
      if(width===1366)await page.screenshot({path:'docs/screenshots/T01-deployment-2026-09-17-interaction.png',fullPage:true});
      const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
      report.viewports.push({width,height,status:response.status(),intro,click,enter,space,overflow,errors,failedRequests});
      await page.close();
    }
    fs.writeFileSync('docs/T01-deployment-2026-09-17-validation.json',JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
    if(report.viewports.some(v=>v.status!==200||!v.intro||!v.click||!v.enter||!v.space||v.overflow||v.errors.length||v.failedRequests.length))process.exitCode=1;
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
