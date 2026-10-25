export function validResult(data) {
 return data && data.ruleset==='ex-v1' && [data.score,data.distance,data.candy].every(n=>Number.isSafeInteger(n)&&n>=0) && Number.isFinite(data.elapsed) && data.elapsed>=0 && data.score===data.distance+data.candy*3750;
}
export function trustedMessage(event,frame,location) {
 if(!frame?.src || event.source!==frame.contentWindow)return false;
 const url=new URL(frame.src,location);const d=event.data;
 return event.origin===url.origin && d?.source==='gidanyan-unity' && d.difficulty==='ex' && String(d.loadId)===url.searchParams.get('loadId');
}
export function renderLeaderboard(root,data) {
 const personal=root.querySelector('[data-personal]');
 if(personal)personal.textContent=data.personal?`あなたの自己ベスト ${data.personal.score.toLocaleString()} pt ／ ${data.personal.rank}位（${data.total}人）`:'まだランキングに記録がありません。EXを遊んで登録してね！';
 const list=root.querySelector('[data-ranking-list]');if(!list)return;list.replaceChildren();
 for(const row of data.top){const li=document.createElement('li');const name=document.createElement('span');const score=document.createElement('strong');name.textContent=`${row.rank}位　${row.nickname}`;score.textContent=`${row.score.toLocaleString()} pt`;li.append(name,score);list.append(li);}
 if(!data.top.length){const li=document.createElement('li');li.textContent='最初のチャレンジャーを待っています！';list.append(li);}
}
export async function mountRanking(root) {
 const resultOnly=root.dataset?.rankingMode==='result';
 const registrationButton=resultOnly?document.getElementById('openRecordRegistration'):null;
 if(registrationButton)registrationButton.disabled=true;
 if(resultOnly)root.hidden=true;
 const status=root.querySelector('[data-ranking-status]');const local=root.querySelector('[data-local-best]');const form=root.querySelector('form');const button=form?.querySelector('button');const name=form?.querySelector('input');const result=root.querySelector('[data-run-score]');
 const key='gidanyan-ex-ranking-v1';let saved={};let persistent=true;
 try{saved=JSON.parse(localStorage.getItem(key)||'{}');if(!saved || typeof saved!=='object')saved={};}catch{saved={};persistent=false;}
 const token=/^[a-f0-9]{64}$/.test(saved.token||'')?saved.token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 saved.token=token;
 function persist(){try{localStorage.setItem(key,JSON.stringify(saved));}catch{persistent=false;}}
 persist();if(name)name.value=typeof saved.nickname==='string'?saved.nickname:'';
 function localBest(){local.textContent=Number.isSafeInteger(saved.best)&&saved.best>=0?`このブラウザの自己ベスト：${saved.best.toLocaleString()} pt`:'このブラウザの自己ベスト：まだ記録がありません';}
 localBest();
 let apiBase=null;let serial=0;let ticket=null;let pending=null;let submitted=false;
 const apiReady=(async()=>{
  try{const response=await fetch('ranking-config.json',{cache:'no-store'});if(!response.ok)throw Error();const config=await response.json();
   if(config.apiBase){const url=new URL(config.apiBase);if(url.protocol!=='https:')throw Error();apiBase=url.href.replace(/\/$/,'');}
   else if(['localhost','127.0.0.1'].includes(location.hostname) || /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(location.hostname))apiBase=location.origin;
  }catch{}
 })();
 async function api(path,body){await apiReady;if(!apiBase)throw Error('ランキングは公開準備中です。自己ベストはこのブラウザに保存されます。');
  const response=await fetch(apiBase+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'ランキングに接続できません。');return data;
 }
 async function refresh(){try{renderLeaderboard(root,await api('/api/leaderboard'));status.textContent=persistent?'同じスコアは同順位です。':'このブラウザでは記録を保持できません。ページを閉じると別プレイヤーになります。';}catch(e){status.textContent=e.message;}}
 root.querySelector('[data-refresh]')?.addEventListener('click',refresh);
 const frame=document.getElementById('unityFrame');
 window.addEventListener('message',async event=>{
  if(!trustedMessage(event,frame,location.href))return;const d=event.data;
  if(['ready','error','run-started'].includes(d.type)){
   serial++;ticket=null;pending=null;submitted=false;if(form)form.hidden=true;if(resultOnly)root.hidden=true;if(registrationButton)registrationButton.disabled=true;
   if(d.type==='run-started'){const n=serial;ticket=api('/api/runs',{}).then(t=>n===serial?t:null).catch(()=>null);}
   return;
  }
  if(d.type!=='result-score' || !validResult(d.result) || !ticket || pending)return;
  const n=serial;pending=d.result;const runTicket=await ticket;if(n!==serial)return;
  pending={...d.result,runId:runTicket?.runId};saved.best=Math.max(Number.isSafeInteger(saved.best)?saved.best:0,pending.score);persist();localBest();
  if(resultOnly)root.hidden=false;
  if(registrationButton)registrationButton.disabled=false;
  result.textContent=`今回のスコア：${pending.score.toLocaleString()} pt`;form.hidden=false;button.disabled=!runTicket;
  status.textContent=runTicket?'ニックネームを入力して、ランキングに記録を残そう！':'ランキングに接続できませんでした。自己ベストはこのブラウザに保存しました。';
 });
 form?.addEventListener('submit',async event=>{
  event.preventDefault();if(!pending?.runId || submitted)return;button.disabled=true;const n=serial;const payload=pending;const nickname=name.value.trim();
  try{const data=await api('/api/scores',{...payload,nickname});if(n!==serial)return;submitted=true;saved.nickname=nickname;persist();renderLeaderboard(root,data);status.textContent='記録を受け付けました！ 自己ベストがランキングに残ります。';}
  catch(e){if(n!==serial)return;status.textContent=e.message;button.disabled=false;}
 });
 if(!resultOnly)await refresh();
}
const root=document.querySelector('[data-ranking]');if(root)mountRanking(root);
