const {chromium}=require('C:/Users/samsung/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const result={url:process.env.QA_URL||'http://127.0.0.1:4173/',viewports:[],errors:[]};
 for(const [width,height] of [[1366,768],[1920,1080],[390,844],[320,700]]){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
 page.on('pageerror',e=>result.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text())});
 await page.goto(result.url+'#projects',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.project-tab').count(),6);
 for(const id of ['burnit','cutandnote']){
 const tab=page.locator('#project-tab-'+id);
 await tab.click();
 const panel=page.locator('#project-'+id);
 assert(await panel.isVisible());
 assert.equal(await page.locator('.project-detail:visible').count(),1);
 assert.equal(await panel.locator('.project-links a').count(),2);
 assert.equal(await panel.locator('.project-title p').textContent(),'2026.09 Web');
 const expected=id==='burnit'?9:8;
 assert.equal(await panel.locator('.carousel-slide').count(),expected);
 const labels=[];
 for(let i=0;i<expected;i++){
  const slide=panel.locator('.carousel-slide:visible');
  await slide.locator('img').evaluate(img=>img.decode());
  labels.push(await slide.getAttribute('data-label'));
  await slide.click();
  assert.equal(await page.locator('#shot-dialog img').getAttribute('src'),await slide.getAttribute('data-shot'));
  await page.keyboard.press('Escape');
  await panel.locator('[data-carousel-next]').click();
 }
 assert.equal(new Set(labels).size,expected);
 assert.equal(await panel.locator('[data-carousel-index]').textContent(),'1');
 assert(await panel.locator('img').first().evaluate(i=>i.complete&&i.naturalWidth>0));
 await page.screenshot({path:`docs/screenshots/gallery-2026-10-04-${id}-${width}.png`,fullPage:true});
 await tab.focus(); await page.keyboard.press('Enter');
 assert.equal(await tab.getAttribute('aria-selected'),'true');
 await page.keyboard.press('Space');
 assert.equal(await tab.getAttribute('aria-selected'),'true');
 await panel.locator('.project-shot:visible').click();
 assert(await page.locator('#shot-dialog').evaluate(d=>d.open));
 await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
 assert(await page.locator('#shot-dialog img').evaluate(i=>i.complete&&i.naturalWidth>0));
 await page.keyboard.press('Escape');
 assert(!(await page.locator('#shot-dialog').evaluate(d=>d.open)));
 await panel.locator('summary').click();
 assert(await panel.locator('details').evaluate(d=>d.open));
 await panel.locator('summary').click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.locator('#project-tab-burnit').focus(); await page.keyboard.press('ArrowDown');
 assert.equal(await page.locator('#project-tab-cutandnote').getAttribute('aria-selected'),'true');
 await page.locator('#tab-records').click();
 assert.equal(await page.locator('.record-list a').count(),5);
 const colors=await page.locator('#panel-records').evaluate(e=>{const s=getComputedStyle(e);return {ink:s.getPropertyValue('--ink'),muted:s.getPropertyValue('--muted'),paper:s.getPropertyValue('--paper')}});
 result.viewports.push({width,height,projectCount:6,overflow:false,clickEnterSpace:true,arrowNavigation:true,dialog:true,links:true,colors});
 await page.close();
 }
 await browser.close(); assert.deepEqual(result.errors,[]);
 fs.writeFileSync('docs/gallery-2026-10-04-validation.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exit(1)});

