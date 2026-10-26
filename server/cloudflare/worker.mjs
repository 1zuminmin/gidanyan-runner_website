// Paste this entire file into Cloudflare's worker.js (no npm dependencies).
// D1 binding: DB. First run schema.sql in the D1 console.
const RULESET = 'ex-v1';
const MAX_AGE = 48 * 3600000;
class RequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const publicRow = r => r && ({nickname:r.nickname, score:r.score, distance:r.distance, candy:r.candy, elapsed:r.elapsed});
async function identity(header) {
  if (!header) return null;
  if (!/^Bearer [a-f0-9]{64}$/.test(header)) throw new RequestError('記録用の識別情報を確認できません。', 401);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(header.slice(7)));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
}
async function bodyJSON(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new RequestError('JSONが必要です。',415);
  const reader = request.body?.getReader(); let size=0; const chunks=[];
  if (reader) {
    try {
      while (true) {
        const {done,value}=await reader.read(); if(done) break;
        size+=value.length;
        if(size>4096) { await reader.cancel(); throw new RequestError('データが大きすぎます。',413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const bytes=new Uint8Array(size); let offset=0;
  for(const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)||'{}'); }
  catch { throw new RequestError('JSONを確認してください。'); }
}
async function leaderboard(db, player) {
  // Top ten ranks are computed directly; tied scores use competition ranking.
  const results=await db.batch([
    db.prepare('SELECT nickname,score,distance,candy,elapsed FROM scores ORDER BY score DESC,updated ASC,player ASC LIMIT 10'),
    db.prepare('SELECT * FROM scores WHERE player=?').bind(player||''),
    db.prepare('SELECT n FROM ranking_stats WHERE id=1')
  ]);
  let previous=null, rank=0;
  const top=results[0].results.map((r,i)=>{ if(r.score!==previous) rank=i+1; previous=r.score; return {...publicRow(r),rank}; });
  const own=results[1].results[0]; let personal=null;
  if(own) {
    const bucket=Math.floor(own.score/10000);
    // Sum bucket counts instead of scanning every higher-scoring player.
    const counts=await db.prepare(`SELECT
      (SELECT COALESCE(SUM(n),0) FROM score_buckets WHERE bucket>?) +
      (SELECT COUNT(*) FROM scores WHERE score>? AND score<?) AS n`).bind(bucket,own.score,(bucket+1)*10000).first();
    personal={...publicRow(own),rank:1+counts.n};
  }
  return {ruleset:RULESET,top,total:results[2].results[0]?.n||0,personal};
}
async function begin(db, player) {
  const id=crypto.randomUUID(), now=Date.now();
  // One current run per browser; bounded storage and atomic per-player throttle.
  const run=await db.prepare(`INSERT INTO runs(player,id,started,submission) VALUES(?,?,?,NULL)
    ON CONFLICT(player) DO UPDATE SET id=excluded.id,started=excluded.started,submission=NULL
    WHERE runs.started<=? RETURNING id`).bind(player,id,now,now-1000).first();
  if(!run) throw new RequestError('少し待ってからお試しください。',429);
  return {runId:id,ruleset:RULESET};
}
async function submit(db,player,body) {
  if(body?.ruleset!==RULESET) throw new RequestError('このゲームのバージョンはランキングに対応していません。');
  const nickname=typeof body.nickname==='string'?body.nickname.normalize('NFKC').trim():'';
  if(!nickname || [...nickname].length>12 || /[\p{Cc}\p{Cf}<>]/u.test(nickname)) throw new RequestError('ニックネームは12文字以内で入力してください。');
  const {score,distance,candy,elapsed,runId}=body;
  if(![score,distance,candy].every(Number.isSafeInteger) || !Number.isFinite(elapsed) || elapsed<0 || elapsed>86400 || distance<0 || candy<0 || score<0 || score>2147483647 || distance>elapsed*45+100 || candy>elapsed*12+20 || score!==distance+candy*3750) throw new RequestError('スコアの内容を確認できません。');
  if(typeof runId!=='string' || runId.length>64) throw new RequestError('プレイ開始の記録がありません。');
  const now=Date.now();
  const run=await db.prepare('SELECT * FROM runs WHERE player=? AND id=?').bind(player,runId).first();
  if(!run || now-run.started>MAX_AGE || elapsed>(now-run.started)/1000+5) throw new RequestError('プレイ記録が期限切れか、開始の記録がありません。もう一度遊んでください。');
  const fingerprint=JSON.stringify({nickname,score,distance,candy,elapsed});
  if(run.submission && run.submission!==fingerprint) throw new RequestError('このプレイ記録は送信済みです。',409);
  // D1 batch is transactional. The conditional claim also protects simultaneous submissions.
  const result=await db.batch([
    db.prepare('UPDATE runs SET submission=? WHERE player=? AND id=? AND submission IS NULL').bind(fingerprint,player,runId),
    db.prepare(`INSERT INTO scores(player,nickname,score,distance,candy,elapsed,updated)
      SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM runs WHERE player=? AND id=? AND submission=?)
      ON CONFLICT(player) DO UPDATE SET nickname=excluded.nickname,score=excluded.score,distance=excluded.distance,candy=excluded.candy,elapsed=excluded.elapsed,updated=excluded.updated
      WHERE excluded.score>scores.score`).bind(player,nickname,score,distance,candy,elapsed,now,player,runId,fingerprint),
    db.prepare('SELECT submission FROM runs WHERE player=? AND id=?').bind(player,runId)
  ]);
  if(result[2].results[0]?.submission!==fingerprint) throw new RequestError('このプレイ記録は送信済みか、新しいプレイが始まっています。',409);
  return leaderboard(db,player);
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin');
    const allowed=(env.ALLOWED_ORIGINS||'https://game.gidaisai.jp').split(',').map(s=>s.trim());
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
    const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
    if(origin && !allowed.includes(origin)) return json({error:'このサイトからは接続できません。'},403);
    if(origin) headers['Access-Control-Allow-Origin']=origin;
    try {
      const path=new URL(request.url).pathname;
      if(!['/','/api/leaderboard','/api/runs','/api/scores'].includes(path)) throw new RequestError('Not found',404);
      if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'86400'}});
      if(!env.DB) throw new RequestError('D1データベースのDB接続を設定してください。',503);
      const db=env.DB.withSession('first-primary');
      if(path==='/' && request.method==='GET') {
        await db.prepare('SELECT n FROM ranking_stats WHERE id=1').first();
        return json({ok:true,service:'gidanyan-ranking-api',ruleset:RULESET});
      }
      const player=await identity(request.headers.get('Authorization'));
      if(path==='/api/leaderboard' && request.method==='GET') return json(await leaderboard(db,player));
      if(request.method!=='POST' || !['/api/runs','/api/scores'].includes(path)) throw new RequestError('Method not allowed',405);
      if(!player) throw new RequestError('識別情報が必要です。',401);
      const body=await bodyJSON(request);
      return json(path==='/api/runs'?await begin(db,player):await submit(db,player,body));
    } catch(error) {
      // Never expose SQL, player tokens or submitted nicknames in error responses/logs.
      return json({error:error.status?error.message:'保存できませんでした。データベースの初期設定と接続を確認してください。'},error.status||500);
    }
  }
};
