import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
export const RULESET = 'ex-v1';
export class RequestError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
export function identity(token) {
    if (!/^[a-f0-9]{64}$/.test(token || '')) throw new RequestError('記録用の識別情報を確認できません。',401);
    return createHash('sha256').update(token).digest('hex');
}
export function createStore(path, now=Date.now) {
 const db=new DatabaseSync(path);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, player TEXT NOT NULL, started INTEGER NOT NULL, submission TEXT);
 CREATE TABLE IF NOT EXISTS scores (player TEXT PRIMARY KEY, nickname TEXT NOT NULL, score INTEGER NOT NULL, distance INTEGER NOT NULL, candy INTEGER NOT NULL, elapsed REAL NOT NULL, updated INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS scores_order ON scores(score DESC, updated ASC, player ASC);`);
 const publicRow=row=>row && ({nickname:row.nickname,score:row.score,distance:row.distance,candy:row.candy,elapsed:row.elapsed});
 function leaderboard(player) {
  const top=db.prepare('SELECT * FROM scores ORDER BY score DESC,updated ASC,player ASC LIMIT 10').all().map(row=>({...publicRow(row),rank:1+db.prepare('SELECT COUNT(*) AS n FROM scores WHERE score > ?').get(row.score).n}));
  const own=player && db.prepare('SELECT * FROM scores WHERE player=?').get(player);
  return {ruleset:RULESET,top,total:db.prepare('SELECT COUNT(*) AS n FROM scores').get().n,personal:own?{...publicRow(own),rank:1+db.prepare('SELECT COUNT(*) AS n FROM scores WHERE score > ?').get(own.score).n}:null};
 }
 function begin(player) {
  db.prepare('DELETE FROM runs WHERE started < ?').run(now()-48*3600000);
  const last=db.prepare('SELECT started FROM runs WHERE player=? ORDER BY started DESC LIMIT 1').get(player);
  if(last && now()-last.started<1000) throw new RequestError('少し待ってからお試しください。',429);
  const id=randomUUID();db.prepare('INSERT INTO runs VALUES(?,?,?,NULL)').run(id,player,now());return {runId:id,ruleset:RULESET};
 }
 function submit(player,body) {
  if(body?.ruleset!==RULESET) throw new RequestError('このゲームのバージョンはランキングに対応していません。');
  const nickname=typeof body.nickname==='string'?body.nickname.normalize('NFKC').trim():'';
  if(!nickname || [...nickname].length>12 || /[\p{Cc}\p{Cf}<>]/u.test(nickname)) throw new RequestError('ニックネームは12文字以内で入力してください。');
  const {score,distance,candy,elapsed,runId}=body;
  if(![score,distance,candy].every(Number.isSafeInteger) || !Number.isFinite(elapsed) || elapsed<0 || elapsed>86400 || distance<0 || candy<0 || score<0 || score>2147483647 || distance>elapsed*45+100 || candy>elapsed*12+20 || score!==distance+candy*3750) throw new RequestError('スコアの内容を確認できません。');
  if(typeof runId!=='string') throw new RequestError('プレイ開始の記録がありません。');
  const run=db.prepare('SELECT * FROM runs WHERE id=? AND player=?').get(runId,player);
  if(!run || now()-run.started>48*3600000 || elapsed>(now()-run.started)/1000+5) throw new RequestError('プレイ記録が期限切れか、開始の記録がありません。もう一度遊んでください。');
  const fingerprint=JSON.stringify({nickname,score,distance,candy,elapsed});
  if(run.submission) {
   if(run.submission!==fingerprint) throw new RequestError('このプレイ記録は送信済みです。',409);
   return leaderboard(player);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
   db.prepare(`INSERT INTO scores VALUES(?,?,?,?,?,?,?) ON CONFLICT(player) DO UPDATE SET nickname=excluded.nickname,score=excluded.score,distance=excluded.distance,candy=excluded.candy,elapsed=excluded.elapsed,updated=excluded.updated WHERE excluded.score>scores.score`).run(player,nickname,score,distance,candy,elapsed,now());
   db.prepare('UPDATE runs SET submission=? WHERE id=?').run(fingerprint,runId);db.exec('COMMIT');
  } catch(e){db.exec('ROLLBACK');throw e;}
  return leaderboard(player);
 }
 return {begin,submit,leaderboard,close:()=>db.close()};
}
