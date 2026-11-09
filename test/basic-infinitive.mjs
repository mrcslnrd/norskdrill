/* Elementary å drills stay in the bank and leave every practice path. */
import { spawn } from 'node:child_process';
const PORT = process.env.PORT || '8768';
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
  '--remote-debugging-port=9242','--user-data-dir=/tmp/chrome-nd-inf','about:blank'
], {stdio:['ignore','pipe','pipe']});
let log=''; chrome.stderr.on('data', d => { log += d.toString(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i=0;i<50;i++){
  try { if ((await fetch('http://127.0.0.1:9242/json/version')).ok) break; } catch {}
  await sleep(200);
  if (i===49) { chrome.kill('SIGKILL'); throw new Error(log.slice(-400)); }
}
const pages = await (await fetch('http://127.0.0.1:9242/json/list')).json();
const page = pages.find(p => p.type==='page') || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.addEventListener('open', res); ws.addEventListener('error', ()=>rej(new Error('ws'))); });
let idn=0; const pending=new Map(); const events=[];
function send(method, params={}){ const id=++idn; return new Promise((resolve,reject)=>{ pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); }); }
ws.addEventListener('message', ev => { const msg=JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);} else if (msg.method) events.push(msg); });
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', {url:`http://127.0.0.1:${PORT}/index.html?inf=1`});
await sleep(1600);
const value = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd;
  const fail = [];
  const check = (n,ok,d) => { if(!ok) fail.push(n+(d?': '+d:'')); };
  const basic = nd.ITEMS.filter(nd.basicInf);
  const ids = basic.map(i => i.id);
  check('stolt av is out', ids.indexOf('pr16')>=0);
  check('modal bare infinitive is out', ids.indexOf('as27')>=0);
  check('count', ids.length===56, String(ids.length)+' '+ids.join(','));
  ['pr20','pr38','as5','as12','as15','as39','rp35'].forEach(id => check(id+' stays', !nd.basicInf(nd.ITEMS.find(i => i.id===id))));
  check('phrases are not excluded by the å rule', !nd.EXPR.some(nd.basicInf));
  check('new patterns exist', ['sh-spelling','pt-bridge','b1-clicks'].every(p => nd.PATTERNS.some(x => x.id===p)));
  for (let n=0;n<4;n++){
    const lesson = nd.buildLesson('2026-11-' + String(12+n), 'prep-aa');
    check('lesson has no basic å', lesson.ids.every(id => ids.indexOf(id)<0));
    check('lesson still 32', lesson.ids.length===32);
    check('phrases still about half', lesson.ids.filter(id => nd.EXPR.some(e => e.id===id)).length>=14);
  }
  const seen = new Set();
  for (let n=0;n<8;n++) nd.buildSet(40, {pids:['sh-spelling','pt-bridge','b1-clicks']}).ids.forEach(id => seen.add(id));
  check('new patterns are served', seen.size>=12, String(seen.size));
  check('drill never serves pr16', !seen.has('pr16'));
  const D = nd.D();
  D.items.pr16 = {seen:3,right:1,wrong:2,streak:0,weak:true,last:4,lastWrong:'i'};
  const t=(function(){const d=new Date();const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());})();
  D.lesson={date:t, ids:['pr16','e161','pr20'], rev:[], cleared:[], done:false, focus:'prep-aa'};
  D.flog=D.flog||{}; D.flog[t]='prep-aa';
  localStorage.setItem('norskdrill.v1', JSON.stringify(D));
  nd.reload();
  check('excluded history is kept', nd.D().items.pr16 && nd.D().items.pr16.wrong===2);
  check('weak list drops pr16', nd.weakItems().indexOf('pr16')<0);
  document.getElementById('go-day').click();
  const q=[nd.cur()&&nd.cur().id].concat(nd.S().queue);
  check('resumed queue skips stolt av', q.every(id => id!=='pr16'), q.join(','));
  check('resumed queue keeps the phrase', q.indexOf('e161')>=0);
  return {fail, n: ids.length, ids};
})()`});
const ex = events.filter(e => e.method==='Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception&&e.params.exceptionDetails.exception.description)||e.params.exceptionDetails.text);
const fails = (value.exceptionDetails ? [value.exceptionDetails.exception && value.exceptionDetails.exception.description || value.exceptionDetails.text] : (value.result&&value.result.value&&value.result.value.fail)||[]).concat(ex);
const ids = value.result&&value.result.value&&value.result.value.ids;
if (ids) fsWrite(ids);
function fsWrite(ids){ /* printed below */ }
console.log(JSON.stringify({fails, n: value.result&&value.result.value&&value.result.value.n}, null, 2));
if (ids) console.log(ids.join(','));
ws.close(); chrome.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
