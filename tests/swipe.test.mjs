import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const code=readFileSync(new URL('../game/manga-swipe.js',import.meta.url),'utf8');
test('keyboard clamps pages; mouse drags; touch stays native',()=>{
 const window={};runInNewContext(code,{window});
 const t={children:[1,2,3],clientWidth:300,scrollLeft:0,classList:{add(){},remove(){}},addEventListener(k,f){this[k]=f},setPointerCapture(){},scrollTo({left}){this.scrollLeft=left;this.scroll()}};
 let page=-1;window.createMangaSwipe(t,i=>page=i);
 const key=k=>t.keydown({key:k,preventDefault(){}});
 key('ArrowRight');assert.equal(page,1);key('End');assert.equal(page,2);key('ArrowRight');assert.equal(page,2);key('Home');assert.equal(page,0);
 t.pointerdown({pointerType:'touch',pointerId:1,button:0,clientX:300});t.pointermove({pointerId:1,clientX:0});assert.equal(t.scrollLeft,0);
 t.pointerdown({pointerType:'mouse',pointerId:2,button:0,clientX:300});t.pointermove({pointerId:2,clientX:20});t.pointerup({pointerId:2});assert.equal(t.scrollLeft,300);
});
