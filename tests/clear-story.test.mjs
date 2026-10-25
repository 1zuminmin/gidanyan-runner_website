import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const swipe=readFileSync(new URL('../game/manga-swipe.js',import.meta.url),'utf8');
const code=swipe+'\n'+readFileSync(new URL('../game/after-story.js',import.meta.url),'utf8');
function setup(course='easy', list=[]) {
 const nodes=new Map();
 function get(id){if(!nodes.has(id))nodes.set(id,{hidden:true,clientWidth:320,scrollLeft:0,scrollTo({left}){this.scrollLeft=left;this.scroll?.()},children:[],classList:{contains:()=>true},setAttribute(){},focus(){this.focused=true},scrollIntoView(){this.scrolled=true},replaceChildren(){this.children=[]},appendChild(n){this.children.push(n)},addEventListener(t,f){this[t]=f}});return nodes.get(id)}
 const frame=get('unityFrame'); frame.src=`https://test.example/game/index.html?difficulty=${course}&loadId=2`;frame.contentWindow={};
 const window={location:{href:'https://test.example/game/stage1.html'},addEventListener(t,f){this[t]=f}};
 const document={body:{dataset:{difficulty:course,difficultyLabel:course}},getElementById:get,createElement:()=>({children:[],appendChild(n){this.children.push(n)},addEventListener(t,f){this[t]=f}})};
 runInNewContext(code,{window,document,URL,fetch:async()=>({ok:true,json:async()=>({[course]:list})})});
 const send=(data={},override={})=>window.message({source:frame.contentWindow,origin:'https://test.example',data:{source:'gidanyan-unity',difficulty:course,loadId:'2',type:'result',cleared:true,...data},...override});
 return {get,send};
}
for(const course of ['easy','normal','hard','ex'])test(`${course}: successful result unlocks matching story; retry hides it`,async()=>{
 const {get,send}=setup(course,['01.png','02.webp']);
 send({cleared:false});assert.equal(get('clearStory').hidden,course !== 'ex');
 send();assert.equal(get('clearStory').hidden,false);assert.equal(get('storyNotice').hidden,false);
 await get('openStoryNotice').click();assert.equal(get('storyNotice').hidden,true);
 assert.deepEqual(Array.from(get('clearStoryPages').children,x=>x.children[0].src),[`stories/${course}/01.png`,`stories/${course}/02.webp`]);
 send({type:'run-started'});assert.equal(get('storyNotice').hidden,true);assert.equal(get('clearStory').hidden,true);assert.equal(get('clearStoryReader').hidden,true);
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
test('Extra unlocks on failed result, rejects malformed results, and hides on restart', async () => {
 const {get,send}=setup('ex',['01.png']);
 for(const cleared of [undefined,null,0,'false']){send({cleared});assert.equal(get('clearStory').hidden,true)}
 send({cleared:false});assert.equal(get('clearStory').hidden,false);
 await get('openClearStory').click();assert.equal(get('clearStoryPages').children[0].children[0].src,'stories/ex/01.png');
 send({type:'run-started'});assert.equal(get('storyNotice').hidden,true);assert.equal(get('clearStory').hidden,true);
});

test('notice can be dismissed without losing the story; returning from reader restores it',async()=>{
 const {get,send}=setup('hard',['01.png']);send();
 get('dismissStoryNotice').click();assert.equal(get('storyNotice').hidden,true);assert.equal(get('clearStory').hidden,false);
 await get('openClearStory').click();get('closeClearStory').click();assert.equal(get('storyNotice').hidden,false);
 send({type:'ready'});assert.equal(get('storyNotice').hidden,true);
});

for (const course of ['easy','normal','hard','ex']) test(`${course}: returning from manga shows header and Back link`,async()=>{
 const {get,send}=setup(course,['01.png']);send();await get('openClearStory').click();
 get('closeClearStory').click();
 assert.equal(get('clearStoryReader').hidden,true);
 assert.equal(get('stageHeader').scrolled,true);
 assert.equal(get('stageBackLink').focused,true);
 assert.equal(get('unityContainer').scrolled,undefined);
});
