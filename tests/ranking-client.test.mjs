import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import {webcrypto} from 'node:crypto';
const code=readFileSync(new URL('../game/ranking-client.js',import.meta.url),'utf8').replaceAll('export ','')+'\nthis.mountRanking=mountRanking;';
function setup({offline=false}={}){
 const els=new Map();function el(key){if(!els.has(key))els.set(key,{hidden:true,children:[],textContent:'',value:'',disabled:false,addEventListener(t,f){this[t]=f;},querySelector:el,append(...items){this.children.push(...items)},replaceChildren(){this.children=[]}});return els.get(key);}
 const frame=el('unityFrame');frame.src='https://test/game/index.html?difficulty=ex&loadId=1';frame.contentWindow={};
 const window={addEventListener(t,f){this[t]=f}};const saved=new Map();const calls=[];
 const context={window,document:{querySelector:()=>null,getElementById:()=>frame,createElement:()=>el(Math.random())},location:{hostname:'localhost',origin:'https://test',href:'https://test/game/stage4.html'},crypto:webcrypto,URL,AbortSignal,localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},fetch:async(url,options)=>{
 calls.push([url,options]);if(url==='ranking-config.json')return{ok:true,json:async()=>({apiBase:''})};if(offline)throw Error('offline');if(url.endsWith('/api/runs'))return{ok:true,json:async()=>({runId:'r'})};return {ok:true,json:async()=>({top:[],total:0,personal:null})};}};
 runInNewContext(code,context);const send=(type,extra={},override={})=>window.message({origin:'https://test',source:frame.contentWindow,data:{type,source:'gidanyan-unity',difficulty:'ex',loadId:'1',...extra},...override});return{context,el,calls,send,saved};
}
const result={ruleset:'ex-v1',score:3772,distance:22,candy:1,elapsed:1};
test('browser: receive EX run, show form, explicit submit and no duplicate',async()=>{
 const e=setup();await e.context.mountRanking({querySelector:e.el});
 await e.send('run-started');await e.send('result-score',{result});
 assert.equal(e.el('form').hidden,false);assert.equal(e.el('button').disabled,false);assert.match(e.el('[data-local-best]').textContent,/3,772/);
 e.el('input').value='ねこ';await e.el('form').submit({preventDefault(){}});await e.el('form').submit({preventDefault(){}});
 assert.equal(e.calls.filter(([u])=>u.endsWith('/api/scores')).length,1);await e.send('run-started');assert.equal(e.el('form').hidden,true);
});
test('browser: reject forged/wrong-course/old-load results; offline best survives',async()=>{
 const e=setup({offline:true});await e.context.mountRanking({querySelector:e.el});await e.send('run-started');
 for(const [extra,override] of [[{difficulty:'easy'},{}],[{loadId:'2'},{}],[{},{origin:'https://evil'}],[{},{source:{}}]]){await e.send('result-score',{result,...extra},override);assert.equal(e.el('form').hidden,true);}
 await e.send('result-score',{result:{...result,score:9999}});assert.equal(e.el('form').hidden,true);
 await e.send('result-score',{result});assert.equal(e.el('button').disabled,true);assert.match(e.el('[data-local-best]').textContent,/3,772/);
});
test('Unity bridge posts scores separately from story notifications',()=>{
 const bridge=readFileSync(new URL('../game/launch.js',import.meta.url),'utf8');assert.match(bridge,/window.gidanyanRunResult/);assert.match(bridge,/type: "result-score"/);assert.match(bridge,/ruleset: "ex-v1"/);
});

test('result panel stays hidden until a valid result and hides on retry',async()=>{
 const e=setup();const root={dataset:{rankingMode:'result'},hidden:false,querySelector:s=>s==='[data-ranking-list]'||s==='[data-personal]'||s==='[data-refresh]'?null:e.el(s)};
 await e.context.mountRanking(root);assert.equal(root.hidden,true);
 assert.equal(e.calls.some(([u])=>u.endsWith('/api/leaderboard')),false);
 await e.send('run-started');assert.equal(root.hidden,true);
 await e.send('result-score',{result:{...result,score:99}});assert.equal(root.hidden,true);
 await e.send('result-score',{result});assert.equal(root.hidden,false);
 assert.match(e.el('[data-run-score]').textContent,/3,772/);
 e.el('input').value='ねこ';await e.el('form').submit({preventDefault(){}});
 assert.match(e.el('[data-ranking-status]').textContent,/受け付けました/);
 await e.send('run-started');assert.equal(root.hidden,true);
});
