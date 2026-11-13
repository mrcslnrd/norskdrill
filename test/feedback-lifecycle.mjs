/* Each new card must show only itself. Grammar and phrases, right and wrong, skip and resume. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = process.env.PORT || '8768';
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
  '--window-size=390,844',
  '--remote-debugging-port=9241','--user-data-dir=/tmp/chrome-nd-fb-'+process.pid,'about:blank'
], {stdio:['ignore','pipe','pipe']});
let log=''; chrome.stderr.on('data', d => { log += d.toString(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i=0;i<50;i++){
  try { if ((await fetch('http://127.0.0.1:9241/json/version')).ok) break; } catch {}
  await sleep(200);
  if (i===49) { chrome.kill('SIGKILL'); throw new Error(log.slice(-400)); }
}
const pages = await (await fetch('http://127.0.0.1:9241/json/list')).json();
const page = pages.find(p => p.type==='page') || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.addEventListener('open', res); ws.addEventListener('error', ()=>rej(new Error('ws'))); });
let idn=0; const pending=new Map(); const events=[];
function send(method, params={}){ const id=++idn; return new Promise((resolve,reject)=>{ pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); }); }
ws.addEventListener('message', ev => { const msg=JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);} else if (msg.method) events.push(msg); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:2, mobile:true});
await send('Page.navigate', {url:`http://127.0.0.1:${PORT}/index.html?fb=1`});
await sleep(1600);

const flow = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd;
  const fail = [];
  const check = (n,ok,d) => { if(!ok) fail.push(n+(d?': '+d:'')); };
  const d=new Date(); const p=n=>String(n).padStart(2,'0');
  const t=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  const queue=['as5','e161','e09','as12','e88r','ck19','e01','sh01','ck13','e67r'];
  nd.D().lesson={date:t, ids:queue.slice(), rev:[], cleared:[], done:false, focus:'at-som-aa'};
  nd.D().flog=nd.D().flog||{}; nd.D().flog[t]='at-som-aa';
  document.getElementById('go-day').click();
  function fb(){return document.getElementById('fb').innerText}
  function card(){return document.getElementById('card').innerText}
  function placeWords(sentence){
    const words=sentence.toLowerCase().replace(/[.,!?;:]/g,'').split(/\\s+/).filter(Boolean);
    words.forEach(w=>{
      const b=[...document.querySelectorAll('#bank .tile')].find(x=>x.textContent===w);
      if(b) b.click();
    });
    return words.length===document.querySelectorAll('#line .tile').length;
  }
  let steps=0;
  function assertClean(label, bits){
    steps++;
    const text=fb();
    check(label+' has no feedback yet', text.trim()==='', (nd.cur()&&nd.cur().id)+' '+text.slice(0,100));
    bits.forEach(b=>check(label+' shows '+b, card().indexOf(b)>=0, (nd.cur()&&nd.cur().id)+' '+card().slice(0,80)));
    check(label+' check starts disabled or waiting', document.getElementById('act').textContent.indexOf('Check')>=0, (nd.cur()&&nd.cur().id)+' ['+document.getElementById('act').textContent+']');
  }
  assertClean('1 grammar', ['viktig']);
  [...document.querySelectorAll('.chip')].find(b=>b.textContent==='at').click();
  check('grammar result is its own sentence', fb().indexOf('barna sover')>=0);
  document.getElementById('act').click();
  assertClean('2 phrase after right grammar', ['igjen','hevn']);
  check('2 no leftover grammar', card().indexOf('barna')<0 && fb().indexOf('Riktig')<0);
  check('2 words placed', placeWords(nd.cur().ok[0]));
  document.getElementById('act').disabled=false; document.getElementById('act').click();
  check('2 feedback is the refund line', fb().indexOf('billetten')>=0 && fb().indexOf('barna')<0);
  document.getElementById('act').click();
  assertClean('3 next phrase', ['knyte']);
  // wrong: tap one distractor only and check
  const bad=[...document.querySelectorAll('#bank .tile')][0];
  bad.click();
  document.getElementById('act').disabled=false; document.getElementById('act').click();
  check('3 wrong feedback belongs to this phrase', fb().indexOf('knyte')>=0 || fb().indexOf('får ikke')>=0);
  check('3 miss is listed to practise', nd.D().expr[nd.cur().fam].weakCards[nd.cur().id]===1);
  document.getElementById('act').click();
  assertClean('4 grammar after a wrong phrase', ['bussen']);
  nd.ITEMS.filter(i=>i.t==='at-som-aa').forEach(i=>{nd.S().shown[nd.keyOf(i)]=2});
  const wrongChip=[...document.querySelectorAll('.chip')].find(b=>b.textContent==='at');
  wrongChip.click();
  check('4 miss is this grammar item', fb().indexOf('bussen')>=0 && fb().indexOf('knyte')<0);
  document.getElementById('act').click();
  assertClean('5 reply cue only', ['Takk for hjelpen']);
  check('5 no scenario paragraph', !document.querySelector('#card .sit'));
  placeWords('Bare hyggelig.');
  document.getElementById('act').disabled=false; document.getElementById('act').click();
  check('5 both thanks replies can be built', fb().indexOf('hyggelig')>=0);
  document.getElementById('act').click();
  assertClean('6 new pattern order', ['sykkel']);
  placeWords('I går kjøpte jeg en sykkel.');
  document.getElementById('act').disabled=false; document.getElementById('act').click();
  document.getElementById('act').click();
  assertClean('7 missed phrase returns', ['knyte']);
  document.getElementById('skip').click();
  check('7 skip names this phrase', fb().toLowerCase().indexOf('knyte')>=0);
  document.getElementById('act').click();
  assertClean('8 next phrase after skip', ['depends']);
  document.getElementById('skip').click();
  check('8 skip names the new phrase', fb().toLowerCase().indexOf('kommer an')>=0);
  document.getElementById('act').click();
  assertClean('9 spelling', ['boat']);
  const spell=[...document.querySelectorAll('.opt')];
  const spellHit=spell.find(b=>b.textContent.trim()==='skip');
  check('9 spelling choices', !!spellHit, spell.map(b=>b.textContent).join('|'));
  if(spellHit) spellHit.click();
  check('9 spelling feedback is its own word', fb().indexOf('skip')>=0 && fb().indexOf('kommer an')<0);
  document.getElementById('act').click();
  assertClean('10 clicks prep', ['tre år']);
  const prep=[...document.querySelectorAll('.chip')].find(b=>b.textContent==='på');
  check('10 preposition choices', !!prep, [...document.querySelectorAll('.chip')].map(b=>b.textContent).join('|'));
  if(prep) prep.click();
  document.getElementById('skip') && document.getElementById('skip').click();
  if(nd.cur()&&nd.cur().expr){
    document.getElementById('act').click();
  }
  check('at least 10 clean openings', steps>=10, String(steps));
  return {fail, steps, last: nd.cur()&&nd.cur().id};
})()`});

const resume = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd=window.__nd; const fail=[];
  const check=(n,ok,d)=>{if(!ok)fail.push(n+(d?': '+d:''));};
  const d=new Date(); const p=n=>String(n).padStart(2,'0');
  const t=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  nd.D().lesson={date:t, ids:['e161','as1'], rev:[], cleared:[], done:false, focus:'questions'};
  localStorage.setItem('norskdrill.v1', JSON.stringify(nd.D()));
  nd.reload();
  document.getElementById('fb').className='ok';
  document.getElementById('fb').innerHTML='<div class="h">✓ Riktig!</div><div class="c">Han er stolt av å være far til tre.</div>';
  document.getElementById('go-day').click();
  check('resume opens the phrase', nd.cur()&&nd.cur().id==='e161', nd.cur()&&nd.cur().id);
  check('resume drops the planted result', document.getElementById('fb').innerText.indexOf('stolt')<0, document.getElementById('fb').innerText.slice(0,120));
  return {fail};
})()`});

function failsOf(r){
  if(r.exceptionDetails) return [r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text];
  return (r.result&&r.result.value&&r.result.value.fail)||[];
}
const ex=events.filter(e=>e.method==='Runtime.exceptionThrown').map(e=>(e.params.exceptionDetails.exception&&e.params.exceptionDetails.exception.description)||e.params.exceptionDetails.text);
const fails=[].concat(failsOf(flow), failsOf(resume), ex.slice(0,2));
console.log(JSON.stringify({fails, steps: flow.result&&flow.result.value&&flow.result.value.steps, last: flow.result&&flow.result.value&&flow.result.value.last}, null, 2));
ws.close(); chrome.kill('SIGKILL');
process.exit(fails.length?1:0);
