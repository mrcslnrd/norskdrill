/* A v5.6.8 progress blob must still load after the card files move. */
import { spawn } from 'node:child_process';
const PORT = process.env.PORT || '8768';
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
  '--window-size=390,844',
  '--remote-debugging-port=9248','--user-data-dir=/tmp/chrome-nd-mig','about:blank'
], {stdio:['ignore','pipe','pipe']});
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i=0;i<40;i++){
  try { if ((await fetch('http://127.0.0.1:9248/json/version')).ok) break; } catch {}
  await sleep(200);
}
const pages = await (await fetch('http://127.0.0.1:9248/json/list')).json();
const page = pages.find(p => p.type==='page') || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.addEventListener('open', res));
let idn=0; const pending=new Map();
function send(method, params={}){ const id=++idn; return new Promise((resolve,reject)=>{ pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); }); }
ws.addEventListener('message', ev => { const msg=JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);} });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', {url:`http://127.0.0.1:${PORT}/index.html?mig=1`});
await sleep(2000);
const seeded = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const blob = {v:2, items:{as5:{seen:4,right:1,wrong:3,streak:0,weak:true,last:1700000000000,lastWrong:'å'}},
    stats:{total:11,best:4,days:{},done:{}}, set:{theme:'dark',typed:false,drill:[],round:false},
    pat:{'at-som-aa':{n:4,ok:1,run:[],drill:true,mastered:0,hist:[0,1],hold:0,rv:0,last:1700000000000}},
    lesson:{date:'2020-01-01',ids:['as5'],rev:[],cleared:['as5'],done:true,focus:'at-som-aa'},
    expr:{e01:{seen:2,right:2,wrong:0,last:1700000000000,cards:{e01:2},weakCards:{}}}};
  localStorage.setItem('norskdrill.v1', JSON.stringify(blob));
  return true;
})()`});
await send('Page.reload', {ignoreCache:true});
await sleep(2000);
const value = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd;
  const fail = [];
  const check = (n,ok,d) => { if(!ok) fail.push(n+(d?': '+d:'')); };
  const d = nd.D();
  const it = d.items.as5;
  check('version', nd.VERSION==='5.7.0');
  check('miss count kept', it && it.wrong===3 && it.seen===4 && it.weak===true, JSON.stringify(it));
  check('last answer kept', it && it.lastWrong==='å');
  check('pattern stats kept', d.pat['at-som-aa'] && d.pat['at-som-aa'].ok===1 && d.pat['at-som-aa'].drill===true);
  check('theme kept', d.set.theme==='dark' && document.documentElement.getAttribute('data-theme')==='dark');
  check('old lesson kept', d.lesson && d.lesson.ids[0]==='as5' && d.lesson.done===true);
  check('phrase progress kept', d.expr.e01 && d.expr.e01.right===2);
  check('same card still exists', !!nd.ITEMS.find(i=>i.id==='as5') && !!nd.EXPR.find(e=>e.id==='e01'));
  return {fail};
})()`});
const fails = (value.result && value.result.value && value.result.value.fail) || ['no result'];
console.log(JSON.stringify({fails}, null, 2));
ws.close(); chrome.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
