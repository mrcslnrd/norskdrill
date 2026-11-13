/* Phrase mix: half a 32-item lesson, family ids, chunk tap, variants, no grammar score. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const PORT = process.env.PORT || '8768';
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',
  '--window-size=390,844',
  '--remote-debugging-port=9235','--user-data-dir=/tmp/chrome-nd-expr-'+process.pid,'about:blank'
], {stdio:['ignore','pipe','pipe']});
let log=''; chrome.stderr.on('data', d => { log += d.toString(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i=0;i<50;i++){
  try { if ((await fetch('http://127.0.0.1:9235/json/version')).ok) break; } catch {}
  await sleep(200);
  if (i===49) { chrome.kill('SIGKILL'); throw new Error(log.slice(-400)); }
}
const pages = await (await fetch('http://127.0.0.1:9235/json/list')).json();
const page = pages.find(p => p.type==='page') || pages[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ ws.addEventListener('open', res); ws.addEventListener('error', ()=>rej(new Error('ws'))); });
let idn=0; const pending=new Map(); const events=[];
function send(method, params={}){ const id=++idn; return new Promise((resolve,reject)=>{ pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); }); }
ws.addEventListener('message', ev => { const msg=JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);} else if (msg.method) events.push(msg); });
await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:1, mobile:true});
await send('Page.navigate', {url:`http://127.0.0.1:${PORT}/index.html?expr=2`});
await sleep(2000);

const logic = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd;
  const fail = [];
  const check = (n,ok,d) => { if(!ok) fail.push(n+(d?': '+d:'')); };
  const exprIds = new Set(nd.EXPR.map(e => e.id));
  const isExpr = id => exprIds.has(id);
  const fams = new Set(nd.EXPR.map(e => e.fam));
  check('reviewed families', fams.size === 134, String(fams.size));
  check('two wordings for every family', [...fams].every(f => nd.EXPR.filter(e => e.fam===f && e.type==='chunk').length >= 2));
  const omitted = ['e23','e24','e43','e52','e11','e15','e105','e115','e117','e120','e121','e155','e157','e160'];
  check('unverified families stay out', omitted.every(id => !fams.has(id)));
  check('alias e26 belongs to e05', nd.EXPR.find(e => e.id==='e26').fam === 'e05');
  check('alias e77 belongs to e64', nd.EXPR.find(e => e.id==='e77').fam === 'e64');
  check('få til is not receipt', nd.EXPR.find(e => e.id==='e09').why.toLowerCase().indexOf('receiv')>=0 || nd.EXPR.find(e => e.id==='e09').why.indexOf('manage')>=0 || nd.EXPR.find(e => e.id==='e09').en.toLowerCase().indexOf('manage')>=0 || nd.EXPR.find(e => e.id==='e09').en.toLowerCase().indexOf("can't")>=0);
  const mangle = nd.EXPR.filter(e => e.fam==='e88').map(e => e.why).join(' ');
  check('mangle is not always you are welcome', /not always|does not always|not an all-purpose/i.test(mangle), mangle);
  const lesson = nd.buildLesson('2026-11-08','possessives');
  check('lesson stays 32', lesson.ids.length===32, String(lesson.ids.length));
  const eCount = lesson.ids.filter(isExpr).length;
  check('about half expressions', eCount>=14 && eCount<=16, String(eCount));
  let alternates = 0;
  for (let i=0;i<lesson.ids.length-1;i++) if (isExpr(lesson.ids[i])!==isExpr(lesson.ids[i+1])) alternates++;
  check('grammar and phrases alternate', alternates>=26, String(alternates));
  check('lesson starts with grammar', !isExpr(lesson.ids[0]));
  const basic = new Set(nd.ITEMS.filter(nd.basicPoss).map(i => i.id));
  check('basic possessives still out', lesson.ids.every(id => !basic.has(id)));
  const poss = lesson.ids.filter(id => { const it=nd.ITEMS.find(x=>x.id===id); return it&&it.t==='possessives'; });
  check('possessive focus still present', poss.length>=6, String(poss.length));
  let faaAdj=0, sameAdj=0;
  const exprOnly = lesson.ids.filter(isExpr);
  for (let i=1;i<exprOnly.length;i++){
    const a=nd.EXPR.find(e=>e.id===exprOnly[i-1]), b=nd.EXPR.find(e=>e.id===exprOnly[i]);
    if (a.cluster==='faa' && b.cluster==='faa') faaAdj++;
    if (a.fam===b.fam) sameAdj++;
  }
  check('få cards are not neighbours in the phrase list', faaAdj===0, String(faaAdj));
  check('same family is not repeated back to back', sameAdj===0, String(sameAdj));
  const freshFamilies = new Set(exprOnly.map(id => nd.EXPR.find(e=>e.id===id).fam));
  check('a new learner meets at most 8 families', freshFamilies.size<=8, String(freshFamilies.size));
  nd.D().out = {possessives:true};
  const blocked = nd.buildLesson('2026-11-09','possessives');
  check('checked-out possessives leave the grammar slots', blocked.ids.every(id => { const it=nd.ITEMS.find(x=>x.id===id); return !it || it.t!=='possessives'; }));
  nd.D().out = {};
  const only = nd.EXPR[0].id;
  const avoid = {};
  nd.EXPR.forEach(e => { if (e.id!==only) avoid[e.id]=1; });
  const few = nd.pickExprs(8, Math.random, avoid);
  check('small pool returns the one eligible phrase', few.length===1 && few[0]===only, few.join(','));
  const round = nd.composeSession(Math.random, 8, () => ['po7','po48','po14','po40']);
  check('short phrase pool is topped up to length', round.length===8, round.join(','));
  check('compose starts with grammar', !isExpr(round[0]));
  return {fail, eCount, families: fams.size, fresh: freshFamilies.size};
})()`});

const ui = await send('Runtime.evaluate', {returnByValue:true, expression: `(() => {
  const nd = window.__nd;
  const fail = [];
  const check = (n,ok,d) => { if(!ok) fail.push(n+(d?': '+d:'')); };
  const chunk = nd.EXPR.find(e => e.id==='e09');
  const words = chunk.ok[0].toLowerCase().replace(/[.,!?;:]/g,'').split(/\\s+/).filter(Boolean);
  const t = (function(){const d=new Date();const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());})();
  const D = nd.D();
  const histBefore = (D.pat.possessives.hist||[]).slice();
  D.lesson = {date:t, ids:[chunk.id], rev:[], cleared:[], done:false, focus:'questions'};
  D.flog = D.flog||{}; D.flog[t]='questions';
  document.getElementById('go-day').click();
  check('chunk opened', nd.cur() && nd.cur().id===chunk.id, nd.cur() && nd.cur().id);
  check('only the English meaning is shown', !!document.querySelector('#card .en') && !document.querySelector('#card .sit') && !document.querySelector('#card .intent'));
  const tiles = [...document.querySelectorAll('#bank .tile')];
  check('word tiles render', tiles.length>=2, String(tiles.length));
  const card = document.getElementById('card');
  check('tiles fit the phone width', card.scrollWidth <= document.documentElement.clientWidth+2, card.scrollWidth+' vs '+document.documentElement.clientWidth);
  words.forEach(w => {
    const b=[...document.querySelectorAll('#bank .tile')].find(x => x.textContent===w);
    check('tile present '+w, !!b);
    if (b) b.click();
  });
  check('words moved into the line', document.querySelectorAll('#line .tile').length===words.length);
  document.getElementById('act').disabled=false;
  document.getElementById('act').click();
  check('correct chunk accepted', document.querySelector('#fb.ok')!==null, (document.querySelector('#fb')||{}).innerText);
  check('family record, not a card score', nd.D().expr[chunk.fam] && nd.D().expr[chunk.fam].seen===1 && nd.D().expr[chunk.fam].cards[chunk.id]===1);
  check('grammar history untouched', JSON.stringify(nd.D().pat.possessives.hist)===JSON.stringify(histBefore));
  const veit = nd.EXPR.find(e => (e.ok||[]).some(a => a.indexOf('veit')>=0));
  D.expr[veit.fam] = {seen:1, right:1, wrong:0, last:1, cards:{}};
  D.lesson = {date:t, ids:[veit.id], rev:[], cleared:[], done:false, focus:'questions'};
  document.getElementById('go-day').click();
  check('the meaning is still the only instruction', !!document.querySelector('#card .en') && !document.querySelector('#card .sit'));
  const veitWords = veit.ok.find(a => a.indexOf('veit')>=0).toLowerCase().replace(/[.,!?;:]/g,'').split(/\\s+/).filter(Boolean);
  veitWords.forEach(w => {
    const b=[...document.querySelectorAll('#bank .tile')].find(x => x.textContent===w);
    if (b) b.click();
  });
  document.getElementById('act').disabled=false;
  document.getElementById('act').click();
  check('accepted line checks out', document.querySelector('#fb.ok')!==null);
  const rep = nd.EXPR.find(e => e.type==='reply' && e.fam==='e88');
  const hist2 = (nd.D().pat.possessives.hist||[]).slice();
  D.expr[rep.fam] = {seen:0, right:0, wrong:0, last:0, cards:{}};
  D.lesson = {date:t, ids:[rep.id], rev:[], cleared:[], done:false, focus:'questions'};
  document.getElementById('go-day').click();
  check('reply shows one Norwegian cue', (document.querySelector('#card .sent')||{}).textContent==='Takk for hjelpen.');
  const replyWords = 'bare hyggelig'.split(' ');
  replyWords.forEach(w => {
    const b=[...document.querySelectorAll('#bank .tile')].find(x => x.textContent===w);
    if (b) b.click();
  });
  document.getElementById('act').disabled=false;
  document.getElementById('act').click();
  check('bare hyggelig is accepted', document.querySelector('#fb.ok')!==null, (document.querySelector('#fb')||{}).innerText.slice(0,80));
  check('reply miss is not a grammar miss', JSON.stringify(nd.D().pat.possessives.hist)===JSON.stringify(hist2));
  const other = nd.EXPR.find(e => e.type==='chunk' && e.id!==chunk.id && e.fam!==chunk.fam);
  D.lesson = {date:t, ids:[other.id], rev:[], cleared:[], done:false, focus:'questions'};
  document.getElementById('go-day').click();
  document.getElementById('skip').click();
  check('skip shows the phrase', (document.querySelector('#fb')||{}).innerText.indexOf(other.ok[0].slice(0,12))>=0);
  check('skip did not touch grammar history', JSON.stringify(nd.D().pat.possessives.hist)===JSON.stringify(hist2));
  return {fail, chunk: chunk.id, width: document.documentElement.clientWidth};
})()`});

const shot = await send('Page.captureScreenshot', {format:'png'});
fs.mkdirSync('/opt/cursor/artifacts', {recursive:true});
fs.writeFileSync('/opt/cursor/artifacts/expr-reply-mobile.png', Buffer.from(shot.data,'base64'));
fs.writeFileSync('/tmp/expr-reply-mobile.png', Buffer.from(shot.data,'base64'));

const ex = events.filter(e => e.method==='Runtime.exceptionThrown').map(e => (e.params.exceptionDetails.exception&&e.params.exceptionDetails.exception.description)||e.params.exceptionDetails.text);
const fails = []
  .concat(logic.exceptionDetails ? [logic.exceptionDetails.exception && logic.exceptionDetails.exception.description || logic.exceptionDetails.text] : (logic.result&&logic.result.value&&logic.result.value.fail)||[])
  .concat(ui.exceptionDetails ? [ui.exceptionDetails.exception && ui.exceptionDetails.exception.description || ui.exceptionDetails.text] : (ui.result&&ui.result.value&&ui.result.value.fail)||[]);
console.log(JSON.stringify({fails, errors:ex.slice(0,4), logic: logic.result&&logic.result.value, ui: ui.result&&ui.result.value}, null, 2));
ws.close(); chrome.kill('SIGKILL');
process.exit(fails.length||ex.length?1:0);
