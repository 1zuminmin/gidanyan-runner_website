import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createStore,identity} from '../server/store.mjs';import {createApp} from '../server/server.mjs';
const player=identity('a'.repeat(64)), other=identity('b'.repeat(64));
const payload=(run,score=3772)=>({ruleset:'ex-v1',runId:run.runId,nickname:'にゃん',score,distance:score-3750,candy:1,elapsed:1});
test('persistent best per browser, ties, personal rank, no private ids in response',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ranking-'));const path=join(dir,'scores.sqlite');let time=100000;let db=createStore(path,()=>time);
 try{const run=db.begin(player);time+=2000;db.submit(player,payload(run));assert.equal(db.leaderboard(player).personal.score,3772);
 assert.equal(db.submit(player,payload(run)).total,1);assert.throws(()=>db.submit(player,{...payload(run),nickname:'changed'}));
 const lower=db.begin(player);time+=2000;db.submit(player,payload(lower,3760));assert.equal(db.leaderboard(player).personal.score,3772);
 const second=db.begin(other);time+=2000;db.submit(other,payload(second));assert.deepEqual(db.leaderboard(player).top.map(x=>x.rank),[1,1]);
 const higher=db.begin(other);time+=2000;db.submit(other,payload(higher,3790));assert.equal(db.leaderboard(player).personal.rank,2);
 assert.ok(!JSON.stringify(db.leaderboard(player)).includes(player));db.close();db=createStore(path,()=>time);assert.equal(db.leaderboard(player).total,2);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('validation rejects bad identities, mismatched scores, injection, wrong owners and expired runs',()=>{
 let time=100000;const db=createStore(':memory:',()=>time);try{
 assert.throws(()=>identity('x'));const run=db.begin(player);time+=2000;
 for(const patch of [{score:999999},{nickname:'<script>'},{nickname:'a'.repeat(13)},{elapsed:1e9},{distance:-1},{ruleset:'old'},{candy:NaN}])assert.throws(()=>db.submit(player,{...payload(run),...patch}));
 assert.throws(()=>db.submit(other,payload(run)));time+=49*3600000;assert.throws(()=>db.submit(player,payload(run)));assert.equal(db.leaderboard().total,0);
 }finally{db.close();}
});
test('HTTP end-to-end: origin, registration, private files, duplicate submission and readback',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ranking-http-'));const {server}=await createApp({dbPath:join(dir,'test.sqlite'),origins:['http://test.example']});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const headers={Origin:'http://test.example',Authorization:'Bearer '+'a'.repeat(64),'Content-Type':'application/json'};
 try{
 assert.equal((await fetch(base+'/api/leaderboard',{headers:{Origin:'http://evil.example'}})).status,403);
 assert.equal((await fetch(base+'/server/data/ranking.sqlite')).status,404);
 assert.equal((await fetch(base+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
 const run=await (await fetch(base+'/api/runs',{method:'POST',headers,body:'{}'})).json();
 const response=await fetch(base+'/api/scores',{method:'POST',headers,body:JSON.stringify(payload(run))});assert.equal(response.status,200);
 assert.equal((await response.json()).personal.score,3772);
 const repeat=await (await fetch(base+'/api/scores',{method:'POST',headers,body:JSON.stringify(payload(run))})).json();assert.equal(repeat.total,1);
 const board=await (await fetch(base+'/api/leaderboard',{headers})).json();assert.equal(board.personal.rank,1);assert.equal(board.top[0].nickname,'にゃん');
 assert.equal((await fetch(base+'/api/scores',{method:'POST',headers,body:'{"bad":'})).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
