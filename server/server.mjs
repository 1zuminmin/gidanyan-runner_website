import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, identity, RequestError } from './store.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function createApp({dbPath,siteRoot=root,origins=[],demo=false}={}) {
 await mkdir(dirname(dbPath),{recursive:true});const store=createStore(dbPath);const limits=new Map();
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 const server=createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,'http://local');
   if(url.pathname.startsWith('/api/')) {
    const origin=req.headers.origin;
    if(origin && !origins.includes(origin)) throw new RequestError('このサイトからは接続できません。',403);
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'});res.end();return;}
    const address=req.socket.remoteAddress;const minute=Math.floor(Date.now()/60000);
    const rate=limits.get(address);const next=rate?.minute===minute?{minute,count:rate.count+1}:{minute,count:1};limits.set(address,next);
    if(limits.size>1000)for(const [k,v] of limits)if(v.minute<minute)limits.delete(k);
    if(next.count>120)throw new RequestError('アクセスが集中しています。少し待ってください。',429);
    const token=req.headers.authorization?.replace(/^Bearer /,'');
    const player=token?identity(token):null;
    if(req.method==='GET' && url.pathname==='/api/leaderboard'){json(res,200,store.leaderboard(player));return;}
    if(req.method!=='POST' || !['/api/runs','/api/scores'].includes(url.pathname))throw new RequestError('Not found',404);
    if(!player)throw new RequestError('識別情報が必要です。',401);
    if(!req.headers['content-type']?.startsWith('application/json'))throw new RequestError('JSONが必要です。',415);
    let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)throw new RequestError('データが大きすぎます。',413);}
    let body;try{body=JSON.parse(raw || '{}');}catch{throw new RequestError('JSONを確認してください。');}
    json(res,200,url.pathname==='/api/runs'?store.begin(player):store.submit(player,body));return;
   }
   if(!['GET','HEAD'].includes(req.method))throw new RequestError('Method not allowed',405);
   let path=decodeURIComponent(url.pathname);if(path==='/')path='/index.html';
   if(path==='/ranking-preview.html' && !demo)throw new RequestError('Not found',404);
   // Never serve source, SQLite files, .git, tests or deployment credentials.
   if(path.split('/').some(p=>p.startsWith('.') || p==='server' || p==='tests' || p==='game_windows_backup') || !/\.(html|css|js|mjs|json|png|jpe?g|webp|svg|gif|woff2?|ttf|unityweb|txt)$/i.test(path))throw new RequestError('Not found',404);
   const file=path==='/ranking-preview.html' && demo ? resolve(siteRoot,'server/preview.html') : resolve(siteRoot,'.'+path);if(!file.startsWith(resolve(siteRoot)+sep))throw new RequestError('Not found',404);
   // Symlinks are permitted only for local staging previews, never server data.
   const info=await stat(file);if(!info.isFile())throw new RequestError('Not found',404);
   const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain'}[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  } catch(e){if(e.code==='ENOENT')json(res,404,{error:'Not found'});else json(res,e.status||500,{error:e.status?e.message:'保存できませんでした。時間をおいて再試行してください。'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 server.on('close',()=>store.close());return {server,store};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const port=Number(process.env.PORT||8787);const host=process.env.HOST||'127.0.0.1';
 const origins=(process.env.ALLOWED_ORIGINS||`http://127.0.0.1:${port},http://localhost:${port}`).split(',').map(x=>x.trim());
 const {server}=await createApp({dbPath:process.env.DB_PATH||resolve(root,'server/data/ranking.sqlite'),origins,demo:process.env.ENABLE_DEMO==='1'});
 server.listen(port,host,()=>console.log(`Ranking: http://${host}:${port}/game/ranking.html`));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
