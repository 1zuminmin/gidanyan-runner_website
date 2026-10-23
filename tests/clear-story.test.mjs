import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const code=readFileSync(new URL('../game/after-story.js',import.meta.url),'utf8');
function setup(course='easy', list=[]) {
 const nodes=new Map();
 function get(id){if(!nodes.has(id))nodes.set(id,{hidden:true,children:[],classList:{contains:()=>true},setAttribute(){},focus(){},scrollIntoView(){},replaceChildren(){this.children=[]},appendChild(n){this.children.push(n)},addEventListener(t,f){this[t]=f}});return nodes.get(id)}
 const frame=get('unityFrame'); frame.src=`https://test.example/game/index.html?difficulty=${course}&loadId=2`;frame.contentWindow={};
 const window={location:{href:'https://test.example/game/stage1.html'},addEventListener(t,f){this[t]=f}};
 const document={body:{dataset:{difficulty:course,difficultyLabel:course}},getElementById:get,createElement:()=>({addEventListener(t,f){this[t]=f}})};
 runInNewContext(code,{window,document,URL,fetch:async()=>({ok:true,json:async()=>({[course]:list})})});
 const send=(data={},override={})=>window.message({source:frame.contentWindow,origin:'https://test.example',data:{source:'gidanyan-unity',difficulty:course,loadId:'2',type:'result',cleared:true,...data},...override});
 return {get,send};
}
for(const course of ['easy','normal','hard','ex'])test(`${course}: successful result unlocks matching story; retry hides it`,async()=>{
 const {get,send}=setup(course,['01.png','02.webp']);
 send({cleared:false});assert.equal(get('clearStory').hidden,true);
 send();assert.equal(get('clearStory').hidden,false);
 await get('openClearStory').click();
 assert.deepEqual(Array.from(get('clearStoryPages').children,x=>x.src),[`stories/${course}/01.png`,`stories/${course}/02.webp`]);
 send({type:'run-started'});assert.equal(get('clearStory').hidden,true);assert.equal(get('clearStoryReader').hidden,true);
});
test('wrong origin, iframe, course, load id or non-boolean clear never unlock',()=>{
 const {get,send}=setup();
 for(const data of [{difficulty:'hard'},{loadId:'1'},{cleared:'true'},{source:'unknown'}]){send(data);assert.equal(get('clearStory').hidden,true)}
 for(const event of [{origin:'https://evil.example'},{source:{}}]){send({},event);assert.equal(get('clearStory').hidden,true)}
});
test('empty story is friendly; unsafe image paths are rejected',async()=>{
 for(const list of [[],['../../private.png']]){const {get,send}=setup('easy',list);send();await get('openClearStory').click();assert.equal(get('clearStoryPages').children.length,0);assert.match(get('clearStoryStatus').textContent,list.length?/読み込めません/:/準備中/)}
});

test('page navigation shows exactly one page, bounds buttons, and resets when reopened', async () => {
 const {get,send}=setup('easy',['01.png','02.png','03.png']);send();await get('openClearStory').click();
 const pages=get('clearStoryPages').children;
 const check=(n)=>{assert.deepEqual(pages.map(p=>p.hidden),[0,1,2].map(i=>i!==n));assert.equal(get('clearStoryPageNumber').textContent,`${n+1} / 3`)};
 check(0);assert.equal(get('clearStoryPrev').disabled,true);get('clearStoryPrev').click();check(0);
 get('clearStoryNext').click();check(1);get('clearStoryNext').click();check(2);
 assert.equal(get('clearStoryNext').disabled,true);get('clearStoryNext').click();check(2);
 get('clearStoryPrev').click();check(1);
 pages[1].error();assert.match(get('clearStoryStatus').textContent,/読み込めません/);
 pages[0].load();assert.match(get('clearStoryStatus').textContent,/読み込めません/);
 get('clearStoryPrev').click();check(0);assert.equal(get('clearStoryStatus').textContent,'');
 get('closeClearStory').click();await get('openClearStory').click();assert.equal(get('clearStoryPageNumber').textContent,'1 / 3');
});
test('single page disables both navigation buttons; empty story hides controls',async()=>{
 for(const list of [[],['01.png']]){const {get,send}=setup('easy',list);send();await get('openClearStory').click();assert.equal(get('clearStoryPrev').disabled,true);assert.equal(get('clearStoryNext').disabled,true);assert.equal(get('clearStoryNavigation').hidden,list.length===0)}
});
