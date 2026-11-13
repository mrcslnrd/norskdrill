/* A v5.6.8 progress blob must still load after the card files move.
   v5.8.2: the removed duplicate ck22 folds into vt73, and damaged data still opens the app. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const APP_VERSION = fs.readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
const PORT = process.env.PORT || '8768';
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
  '--window-size=390,844',
  '--remote-debugging-port=9248','--user-data-dir=/tmp/chrome-nd-mig-'+process.pid,'about:blank'
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
  const blob = {v:2, items:{as5:{seen:4,right:1,wrong:3,streak:0,weak:true,last:1700000000000,lastWrong:'å'},
    ck22:{seen:3,right:1,wrong:2,streak:0,weak:true,last:1700000500000,lastWrong:'fordi det regnet vi ble hjemme'},
    vt73:{seen:2,right:2,wrong:0,streak:2,weak:false,last:1700000100000,lastWrong:''}},
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
  check('version', nd.VERSION===${JSON.stringify(APP_VERSION)}, nd.VERSION);
  const v = d.items.vt73;
  check('ck22 folded into vt73', !d.items.ck22 && v && v.seen===5 && v.right===3 && v.wrong===2 && v.weak===true && v.lastWrong==='fordi det regnet vi ble hjemme', JSON.stringify(v));
  check('miss count kept', it && it.wrong===3 && it.seen===4 && it.weak===true, JSON.stringify(it));
  check('last answer kept', it && it.lastWrong==='å');
  check('pattern stats kept', d.pat['at-som-aa'] && d.pat['at-som-aa'].ok===1 && d.pat['at-som-aa'].drill===true);
  check('theme kept', d.set.theme==='dark' && document.documentElement.getAttribute('data-theme')==='dark');
  check('old lesson kept', d.lesson && d.lesson.ids[0]==='as5' && d.lesson.done===true);
  check('phrase progress kept', d.expr.e01 && d.expr.e01.right===2);
  check('same card still exists', !!nd.ITEMS.find(i=>i.id==='as5') && !!nd.EXPR.find(e=>e.id==='e01'));
  return {fail};
})()`});
/* Damaged data: wrong types everywhere must not stop the app from opening. */
await send('Runtime.evaluate', {returnByValue:true, expression: `localStorage.setItem('norskdrill.v1', JSON.stringify({v:4, items:{as5:null, x:7}, stats:'x', set:5, pat:{'at-som-aa':null, 'v2-fronted-time':{run:'x', hist:'y'}}, tag:{agreement:null}, lesson:'bad', pts:[1], out:[], flog:[], expr:[]})); true`});
const errs = [];
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text); });
await send('Page.reload', {ignoreCache:true});
await sleep(2000);
const broken = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd, f = [];
  if (!nd) return ['app did not start'];
  const d = nd.D();
  if (typeof d.stats !== 'object' || typeof d.stats.days !== 'object') f.push('stats not repaired');
  if (typeof d.set !== 'object' || !Array.isArray(d.set.drill)) f.push('settings not repaired');
  if (d.items.as5 || d.items.x) f.push('bad item records kept');
  if (!Array.isArray(d.pat['at-som-aa'].hist) || !Array.isArray(d.pat['v2-fronted-time'].run)) f.push('pattern stats not repaired');
  if (d.lesson !== null) f.push('bad lesson kept');
  document.getElementById('go-day').click();
  if (!nd.cur()) f.push('lesson does not start');
  return f;
})()`});
const fails = ((value.result && value.result.value && value.result.value.fail) || ['no result'])
  .concat((broken.result && broken.result.value) || ['damaged data: no result'], errs.map(e => 'damaged data: ' + e));
console.log(JSON.stringify({fails}, null, 2));
ws.close(); chrome.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
