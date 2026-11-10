/* The blue reward plays only when a previously missed item is answered correctly. */
import { spawn } from 'node:child_process';
const PORT = process.env.PORT || '8768';
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
  '--window-size=390,844',
  '--remote-debugging-port=9246','--user-data-dir=/tmp/chrome-nd-fix','about:blank'
], {stdio:['ignore','pipe','pipe']});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let log=''; chrome.stderr.on('data', d => { log += d; });
for (let i=0;i<40;i++){
  try { if ((await fetch('http://127.0.0.1:9246/json/version')).ok) break; } catch {}
  await sleep(200);
}
const pages = await (await fetch('http://127.0.0.1:9246/json/list')).json();
const page = pages.find(p => p.type==='page') || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.addEventListener('open', res));
let idn=0; const pending=new Map(); const events=[];
function send(method, params={}){ const id=++idn; return new Promise((resolve,reject)=>{ pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); }); }
ws.addEventListener('message', ev => { const msg=JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);} else if (msg.method) events.push(msg); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:1, mobile:true});
await send('Page.navigate', {url:`http://127.0.0.1:${PORT}/index.html?fix=1`});
await sleep(1500);
const value = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd;
  const fail = [];
  const check = (n,ok,d) => { if(!ok) fail.push(n+(d?': '+d:'')); };
  document.documentElement.setAttribute('data-theme','dark');
  const d=new Date(); const p=n=>String(n).padStart(2,'0');
  const t=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  nd.D().lesson={date:t, ids:['as5'], rev:[], cleared:[], done:false, focus:'at-som-aa'};
  document.getElementById('go-day').click();
  nd.ITEMS.filter(i => i.t==='at-som-aa' && i.id!=='as5').forEach(i => { nd.S().shown[nd.keyOf(i)] = 2; });
  [...document.querySelectorAll('.chip')].find(b=>b.textContent==='å').click();
  check('a miss is not a reward', document.getElementById('fb').className.indexOf('fix')<0);
  document.getElementById('act').click();
  check('the missed item came back with a clean card', nd.cur() && nd.cur().id==='as5' && document.getElementById('fb').innerText.trim()==='', (nd.cur()&&nd.cur().id)+' q='+(nd.S()&&nd.S().queue));
  const again=[...document.querySelectorAll('.chip')].find(b=>b.textContent==='at');
  check('the answer chip is back', !!again, [...document.querySelectorAll('.chip')].map(b=>b.textContent).join('|'));
  if(!again) return {fail};
  again.click();
  const fb=document.getElementById('fb');
  check('fixing the miss lights the screen', document.documentElement.classList.contains('fixmiss') && fb.classList.contains('ok'), document.documentElement.className);
  const veil=document.getElementById('nd-fix');
  const vs=getComputedStyle(veil);
  check('the veil does not block taps', vs.pointerEvents==='none');
  check('the flood animation is attached', vs.animationName.indexOf('nd-flood')>=0, vs.animationName);
  // a first-try correct phrase must not glow
  nd.D().lesson={date:t, ids:['e161'], rev:[], cleared:[], done:false, focus:'questions'};
  document.getElementById('go-day').click();
  const words=nd.cur().ok[0].toLowerCase().replace(/[.,!?;:]/g,'').split(/\\s+/).filter(Boolean);
  words.forEach(w=>{ const b=[...document.querySelectorAll('#bank .tile')].find(x=>x.textContent===w); if(b) b.click(); });
  document.getElementById('act').click();
  check('a first correct answer does not light the screen', document.getElementById('fb').classList.contains('ok') && !document.documentElement.classList.contains('fixmiss'), document.documentElement.className);
  return {fail};
})()`});
const ex = events.filter(e => e.method==='Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception&&e.params.exceptionDetails.exception.description)||e.params.exceptionDetails.text);
const fails = (value.exceptionDetails ? [value.exceptionDetails.exception&&value.exceptionDetails.exception.description||value.exceptionDetails.text] : (value.result&&value.result.value&&value.result.value.fail)||[]).concat(ex);
console.log(JSON.stringify({fails}, null, 2));
ws.close(); chrome.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
