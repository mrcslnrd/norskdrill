/* The Få drill button on the home screen starts an endless session of få cards only, and få misses land in the normal stats and practise list. */
import { spawn } from 'node:child_process';
const PORT = process.env.PORT || '8768';
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
  '--window-size=390,844',
  '--remote-debugging-port=9251','--user-data-dir=/tmp/chrome-nd-faa-'+process.pid,'about:blank'
], {stdio:['ignore','pipe','pipe']});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let log=''; chrome.stderr.on('data', d => { log += d; });
for (let i=0;i<40;i++){
  try { if ((await fetch('http://127.0.0.1:9251/json/version')).ok) break; } catch {}
  await sleep(200);
}
const pages = await (await fetch('http://127.0.0.1:9251/json/list')).json();
const page = pages.find(p => p.type==='page') || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(res => ws.addEventListener('open', res));
let idn=0; const pending=new Map(); const events=[];
function send(method, params={}){ const id=++idn; return new Promise((resolve,reject)=>{ pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); }); }
ws.addEventListener('message', ev => { const msg=JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);} else if (msg.method) events.push(msg); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:1, mobile:true});
await send('Page.navigate', {url:`http://127.0.0.1:${PORT}/index.html?faa=1`});
await sleep(1500);
const value = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd;
  const fail = [];
  const check = (n,ok,d) => { if(!ok) fail.push(n+(d?': '+d:'')); };
  const btn = document.getElementById('go-faa');
  check('the button exists', !!btn);
  if (!btn) return {fail};
  check('the button says Få drill', /^Få drill/.test(btn.textContent), btn.textContent);
  check('the button sits right after Just drill', document.getElementById('go-drill').nextElementSibling === btn);
  check('the button looks like Just drill', btn.className === document.getElementById('go-drill').className, btn.className);
  const faa = nd.ITEMS.filter(i => i.t === 'faa');
  check('80 or more få cards', faa.length >= 80, faa.length);
  btn.click();
  check('a session starts', document.getElementById('v-play').classList.contains('on') && !!nd.cur());
  const act = () => document.getElementById('act');
  const seen = new Set(), types = new Set();
  let wrongDone = null;
  for (let n = 0; n < 40; n++) {
    const it = nd.cur();
    if (!it) { fail.push('session ended after ' + n); break; }
    if (it.expr || it.t !== 'faa') { fail.push('not a få card: ' + it.id + ' ' + it.t); break; }
    seen.add(it.id); types.add(it.type);
    const wantWrong = !wrongDone && (it.type === 'fill' || it.type === 'mc') && n > 3;
    if (it.type === 'order') {
      nd.tileWords(it.s).forEach(w => { const b = [...document.querySelectorAll('#bank .tile')].find(x => x.textContent === w); if (b) b.click(); });
      act().click();
      check('a correct build is right: ' + it.id, document.getElementById('fb').classList.contains('ok'));
    } else if (it.type === 'fill') {
      const pick = wantWrong ? it.wrong[0] : it.ans;
      [...document.querySelectorAll('.chip')].find(b => b.textContent === pick).click();
    } else {
      const pick = wantWrong ? it.options[1] : it.options[0];
      [...document.querySelectorAll('.opt')].find(b => b.textContent === pick).click();
    }
    if (wantWrong) {
      const no = [...document.querySelectorAll('.chip.no, .opt.no')];
      check('only the wrong choice turns red', no.length === 1, no.length);
      wrongDone = it.id;
    }
    act().click();
  }
  check('many different få cards', seen.size >= 25, seen.size);
  check('several card types', types.size >= 3, [...types].join(','));
  const d = nd.D();
  check('få answers count in the pattern stats', d.pat.faa && d.pat.faa.n >= 30, JSON.stringify(d.pat.faa && d.pat.faa.n));
  check('the miss is saved on the card', wrongDone && d.items[wrongDone] && d.items[wrongDone].wrong === 1, wrongDone);
  check('the miss counts in the få pattern', d.pat.faa.ok === d.pat.faa.n - 1, d.pat.faa.ok + '/' + d.pat.faa.n);
  check('the mistakes export names the få card', nd.exportText().indexOf('Få') >= 0);
  document.getElementById('quit').click();
  const again = document.getElementById('again');
  if (again && document.getElementById('v-sum').classList.contains('on')) {
    again.click();
    check('Drill again starts få again', nd.cur() && nd.cur().t === 'faa', nd.cur() && nd.cur().t);
  }
  return {fail};
})()`});
const ex = events.filter(e => e.method==='Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception&&e.params.exceptionDetails.exception.description)||e.params.exceptionDetails.text);
const fails = (value.exceptionDetails ? [value.exceptionDetails.exception&&value.exceptionDetails.exception.description||value.exceptionDetails.text] : (value.result&&value.result.value&&value.result.value.fail)||[]).concat(ex);
console.log(JSON.stringify({fails}, null, 2));
ws.close(); chrome.kill('SIGKILL');
process.exit(fails.length ? 1 : 0);
