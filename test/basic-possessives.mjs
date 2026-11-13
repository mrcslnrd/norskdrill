/* Picker checks for v5.6.4: basic min/din/vår agreement stays in the bank, but no practice path serves it.
   Run from the repo root while a static server is up:
   PORT=8768 node test/basic-possessives.mjs
*/
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const APP_VERSION = fs.readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
const PORT = process.env.PORT || '8768';
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
  '--remote-debugging-port=9234','--user-data-dir=/tmp/chrome-nd564-'+process.pid,'about:blank'
], {stdio:['ignore','pipe','pipe']});
let log=''; chrome.stderr.on('data', d => { log += d.toString(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i=0;i<50;i++){
  try { if ((await fetch('http://127.0.0.1:9234/json/version')).ok) break; } catch {}
  await sleep(200);
  if (i===49) { chrome.kill('SIGKILL'); throw new Error(log.slice(-500)); }
}
const pages = await (await fetch('http://127.0.0.1:9234/json/list')).json();
const page = pages.find(p => p.type==='page') || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.addEventListener('open', res); ws.addEventListener('error', ()=>rej(new Error('ws'))); });
let id=0; const pending=new Map(); const events=[];
function send(method, params={}){ const msgId=++id; return new Promise((resolve,reject)=>{ pending.set(msgId,{resolve,reject}); ws.send(JSON.stringify({id:msgId,method,params})); }); }
ws.addEventListener('message', ev => { const msg=JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);} else if (msg.method) events.push(msg); });
await send('Runtime.enable'); await send('Page.enable'); await send('Console.enable');
await send('Page.navigate', {url:`http://127.0.0.1:${PORT}/index.html?v=564`});
await sleep(1800);

const expr = `(() => {
  const nd = window.__nd;
  const poss = nd.ITEMS.filter(i => i.t === 'possessives');
  const basic = poss.filter(nd.basicPoss);
  const kept = poss.filter(i => !nd.basicPoss(i));
  const basicIds = new Set(basic.map(i => i.id));
  const fail = [];
  function check(name, ok, detail){ if(!ok) fail.push(name + (detail ? ': ' + detail : '')); }

  check('version', nd.VERSION === ${JSON.stringify(APP_VERSION)} && document.getElementById('ver').textContent.indexOf('Norsk drill v' + nd.VERSION + ' · ') === 0, document.getElementById('ver').textContent);
  check('excluded count', basic.length === 22, String(basic.length));
  check('retained count', kept.length === poss.length - 22 && kept.length >= 111, String(kept.length));
  check('po1 basic agreement', nd.basicPoss(nd.ITEMS.find(i => i.id==='po1')));
  check('po32 faren min', nd.basicPoss(nd.ITEMS.find(i => i.id==='po32')));
  check('po73 passordet mitt', nd.basicPoss(nd.ITEMS.find(i => i.id==='po73')));
  check('po7 moren sin stays', !nd.basicPoss(nd.ITEMS.find(i => i.id==='po7')));
  check('po14 deres stays', !nd.basicPoss(nd.ITEMS.find(i => i.id==='po14')));
  check('po40 deres stays', !nd.basicPoss(nd.ITEMS.find(i => i.id==='po40')));
  check('po41 incidental min stays', !nd.basicPoss(nd.ITEMS.find(i => i.id==='po41')));
  check('po85 incidental min stays', !nd.basicPoss(nd.ITEMS.find(i => i.id==='po85')));
  check('po127 clause din stays', !nd.basicPoss(nd.ITEMS.find(i => i.id==='po127')));
  const alt = nd.ITEMS.find(i => i.id==='po48');
  check('po48 alt kept', alt.alt && alt.alt[0] === 'Hver morgen løper Per med hunden sin.', JSON.stringify(alt.alt));
  check('training sentence restored', nd.ITEMS.some(i => i.s==='Jo mer jeg trener, jo sterkere blir jeg.'));
  check('sunday cafe', nd.ITEMS.some(i => i.s==='På søndag går vi på kafé.'));
  check('no jobleser', !nd.ITEMS.some(i => JSON.stringify(i).indexOf('jobleser')>=0));
  check('no blinking cursor', !document.querySelector('.cur'));
  const banned = /\\b(kirken|presten|Bibelen|gudstjenesten|Lisboa|Portugal|treningssenteret|maratonet|bønn)\\b/i;
  const leaked = nd.ITEMS.filter(it => banned.test([it.s, it.prompt, it.en, it.why, ...(it.alt||[])].join(' '))).map(it => it.id);
  check('no biography scenes in items', leaked.length === 0, leaked.slice(0, 8).join(','));
  const droppedAlt = nd.ITEMS.find(i => i.id==='po42');
  check('excluded item still in the bank', !!droppedAlt && droppedAlt.alt && droppedAlt.alt.length === 1);

  const seen = new Set();
  for (let n = 0; n < 8; n++) {
    const set = nd.buildSet(400, {pids:['possessives']}).ids;
    set.forEach(id => seen.add(id));
    const bad = set.filter(id => basicIds.has(id));
    check('just-drill round has no basic', bad.length === 0, bad.join(','));
  }
  ['po7','po14','po40','po41','po48','po85','po127'].forEach(id => check('possessive drill can serve '+id, seen.has(id)));
  check('possessive drill serves the whole retained set', seen.size === kept.length, seen.size + ' of ' + kept.length);

  for (let n = 0; n < 12; n++) {
    const lesson = nd.buildLesson('2026-11-' + String(10+n), 'possessives');
    const bad = lesson.ids.filter(id => basicIds.has(id));
    check('lesson '+n+' has no basic', bad.length === 0, bad.join(','));
    check('lesson '+n+' is 32', lesson.ids.length === 32, String(lesson.ids.length));
    const nPoss = lesson.ids.filter(id => { const it = nd.ITEMS.find(i => i.id===id); return it && it.t === 'possessives'; }).length;
    check('focus lesson still uses possessives', nPoss >= 8, String(nPoss));
  }

  const D = nd.D();
  D.items.po1 = {seen:4,right:1,wrong:3,streak:0,weak:true,last:5,lastWrong:'min'};
  D.items.po48 = {seen:2,right:0,wrong:2,streak:0,weak:true,last:9,lastWrong:''};
  localStorage.setItem('norskdrill.v1', JSON.stringify(D));
  nd.reload();
  const D2 = nd.D();
  check('po1 history kept', D2.items.po1 && D2.items.po1.wrong === 3 && D2.items.po1.weak === true);
  const weak = nd.weakItems();
  check('weak list drops po1', weak.indexOf('po1') < 0, weak.join(','));
  check('weak list keeps po48', weak.indexOf('po48') >= 0, weak.join(','));

  const t = (function(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })();
  D2.lesson = {date:t, ids:['po1','po48','po7'], rev:['po1'], cleared:['po1'], done:false, focus:'possessives'};
  D2.flog = D2.flog || {}; D2.flog[t] = 'possessives';
  const purged = nd.purgeLesson();
  check('purge ran', purged === true);
  check('resumed lesson drops po1', D2.lesson.ids.indexOf('po1') < 0, D2.lesson.ids.join(','));
  check('resumed lesson drops po1 from cleared', D2.lesson.cleared.indexOf('po1') < 0);
  check('resumed lesson keeps po48', D2.lesson.ids.indexOf('po48') >= 0, D2.lesson.ids.join(','));
  check('resumed lesson has no basic', D2.lesson.ids.every(id => !basicIds.has(id)));
  check('po1 stats still there after purge', D2.items.po1.wrong === 3);

  check('sync still present', typeof nd.syncGet === 'function' && typeof nd.syncSummary === 'function');
  const exported = nd.readCode(nd.makeCode());
  check('export still carries po1', exported.items.po1 && exported.items.po1.wrong === 3);

  return {fail, excluded: basic.map(i => i.id), kept: kept.length, lessonSample: D2.lesson.ids.slice(0,8)};
})()`;

const result = await send('Runtime.evaluate', {returnByValue:true, expression: expr});
if (result.exceptionDetails) {
  console.log(JSON.stringify(result.exceptionDetails, null, 2));
  chrome.kill('SIGKILL');
  process.exit(1);
}
const value = result.result.value;

// Session paths: lesson of the day, just drill, weak practice, and a queue that already contains po1.
const flow = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd;
  const basic = new Set(nd.ITEMS.filter(nd.basicPoss).map(i => i.id));
  const fail = [];
  function check(name, ok, detail){ if(!ok) fail.push(name + (detail ? ': ' + detail : '')); }
  document.getElementById('go-day').click();
  check('lesson opened', document.documentElement.getAttribute('data-view')==='v-play');
  check('lesson current is not basic', !basic.has(nd.cur().id), nd.cur() && nd.cur().id);
  const S = nd.S();
  S.answered = true;
  S.queue = ['po1','po48'];
  const act = document.getElementById('act');
  act.disabled = false;
  act.click();
  check('queued basic item is skipped', nd.cur() && nd.cur().id==='po48', nd.cur() && nd.cur().id);
  check('queue no longer starts with po1', nd.S().queue[0] !== 'po1');

  document.getElementById('quit').click();
  const D = nd.D();
  D.set.drill = ['possessives'];
  D.set.round = false;
  document.getElementById('go-drill').click();
  document.getElementById('drill-go').click();
  check('possessive drill opened', document.documentElement.getAttribute('data-view')==='v-play');
  const got = [];
  if (nd.cur()) got.push(nd.cur().id);
  for (let i=0;i<25;i++) { if(!nd.genNext()) break; }
  nd.S().queue.forEach(id => got.push(id));
  check('endless possessive drill has items', got.length > 5, String(got.length));
  check('endless possessive drill has no basic', got.every(id => !basic.has(id)), got.filter(id => basic.has(id)).join(','));
  const gram = got.filter(id => !nd.EXPR.some(e => e.id===id));
  const exprs = got.filter(id => nd.EXPR.some(e => e.id===id));
  check('grammar half stays on possessives', gram.length>0 && gram.every(id => { const it=nd.ITEMS.find(i => i.id===id); return it && it.t==='possessives'; }));
  check('expressions alternate into the drill', exprs.length>0);

  document.getElementById('quit').click();
  Object.keys(D.items).forEach(k => { if (D.items[k]) D.items[k].weak = false; });
  D.items.po1 = {seen:1,right:0,wrong:1,streak:0,weak:true,last:1,lastWrong:''};
  localStorage.setItem('norskdrill.v1', JSON.stringify(D));
  nd.reload();
  const before = document.documentElement.getAttribute('data-view');
  document.getElementById('go-weak-h').click();
  check('only a basic weak sentence does not start practice', document.documentElement.getAttribute('data-view')===before || document.documentElement.getAttribute('data-view')==='v-home', document.documentElement.getAttribute('data-view'));
  check('basic sentence is not listed', (document.getElementById('weaklist').innerText||'').indexOf('Huset')<0);

  nd.D().items.po7 = {seen:1,right:0,wrong:1,streak:0,weak:true,last:2,lastWrong:''};
  localStorage.setItem('norskdrill.v1', JSON.stringify(nd.D()));
  nd.reload();
  document.getElementById('go-weak-h').click();
  check('weak practice opens for a retained miss', document.documentElement.getAttribute('data-view')==='v-play');
  const ids = [nd.cur() && nd.cur().id].concat(nd.S().queue);
  check('weak practice does not serve po1', ids.every(id => id!=='po1'), ids.join(','));
  check('weak practice serves the retained miss', ids.indexOf('po7')>=0, ids.join(','));
  return {fail};
})()`});

const ex = events.filter(e => e.method==='Runtime.exceptionThrown' || (e.method==='Runtime.consoleAPICalled' && e.params.type==='error')).map(e => {
  if (e.method==='Runtime.exceptionThrown') return (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.exceptionDetails.text;
  return 'console.error ' + (e.params.args||[]).map(a => a.value ?? a.description ?? '').join(' ');
});
const fails = (value && value.fail || []).concat(flow.result && flow.result.value && flow.result.value.fail || []);
console.log(JSON.stringify({fails, errors: ex, excluded: value.excluded, kept: value.kept, lessonSample: value.lessonSample}, null, 2));
ws.close(); chrome.kill('SIGKILL');
process.exit(fails.length || ex.length || flow.exceptionDetails ? 1 : 0);
