import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {startSiteServer} from './helpers/site-server.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');

const unityStub=`<script>
 const params=new URLSearchParams(location.search);
 window.reportRun=(type,cleared=true)=>parent.postMessage({source:'gidanyan-unity',type,cleared,
  difficulty:params.get('difficulty'),loadId:params.get('loadId')},location.origin);
 window.reportRun('ready');
</script>`;

async function report(page,type,cleared=true) {
 const frame=page.frames().find(frame=>/\/game\/index\.html\?/.test(frame.url()));
 assert.ok(frame,'Unity iframe has loaded');
 await frame.evaluate(({type,cleared})=>window.reportRun(type,cleared),{type,cleared});
 // Wait until the parent has processed the asynchronous postMessage.
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
}

async function readStory(page,course) {
 await page.locator('#openStoryNotice').click();
 await page.locator('#clearStoryPages img').first().waitFor({state:'visible'});
 await page.waitForFunction(()=>{
  const image=document.querySelector('#clearStoryPages img');
  return image?.complete && image.naturalWidth>0;
 });
 const source=await page.locator('#clearStoryPages img').first().getAttribute('src');
 assert.ok(source.startsWith(`stories/${course}/`));
 assert.equal(await page.locator('#clearStoryReader').isVisible(),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
}

async function checkSelection(page,cleared=[]) {
 for(const course of ['easy','normal','hard','ex']){
  const badge=page.locator(`.stage-card[data-difficulty="${course}"] .stage-status`);
  const next=course==='normal' && cleared.includes('easy') && !cleared.includes('normal');
  const visible=cleared.includes(course)||course==='easy'||next;
  assert.equal(await badge.isVisible(),visible,`${course}: badge visibility`);
  if(visible)assert.equal(await badge.textContent(),cleared.includes(course)?'CLEAR':next?'NEXT':'まずはここから');
 }
}

test('all courses keep comics after navigation, reload and a browser restart',async t=>{
 const {base,close}=await startSiteServer();
 const profilePrefix=path.join(tmpdir(),'gidanyan-clear-story-');
 const profile=await mkdtemp(profilePrefix);
 let context;
 const errors=[];
 t.after(async()=>{
  await context?.close();
  await close();
  assert.ok(path.resolve(profile).startsWith(path.resolve(profilePrefix)));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 });
 const launch=async()=>{
  context=await chromium.launchPersistentContext(profile,{
   channel:process.env.PHOTO_TEST_BROWSER||'chrome',headless:true,viewport:{width:390,height:844}
  });
  await context.route('**/game/index.html?**',route=>route.fulfill({contentType:'text/html',body:unityStub}));
  await context.route('**/game/ranking-config.json',route=>route.fulfill({json:{apiBase:''}}));
  await context.route('**/api/**',route=>route.fulfill({status:503,json:{error:'Offline test'}}));
  const page=context.pages()[0];
  page.on('pageerror',error=>errors.push(error.message));
  return page;
 };
 let page=await launch();
 const courses=['easy','normal','hard','ex'];
 await page.goto(`${base}/game/stage-select.html`);
 await checkSelection(page);
 for(const [index,course] of courses.entries()){
  await page.goto(`${base}/game/stage${index+1}.html`);
  assert.equal(await page.locator('#clearStory').isHidden(),true);
  await page.waitForFunction(()=>!document.querySelector('#nextBtn').disabled);
  await page.getByRole('button',{name:'PLAY',exact:true}).click();
  await report(page,'run-started');
  await report(page,'result',course!=='ex');
  await readStory(page,course);

  await page.locator('#closeClearStory').click();
  await page.locator('#dismissStoryNotice').click();
  await page.locator('#stageBackLink').click();
  await page.waitForURL('**/game/stage-select.html');
  await checkSelection(page,courses.slice(0,index+1));
  await page.locator(`a[href="stage${index+1}.html"]`).click();
  await readStory(page,course);
  assert.equal(await page.locator('#mangaReader').isVisible(),true,'No new play was required');

  await page.reload();
  await readStory(page,course);
  await page.waitForFunction(()=>!document.querySelector('#nextBtn').disabled);
  for(const type of ['ready','error']){
   await report(page,type);
   assert.equal(await page.locator('#clearStoryReader').isVisible(),true);
  }
 }

 // Launch a new browser process with its on-disk profile, without injecting storage.
 await context.close();context=null;
 page=await launch();
 await page.goto(`${base}/game/stage-select.html`);
 await checkSelection(page,courses);
 for(const [index,course] of courses.entries()){
  await page.goto(`${base}/game/stage${index+1}.html`);
  await readStory(page,course);
  assert.equal(await page.locator('#mangaReader').isVisible(),true);
 }
 assert.deepEqual(errors,[]);
});

test('selection labels overlap the border without moving captions and refresh with progress',async t=>{
 const {base,close}=await startSiteServer();
 let browser;
 t.after(async()=>{await browser?.close();await close()});
 browser=await chromium.launch({channel:process.env.PHOTO_TEST_BROWSER||'chrome',headless:true});
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto(`${base}/game/stage-select.html`);
 await checkSelection(page);
 const checkLayout=async()=>{
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const positions=await page.locator('.stage-status:not([hidden])').evaluateAll(badges=>badges.map(badge=>{
    const b=badge.getBoundingClientRect();
    const captionElement=badge.parentElement.querySelector('.stage-caption');
    const caption=captionElement.getBoundingClientRect();
    const card=badge.closest('.stage-card').getBoundingClientRect();
    const style=getComputedStyle(badge);
    return {captionOverlap:b.bottom+2>caption.top,
     crossesTopBorder:b.top<card.top && b.bottom>card.top,
     insideWidth:b.left>=card.left && b.right<=card.right,
     topRight:card.right-b.right<25,
     matchingFont:style.fontFamily===getComputedStyle(captionElement).fontFamily,
     textOnly:style.backgroundColor==='rgba(0, 0, 0, 0)' && style.borderTopWidth==='0px'};
   }));
   for(const position of positions)assert.deepEqual(position,{
    captionOverlap:false,crossesTopBorder:true,insideWidth:true,topRight:true,matchingFont:true,textOnly:true
   });
   const captionOffsets=await page.locator('.stage-caption').evaluateAll(captions=>captions.map(caption=>{
    const box=caption.getBoundingClientRect();
    const image=caption.closest('.stage-image').getBoundingClientRect();
    return {top:box.top-image.top,left:box.left-image.left};
   }));
   for(const offset of captionOffsets)assert.deepEqual(offset,width<=380?{top:8,left:9}:{top:10,left:12});
  }
 };
 await checkLayout();

 const other=await context.newPage();
 await other.goto(`${base}/game/stage-select.html`);
 await other.evaluate(()=>{
  localStorage.setItem('gidanyan-story-unlocked-v1:ex','true');
  localStorage.setItem('gidanyan-story-unlocked-v1:normal','false');
 });
 await page.waitForFunction(()=>!document.querySelector('[data-difficulty="ex"] .stage-status').hidden);
 await checkSelection(page,['ex']);

 await other.evaluate(()=>localStorage.setItem('gidanyan-story-unlocked-v1:easy','true'));
 await page.waitForFunction(()=>!document.querySelector('[data-difficulty="normal"] .stage-status').hidden);
 await checkSelection(page,['easy','ex']);
 await checkLayout();
 await other.evaluate(()=>localStorage.setItem('gidanyan-story-unlocked-v1:normal','true'));
 await page.waitForFunction(()=>document.querySelector('[data-difficulty="normal"] .stage-status').textContent==='CLEAR');
 await checkSelection(page,['easy','normal','ex']);

 await page.goto(`${base}/index.html`);
 await page.evaluate(()=>{
  localStorage.setItem('gidanyan-story-unlocked-v1:easy','true');
  localStorage.setItem('gidanyan-story-unlocked-v1:normal','true');
  localStorage.setItem('gidanyan-story-unlocked-v1:hard','true');
 });
 await page.goBack();
 await checkSelection(page,['easy','normal','hard','ex']);
 await checkLayout();

 await other.evaluate(()=>localStorage.clear());
 await page.waitForFunction(()=>document.querySelector('[data-difficulty="ex"] .stage-status').hidden);
 await checkSelection(page);

 const blocked=await browser.newContext();
 await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked')}}));
 const blockedPage=await blocked.newPage();
 const errors=[];blockedPage.on('pageerror',error=>errors.push(error.message));
 await blockedPage.goto(`${base}/game/stage-select.html`);
 await checkSelection(blockedPage);
 assert.deepEqual(errors,[]);
});
