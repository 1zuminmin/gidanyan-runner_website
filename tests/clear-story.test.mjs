import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const swipe=readFileSync(new URL('../game/manga-swipe.js',import.meta.url),'utf8');
const code=swipe+'\n'+readFileSync(new URL('../game/after-story.js',import.meta.url),'utf8');
function memoryStorage() {
 const values=new Map();
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
}
function setup(course='easy', list=[], {storage=memoryStorage(), visible=true, fetchStory}={}) {
 const nodes=new Map();
 function get(id){if(!nodes.has(id))nodes.set(id,{hidden:true,clientWidth:320,scrollLeft:0,scrollTo({left}){this.scrollLeft=left;this.scroll?.()},children:[],classList:{contains:()=>true},setAttribute(){},focus(){this.focused=true},scrollIntoView(){this.scrolled=true},replaceChildren(){this.children=[]},appendChild(n){this.children.push(n)},addEventListener(t,f){this[t]=f}});return nodes.get(id)}
 const frame=get('unityFrame'); frame.src=`https://test.example/game/index.html?difficulty=${course}&loadId=2`;frame.contentWindow={};
 get('unityContainer').classList.contains=()=>visible;
 const window={localStorage:storage,location:{href:'https://test.example/game/stage1.html'},addEventListener(t,f){this[t]=f}};
 const document={body:{dataset:{difficulty:course,difficultyLabel:course}},getElementById:get,createElement:()=>({children:[],appendChild(n){this.children.push(n)},addEventListener(t,f){this[t]=f}})};
 runInNewContext(code,{window,document,URL,fetch:fetchStory??(async()=>({ok:true,json:async()=>({[course]:list})}))});
 const send=(data={},override={})=>window.message({source:frame.contentWindow,origin:'https://test.example',data:{source:'gidanyan-unity',difficulty:course,loadId:'2',type:'result',cleared:true,...data},...override});
 return {get,send,storage};
}
for(const course of ['easy','normal','hard','ex'])test(`${course}: successful result unlocks matching story; retry keeps access`,async()=>{
 const {get,send}=setup(course,['01.png','02.webp']);
 send({cleared:false});assert.equal(get('clearStory').hidden,course !== 'ex');
 send();assert.equal(get('clearStory').hidden,false);assert.equal(get('storyNotice').hidden,false);
 await get('openStoryNotice').click();assert.equal(get('storyNotice').hidden,true);
 assert.deepEqual(Array.from(get('clearStoryPages').children,x=>x.children[0].src),[`stories/${course}/01.png`,`stories/${course}/02.webp`]);
 send({type:'run-started'});assert.equal(get('storyNotice').hidden,true);assert.equal(get('clearStory').hidden,false);assert.equal(get('clearStoryReader').hidden,true);
 await get('openClearStory').click();assert.equal(get('clearStoryReader').hidden,false);
});
test('wrong origin, iframe, course, load id or non-boolean clear never unlock',()=>{
 const {get,send}=setup();
 for(const data of [{difficulty:'hard'},{loadId:'1'},{cleared:'true'},{source:'unknown'}]){send(data);assert.equal(get('clearStory').hidden,true)}
 for(const event of [{origin:'https://evil.example'},{source:{}}]){send({},event);assert.equal(get('clearStory').hidden,true)}
});
test('empty story is friendly; unsafe image paths are rejected',async()=>{
 for(const list of [[],['../../private.png']]){const {get,send}=setup('easy',list);send();await get('openClearStory').click();assert.equal(get('clearStoryPages').children.length,0);assert.match(get('clearStoryStatus').textContent,list.length?/読み込めません/:/準備中/)}
});

test('swipe updates page count and status; reopening starts on page one', async () => {
 const {get,send}=setup('easy',['01.png','02.png','03.png']);send();await get('openClearStory').click();
 const track=get('clearStoryPages');assert.equal(track.children.length,3);
 track.scrollTo({left:320});assert.equal(get('clearStoryPageNumber').textContent,'2 / 3');
 track.children[1].children[0].error();assert.match(get('clearStoryStatus').textContent,/読み込めません/);
 track.children[0].children[0].load();assert.match(get('clearStoryStatus').textContent,/読み込めません/);
 track.scrollTo({left:0});assert.equal(get('clearStoryStatus').textContent,'');
 get('closeClearStory').click();await get('openClearStory').click();assert.equal(get('clearStoryPageNumber').textContent,'1 / 3');assert.equal(track.scrollLeft,0);
});
test('Extra unlocks on failed result, rejects malformed results, and keeps access on restart', async () => {
 const {get,send}=setup('ex',['01.png']);
 for(const cleared of [undefined,null,0,'false']){send({cleared});assert.equal(get('clearStory').hidden,true)}
 send({cleared:false});assert.equal(get('clearStory').hidden,false);
 await get('openClearStory').click();assert.equal(get('clearStoryPages').children[0].children[0].src,'stories/ex/01.png');
 send({type:'run-started'});assert.equal(get('storyNotice').hidden,true);assert.equal(get('clearStory').hidden,false);
});

test('notice can be dismissed without losing the story; returning from reader restores it',async()=>{
 const {get,send}=setup('hard',['01.png']);send();
 get('dismissStoryNotice').click();assert.equal(get('storyNotice').hidden,true);assert.equal(get('clearStory').hidden,false);
 await get('openClearStory').click();get('closeClearStory').click();assert.equal(get('storyNotice').hidden,false);
 send({type:'ready'});assert.equal(get('storyNotice').hidden,false);
});

for (const course of ['easy','normal','hard','ex']) test(`${course}: returning from manga shows header and Back link`,async()=>{
 const {get,send}=setup(course,['01.png']);send();await get('openClearStory').click();
 get('closeClearStory').click();
 assert.equal(get('clearStoryReader').hidden,true);
 assert.equal(get('stageHeader').scrolled,true);
 assert.equal(get('stageBackLink').focused,true);
 assert.equal(get('unityContainer').scrolled,undefined);
});

test('EX registration notice scrolls to the same-page form without leaving the result',()=>{
 const {get,send}=setup('ex');send({cleared:false});
 get('recordRegistration').hidden=false;
 get('openRecordRegistration').click();
 assert.equal(get('storyNotice').hidden,true);
 assert.equal(get('recordRegistration').scrolled,true);
 assert.equal(get('recordRegistration').focused,true);
 assert.equal(get('clearStory').hidden,false);
});

test('story button hides during reading, returns on image error and after closing',async()=>{
 const {get,send}=setup('ex',['01.png']);send();assert.equal(get('openClearStory').hidden,false);
 await get('openClearStory').click();assert.equal(get('openClearStory').hidden,true);
 const image=get('clearStoryPages').children[0].children[0];image.error();assert.equal(get('openClearStory').hidden,false);
 image.load();assert.equal(get('openClearStory').hidden,true);
 get('closeClearStory').click();assert.equal(get('openClearStory').hidden,false);
});

for(const course of ['easy','normal','hard','ex'])test(`${course}: another visit allows rereading without showing a result notice`,async()=>{
 const storage=memoryStorage();
 setup(course,[],{storage}).send({cleared:course!=='ex'});
 const {get,send}=setup(course,['01.png'],{storage,visible:false});
 assert.equal(get('clearStory').hidden,false);
 assert.equal(get('storyNotice').hidden,true);
 await get('openClearStory').click();
 assert.equal(get('clearStoryReader').hidden,false);
 assert.equal(get('clearStoryPages').children[0].children[0].src,`stories/${course}/01.png`);
 for(const type of ['ready','error']){
  send({type});
  assert.equal(get('clearStoryReader').hidden,false);
  assert.equal(get('clearStoryPages').children.length,1);
 }
 get('closeClearStory').click();
 assert.equal(get('storyNotice').hidden,true);
});

test('course progress remains independent across visits and concurrent pages',()=>{
 const storage=memoryStorage();
 const easy=setup('easy',[],{storage}),hard=setup('hard',[],{storage});
 easy.send();hard.send();
 assert.equal(setup('easy',[],{storage}).get('clearStory').hidden,false);
 assert.equal(setup('hard',[],{storage}).get('clearStory').hidden,false);
 assert.equal(setup('normal',[],{storage}).get('clearStory').hidden,true);
 assert.equal(setup('ex',[],{storage}).get('clearStory').hidden,true);
});

test('failed attempts and retry/loading events never erase a previous clear',()=>{
 const {send,storage}=setup();send();
 for(const type of ['run-started','ready','error','result']){
  send({type,cleared:false});
  assert.equal(setup('easy',[],{storage}).get('clearStory').hidden,false);
 }
});

test('untrusted, malformed, failed or pre-play results never persist a clear',()=>{
 const {send,storage}=setup();
 for(const data of [{difficulty:'hard'},{loadId:'1'},{cleared:'true'},{cleared:false},{source:'unknown'}])send(data);
 for(const event of [{origin:'https://evil.example'},{source:{}}])send({},event);
 setup('easy',[],{storage,visible:false}).send();
 for(const course of ['easy','hard'])assert.equal(setup(course,[],{storage}).get('clearStory').hidden,true);
});

test('unexpected stored values do not unlock a story',()=>{
 for(const value of ['false','1','null','undefined','{}','{broken']){
  const storage=memoryStorage();storage.setItem('gidanyan-story-unlocked-v1:easy',value);
  assert.equal(setup('easy',[],{storage}).get('clearStory').hidden,true);
 }
});

test('blocked reads or writes still allow reading and replaying during this visit',async()=>{
 const fail=()=>{throw new Error('Storage unavailable')};
 for(const storage of [{getItem:fail,setItem:fail},{getItem:()=>null,setItem:fail}]){
  const {get,send}=setup('easy',['01.png'],{storage});
  assert.equal(get('clearStory').hidden,true);
  send();await get('openClearStory').click();
  assert.equal(get('clearStoryReader').hidden,false);
  send({type:'run-started'});
  await get('openClearStory').click();
  assert.equal(get('clearStoryPages').children.length,1);
 }
});

test('background ready/error notifications do not cancel a restored story fetch',async()=>{
 const storage=memoryStorage();setup('normal',[],{storage}).send();
 let finish;
 const {get,send}=setup('normal',[],{storage,visible:false,fetchStory:()=>new Promise(resolve=>{finish=resolve})});
 const reading=get('openClearStory').click();
 send({type:'ready'});send({type:'error'});
 finish({ok:true,json:async()=>({normal:['01.png']})});await reading;
 assert.equal(get('clearStoryReader').hidden,false);
 assert.equal(get('clearStoryPages').children.length,1);
});

for(const course of ['easy','normal','hard','ex']) test(`${course}: retry and rereading do not restore the previous result notice`,async()=>{
 const {get,send}=setup(course,['01.png']);
 send();assert.equal(get('storyNotice').hidden,false);
 send({type:'run-started'});
 await get('openClearStory').click();get('closeClearStory').click();
 assert.equal(get('storyNotice').hidden,true);
 send({cleared:false});
 assert.equal(get('storyNotice').hidden,course!=='ex');
 send();assert.equal(get('storyNotice').hidden,false);
});
