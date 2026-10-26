import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../server/cloudflare/worker.mjs';
// SQLite-backed D1 API adapter: validates SQL, transactions and HTTP contract locally.
function setup(t) {
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../server/cloudflare/schema.sql',import.meta.url),'utf8'));
 t.after(()=>sql.close());
 function prepare(query) {
  let args=[];
  return {bind(...values){args=values;return this;},async first(){return sql.prepare(query).get(...args)||null;},execute(){return {results:sql.prepare(query).all(...args)};}};
 }
 const DB={prepare,withSession(){return this;},async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 async function call(path,body,token='a'.repeat(64),origin='https://game.gidaisai.jp') {
  const headers={Origin:origin};if(token)headers.Authorization=`Bearer ${token}`;
  if(body!==undefined)headers['Content-Type']='application/json';
  const response=await worker.fetch(new Request('https://ranking.example'+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}),{DB});
  return {status:response.status,headers:response.headers,data:await response.json()};
 }
 async function run(token='a'.repeat(64)) {const r=await call('/api/runs',{},token);assert.equal(r.status,200);sql.prepare('UPDATE runs SET started=started-60000 WHERE id=?').run(r.data.runId);return r.data.runId;}
 const score=(runId,candy=10,distance=100)=>({runId,ruleset:'ex-v1',nickname:'ぎだにゃん',candy,distance,score:candy*3750+distance,elapsed:60});
 return {sql,DB,call,run,score};
}
test('D1 registration, duplicate retries, lower/higher best and tied ranks',async t=>{
 const {call,run,score}=setup(t);
 assert.equal((await call('/')).data.ok,true);
 const id=await run();const payload=score(id);
 let r=await call('/api/scores',payload);assert.equal(r.status,200);assert.equal(r.data.personal.score,37600);assert.equal(r.data.total,1);
 assert.deepEqual((await call('/api/scores',payload)).data,r.data);
 assert.equal((await call('/api/scores',{...payload,nickname:'別名'})).status,409);
 r=await call('/api/scores',score(await run(),1));assert.equal(r.data.personal.score,37600);
 r=await call('/api/scores',score(await run(),20));assert.equal(r.data.personal.score,75100);assert.equal(r.data.total,1);
 const b='b'.repeat(64),c='c'.repeat(64);
 await call('/api/scores',score(await run(b),20),b);
 r=await call('/api/scores',score(await run(c),2),c);
 assert.deepEqual(r.data.top.map(x=>x.rank),[1,1,3]);assert.equal(r.data.personal.rank,3);assert.equal(r.data.total,3);
 assert.ok(!JSON.stringify(r.data).includes('player'));
});
test('D1 rejects invalid origin/token, implausible score, wrong player and expired runs',async t=>{
 const {call,run,score,sql}=setup(t); const id=await run();
 assert.equal((await call('/api/runs',{},null)).status,401);
 assert.equal((await call('/api/runs',{},'bad')).status,401);
 assert.equal((await call('/api/runs',{},undefined,'https://evil.example')).status,403);
 assert.equal((await call('/api/scores',score(id),'b'.repeat(64))).status,400);
 assert.equal((await call('/api/scores',{...score(id),score:9})).status,400);
 assert.equal((await call('/api/scores',{...score(id),nickname:'<script>'})).status,400);
 assert.equal((await call('/api/scores',{...score(id),elapsed:600})).status,400);
 sql.prepare('UPDATE runs SET started=0').run();
 assert.equal((await call('/api/scores',score(id))).status,400);
});
test('Atomic start throttle and replacing an old run',async t=>{
 const {call,run,score,sql}=setup(t);
 const first=await call('/api/runs',{});assert.equal(first.status,200);
 assert.equal((await call('/api/runs',{})).status,429);
 sql.prepare('UPDATE runs SET started=started-60000').run();
 await run();assert.equal((await call('/api/scores',score(first.data.runId))).status,400);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM runs').get().n,1);
});
test('CORS preflight, bounded input, missing schema and method errors',async t=>{
 const {DB,call}=setup(t);
 let r=await worker.fetch(new Request('https://ranking.example/api/scores',{method:'OPTIONS',headers:{Origin:'https://game.gidaisai.jp'}}),{DB});
 assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://game.gidaisai.jp');assert.equal(r.headers.get('Access-Control-Max-Age'),'86400');
 assert.equal((await call('/api/runs',{padding:'あ'.repeat(2000)})).status,413);
 assert.equal((await call('/api/scores')).status,405);
 assert.equal((await call('/api/unknown')).status,404);
 r=await worker.fetch(new Request('https://ranking.example/'),{});assert.equal(r.status,503);
});
test('Bucket ranks equal full COUNT for 20,000 records and after updates/deletes',async t=>{
 const {sql,call}=setup(t);sql.exec('BEGIN');
 const add=sql.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?)');
 for(let i=0;i<20000;i++)add.run(`p${i}`,'test',Math.floor(i/3)*12345,0,0,0,i);
 sql.exec('COMMIT');
 // Use API to create a real authenticated personal row, then change its score to exercise buckets.
 const {data}=await call('/api/runs',{});const player=sql.prepare('SELECT player FROM runs WHERE id=?').get(data.runId).player;
 add.run(player,'self',10000,0,0,0,20001);
 for(const value of [0,9999,10000,12345,50000000,2147483647]) {
  sql.prepare('UPDATE scores SET score=? WHERE player=?').run(value,player);
  const result=await call('/api/leaderboard');
  assert.equal(result.status,200);
  assert.equal(result.data.personal.rank,1+sql.prepare('SELECT COUNT(*) AS n FROM scores WHERE score>?').get(value).n);
  assert.equal(result.data.total,20001);
 }
 sql.prepare('DELETE FROM scores WHERE player=?').run(player);
 assert.equal((await call('/api/leaderboard')).data.total,20000);
});
