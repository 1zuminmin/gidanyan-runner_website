import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';
import {startSiteServer} from './helpers/site-server.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
test('all opening comics scroll horizontally and preserve PLAY readiness',async t=>{
 const {base,close}=await startSiteServer();t.after(close);
 const browser=await chromium.launch({channel:process.env.PHOTO_TEST_BROWSER||'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route('**/game/index.html?**',route=>route.fulfill({contentType:'text/html',body:`<script>const p=new URLSearchParams(location.search);parent.postMessage({source:'gidanyan-unity',type:'ready',difficulty:p.get('difficulty'),loadId:p.get('loadId')},location.origin);</script>`}));
 for(const n of [1,2,3,4]){
  await page.goto(`${base}/game/stage${n}.html`);
  await page.waitForFunction(()=>document.querySelectorAll('#mangaTrack .manga-slide').length===4);
  assert.equal(await page.getByRole('button',{name:'NEXT',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'BACK',exact:true}).count(),0);
  await page.locator('#mangaTrack').focus();
  for(let i=0;i<3;i++){await page.keyboard.press('ArrowRight');await page.waitForFunction(n=>document.querySelector('#pageNumber').textContent===`${n+2} / 4`,i);}
  await page.waitForFunction(()=>document.querySelector('#pageNumber').textContent==='4 / 4');
  await page.getByRole('button',{name:'PLAY',exact:true}).waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'PLAY',exact:true}).click();
  assert.equal(await page.locator('#mangaReader').isHidden(),true);
 }
});
