function startApp(data){
"use strict";
var PATTERNS=data.patterns,ITEMS=data.items,EXPR=data.expr;
var VERSION="5.7.0",VERSION_NOTE="",VERSION_DATE="10 Nov 2026";
var KEY="norskdrill.v1",SESSION_SIZE=16,NEED=3,EXTRA_CAP=8;
/* v5.6 lesson of the day: 32 items, half on one daily focus pattern, at most 2 mastered reviews, no very short basics */
var LESSON_SIZE=32,FOCUS_SHARE=0.5,LESSON_REV=2,EASY_WORDS=5,FLOG_KEEP=40;
/* v5.5 adaptive picker: status per pattern from its last 20 answers */
var WIN=20,MAST_OK=18,WEAK_ACC=0.75,HOLD=10,WEAK_SHARE=0.6;
var PTAGS=[{id:"agreement",l:"min / mitt / mine"},{id:"sin-basic",l:"sin or hans"},{id:"in-subject",l:"never sin in the subject"},{id:"sub-clause",l:"at / fordi / når clauses"}],PTAG_L={};PTAGS.forEach(function(t){PTAG_L[t.id]=t.l});
var PIDS=PATTERNS.map(function(p){return p.id}),PBY={};PATTERNS.forEach(function(p){PBY[p.id]=p});
var EXBY={};EXPR.forEach(function(e){EXBY[e.id]=e});
var BY={};ITEMS.forEach(function(i){BY[i.id]=i});
var PTOTAL={};PIDS.forEach(function(p){PTOTAL[p]=ITEMS.filter(function(i){return i.t===p&&!drillOut(i)}).length});
var $=function(id){return document.getElementById(id)};
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function shuffle(a,r){r=r||Math.random;a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(r()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}
function pad(n){return("0"+n).slice(-2)}
function today(){var d=new Date();return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function dayShift(s,n){var p=s.split("-");var d=new Date(+p[0],+p[1]-1,+p[2]+n);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function byId(id){return BY[id]||EXBY[id]}

/* ---------- item helpers ---------- */
function parseGap(it){
  var s=it.s,p=s.indexOf("^"),before=s.slice(0,p).trim().split(/\s+/).filter(Boolean).length;
  var clean=s.replace("^","").replace(/\s+/g," ").trim();
  var m=clean.match(/^(.*?)([.?!]*)$/);var words=m[1].split(" ");
  return {words:words,punct:m[2],at:before};
}
function fullText(it){
  if(it&&it.expr)return (it.ok&&it.ok[0])||it.sit||"";
  if(it._f)return it._f;var r;
  switch(it.type){
    case"order":r=it.s;break;
    case"sense":r=it.s;break;
    case"mc":r=it.prompt.indexOf("___")>-1?it.prompt.replace("___",it.options[0]):it.options[0];break;
    case"gap":var g=parseGap(it);var w=g.words.slice();w.splice(g.at,0,it.adv||"ikke");r=w.join(" ")+g.punct;break;
    case"fill":r=it.s.replace("___",it.ans);break;
    case"typed":r=it.s.indexOf("___")>-1?it.s.replace("___",it.acc[0]):it.acc[0];break;
  }
  it._f=r;return r;
}
function keyOf(it){if(!it)return "";if(it.expr)return "expr:"+it.id;return fullText(it)}
/* v5.5: tiles are lowercase and the sentence-final . ? ! is dropped; identical words are interchangeable (compared as text)
   v5.6.2: commas, semicolons and colons are dropped too, so any grammatical order (item.alt) can be built from the same tiles */
function tileWord(w){return w.toLocaleLowerCase("nb").replace(/[,;:]/g,"")}
function tileWords(s){var w=s.split(" ").map(tileWord);w[w.length-1]=w[w.length-1].replace(/[.?!]+$/,"");return w.filter(Boolean)}
function tileX(x){return tileWord(x).replace(/[.?!]+$/,"")}
function markWord(s,w){var i=s.indexOf(w);if(i<0)return esc(s);return esc(s.slice(0,i))+"<b>"+esc(w)+"</b>"+esc(s.slice(i+w.length))}
function typeLabel(it){return{order:"Build the sentence",mc:"Pick the right form",sense:"What does the bold word mean?",gap:"Where does "+(it.adv||"ikke")+" go?",fill:"Tap the word that fits",typed:"Type it (optional)"}[it.type]}
function isEasy(it){return fullText(it).split(/\s+/).length<=EASY_WORDS}
function norm(s){return s.toLowerCase().replace(/[.,!?;:]/g,"").replace(/\s+/g," ").trim()}

/* ---------- storage + migration ---------- */
var mem=null;
function normalize(d){
  d=d&&typeof d==="object"?d:{};
  d.items=d.items&&typeof d.items==="object"?d.items:{};
  d.expr=d.expr&&typeof d.expr==="object"&&!Array.isArray(d.expr)?d.expr:{};
  foldExpr(d);
  d.stats=d.stats||{};d.set=d.set||{};d.chk=d.chk&&typeof d.chk==="object"?d.chk:{};
  /* v5.6.1: checked-out patterns {pid:true}: left out of every lesson, drill and practice */
  var oo=d.out&&typeof d.out==="object"&&!Array.isArray(d.out)?d.out:{};d.out={};Object.keys(oo).forEach(function(k){if(oo[k]&&PBY[k])d.out[k]=true});
  var s=d.stats;s.best=s.best||0;s.days=s.days||{};s.total=s.total||0;s.done=s.done||{};
  if(typeof d.set.typed!=="boolean")d.set.typed=false;
  if(!Array.isArray(d.set.drill))d.set.drill=[];
  if(typeof d.set.round!=="boolean")d.set.round=false;
  var migrate=!d.pat;
  d.pat=d.pat||{};
  PIDS.forEach(function(pid){
    var p=d.pat[pid]=d.pat[pid]||{n:0,ok:0,run:[],drill:false,mastered:0,hist:[]};
    p.run=p.run||[];p.hist=Array.isArray(p.hist)?p.hist.slice(-WIN):[];p.mastered=p.mastered||0;p.n=p.n||0;p.ok=p.ok||0;p.drill=!!p.drill;
    p.hold=p.hold||0;p.rv=p.rv||0;
    if(!p.last){var mx=0;ITEMS.forEach(function(it){var x=d.items[it.id];if(it.t===pid&&x&&x.last>mx)mx=x.last});p.last=mx}
  });
  /* v5.5: per sub-pattern stats (possessives). Older data: seeded from the per-sentence counts */
  if(!d.tag||typeof d.tag!=="object"){d.tag={};ITEMS.forEach(function(it){var x=d.items[it.id];if(!it.g||!x)return;var T=d.tag[it.g]=d.tag[it.g]||{n:0,ok:0,hist:[]};T.n+=(x.right||0)+(x.wrong||0);T.ok+=(x.right||0)})}
  PTAGS.forEach(function(t){var T=d.tag[t.id]=d.tag[t.id]||{n:0,ok:0,hist:[]};T.n=T.n||0;T.ok=T.ok||0;T.hist=Array.isArray(T.hist)?T.hist.slice(-WIN):[]});
  if(migrate){ /* v1 -> v2: rebuild per-pattern stats from the per-sentence history */
    ITEMS.forEach(function(it){var x=d.items[it.id];if(!x)return;var p=d.pat[it.t];p.n+=(x.right||0)+(x.wrong||0);p.ok+=(x.right||0);if(x.weak)p.drill=true});
  }
  /* v5.6: daily focus log {date: pattern id}; new patterns simply start as "new" (entries above) */
  d.flog=d.flog&&typeof d.flog==="object"&&!Array.isArray(d.flog)?d.flog:{};
  var fk=Object.keys(d.flog).sort();if(fk.length>FLOG_KEEP)fk.slice(0,fk.length-FLOG_KEEP).forEach(function(k){delete d.flog[k]});
  d.pts=d.pts||{};["total","best","bestStreak","sessions","answers","correct"].forEach(function(k){d.pts[k]=d.pts[k]||0});
  d.v=4;return d;
}
function load(){
  var raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
  var d=null;try{d=raw?JSON.parse(raw):null}catch(e){}
  if(d&&d.v!==4){ /* keep a copy of the older data before upgrading it in place */
    try{var bk=KEY+".v"+(d.v||1)+"backup";if(!localStorage.getItem(bk))localStorage.setItem(bk,raw)}catch(e){}
  }
  if(!d&&mem)d=mem;
  return normalize(d);
}
var D=load();
var SV={ok:null,t:0};
function save(){
  mem=D;var ok=false;
  try{var j=JSON.stringify(D);localStorage.setItem(KEY,j);ok=localStorage.getItem(KEY)===j}catch(e){}
  SV.ok=ok;SV.t=Date.now();paintSaved();SY.dirty=true;return ok;
}
function paintSaved(){
  var t=new Date(SV.t),hm=pad(t.getHours())+":"+pad(t.getMinutes());
  var txt=SV.ok===null?"checking storage…":SV.ok?"saved · "+hm:"! can't save on this device. Use Export progress";
  var a=$("saved");if(a){a.textContent=txt;a.classList.toggle("bad",SV.ok===false)}
  var m=$("m-saved");if(m){m.textContent=SV.ok===false?"! not saved":"saved";m.style.color=SV.ok===false?"var(--no)":"var(--ok)"}
}
function st(id){return D.items[id]||(D.items[id]={seen:0,right:0,wrong:0,streak:0,weak:false,last:0,lastWrong:""})}
function lessonDoneToday(){return !!(D.lesson&&D.lesson.date===today()&&D.lesson.done)}
function dayStreak(){var t=today(),n=0,d=D.stats.days[t]?t:dayShift(t,-1);while(D.stats.days[d]){n++;d=dayShift(d,-1)}return n}
function isOut(p){return !!(D.out&&D.out[p])}
function activePids(){return PIDS.filter(function(p){return !isOut(p)})}
/* v5.6.4: first/second-person possessive agreement (min/mitt/mine, din/ditt/dine, vår/vårt/våre) is out of practice.
   sin/sitt/sine versus hans/hennes/deres stays, including clauses and genitives, even when min, din or vår is only mentioned.
   "dere takes deres, not sin" stays too: that is the ownership distinction, not the basic agreement drill. */
function basicPoss(it){
  if(!it||it.t!=="possessives"||it.g!=="agreement")return false;
  var why=it.why||"";
  if(/\bdere\b/.test(why)&&/\bderes\b/.test(why))return false;
  return true;
}
/* The explanation says what the item trains. These are only the elementary å drills:
   bare infinitive versus å, a modal plus a bare infinitive, and stock preposition + å + infinitive.
   A sentence that merely contains å stays: purpose for å, a new-subject at-clause,
   etter å ha + participle, a reported request, and every phrase. */
function basicInf(it){
  if(!it||it.expr)return false;
  var why=it.why||"";
  if(why.indexOf("After a preposition the verb comes as å + infinitive")>=0)return true;
  if(why.indexOf("After å the verb is always the infinitive")>=0)return true;
  if(why.indexOf("uten å = sem + infinitive")>=0)return true;
  if(why.indexOf("å goes in front of an infinitive, when there is no new subject")>=0)return true;
  if(why.indexOf("the infinitive comes without å")>=0)return true;
  if(why.indexOf("adjective + å + infinitive")>=0)return true;
  if(why.indexOf("viktig + å + infinitive")>=0)return true;
  if(why==="bestemme seg for å + infinitive.")return true;
  if(why==="tid til å + infinitive.")return true;
  if(why.indexOf("i stedet for + å + infinitive")>=0)return true;
  return false;
}
function bridgeItem(it){return !!(it&&it.t==="pt-bridge")}
function drillOut(it){return basicPoss(it)||basicInf(it)||bridgeItem(it)}
function dropBasicQueue(){
  if(!S||!S.queue)return;
  while(S.queue.length&&drillOut(byId(S.queue[0]))){
    var id=S.queue.shift();
    if(S.base[id]&&!S.baseDone[id]){S.baseDone[id]=1;S.done++}
    if(S.kind==="lesson"&&D.lesson&&D.lesson.cleared.indexOf(id)<0)D.lesson.cleared.push(id);
  }
}
function weakItems(){return ITEMS.filter(function(i){return D.items[i.id]&&D.items[i.id].weak&&!isOut(i.t)&&!drillOut(i)})}
function weakPats(){return PIDS.filter(function(p){return !isOut(p)&&patStatus(p)==="weak"})}
function patAcc(pid){var P=D.pat[pid];return P.n?Math.round(P.ok/P.n*100):null}
function patSolved(pid){return ITEMS.filter(function(i){var s=D.items[i.id];return i.t===pid&&!drillOut(i)&&s&&s.right>0}).length}
/* v5.5: a plain tally instead of points: right / answered, all patterns, all time */
function tally(){var ok=0,n=0;PIDS.forEach(function(p){ok+=D.pat[p].ok||0;n+=D.pat[p].n||0});return{ok:ok,n:n}}
function tallyTxt(){var t=tally();return t.ok.toLocaleString("en")+" / "+t.n.toLocaleString("en")}
function sum(a){var t=0;for(var i=0;i<a.length;i++)t+=a[i];return t}
/* new: under 5 answers · weak: under 75% of the last 20, or 2 misses in the last 10 · mastered: 18+ of the last 20 (needs 20 answers; a missed review holds it back for 10 right answers) · otherwise learning */
function patStatus(pid){
  var P=D.pat[pid],h=P.hist,n=h.length,ok=sum(h),l10=h.slice(-10),miss10=l10.length-sum(l10);
  if(P.n<5&&n<5)return"new";
  if(miss10>=2||(n>=5&&ok/n<WEAK_ACC))return"weak";
  if(pid==="possessives"&&PTAGS.some(function(t){return tagIsWeak(t.id)}))return"weak"; /* a weak sub-pattern makes possessives weak */
  if(n>=WIN&&ok>=MAST_OK&&!(P.hold>0))return"mastered";
  return"learning";
}
function tagIsWeak(g){var T=D.tag&&D.tag[g];if(!T)return false;var h=T.hist,l10=h.slice(-10);if(h.length>=5)return(l10.length-sum(l10))>=2||sum(h)/h.length<WEAK_ACC;return T.n>=5&&T.ok/T.n<WEAK_ACC}
function acc20(pid){var h=D.pat[pid].hist;return h.length?sum(h)/h.length:null}
function weakness(pid){var h=D.pat[pid].hist,a=acc20(pid),l10=h.slice(-10),w=Math.max(0.1,(a===null?0.5:1-a)+0.15*(l10.length-sum(l10)));if(pid==="possessives")PTAGS.forEach(function(t){if(tagIsWeak(t.id))w=Math.max(w,tagWeak(t.id))});return w}
function tagWeak(g){var T=D.tag[g];if(!T)return 0.5;var h=T.hist;if(h.length>=3)return Math.max(0.05,1-sum(h)/h.length);if(T.n>=3)return Math.max(0.05,1-T.ok/T.n);return 0.5}
function tagAcc(g){var T=D.tag[g];if(!T)return null;var h=T.hist;if(h.length)return Math.round(sum(h)/h.length*100);return T.n?Math.round(T.ok/T.n*100):null}
var STATUS_L={new:"New",weak:"Needs work",learning:"Learning",mastered:"Mastered"};

/* ---------- views ---------- */
var VIEWS=["v-home","v-set","v-drill","v-check","v-play","v-sum"];
function show(id){if(id!=="v-play"){missBg(false);hitFx(null)}VIEWS.forEach(function(v){$(v).classList.toggle("on",v===id)});document.documentElement.setAttribute("data-view",id);paintChrome();window.scrollTo(0,0)}
/* browser/status-bar tint: the page background */
function paintChrome(){var m=document.querySelector('meta[name="theme-color"]');if(!m)return;m.setAttribute("content",getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()||"#050a07")}
function toast(m,ms){var t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(toast._t);toast._t=setTimeout(function(){t.classList.remove("on")},ms||2200)}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
function dots(n){return "●".repeat(Math.min(3,n))+"○".repeat(Math.max(0,3-n))}

function patCard(pid,opt){
  opt=opt||{};var P=D.pat[pid],st=patStatus(pid),h=P.hist,solved=patSolved(pid),tot=PTOTAL[pid];
  var cls="pcard st-"+st+(opt.sel?" sel":"");
  var last=h.length?sum(h)+" / "+h.length:"–";
  var sub="";
  if(pid==="possessives")sub='<div class="r4">'+PTAGS.map(function(t){var a=tagAcc(t.id);return'<span>'+esc(t.l)+' <b>'+(a===null?"–":a+"%")+'</b></span>'}).join("")+'</div>';
  return '<button class="'+cls+'" data-p="'+pid+'">'+
   '<div class="r1"><b>'+(opt.check?'<span class="chk2">'+(opt.sel?"✓":"")+'</span>':"")+esc(PBY[pid].label)+'</b><span class="stl">'+STATUS_L[st]+'</span></div>'+
   '<div class="r2">'+esc(PBY[pid].hint)+'</div>'+sub+
   '<div class="mini"><i style="width:'+Math.round(solved/tot*100)+'%"></i></div>'+
   '<div class="r3"><span>last 20: '+last+' · '+solved+' / '+tot+' solved</span><span>'+(P.drill?'<span class="runs" title="in a row on different sentences">'+dots(P.run.length)+'</span>':"")+'</span></div></button>';
}
function paintDayBtn(){
  var b=$("go-day"),L=D.lesson&&D.lesson.date===today()?D.lesson:null,n=dayStreak();
  /* v5.6: today's focus, quietly in the subtitle (an older lesson without a focus shows none) */
  var fp=L?(L.focus&&PBY[L.focus]?L.focus:null):todayFocus(),ft=fp?'Today: '+esc(PBY[fp].short||PBY[fp].label):'';
  if(!activePids().length&&!(L&&L.done)){b.className="btn pri day";b.innerHTML='Lesson of the day<small>everything is checked out</small>';return}
  if(L&&L.done){b.className="btn pri day done";b.innerHTML='✓ Day done<small>tap to practise more</small>'}
  else if(L&&L.cleared.length){b.className="btn pri day";b.innerHTML='Continue today\'s lesson<small>'+L.cleared.length+' / '+L.ids.length+(ft?' · '+ft:' cleared')+'</small>'}
  else{b.className="btn pri day";b.innerHTML='Lesson of the day<small>'+(L?L.ids.length:LESSON_SIZE)+' items'+(ft?' · '+ft:' · same lesson all day')+'</small>'}
}
function doneCount(){var o=PIDS.filter(isOut).length,m=PIDS.filter(function(p){return !isOut(p)&&patStatus(p)==="mastered"}).length;return{n:o+m,out:o,m:m}}
function renderHome(){
  purgeLesson();paintDayBtn();paintSaved();
  var w=weakItems(),we=weakExprList(),wp=weakPats();
  var ds=dayStreak();$("s-day").textContent=ds?"· "+ds+"-day streak":"";
  $("s-tally").textContent=tallyTxt();
  /* the practise cell: weak patterns first; if none, the sentences waiting for another go; 0 = all clear (tap does nothing) */
  var nP=wp.length||w.length||we.length,gw=$("go-weak");$("s-weak").textContent=nP;$("s-weak-l").textContent=nP?"to practise":"all clear";
  gw.classList.toggle("clear",!nP);gw.setAttribute("aria-label",nP?nP+" to practise. Tap to practise.":"All clear");
  $("weak-go").textContent=(wp.length||w.length)?"› tap to start":"";$("weaklist").classList.toggle("on",!!(wp.length||w.length));
  $("sw-typed").classList.toggle("on",D.set.typed);
  var wl=$("weaklist");
  if(!w.length&&!we.length)wl.innerHTML='<div>'+(wp.length?'No sentences waiting. Tap above to practise the patterns that need another look.':'Nothing waiting right now. Sentences that need another go will gather here.')+'</div>';
  else wl.innerHTML=w.map(function(i){return'<div><b>'+esc(fullText(i))+'</b><small>'+esc(PBY[i.t].label)+'</small></div>'}).concat(we.map(function(e){return'<div><b>'+esc(fullText(e))+'</b><small>Phrase</small></div>'})).join("");
  var dn=doneCount();$("go-check").textContent="B1 · "+dn.n+" / "+PIDS.length+" patterns "+(dn.out?"done":"mastered");
  $("go-drill-sub").textContent="pick patterns · endless";
}

/* ---------- picking sentences ---------- */
function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){var a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;var t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function typedOk(){return D.set.typed}
function freshSort(pool){return pool.sort(function(a,b){var x=D.items[a.id],y=D.items[b.id];var xs=x&&x.seen?1:0,ys=y&&y.seen?1:0;if(xs!==ys)return xs-ys;return(x?x.last:0)-(y?y.last:0)})}
/* possessives: interleave sub-patterns by weakness (smooth weighted round robin), weakest first */
function byTag(pool,pre){pre=pre||{};
  var groups={},order=[];
  pool.forEach(function(i){var g=i.g||"_";if(!groups[g]){groups[g]=[];order.push(g)}groups[g].push(i)});
  if(order.length<2)return pool;
  var w={},cr={},tot=0,out=[],K=0;order.forEach(function(g){w[g]=tagWeak(g);tot+=w[g];K+=pre[g]||0});
  /* continue the round robin from what is already in the set (so a second pass doesn't restart at the top) */
  order.forEach(function(g){cr[g]=K*w[g]-(pre[g]||0)*tot});
  order.sort(function(a,b){return w[b]-w[a]});
  while(out.length<pool.length){
    var best=null;order.forEach(function(g){if(!groups[g].length)return;cr[g]+=w[g];if(best===null||cr[g]>cr[best])best=g});
    if(best===null)break;out.push(groups[best].shift());cr[best]-=tot;
  }
  return out;
}
/* fresh candidates of a pattern, best first: unseen, then least recently seen (possessives: weakest sub-pattern first) */
function ranked(pid,blockKeys,r,pre){
  var pool=ITEMS.filter(function(i){return i.t===pid&&!drillOut(i)&&(typedOk()||i.type!=="typed")&&!blockKeys[keyOf(i)]});
  pool=freshSort(shuffle(pool,r));
  return pid==="possessives"?byTag(pool,pre):pool;
}
/* split n slots over patterns in proportion to weight (largest remainder) */
function alloc(pids,n,wf){
  var w=pids.map(wf),tot=sum(w)||1,q=w.map(function(x){return Math.floor(n*x/tot)}),left=n-sum(q);
  var fr=pids.map(function(p,i){return{i:i,f:n*w[i]/tot-q[i]}}).sort(function(a,b){return b.f-a.f});
  for(var k=0;k<fr.length&&left>0;k++){q[fr[k].i]++;left--}
  if(n>=pids.length)pids.forEach(function(p,i){if(!q[i]){var m=q.indexOf(Math.max.apply(null,q));if(q[m]>1){q[m]--;q[i]=1}}});
  var o={};pids.forEach(function(p,i){o[p]=q[i]});return o;
}
/* v5.5 lesson / round: up to 4 missed sentences, ONE review item shared by all mastered patterns,
   ~60% from weak patterns (more slots for weaker ones), the rest from learning and new patterns */
function buildSet(r,n,opts){
  opts=opts||{};var chosen=[],keys={},rev=[];
  function take(it){chosen.push(it.id);keys[keyOf(it)]=1}
  var PS=(opts.pids||PIDS).filter(function(p){return !isOut(p)}),inP=function(p){return PS.indexOf(p)>-1};
  var ST={};PS.forEach(function(p){ST[p]=patStatus(p)});
  var of=function(k){return PS.filter(function(p){return ST[p]===k})};
  var wp=of("weak"),mp=of("mastered"),lp=PS.filter(function(p){return ST[p]==="learning"||ST[p]==="new"});
  /* 1. missed sentences, oldest first, max 2 per pattern (not from mastered patterns) */
  var missed=shuffle(weakItems().filter(function(i){return inP(i.t)&&(opts.weakOnly||ST[i.t]!=="mastered")&&(typedOk()||i.type!=="typed")}),r).sort(function(a,b){return D.items[a.id].last-D.items[b.id].last});
  var perPat={};
  missed.forEach(function(i){if(chosen.length>=(opts.maxMissed||4))return;if((perPat[i.t]||0)>=2)return;if(keys[keyOf(i)])return;perPat[i.t]=(perPat[i.t]||0)+1;take(i)});
  function preTags(){var o={};chosen.forEach(function(id){var g=byId(id).g;if(g)o[g]=(o[g]||0)+1});return o}
  function cnt(pids){return chosen.filter(function(id){return pids.indexOf(byId(id).t)>-1}).length}
  function rr(pids,limit){
    var lists=pids.map(function(p){return ranked(p,keys,r,preTags())}),idx=pids.map(function(){return 0}),guard=0;
    while(chosen.length<limit&&guard++<2000){
      var any=false;
      for(var k=0;k<lists.length&&chosen.length<limit;k++){
        while(idx[k]<lists[k].length&&keys[keyOf(lists[k][idx[k]])])idx[k]++;
        if(idx[k]<lists[k].length){take(lists[k][idx[k]++]);any=true}
      }
      if(!any)break;
    }
  }
  function fillPat(p,k){var L=ranked(p,keys,r,preTags()),j=0;while(k>0&&j<L.length){if(!keys[keyOf(L[j])]){take(L[j]);k--}j++}return k}
  /* 2. one review item for all mastered patterns: the one checked longest ago */
  if(!opts.weakOnly&&mp.length&&chosen.length<n){
    var mo=mp.slice().sort(function(a,b){return(D.pat[a].rv||0)-(D.pat[b].rv||0)});
    for(var m=0;m<mo.length;m++){var before=chosen.length;fillPat(mo[m],1);if(chosen.length>before){rev.push(chosen[chosen.length-1]);break}}
  }
  /* 3. weak patterns: ~60% of the set (all of it in Weak spots), split by weakness */
  if(wp.length){
    var target=opts.weakOnly?n:Math.min(n,Math.round(n*(opts.weakShare||WEAK_SHARE)));
    var slots=Math.max(0,Math.min(n-chosen.length,target-cnt(wp)));
    var q=alloc(wp,slots,weakness),spare=0;
    wp.slice().sort(function(a,b){return weakness(b)-weakness(a)}).forEach(function(p){spare+=fillPat(p,q[p])});
    if(spare)rr(wp,Math.min(n,chosen.length+spare));
  }
  if(!opts.weakOnly){
    /* 4. learning and new patterns, least recently practised first */
    rr(shuffle(lp,r).sort(function(a,b){return(D.pat[a].last||0)-(D.pat[b].last||0)}),n);
    /* 5. not enough left: more weak, then mastered */
    if(wp.length)rr(wp,n);
    if(mp.length)rr(shuffle(mp,r),n);
  }
  var out=shuffle(chosen,r);buildSet.rev=rev;return out;
}
/* v5.6 daily focus: date-seeded, never yesterday's (nor the last 3 days' when there is a choice),
   preferring new, weak and least-mastered patterns; the new B1 patterns get a small push */
function focusScore(p){
  var st=patStatus(p),a=acc20(p),b1=PBY[p].b1?1:0;
  if(st==="new")return 3+b1;
  if(st==="weak")return 2.5+weakness(p)+0.5*b1;
  if(st==="learning")return 1.5+(a===null?0.5:(1-a)*3)+0.5*b1;
  return 0.2;
}
function todayFocus(t){
  t=t||today();
  if(D.flog[t]&&PBY[D.flog[t]]&&!isOut(D.flog[t])&&PTOTAL[D.flog[t]])return D.flog[t];
  var act=activePids().filter(function(p){return PTOTAL[p]});if(!act.length)return null;
  var y=D.flog[dayShift(t,-1)],recent=[1,2,3].map(function(k){return D.flog[dayShift(t,-k)]}).filter(Boolean);
  var c=act.filter(function(p){return recent.indexOf(p)<0});
  if(!c.length)c=act.filter(function(p){return p!==y});
  if(!c.length)c=act;
  var sc=c.map(function(p){return{p:p,w:focusScore(p)}}).sort(function(a,b){return(b.w-a.w)||(a.p<b.p?-1:1)});
  var top=sc.slice(0,4),r=rng(hashStr("norsk-focus|"+t)),x=r()*sum(top.map(function(o){return o.w})),pick=top[0].p;
  for(var i=0;i<top.length;i++){x-=top[i].w;if(x<=0){pick=top[i].p;break}}
  D.flog[t]=pick;
  var fk=Object.keys(D.flog).sort();if(fk.length>FLOG_KEEP)fk.slice(0,fk.length-FLOG_KEEP).forEach(function(k){delete D.flog[k]});
  return pick;
}
/* v5.6 lesson: missed sentences (max 4), ~half the focus pattern, at most 2 reviews from mastered patterns,
   the rest weak, learning and new patterns; sentences of 5 words or fewer only as a last resort */
function buildLesson(r,n,F){
  var chosen=[],keys={},rev=[];if(F&&isOut(F))F=null;
  function take(it){chosen.push(it.id);keys[keyOf(it)]=1}
  var ST={};PIDS.forEach(function(p){ST[p]=patStatus(p)});
  function preTags(){var o={};chosen.forEach(function(id){var g=byId(id).g;if(g)o[g]=(o[g]||0)+1});return o}
  function cands(p,easy){var L=ranked(p,keys,r,preTags());return easy?L:L.filter(function(i){return !isEasy(i)})}
  function fillPat(p,k,easy){var L=cands(p,easy),j=0;while(k>0&&j<L.length){if(!keys[keyOf(L[j])]){take(L[j]);k--}j++}return k}
  function rr(pids,limit,easy){
    var lists=pids.map(function(p){return cands(p,easy)}),idx=pids.map(function(){return 0}),guard=0;
    while(chosen.length<limit&&guard++<4000){
      var any=false;
      for(var k=0;k<lists.length&&chosen.length<limit;k++){
        while(idx[k]<lists[k].length&&keys[keyOf(lists[k][idx[k]])])idx[k]++;
        if(idx[k]<lists[k].length){take(lists[k][idx[k]++]);any=true}
      }
      if(!any)break;
    }
  }
  var mp=activePids().filter(function(p){return ST[p]==="mastered"&&p!==F});
  var mix=activePids().filter(function(p){return p!==F&&ST[p]!=="mastered"}).sort(function(a,b){
    var o={weak:0,learning:1,"new":2};return(o[ST[a]]-o[ST[b]])||(weakness(b)-weakness(a))||(a<b?-1:1)});
  /* 1. missed sentences, oldest first, max 2 per pattern, not from mastered patterns */
  var missed=shuffle(weakItems().filter(function(i){return(ST[i.t]!=="mastered"||i.t===F)&&(typedOk()||i.type!=="typed")}),r).sort(function(a,b){return D.items[a.id].last-D.items[b.id].last});
  var perPat={};
  missed.forEach(function(i){if(chosen.length>=4)return;if((perPat[i.t]||0)>=2)return;if(keys[keyOf(i)])return;perPat[i.t]=(perPat[i.t]||0)+1;take(i)});
  /* 2. the focus pattern: about half the lesson */
  var nF=Math.round(n*FOCUS_SHARE),have=chosen.filter(function(id){return byId(id).t===F}).length;
  if(F)fillPat(F,Math.max(0,nF-have));
  /* 3. review: up to 2 mastered patterns, the ones checked longest ago, one item each */
  var mo=mp.slice().sort(function(a,b){return(D.pat[a].rv||0)-(D.pat[b].rv||0)||(a<b?-1:1)});
  for(var m=0;m<mo.length&&rev.length<LESSON_REV&&chosen.length<n;m++){var before=chosen.length;fillPat(mo[m],1);if(chosen.length>before)rev.push(chosen[chosen.length-1])}
  /* 4. the mix: weak, then learning, then new patterns */
  rr(mix,n);
  /* 5. short (almost everything mastered): focus up to 3/4, then mastered patterns (B1 and least sure first), then the rest */
  function cntF(){return chosen.filter(function(id){return byId(id).t===F}).length}
  if(F)fillPat(F,Math.max(0,Math.min(n-chosen.length,Math.round(n*0.75)-cntF())));
  rr(mix,n,true);
  rr(mp.slice().sort(function(a,b){return((PBY[b].b1?1:0)-(PBY[a].b1?1:0))||((acc20(a)||0)-(acc20(b)||0))||(a<b?-1:1)}),n);
  if(F)fillPat(F,n-chosen.length);
  rr(F?[F].concat(mp):mp,n,true);
  buildLesson.rev=rev;return shuffle(chosen,r);
}
/* v5.6.1: today's lesson drops the not-yet-cleared items of checked-out patterns and refills from the rest (cleared items stay, so counts hold) */
function purgeLesson(){
  var L=D.lesson;if(!L||L.date!==today()||L.done||!Array.isArray(L.ids))return false;
  L.cleared=L.cleared||[];
  var bad=function(id){var it=byId(id);return it&&(drillOut(it)||(isOut(it.t)&&L.cleared.indexOf(id)<0))};
  var fOut=!!(L.focus&&isOut(L.focus)),nb=L.ids.filter(bad).length;
  if(!nb&&!fOut)return false;
  var target=L.ids.length;
  L.ids=L.ids.filter(function(id){return !bad(id)});
  L.cleared=L.cleared.filter(function(id){return L.ids.indexOf(id)>-1});
  L.rev=(L.rev||[]).filter(function(id){return L.ids.indexOf(id)>-1});
  if(fOut){delete D.flog[L.date];L.focus=todayFocus(L.date)}
  var keys={};L.ids.forEach(function(id){keys[keyOf(byId(id))]=1});
  var rc=rng(hashStr("norsk-refill|"+L.date+"|"+target+"|"+L.ids.length));var cand=composeSession(rc,LESSON_SIZE,function(nn){return buildLesson(rc,nn,L.focus)});
  for(var i=0;i<cand.length&&L.ids.length<target;i++){var it=byId(cand[i]);if(!keys[keyOf(it)]){L.ids.push(it.id);keys[keyOf(it)]=1}}
  save();return true;
}
/* v5.6.4 expressions. Family ids stay stable (e01, and e26 belongs to e05).
   Append a family; do not renumber one. A session is grammar, phrase, grammar, phrase.
   Progress is stored on the family, so a variant does not start a second score.
   A missed phrase comes back later in the session and stays under To practise until it is right.
   It does not move a grammar pattern's mastery or check-out. */
function exprFamOf(id){var it=EXBY[id];return it&&it.fam?it.fam:id}
function foldExpr(d){
  var src=d.expr&&typeof d.expr==="object"&&!Array.isArray(d.expr)?d.expr:{};
  var next={};
  Object.keys(src).forEach(function(k){
    var rec=src[k];if(!rec||typeof rec!=="object")return;
    var fam=k;
    if(typeof EXBY!=="undefined"&&EXBY[k])fam=EXBY[k].fam;
    else if(typeof EXPR==="undefined"||!EXPR.some(function(e){return e.fam===k}))return;
    var dest=next[fam]||{seen:0,right:0,wrong:0,last:0,cards:{}};
    dest.cards=dest.cards&&typeof dest.cards==="object"?dest.cards:{};
    if(rec.cards&&typeof rec.cards==="object")Object.keys(rec.cards).forEach(function(cid){dest.cards[cid]=(dest.cards[cid]||0)+(rec.cards[cid]||0)});
    else if(typeof EXBY!=="undefined"&&EXBY[k])dest.cards[k]=(dest.cards[k]||0)+(rec.seen||0);
    dest.seen=(dest.seen||0)+(rec.seen||0);
    dest.right=(dest.right||0)+(rec.right||0);
    dest.wrong=(dest.wrong||0)+(rec.wrong||0);
    dest.last=Math.max(dest.last||0,rec.last||0);
    dest.weakCards=dest.weakCards&&typeof dest.weakCards==="object"?dest.weakCards:{};
    if(rec.weakCards&&typeof rec.weakCards==="object")Object.keys(rec.weakCards).forEach(function(cid){if(rec.weakCards[cid])dest.weakCards[cid]=1});
    next[fam]=dest;
  });
  d.expr=next;
}
function exprStat(id){
  var fam=exprFamOf(id);
  if(!D.expr||typeof D.expr!=="object")D.expr={};
  var st=D.expr[fam];
  if(!st||typeof st!=="object")st=D.expr[fam]={seen:0,right:0,wrong:0,last:0,cards:{}};
  if(!st.cards||typeof st.cards!=="object")st.cards={};
  if(!st.weakCards||typeof st.weakCards!=="object")st.weakCards={};
  return st;
}
function weakExprList(){
  var out=[];
  if(!D.expr)return out;
  EXPR.forEach(function(e){var st=D.expr[e.fam];if(st&&st.weakCards&&st.weakCards[e.id])out.push(e)});
  return out;
}
function famSeen(fam){var st=D.expr&&D.expr[fam];return !!(st&&st.seen>0)}
function cardUses(id){var st=D.expr&&D.expr[exprFamOf(id)];return st&&st.cards&&st.cards[id]||0}
function shuffleExpr(a,rand){var b=a.slice();for(var i=b.length-1;i>0;i--){var j=Math.floor(rand()*(i+1));var t=b[i];b[i]=b[j];b[j]=t}return b}
function pickExprs(n,rand,avoid){
  rand=rand||Math.random;avoid=avoid||{};
  if(!EXPR.length||n<=0)return [];
  var introduced={};EXPR.forEach(function(e){if(famSeen(e.fam))introduced[e.fam]=1});
  var maxNew=Object.keys(introduced).length>=8?3:8;
  var byFam={};EXPR.forEach(function(e){(byFam[e.fam]||(byFam[e.fam]=[])).push(e)});
  function unseenFirst(list){
    var open=[],seen=[];
    list.forEach(function(e){if(avoid[e.id]||chosen.indexOf(e.id)>-1)return;(cardUses(e.id)?seen:open).push(e)});
    return shuffleExpr(open,rand).concat(shuffleExpr(seen,rand));
  }
  var chosen=[];
  function place(e){
    function okAt(i){
      var left=i>0?EXBY[chosen[i-1]]:null,right=i<chosen.length?EXBY[chosen[i]]:null;
      if(left&&(left.fam===e.fam||(left.cluster==="faa"&&e.cluster==="faa")))return false;
      if(right&&(right.fam===e.fam||(right.cluster==="faa"&&e.cluster==="faa")))return false;
      return true;
    }
    for(var i=chosen.length;i>=0;i--){if(okAt(i)){chosen.splice(i,0,e.id);return true}}
    return false;
  }
  function takeOne(fam){
    if(chosen.length>=n)return false;
    var left=unseenFirst(byFam[fam]||[]);
    for(var i=0;i<left.length;i++){if(place(left[i]))return true}
    return false;
  }
  var review=shuffleExpr(Object.keys(byFam).filter(function(f){return introduced[f]}),rand);
  var fresh=shuffleExpr(Object.keys(byFam).filter(function(f){return !introduced[f]}),rand);
  var targetNew=Math.min(maxNew,n),targetReview=n-targetNew,newN=0,reviewGot=0;
  for(var i=0;i<review.length&&reviewGot<targetReview&&chosen.length<n;i++){if(takeOne(review[i]))reviewGot++}
  var reviewShort=targetReview-reviewGot;
  for(var j=0;j<fresh.length&&newN<targetNew&&chosen.length<n;j++){if(takeOne(fresh[j]))newN++}
  var famsIn=[];chosen.forEach(function(id){var f=EXBY[id].fam;if(famsIn.indexOf(f)<0)famsIn.push(f)});
  famsIn=shuffleExpr(famsIn,rand);
  var guard=0,gap=reviewShort;
  while(chosen.length<n&&guard<famsIn.length*4){
    guard++;var progressed=false;
    for(var k=0;k<famsIn.length&&chosen.length<n;k++){
      var fam=famsIn[k],have=0;
      chosen.forEach(function(id){if(EXBY[id].fam===fam)have++});
      if(have>=2)continue;
      var isNew=!introduced[fam];
      if(isNew&&gap<=0)continue;
      if(takeOne(fam)){progressed=true;if(isNew)gap--}
    }
    if(!progressed)break;
  }
  return chosen.slice(0,n);
}
function zipIds(g,e){var o=[],i=0,j=0;while(i<g.length||j<e.length){if(i<g.length)o.push(g[i++]);if(j<e.length)o.push(e[j++])}return o}
function composeSession(rand,n,grammarFn){
  if(!EXPR.length)return grammarFn(n);
  var eN=Math.floor(n/2),gN=n-eN,g=grammarFn(gN),e=pickExprs(eN,rand),have={};
  g.forEach(function(id){have[id]=1});
  if(e.length<eN){var more=grammarFn(gN+(eN-e.length));more.forEach(function(id){if(g.length<gN+(eN-e.length)&&!have[id]){g.push(id);have[id]=1}})}
  return zipIds(g,e).slice(0,n);
}
function renderChunk(){renderOrder()}
function exprWords(it){
  var need={};
  function take(s){
    var c={};
    tileWords(s||"").forEach(function(w){c[w]=(c[w]||0)+1});
    Object.keys(c).forEach(function(w){if((need[w]||0)<c[w])need[w]=c[w]});
  }
  (it.ok||[]).concat(it.alt||[]).forEach(take);
  var words=[];
  Object.keys(need).forEach(function(w){for(var i=0;i<need[w];i++)words.push(w)});
  (it.x||[]).forEach(function(w){w=tileWord(String(w)).replace(/[.?!]+$/,"");if(w)words.push(w)});
  return words;
}
function flagBtn(){return '<button type="button" class="flag" id="flag" aria-label="Copy a flag for this card">\u2691</button>'}
function promptOf(it){if(it.type==="reply")return it.cue||"";if(it.type==="sense")return it.s||"";if(it.en)return it.en;if(it.prompt)return it.prompt;return it.s||""}
function answerOf(it){
  if(it.expr)return (it.ok||[]).join(" / ");
  if(it.type==="mc"||it.type==="sense")return (it.options||[])[0]||"";
  if(it.type==="fill")return it.ans||"";
  if(it.type==="typed")return (it.acc||[]).join(" / ");
  return fullText(it)||it.s||"";
}
function copyFlag(){
  var it=S&&S.cur;if(!it)return;
  var last=S.userText||"";
  if(!last&&D.items[it.id]&&D.items[it.id].lastWrong)last=D.items[it.id].lastWrong;
  var line="FLAG "+it.id+": "+promptOf(it)+" | answer: "+answerOf(it)+" | his last answer: "+last;
  function legacy(){var ta=document.createElement("textarea");ta.value=line;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.left="-9999px";document.body.appendChild(ta);ta.select();var ok=false;try{ok=document.execCommand("copy")}catch(e){}ta.remove();return ok}
  var done=function(){toast("Copied",1000)};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(line).then(done,function(){legacy()?done():toast("Copy failed",1000)});
  else if(!legacy())toast("Copy failed",1000);else done();
}
function markWrongTiles(sentence){
  var want=tileWords(sentence||"");
  document.querySelectorAll("#line .tile").forEach(function(el,i){if((el.textContent||"")!==(want[i]||""))el.classList.add("no")});
}
function renderExpr(it){
  var h=flagBtn()+'<div class="ins">Build the sentence</div>';
  if(it.type==="reply")h+='<p class="sent">'+esc(it.cue||"")+'</p>';
  else if(it.en)h+='<p class="en">'+esc(it.en)+'</p>';
  var words=exprWords(it).map(function(w,i){return {w:w,k:i}});
  S.state={bank:shuffle(words),line:[]};
  h+='<div class="lift" aria-hidden="true"></div><div class="line" id="line"></div><div class="bank" id="bank"></div><button class="btn sm" id="skip" style="margin-top:12px">Skip</button>';
  $("card").innerHTML=h;
  setAct("Check", false);
  renderOrder();
  $("card").scrollTop=0;
}
function answerExpr(ok,userText){
  S.answered=true;S.attempts++;
  var it=S.cur,st=exprStat(it.id),key=keyOf(it);
  st.seen++;st.last=Date.now();st.cards[it.id]=(st.cards[it.id]||0)+1;if(ok)st.right++;else st.wrong++;
  if(!st.weakCards||typeof st.weakCards!=="object")st.weakCards={};
  var fixedExpr=!!(ok&&st.weakCards[it.id]);
  if(ok)delete st.weakCards[it.id];else st.weakCards[it.id]=1;
  S.queue.shift();S.answers++;if(ok)S.correct++;
  var requeue=!ok&&(S.shown[key]||0)<2;
  if(requeue)S.queue.splice(Math.min(3,S.queue.length),0,it.id);
  else if(S.base[it.id]&&!S.baseDone[it.id]){S.baseDone[it.id]=1;S.done++;if(S.kind==="lesson"&&D.lesson&&D.lesson.cleared.indexOf(it.id)<0)D.lesson.cleared.push(it.id)}
  save();
  if(S.kind==="drill"){$("streak").textContent=S.correct+" / "+S.answers;if(S.round){$("bar").style.width=Math.round(S.done/Math.max(1,S.total)*100)+"%";$("m-left").textContent=S.done+" / "+S.total+" cleared"}}
  else{$("bar").style.width=Math.round(S.done/Math.max(1,S.total)*100)+"%";$("m-left").textContent=S.done+" / "+S.total+" cleared"}
  S.userText=userText||"";
  hitFx(fixedExpr?"fixmiss":ok?null:"wrongfx");
  var fb=$("fb");fb.className=ok?"ok":"no";
  var accepted=(it.ok&&it.ok.length)?it.ok:(it.choices||[]).filter(function(c){return c.ok}).map(function(c){return c.t});
  var shown=ok&&userText?userText:accepted.join(" / ");
  fb.innerHTML='<div class="h">'+(ok?"✓ Riktig!":"✗ Not quite")+'</div><div class="c">'+esc(shown)+'</div><div class="r">'+esc(it.why||"")+'</div>';
  var more=S.queue.length||S.endless;setAct(more?"Neste →":"Finish",true,ok?"pri":"warn");
  var sk=$("skip");if(sk)sk.style.display="none";
}

function ensureLesson(){
  var t=today();purgeLesson();
  if(D.lesson&&D.lesson.ids)D.lesson.ids=D.lesson.ids.filter(byId);
  var L=D.lesson,old=L&&L.date===t&&!L.focus&&!L.done&&!(L.cleared&&L.cleared.length); /* an untouched pre-5.6 lesson from today is rebuilt */
  if(!L||L.date!==t||!L.ids||!L.ids.length||old){
    var r=rng(hashStr("norsk-drill|"+t)),f=todayFocus(t),ids=composeSession(r,LESSON_SIZE,function(nn){return buildLesson(r,nn,f)});
    D.lesson={date:t,ids:ids,rev:buildLesson.rev.slice(),cleared:[],done:false,focus:f};save();
  }
  return D.lesson;
}

/* ---------- session engine ---------- */
var S=null,LAST={kind:"round",pids:PIDS};
function newS(kind,ids,total){
  return {kind:kind,queue:ids.slice(),total:total,done:0,base:{},baseDone:{},shown:{},injected:{},extra:{},focus:null,exprTurn:false,exprSeen:{},
    first:0,firstWrong:0,answers:0,correct:0,streak:0,best:0,masteredNow:[],missed:{},cnt:{},rev:{},focusTag:null,
    cur:null,state:null,answered:false,attempts:0,patsSel:[],endless:kind==="drill",lastType:"",lastPid:""};
}
function begin(){S.queue.forEach(function(id){S.base[id]=1});show("v-play");$("quit").textContent=S.kind==="drill"?"Stop":"✕";$("quit").classList.toggle("wide",S.kind==="drill");next()}
function startLesson(){
  if(lessonDoneToday()){startRound(PIDS);return}
  if(!activePids().length){toast("Everything is checked out. Bring a pattern back on B1 Progress.");return}
  var L=ensureLesson();
  var left=L.ids.filter(function(id){var it=byId(id);return L.cleared.indexOf(id)<0&&!(it&&drillOut(it))});
  if(!left.length&&L.cleared.length&&L.ids.some(function(id){return byId(id)&&isOut(byId(id).t)})){ /* the rest was checked out: the day is done */
    L.done=true;D.stats.days[L.date]=1;D.stats.done[L.date]=1;save();renderHome();toast("Today's lesson is done ✓");return}
  if(!left.length){L.ids=L.ids.filter(function(id){var it=byId(id);return !(it&&drillOut(it))});L.cleared=[];left=L.ids.slice()}
  if(!left.length){toast("Nothing to practise right now");return}
  S=newS("lesson",left,L.ids.length);S.done=L.ids.length-left.length;(L.rev||[]).forEach(function(id){S.rev[id]=1});LAST={kind:"lesson"};begin();
}
/* Just drill, "Mixed round" option: fixed 16 items, weak spots and missed sentences first */
function startRound(pids){
  var ids=composeSession(Math.random,SESSION_SIZE,function(nn){return buildSet(Math.random,nn,{pids:pids})});
  if(!ids.length){toast("Nothing to practise");return}
  S=newS("drill",ids,ids.length);buildSet.rev.forEach(function(id){S.rev[id]=1});S.endless=false;S.round=true;S.patsSel=pids.slice();LAST={kind:"round",pids:pids.slice()};begin();
}
/* v5.5.3: practise what's open: missed sentences + weak patterns first, then endless on those patterns */
function startWeak(){
  var phrases=weakExprList().map(function(e){return e.id});
  var gN=EXPR.length?6:12;var ids=buildSet(Math.random,gN,{weakOnly:true,weakShare:12,maxMissed:5});
  if(!ids.length)ids=weakItems().map(function(i){return i.id}).slice(0,gN); /* v5.5.6: never a dead tap while sentences are listed */
  if(!ids.length&&!phrases.length)return; /* all clear: a quiet no-op */
  if(EXPR.length&&ids.length)ids=zipIds(ids,pickExprs(Math.min(6,ids.length),Math.random));
  phrases.forEach(function(id){if(ids.indexOf(id)<0)ids.unshift(id)});
  var pats=[];weakPats().concat(ids.map(function(id){var it=byId(id);return it&&it.t})).forEach(function(p){if(p&&PBY[p]&&pats.indexOf(p)<0)pats.push(p)});
  S=newS("drill",ids,ids.length);S.practise=true;S.endless=pats.length>0;S.patsSel=pats;LAST={kind:"weak"};begin();
}
function startDrill(){
  var sel=D.set.drill.filter(function(p){return PBY[p]&&!isOut(p)});
  if(!sel.length){toast("Pick at least one pattern");return}
  if(D.set.round){startRound(sel);return}
  S=newS("drill",[],0);S.patsSel=sel;LAST={kind:"drill"};
  if(!genNext()){toast("No sentences available");S=null;return}
  begin();
}
function queueKeys(){var k={};S.queue.forEach(function(id){k[keyOf(byId(id))]=1});return k}
/* pick a fresh sentence of the pattern: not shown yet this session; second showing only as a fallback */
function pickFresh(pid,tag){
  var qk=queueKeys();
  var all=ITEMS.filter(function(i){return i.t===pid&&!drillOut(i)&&(typedOk()||i.type!=="typed")});
  /* possessives: same sub-pattern as the miss, otherwise a sub-pattern drawn by weakness */
  if(pid==="possessives"){
    var gs=PTAGS.map(function(t){return t.id}).filter(function(g){return all.some(function(i){return i.g===g&&!qk[keyOf(i)]&&(S.shown[keyOf(i)]||0)<2})});
    var g=tag&&gs.indexOf(tag)>-1?tag:null;
    if(!g&&gs.length){var tw=gs.map(tagWeak),tt=sum(tw),rr_=Math.random()*tt;g=gs[0];for(var k=0;k<gs.length;k++){rr_-=tw[k];if(rr_<=0){g=gs[k];break}}}
    if(g)all=all.filter(function(i){return i.g===g});
  }
  function pool(limit){return all.filter(function(i){var k=keyOf(i);return !qk[k]&&(S.shown[k]||0)<limit})}
  var p=pool(1);if(!p.length)p=pool(2);if(!p.length)return null;
  p=freshSort(shuffle(p));
  var top=p.slice(0,8),alt=top.filter(function(i){return i.type!==S.lastType});
  var pickFrom=alt.length?alt:top;
  return pickFrom[Math.floor(Math.random()*pickFrom.length)];
}
function genNext(){
  if(EXPR.length&&S.exprTurn){var avoid={};(S.queue||[]).forEach(function(id){avoid[id]=1});Object.keys(S.exprSeen||{}).forEach(function(id){avoid[id]=1});var ex=pickExprs(1,Math.random,avoid);S.exprTurn=false;if(ex.length){S.queue.push(ex[0]);S.exprSeen[ex[0]]=1;return true}}
  var pid;
  if(S.focus&&D.pat[S.focus].drill&&S.patsSel.indexOf(S.focus)>-1)pid=S.focus;
  else{
    /* v5.5: weight by the last 20 answers; mastered patterns come back rarely (0.1) */
    var ws=S.patsSel.map(function(p){var st=patStatus(p),a=acc20(p),w=st==="mastered"?0.1:1+(a===null?0.5:(1-a)*2)+(st==="weak"?1.5:0)+(st==="new"?0.5:0);if(p===S.lastPid&&S.patsSel.length>1)w*=0.5;return{p:p,w:Math.max(0.05,w)}});
    var tot=ws.reduce(function(s,x){return s+x.w},0),r=Math.random()*tot;pid=ws[0].p;
    for(var i=0;i<ws.length;i++){r-=ws[i].w;if(r<=0){pid=ws[i].p;break}}
  }
  var tg=pid===S.focus?S.focusTag:null,it=pickFresh(pid,tg);
  if(!it){ /* all sentences of this pattern used twice: start a new round */
    ITEMS.forEach(function(x){if(x.t===pid)S.shown[keyOf(x)]=0});it=pickFresh(pid,tg);
  }
  if(!it)return false;S.queue.push(it.id);S.exprTurn=!!EXPR.length;return true;
}
/* after a miss: fresh sentences of the same pattern until 3 right in a row on different sentences */
function maybeInject(){
  if(!S.focus)return;
  var P=D.pat[S.focus];
  if(!P.drill){S.focus=null;return}
  if(!S.endless&&(S.extra[S.focus]||0)>=EXTRA_CAP){S.focus=null;return}
  for(var i=0;i<Math.min(2,S.queue.length);i++){var q=byId(S.queue[i]);if(q.t===S.focus&&S.injected[q.id])return}
  var it=pickFresh(S.focus,S.focusTag);if(!it)return;
  S.queue.unshift(it.id);S.injected[it.id]=1;S.extra[S.focus]=(S.extra[S.focus]||0)+1;
}
function updateTop(){
  if(S.kind==="drill"){
    if(S.cur&&S.cur.expr){$("streak").textContent=S.correct+" / "+S.answers;if(S.round){$("bar").style.width=Math.round(S.done/Math.max(1,S.total)*100)+"%";$("m-left").textContent=S.done+" / "+S.total+" cleared"}else $("m-left").textContent="phrase";return}
    var P=S.cur?D.pat[S.cur.t]:null;
    $("streak").textContent=S.correct+" / "+S.answers;
    if(S.round){
      $("bar").style.width=Math.round(S.done/Math.max(1,S.total)*100)+"%";
      var ex2=0;Object.keys(S.extra).forEach(function(k){ex2+=S.extra[k]});
      $("m-left").textContent=S.done+" / "+S.total+" cleared"+(ex2?" · +"+ex2+" extra":"");
    }else{
      $("bar").style.width=P?Math.round(Math.min(P.run.length,NEED)/NEED*100)+"%":"0%";
      $("m-left").textContent=S.streak+" in a row";
    }
  }else{
    $("bar").style.width=Math.round(S.done/Math.max(1,S.total)*100)+"%";
    $("streak").textContent="";
    var ex=0;Object.keys(S.extra).forEach(function(k){ex+=S.extra[k]});
    $("m-left").textContent=S.done+" / "+S.total+" cleared"+(ex?" · +"+ex+" extra":"");
  }
}
function setAct(label,enabled,cls){var a=$("act");a.textContent=label;a.disabled=!enabled;a.className="btn "+(cls||"pri")}
function hitFx(kind){var h=document.documentElement;h.classList.remove("fixmiss","wrongfx");if(!kind)return;void h.offsetWidth;h.classList.add(kind)}
function missBg(on){document.documentElement.classList.toggle("miss",!!on)}
function next(){
  dropBasicQueue();
  if(S.endless&&!S.queue.length)genNext();
  dropBasicQueue();
  if(!S.queue.length)return finish();
  var it=byId(S.queue[0]);
  /* Every new card starts clean. Phrases used to return before this, so the previous result stayed on screen. */
  missBg(false);
  hitFx(null);
  S.userText="";
  var fb0=$("fb");if(fb0){fb0.className="";fb0.innerHTML=""}
  S.cur=it;S.answered=false;S.state={};
  var k=keyOf(it);S.shown[k]=(S.shown[k]||0)+1;
  if(it.expr){renderExpr(it);updateTop();return}
  updateTop();
  var P=D.pat[it.t],tags="";
  if(S.injected[it.id])tags+='<span class="tag t-ok">new sentence, same pattern</span> ';
  else if(S.shown[k]>1)tags+='<span class="tag t-no">second try</span> ';
  if(S.rev[it.id])tags+='<span class="tag t-rev">review</span> ';
  var h='<div class="tags"><span class="tag">'+esc(PBY[it.t].label)+(it.g&&PTAG_L[it.g]?' · '+esc(PTAG_L[it.g]):'')+'</span> '+tags+(P.drill?'<span class="dots" title="in a row on different sentences">'+dots(P.run.length)+'</span>':"")+'</div>'+flagBtn()+'<div class="ins">'+esc(typeLabel(it))+'</div>';
  if(it.en)h+='<p class="en">'+esc(it.en)+'</p>';
  var c=$("card");
  if(it.type==="order"){
    var tiles=shuffle(tileWords(it.s).concat((it.x||[]).map(tileX)).map(function(w,i){return{w:w,k:i}}));
    S.state={bank:tiles,line:[]};
    h+='<div class="lift" aria-hidden="true"></div><div class="line" id="line"></div><div class="bank" id="bank"></div>';
    c.innerHTML=h;renderOrder();setAct("Check",false);
  }else if(it.type==="mc"){
    var opts=shuffle(it.options.map(function(o,i){return{o:o,ok:i===0}}));S.state={opts:opts};
    if(it.prompt.indexOf("___")>-1)h+='<div class="sent">'+esc(it.prompt).replace("___",'<span class="slot" id="slot">&nbsp;</span>')+'</div>';
    h+='<div class="lift" aria-hidden="true"></div>'+opts.map(function(o,i){return'<button class="opt" data-i="'+i+'">'+esc(o.o)+'</button>'}).join("");
    c.innerHTML=h;setAct("Check",false);
  }else if(it.type==="sense"){
    var sopts=shuffle(it.options.map(function(o,i){return{o:o,ok:i===0}}));S.state={opts:sopts};
    h+='<div class="sent">'+markWord(it.s,it.word)+'</div><div class="lift" aria-hidden="true"></div>'+sopts.map(function(o,i){return'<button class="opt" data-i="'+i+'">'+esc(o.o)+'</button>'}).join("");
    c.innerHTML=h;setAct("Check",false);
  }else if(it.type==="gap"){
    var g=parseGap(it);S.state={g:g};
    h+='<div class="lift" aria-hidden="true"></div><div class="gaps">';
    g.words.forEach(function(w,i){var last=i===g.words.length-1;h+='<span class="w">'+esc(w)+'</span>'+(last?'<span style="white-space:nowrap">':'')+'<button class="gap" data-i="'+(i+1)+'" aria-label="gap after '+esc(w)+'">+</button>'+(last?'<span class="w">'+esc(g.punct)+'</span></span>':'')});
    h+='</div>';
    c.innerHTML=h;setAct("Check",false);
  }else if(it.type==="fill"){
    var chips=shuffle([it.ans].concat(it.wrong));S.state={chips:chips};
    h+='<div class="sent">'+esc(it.s).replace("___",'<span class="slot" id="slot">&nbsp;</span>')+'</div><div class="lift" aria-hidden="true"></div><div class="chips">'+chips.map(function(w,i){return'<button class="chip" data-i="'+i+'">'+esc(w)+'</button>'}).join("")+'</div>';
    c.innerHTML=h;setAct("Check",false);
  }else{
    h+='<div class="sent">'+esc(it.s).replace("___",'<span class="slot">&nbsp;&nbsp;&nbsp;&nbsp;</span>')+'</div><div class="lift" aria-hidden="true"></div><input class="typed" id="typed" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Type here…"><button class="btn sm" id="skip" style="margin-top:12px">Skip this one</button>';
    c.innerHTML=h;setAct("Check",false);
    var inp=$("typed");inp.addEventListener("input",function(){$("act").disabled=!inp.value.trim()});
    inp.addEventListener("keydown",function(e){if(e.key==="Enter"&&inp.value.trim()){e.preventDefault();onAct()}});
  }
  c.scrollTop=0;
}
function renderOrder(){
  var s_=S.state;
  $("line").innerHTML=s_.line.map(function(t,i){return'<button class="tile" data-l="'+i+'">'+esc(t.w)+'</button>'}).join("");
  $("bank").innerHTML=s_.bank.map(function(t,i){return'<button class="tile" data-b="'+i+'">'+esc(t.w)+'</button>'}).join("");
  $("act").disabled=s_.line.length<2;
}

/* record an answer: sentence stats, pattern run/mastery, requeue / fresh sentences */
function answer(ok,userText){
  if(S.answered)return;if(S.cur&&S.cur.expr){answerExpr(ok,userText);return}S.answered=true;S.attempts++;
  var it=S.cur,s=st(it.id),P=D.pat[it.t],key=keyOf(it);
  var firstTime=!S.missed[it.id]&&!S.cnt[it.id];
  S.cnt[it.id]=1;
  s.seen++;s.last=Date.now();
  S.queue.shift();S.answers++;S.lastType=it.type;S.lastPid=it.t;
  var st0=patStatus(it.t),isRev=!!S.rev[it.id]||st0==="mastered";
  P.n++;if(ok)P.ok++;P.hist.push(ok?1:0);if(P.hist.length>WIN)P.hist.shift();
  if(it.g&&D.tag[it.g]){var T=D.tag[it.g];T.n++;if(ok)T.ok++;T.hist.push(ok?1:0);if(T.hist.length>WIN)T.hist.shift()}
  P.last=Date.now();if(isRev)P.rv=Date.now();
  var demoted=false;
  if(!ok&&st0==="mastered"){P.hold=HOLD;demoted=true}else if(ok&&P.hold>0)P.hold--;
  var st1=patStatus(it.t);
  if(st1==="mastered"&&st0!=="mastered"&&S.masteredNow.indexOf(it.t)<0)S.masteredNow.push(it.t);
  var msg="",mastered=false;
  var fixed=!!(ok&&s.weak);
  if(ok){
    s.right++;s.streak++;s.weak=false;D.stats.total++;S.correct++;S.streak++;if(S.streak>S.best)S.best=S.streak;if(S.streak>D.stats.best)D.stats.best=S.streak;
    if(firstTime)S.first++;
    if(P.run.indexOf(key)<0)P.run.push(key);
    if(P.run.length>=NEED){mastered=true;P.mastered++;P.drill=false;P.run=[];if(S.focus===it.t){S.focus=null;S.focusTag=null}}
  }else{
    s.wrong++;s.streak=0;s.weak=true;s.lastWrong=userText||"";S.streak=0;S.missed[it.id]=(S.missed[it.id]||0)+1;
    if(firstTime)S.firstWrong++;
    P.drill=true;P.run=[];S.focus=it.t;S.focusTag=it.g||null;
  }
  /* queue management */
  var requeued=false;
  if(!ok&&(S.shown[key]||0)<2){requeued=true}
  maybeInject();
  if(requeued)S.queue.splice(Math.min(3,S.queue.length),0,it.id);
  if(!requeued&&S.base[it.id]&&!S.baseDone[it.id]){S.baseDone[it.id]=1;S.done++;if(S.kind==="lesson"&&D.lesson&&D.lesson.cleared.indexOf(it.id)<0)D.lesson.cleared.push(it.id)}
  if(ok){
    msg=st1==="mastered"&&st0!=="mastered"?"Pattern mastered: "+sum(P.hist)+" of your last "+P.hist.length+" right. It rests now and comes back as a short review.":mastered?"3 in a row on different sentences ✓":(P.drill?"Run: "+P.run.length+" / "+NEED+" on different sentences.":"");
  }else if(demoted)msg="Review missed. "+PBY[it.t].label+" goes back into rotation.";
  msg=esc(msg);
  if(ok)buzz(15);else buzz([70,40,70]);
  save();updateTop();
  S.userText=userText||"";
  hitFx(fixed?"fixmiss":ok?null:"wrongfx");
  var fb=$("fb");fb.className=ok?"ok":"no";
  var alsoTxt=ok&&S.hit?S.hit:null;S.hit=null;
  fb.innerHTML='<div class="h">'+(ok?"✓ Riktig!":"✗ Not quite")+'</div><div class="c">'+esc(alsoTxt||fullText(it))+'</div>'+(alsoTxt?'<div class="also">Also right: '+esc(fullText(it))+'</div>':'')+'<div class="r">'+esc(it.why||"")+'</div>'+(msg?'<div class="q">'+msg+'</div>':"");
  var more=S.queue.length||S.endless;
  setAct(more?"Neste →":"Finish",true,ok?"pri":"warn");
  var sk=$("skip");if(sk)sk.style.display="none";
  setTimeout(function(){fb.scrollIntoView&&fb.scrollIntoView({block:"nearest"})},30);
}
function onAct(){
  if(!S)return;
  if(S.answered){next();return}
  var it=S.cur;
  if(it.type==="chunk"||it.expr){
    var gotc=S.state.line.map(function(t){return t.w}).join(" ");
    var hitc=null;(it.ok||[]).concat(it.alt||[]).forEach(function(a){if(!hitc&&tileWords(a).join(" ")===gotc)hitc=a});
    document.querySelectorAll("#bank .tile,#line .tile").forEach(function(b){b.disabled=true});
    if(!hitc)markWrongTiles((it.ok&&it.ok[0])||"");
    answer(!!hitc,hitc||gotc);return;
  }
  if(it.type==="order"){
    var got=S.state.line.map(function(t){return t.w}).join(" ");
    /* v5.6.2: every grammatical order in it.alt counts; case, commas and the final mark never matter */
    var hit=null;[it.s].concat(it.alt||[]).forEach(function(a){if(!hit&&tileWords(a).join(" ")===got)hit=a});
    var ok=!!hit;S.hit=hit&&hit!==it.s?hit:null;if(ok)$("line").classList.add("ok");else markWrongTiles(it.s);
    document.querySelectorAll("#bank .tile,#line .tile").forEach(function(b){b.disabled=true});
    answer(ok,got);
  }else if(it.type==="typed"){
    var v=$("typed").value;var accepted=it.acc.map(norm);var ok2=accepted.indexOf(norm(v))>-1;
    $("typed").disabled=true;if(ok2)$("typed").style.borderColor="var(--ok)";else $("typed").style.color="var(--no)";
    answer(ok2,v.trim());
  }
}
$("act").addEventListener("click",onAct);
document.addEventListener("keydown",function(e){if(e.key==="Enter"&&S&&$("v-play").classList.contains("on")&&S.answered&&document.activeElement.tagName!=="INPUT"){e.preventDefault();onAct()}});
$("card").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b||!S)return;if(b.id==="flag"){copyFlag();return}if(S.answered)return;var it=S.cur;
  if(b.id==="skip"){
    if(it.expr){var est=exprStat(it.id);est.seen++;est.last=Date.now();est.cards[it.id]=(est.cards[it.id]||0)+1;S.queue.shift();if(S.base[it.id]&&!S.baseDone[it.id]){S.baseDone[it.id]=1;S.done++;if(S.kind==="lesson"&&D.lesson&&D.lesson.cleared.indexOf(it.id)<0)D.lesson.cleared.push(it.id)}S.answered=true;var fb=$("fb");fb.className="no";fb.innerHTML='<div class="h">Skipped</div><div class="c">'+esc((it.ok&&it.ok[0])||"")+'</div><div class="r">'+esc(it.why||"")+'</div>';setAct("Neste →",true,"warn");return}
    S.queue.shift();if(S.base[it.id]&&!S.baseDone[it.id]){S.baseDone[it.id]=1;S.total--}
    next();return;
  }
  if(it.type==="order"||it.type==="chunk"||it.type==="reply"){
    if(b.dataset.b!==undefined){var t=S.state.bank.splice(+b.dataset.b,1)[0];S.state.line.push(t);renderOrder()}
    else if(b.dataset.l!==undefined){var t2=S.state.line.splice(+b.dataset.l,1)[0];S.state.bank.push(t2);renderOrder()}
  }else if(it.type==="reply"&&b.dataset.i!==undefined){var ch=it.choices,ix=+b.dataset.i,rok=!!ch[ix].ok;document.querySelectorAll(".opt").forEach(function(x,k){x.disabled=true;if(ch[k].ok)x.classList.add("ok");else if(k===ix)x.classList.add("no")});answer(rok,ch[ix].t)}
  else if(it.type==="sense"&&b.dataset.i!==undefined){
    var sopts=S.state.opts,spick=sopts[+b.dataset.i];
    document.querySelectorAll(".opt").forEach(function(x,i){x.disabled=true;if(sopts[i].ok)x.classList.add("ok");else if(i===+b.dataset.i)x.classList.add("no")});
    answer(spick.ok,spick.o);
  }else if(it.type==="mc"&&b.dataset.i!==undefined){
    var opts=S.state.opts,pick=opts[+b.dataset.i],btns=document.querySelectorAll(".opt");
    btns.forEach(function(x,i){x.disabled=true;if(opts[i].ok)x.classList.add("ok");else if(i===+b.dataset.i)x.classList.add("no")});
    var sl=$("slot");if(sl){sl.textContent=pick.o;sl.classList.add(pick.ok?"ok":"no")}
    answer(pick.ok,it.prompt.indexOf("___")>-1?it.prompt.replace("___",pick.o):pick.o);
  }else if(it.type==="gap"&&b.dataset.i!==undefined){
    var at=+b.dataset.i,g=S.state.g,ok=at===g.at;
    document.querySelectorAll(".gap").forEach(function(x){x.disabled=true});
    var gaps=document.querySelectorAll(".gap");
    gaps[g.at-1].textContent=it.adv||"ikke";gaps[g.at-1].classList.add("ok");
    if(!ok){b.textContent=it.adv||"ikke";b.classList.add("no")}
    var w=g.words.slice();w.splice(at,0,it.adv||"ikke");
    answer(ok,w.join(" ")+g.punct);
  }else if(it.type==="fill"&&b.dataset.i!==undefined){
    var ch=S.state.chips,i=+b.dataset.i,ok3=ch[i]===it.ans;
    document.querySelectorAll(".chip").forEach(function(x,k){x.disabled=true;if(ch[k]===it.ans)x.classList.add("ok");else if(k===i)x.classList.add("no")});
    var sl2=$("slot");sl2.textContent=ch[i];sl2.classList.add(ok3?"ok":"no");
    answer(ok3,it.s.replace("___",ch[i]));
  }
});

function finish(){
  var kind=S.kind;
  if(kind==="drill"&&!S.attempts){S=null;renderHome();show("v-home");return}
  var n=S.first+S.firstWrong,acc=S.answers?Math.round(S.correct/S.answers*100):100;
  if(kind==="lesson"&&D.lesson){D.lesson.done=true;var ld=D.lesson.date||today();D.stats.days[ld]=1;D.stats.done[ld]=1} /* credit the lesson's own day (a lesson started before midnight no longer marks the next day done) */
  save();syncSoon("finish");
  var title,sub,emoji,stats,extra="";
  if(kind==="lesson"){
    emoji="✓";title="Day done";
    sub="Today's lesson is complete and saved. "+dayStreak()+(dayStreak()===1?" day":" days")+" in a row. Come back tomorrow for a new one, or keep going below.";
    stats='<div class="stat"><b>'+S.correct+' / '+S.answers+'</b><span>right this session</span></div><div class="stat"><b>'+tallyTxt()+'</b><span>right in total</span></div><div class="stat"><b>'+S.best+'</b><span>best run in a row</span></div><div class="stat"><b>'+Object.keys(S.missed).length+'</b><span>items missed</span></div>';
  }else if(kind==="drill"){
    emoji="✓";title=S.round?"Round finished":S.practise?"Practice done":"Drill finished";
    sub=S.answers+" answer"+(S.answers===1?"":"s")+".";
    stats='<div class="stat"><b>'+S.correct+' / '+S.answers+'</b><span>right this session</span></div><div class="stat"><b>'+tallyTxt()+'</b><span>right in total</span></div><div class="stat"><b>'+S.best+'</b><span>best run in a row</span></div><div class="stat"><b>'+S.masteredNow.length+'</b><span>patterns mastered</span></div>';
    if(S.masteredNow.length)extra='<div class="ptscard"><small>Mastered: '+S.masteredNow.map(function(p){return esc(PBY[p].label)}).join(", ")+'</small></div>';
  }else{
    emoji="✓";title=kind==="weak"?"Weak spots round done":"Session done";
    sub=S.total?"You cleared "+S.done+" items.":"Nothing was answered.";
    stats='<div class="stat"><b>'+S.correct+' / '+S.answers+'</b><span>right this session</span></div><div class="stat"><b>'+tallyTxt()+'</b><span>right in total</span></div><div class="stat"><b>'+Object.keys(S.missed).length+'</b><span>items missed</span></div><div class="stat"><b>'+S.masteredNow.length+'</b><span>patterns mastered</span></div>';
  }
  $("sum-emoji").textContent=emoji;$("sum-title").textContent=title;$("sum-sub").textContent=sub;$("sum-stats").innerHTML=stats;$("sum-extra").innerHTML=extra;
  var ids=Object.keys(S.missed);
  $("sum-miss").innerHTML=ids.length?'<h2>You missed</h2><div class="weaklist">'+ids.map(function(id){var it=byId(id);return'<div><b>'+esc(fullText(it))+'</b><small>'+esc(it.why||"")+'</small></div>'}).join("")+'</div>':'<p class="sub" style="text-align:center">No mistakes this round.</p>';
  $("sum-weak").disabled=!weakPats().length&&!weakItems().length;
  $("again").textContent=S.round?"Another round":S.practise?"Practise more":kind==="drill"?"Drill again":"Practise more";
  S=null;show("v-sum");
}

/* ---------- Just drill: pattern picker ---------- */
function renderDrill(){
  D.set.drill=D.set.drill.filter(function(p){return !isOut(p)});
  $("drill-list").innerHTML=activePids().map(function(p){return patCard(p,{check:true,sel:D.set.drill.indexOf(p)>-1})}).join("");
  $("drill-go").disabled=!D.set.drill.length;
  $("sw-round").classList.toggle("on",D.set.round);
  $("drill-go").textContent=D.set.round?"Start round (16)":"Start drilling";
}
function openDrill(){
  D.set.drill=D.set.drill.filter(function(p){return !isOut(p)});if(!D.set.drill.length&&activePids().length){var wp=weakPats();D.set.drill=wp.length?wp.slice():[activePids().sort(function(a,b){var x=patAcc(a),y=patAcc(b);return(x===null?-1:x)-(y===null?-1:y)})[0]]}
  renderDrill();show("v-drill");
}
$("go-drill").addEventListener("click",openDrill);
$("drill-back").addEventListener("click",function(){renderHome();show("v-home")});
$("drill-list").addEventListener("click",function(e){var b=e.target.closest(".pcard");if(!b)return;var p=b.dataset.p,i=D.set.drill.indexOf(p);if(i>-1)D.set.drill.splice(i,1);else D.set.drill.push(p);save();renderDrill()});
$("dr-weak").addEventListener("click",function(){var wp=weakPats();if(!wp.length){toast("No weak patterns right now");return}D.set.drill=wp.slice();save();renderDrill()});
$("dr-all").addEventListener("click",function(){D.set.drill=activePids();save();renderDrill()});
$("drill-go").addEventListener("click",startDrill);

/* ---------- export mistakes ---------- */
function exportText(){
  var w=weakItems(),all=ITEMS.filter(function(i){return D.items[i.id]&&D.items[i.id].wrong>0});
  all.sort(function(a,b){var x=D.items[a.id],y=D.items[b.id];return(y.weak-x.weak)||(y.wrong-x.wrong)});
  var L=["Norsk drill: my mistakes ("+today()+")","Weak patterns: "+(weakPats().map(function(p){return PBY[p].label}).join(", ")||"none")+" · sentences still wrong: "+w.length+" · ever missed: "+all.length,"Accuracy by pattern: "+PIDS.map(function(p){var a=patAcc(p);return PBY[p].label+" "+(a===null?"–":a+"%")}).join(" · "),""];
  if(!all.length)L.push("No mistakes logged yet.");
  all.slice(0,20).forEach(function(i,k){var s=D.items[i.id];
    L.push((k+1)+". ["+PBY[i.t].label+"] "+(s.weak?"STILL WRONG":"answered right since"));
    L.push("   Correct: "+fullText(i));
    if(s.lastWrong)L.push("   I wrote: "+s.lastWrong);
    L.push("   Why: "+(i.why||"")+" (missed "+s.wrong+"×)");
  });
  if(all.length>20)L.push("… and "+(all.length-20)+" more");
  return L.join("\n");
}
function doExport(){
  var t=exportText(),ta=$("modal-ta");ta.value=t;
  $("modal").classList.add("on");
  var done=function(){$("modal-note").textContent="Copied to clipboard ✓ Paste it to your tutor.";toast("Copied ✓")};
  var fail=function(){$("modal-note").textContent="Tap Copy, or long-press the text to select and copy it."};
  if(navigator.clipboard&&navigator.clipboard.writeText&&window.isSecureContext){navigator.clipboard.writeText(t).then(done,function(){legacy()?done():fail()})}
  else{legacy()?done():fail()}
  function legacy(){try{ta.focus();ta.select();ta.setSelectionRange(0,99999);return document.execCommand("copy")}catch(e){return false}}
}
function copyText(t,ta){
  function leg(){try{ta.focus();ta.select();ta.setSelectionRange(0,999999);return document.execCommand("copy")}catch(e){return false}}
  if(navigator.clipboard&&navigator.clipboard.writeText&&window.isSecureContext)return navigator.clipboard.writeText(t).then(function(){return true},function(){return leg()});
  return Promise.resolve(leg());
}
$("modal-copy").addEventListener("click",function(){var ta=$("modal-ta");copyText(ta.value,ta).then(function(ok){if(ok){toast("Copied ✓");$("modal-note").textContent="Copied to clipboard ✓ Paste it to your tutor."}else toast("Select the text and copy")})});
$("modal-close").addEventListener("click",function(){$("modal").classList.remove("on")});
$("modal").addEventListener("click",function(e){if(e.target===$("modal"))$("modal").classList.remove("on")});

/* ---------- backup code (includes all progress) ---------- */
function makeCode(){
  var items={};Object.keys(D.items).forEach(function(k){if(D.items[k].seen)items[k]=D.items[k]});
  var o={v:4,app:"norsk-drill",at:new Date().toISOString(),items:items,stats:D.stats,set:D.set,lesson:D.lesson,pat:D.pat,pts:D.pts,chk:D.chk,tag:D.tag,flog:D.flog,out:D.out,expr:D.expr};
  return "ND1:"+btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function readCode(txt){
  txt=String(txt||"").replace(/\s+/g,"");
  if(/^nd1:/i.test(txt))txt="ND1:"+txt.slice(4);
  if(txt.indexOf("ND1:")!==0)throw new Error("That doesn't look like a Norsk drill code (it should start with ND1:)");
  var o=JSON.parse(decodeURIComponent(escape(atob(txt.slice(4)))));
  if(!o||o.app!=="norsk-drill"||!o.items||typeof o.items!=="object"||!o.stats)throw new Error("The code is damaged or incomplete");
  return o;
}
function openBackup(mode){
  var ta=$("bk-ta");$("bk").classList.add("on");
  if(mode==="export"){
    $("bk-title").textContent="Export progress";ta.value=makeCode();ta.readOnly=true;
    $("bk-note").textContent="Copy this code and keep it somewhere safe (Notes, a message to yourself). It includes all your progress. Import it later to restore everything.";
    $("bk-do").style.display="none";$("bk-paste").style.display="none";$("bk-copy").style.display="";
    copyText(ta.value,ta).then(function(ok){if(ok){$("bk-note").textContent="Copied ✓ Paste it into Notes or a message to yourself. It includes all your progress.";toast("Code copied ✓")}});
  }else{
    $("bk-title").textContent="Import progress";ta.value="";ta.readOnly=false;
    $("bk-note").textContent="Paste a code that starts with ND1:, then tap Import. This replaces the progress on this device. Codes from the older version work too.";
    $("bk-do").style.display="";$("bk-paste").style.display="";$("bk-copy").style.display="none";
  }
}
$("bk-exp").addEventListener("click",function(){openBackup("export")});
$("bk-imp").addEventListener("click",function(){openBackup("import")});
$("bk-close").addEventListener("click",function(){$("bk").classList.remove("on")});
$("bk").addEventListener("click",function(e){if(e.target===$("bk"))$("bk").classList.remove("on")});
$("bk-copy").addEventListener("click",function(){var ta=$("bk-ta");copyText(ta.value,ta).then(function(ok){toast(ok?"Copied ✓":"Select the text and copy")})});
$("bk-paste").addEventListener("click",function(){
  if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(function(t){$("bk-ta").value=t},function(){toast("Long-press the box and choose Paste")})}
  else toast("Long-press the box and choose Paste");
});
$("bk-do").addEventListener("click",function(){
  var o;try{o=readCode($("bk-ta").value)}catch(e){toast(e.message||"Invalid code");return}
  var n=Object.keys(o.items).length;
  if(!confirm("Replace the progress on this device with this backup ("+n+" sentences, saved "+String(o.at||"").slice(0,10)+")?"))return;
  var theme=D.set.theme;
  var nd={items:o.items,stats:o.stats,set:o.set||{},lesson:o.lesson||null,pat:o.pat,pts:o.pts,chk:o.chk,tag:o.tag,flog:o.flog,out:o.out,expr:o.expr};
  nd.set.theme=theme;
  D=normalize(nd);if(!o.set||!o.set.drill)D.set.drill=[];
  save();$("bk").classList.remove("on");renderHome();toast("Progress imported ✓");
});


/* ---------- v5.6.3 sync: progress to a secret GitHub gist, so the tutor can read it ----------
   The token lives only in localStorage under its own key (never in D, the export code, the repo or the build).
   No token = nothing happens. Every failure is silent; the last error shows quietly in Settings only. */
var SYNC_KEY="norskdrill.sync",SY={busy:false,t:null,again:false,dirty:false};
function syncGet(){try{var o=JSON.parse(localStorage.getItem(SYNC_KEY)||"{}");return o&&typeof o==="object"?o:{}}catch(e){return{}}}
function syncSet(o){try{localStorage.setItem(SYNC_KEY,JSON.stringify(o))}catch(e){}}
function isoT(ms){return ms?new Date(ms).toISOString():null}
function syncSummary(){
  var L=D.lesson&&D.lesson.date===today()?D.lesson:null,c={mastered:0,learning:0,"to-practise":0,"new":0,"checked-out":0};
  var pats=PIDS.map(function(p){var P=D.pat[p],st=isOut(p)?"checked-out":patStatus(p);st=st==="weak"?"to-practise":st;c[st]++;
    return{id:p,label:PBY[p].label,status:st,last20:sum(P.hist)+"/"+P.hist.length,answered:P.n,right:P.ok,lastPractised:isoT(P.last)}});
  var miss=ITEMS.filter(function(i){var x=D.items[i.id];return x&&x.wrong>0}).sort(function(a,b){return D.items[b.id].last-D.items[a.id].last}).slice(0,15)
    .map(function(i){var x=D.items[i.id];return{id:i.id,pattern:i.t,answer:fullText(i),lastGiven:x.lastWrong||"",stillOpen:!!x.weak&&!isOut(i.t),right:x.right,wrong:x.wrong,lastSeen:isoT(x.last)}});
  var n=new Date();
  return{app:"norsk-drill",kind:"summary",version:VERSION,at:n.toISOString(),local:today()+" "+pad(n.getHours())+":"+pad(n.getMinutes()),
    lessonToday:L?{date:L.date,done:!!L.done,cleared:(L.cleared||[]).length,total:L.ids.length,focus:L.focus||null,focusLabel:L.focus&&PBY[L.focus]?PBY[L.focus].label:null}:null,
    streakDays:dayStreak(),tally:tally(),counts:c,toPractise:weakPats(),checkedOut:PIDS.filter(isOut),
    daysPractised:Object.keys(D.stats.days).sort().slice(-14),patterns:pats,recentMisses:miss};
}
function syncNow(why){
  var c=syncGet();if(!c.token||!window.fetch)return Promise.resolve(false);
  if(SY.busy){SY.again=true;return Promise.resolve(false)}
  SY.busy=true;var wasDirty=SY.dirty;SY.dirty=false;
  var create=!c.gist,body;
  try{var o={description:"Norsk drill progress (auto-sync)",files:{"norskdrill-summary.json":{content:JSON.stringify(syncSummary(),null,1)},"norskdrill-progress.txt":{content:makeCode()}}};
    if(create)o["public"]=false;body=JSON.stringify(o)}catch(e){SY.busy=false;SY.dirty=wasDirty;return Promise.resolve(false)}
  var opt={method:create?"POST":"PATCH",headers:{"Authorization":"Bearer "+c.token,"Accept":"application/vnd.github+json","Content-Type":"application/json"},body:body};
  if(why==="hidden"&&body.length<60000)opt.keepalive=true;
  return fetch("https://api.github.com/gists"+(create?"":"/"+c.gist),opt).then(function(r){
    if(r.status===404&&!create){var c3=syncGet();if(c3.gist===c.gist){delete c3.gist;syncSet(c3)}throw new Error("gist not found, a new one is made next time")}
    if(r.status===401)throw new Error("token not accepted (expired or wrong)");
    if(r.status===403)throw new Error("token lacks Gists read/write");
    if(!r.ok)throw new Error("GitHub said "+r.status);
    return r.json();
  }).then(function(j){
    var c2=syncGet();if(c2.token!==c.token)return false;
    if(create&&j&&j.id)c2.gist=j.id;c2.at=Date.now();c2.err="";syncSet(c2);return true;
  }).catch(function(e){
    SY.dirty=SY.dirty||wasDirty;var c2=syncGet();if(c2.token){c2.err=String(e&&e.message||e).slice(0,90);c2.errAt=Date.now();syncSet(c2)}return false;
  }).then(function(ok){
    SY.busy=false;try{paintSync()}catch(e){}
    if(SY.again){SY.again=false;syncSoon("again")}
    return ok;
  });
}
function syncSoon(why){if(!syncGet().token)return;clearTimeout(SY.t);SY.t=setTimeout(function(){syncNow(why)},3000)}
function paintSync(){
  var c=syncGet(),on=!!c.token;$("sync-off").style.display=on?"none":"";$("sync-on").style.display=on?"":"none";
  if(!on)return;
  var t=c.at?new Date(c.at):null,hm=t?pad(t.getHours())+":"+pad(t.getMinutes()):"";
  var when=!t?"Not synced yet":(today()===t.getFullYear()+"-"+pad(t.getMonth()+1)+"-"+pad(t.getDate())?"Synced "+hm:"Synced "+t.getDate()+" "+["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][t.getMonth()]+" "+hm);
  var h=esc(when)+(c.gist?' · gist <a href="https://gist.github.com/'+esc(c.gist)+'" target="_blank" rel="noopener">'+esc(c.gist)+'</a>':'');
  if(c.err&&(!c.at||(c.errAt||0)>c.at))h+='<br>Last try failed: '+esc(c.err);
  $("sync-st").innerHTML=h;
}
$("sync-save").addEventListener("click",function(){
  var v=String($("sync-tok").value||"").trim();
  if(!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(v)){toast("That doesn't look like a GitHub token");return}
  var c=syncGet();if(c.token!==v){c={token:v,gist:c.gist||""};if(!c.gist)delete c.gist}syncSet(c);$("sync-tok").value="";paintSync();toast("Sync on");
  syncNow("first").then(function(ok){toast(ok?"Synced ✓":"Saved. Sync will retry quietly.")});
});
$("sync-stop").addEventListener("click",function(){
  if(!confirm("Turn off sync on this device? The token is removed from this device. The gist stays on GitHub."))return;
  try{localStorage.removeItem(SYNC_KEY)}catch(e){}paintSync();toast("Sync off");
});
document.addEventListener("visibilitychange",function(){
  if(!syncGet().token)return;
  if(document.visibilityState==="hidden"){if(SY.dirty){clearTimeout(SY.t);syncNow("hidden")}}
  else{var c=syncGet();if(SY.dirty||!c.at||Date.now()-c.at>30*60000)syncSoon("visible")}
});

/* ---------- B1 checklist ---------- */
var CHECK=[
{g:"Verbs",items:[
 {id:"v-tenses",l:"Tenses: present, past, perfect",p:null},
 {id:"v-pluperf",l:"Past perfect (hadde + participle)",p:"etter-at-hadde"},
 {id:"v-strong",l:"Strong (irregular) verbs",p:null},
 {id:"v-modals",l:"Modal verbs + infinitive (kan, skal, vil, må)",p:"at-som-aa",part:1},
 {id:"v-future",l:"Future: skal, vil, kommer til å",p:"future"},
 {id:"v-passive",l:"Passive (blir + participle, -s)",p:"passive"},
 {id:"v-refl",l:"Reflexive verbs and s-verbs",p:null},
 {id:"v-particle",l:"Particle verbs (stå opp, gi opp, slå av …)",p:"particle-verbs"},
 {id:"v-imper",l:"Imperative (Kom inn! Ikke glem …!)",p:"v2-fronted-time",part:1},
 {id:"v-cond",l:"Conditional (hvis … ville / hadde)",p:"conditional"}]},
{g:"Sentence structure",items:[
 {id:"s-v2",l:"V2: verb in second place (fronted time, object, clause)",p:"v2-fronted-time"},
 {id:"s-sadv",l:"Sentence adverbs: ikke, aldri, nok, gjerne … placement",p:"sentence-adverbs"},
 {id:"s-sub-ikke",l:"Subordinate clauses: ikke after the subject",p:"ikke-bisetning"},
 {id:"s-sub-adv",l:"Subordinate clauses: conjunctions, hvem/hva som, adverbs",p:"adverbs-bisetning"},
 {id:"s-quest",l:"Questions: direct and indirect",p:"questions"},
 {id:"s-rel",l:"Relative clauses with som",p:"relative-som"},
 {id:"s-atsom",l:"at / som / å",p:"at-som-aa"},
 {id:"s-rep",l:"Reported speech",p:"reported-speech"},
 {id:"s-link",l:"Linking words (da, når, mens, fordi, selv om …)",p:"linking-words"},
 {id:"s-danaar",l:"Da vs når: den gang da, hver gang når",p:"da-naar"},
 {id:"s-conn",l:"derfor / likevel / ellers / dessuten + inversion",p:"connector-inversion"},
 {id:"s-subord",l:"selv om / fordi / mens / før / siden clauses",p:"subordinators"},
 {id:"s-jojo",l:"jo … jo (the more … the more)",p:"jo-jo"}]},
{g:"Nouns, pronouns, adjectives",items:[
 {id:"n-gender",l:"Gender and plurals",p:null},
 {id:"n-def",l:"Definite forms: den store bilen, denne, neste …",p:"definite-forms"},
 {id:"n-adj",l:"Adjective agreement",p:null},
 {id:"n-comp",l:"Comparison (-ere, -est, enn, like … som)",p:"comparison"},
 {id:"n-poss",l:"Possessives: min / sin / hans, bilen min vs min bil",p:"possessives"},
 {id:"n-man",l:"man / noen / noe / hverandre",p:null}]},
{g:"Small words",items:[
 {id:"w-prep",l:"Prepositions (+ å: glad i å, flink til å …)",p:"prep-aa",part:1},
 {id:"w-little",l:"Small words: altså, jo, vel, nok, heller, nemlig …",p:"small-words"},
 {id:"w-time",l:"Time expressions: i morges, i fjor, på mandag, om sommeren …",p:"time-expressions"},
 {id:"w-ord",l:"Ordinals and dates (første … trettiførste)",p:"ordinals"}]}];
var CHECK_IDS=[];CHECK.forEach(function(g){g.items.forEach(function(i){CHECK_IDS.push(i.id)})});
/* v5.6.1: B1 Progress is one list. Groups follow the home screen's words: To practise (= weak), Learning, New, Mastered.
   Each row has one bar: right answers in the last 20 (the tick marks 18, where a pattern is mastered). The old checklist ticks stay in D.chk (export/import) but are no longer shown. */
var PGROUPS=[["weak","To practise"],["learning","Learning"],["new","New"],["mastered","Mastered"],["out","Checked out"]];
function progRow(pid){
  var out=isOut(pid),st=patStatus(pid),h=D.pat[pid].hist.slice(-WIN),ok=sum(h),pct=Math.round(ok/WIN*100),nm=esc(PBY[pid].label);
  var pv=st==="new"&&!h.length?"new":st==="mastered"?"✓ "+ok+" / "+WIN:ok+" / "+WIN;
  return '<div class="prow st-'+st+(out?" out":"")+'" data-p="'+pid+'"><button class="pgo" aria-label="'+nm+', '+(out?"checked out":esc(STATUS_L[st])+', '+ok+' of the last '+WIN+' right. Tap to practise')+'."><span class="pt"><span class="pn">'+nm+'</span><span class="pv">'+pv+'</span></span><span class="pb"><i style="width:'+pct+'%"></i></span></button>'+
   '<button class="pout" aria-pressed="'+out+'" aria-label="'+(out?"Bring back "+nm:"Check out "+nm)+'"><span>'+(out?"✓":"")+'</span></button></div>';
}
function renderProgress(){
  var by={};PGROUPS.forEach(function(g){by[g[0]]=[]});
  PIDS.forEach(function(p){by[isOut(p)?"out":patStatus(p)].push(p)});
  by.weak.sort(function(x,y){return weakness(y)-weakness(x)});
  by.learning.sort(function(x,y){return sum(D.pat[y].hist.slice(-WIN))-sum(D.pat[x].hist.slice(-WIN))});
  var dn=doneCount(),top=dn.out?dn.n+' of '+PIDS.length+' patterns done':dn.m+' of '+PIDS.length+' patterns mastered';
  $("pat-sum").innerHTML='<b class="l">'+top+'</b>'+(dn.out?'<small class="pdn">'+dn.m+' mastered · '+dn.out+' checked out</small>':'')+'<div class="lvbar"><i style="width:'+Math.round(dn.n/PIDS.length*100)+'%"></i></div><small>Each bar is your last '+WIN+' answers. '+MAST_OK+' right = mastered. Tap a pattern to practise it. Tick the box when you know it well: it stops coming up.</small>';
  var h="";
  PGROUPS.forEach(function(g){var l=by[g[0]];if(!l.length)return;h+='<h2 class="pgrp">'+g[1]+'<span>'+l.length+'</span></h2>'+l.map(progRow).join("")});
  $("patterns").innerHTML=h;
  var nd=[];CHECK.forEach(function(g){g.items.forEach(function(i){if(!i.p)nd.push(i.l)})});
  $("pat-more").textContent=nd.length?"Not in the drills yet: "+nd.join(" · ")+".":"";
}
function toggleOut(pid){if(!PBY[pid])return;if(D.out[pid])delete D.out[pid];else D.out[pid]=true;D.set.drill=D.set.drill.filter(function(p){return !isOut(p)});purgeLesson();save()}
$("go-check").addEventListener("click",function(){renderProgress();show("v-check");var sc=document.querySelector("#v-check .scroll");if(sc)sc.scrollTop=0});
$("sw-round").addEventListener("click",function(){D.set.round=!D.set.round;save();var y=window.scrollY;renderDrill();window.scrollTo(0,y)});
$("chk-back").addEventListener("click",function(){renderHome();show("v-home")});

/* ---------- wiring ---------- */
$("sw-typed").addEventListener("click",function(){D.set.typed=!D.set.typed;save();renderHome()});
$("go-set").addEventListener("click",function(){renderHome();paintSync();show("v-set")});
$("set-back").addEventListener("click",function(){renderHome();show("v-home")});
/* B1 Progress > Patterns: tap a card to start Just drill on that pattern */
$("patterns").addEventListener("click",function(e){var c=e.target.closest(".prow");if(!c||!PBY[c.dataset.p])return;var p=c.dataset.p;
  if(e.target.closest(".pout")){var sc=document.querySelector("#v-check .scroll"),y=sc?sc.scrollTop:0;toggleOut(p);renderProgress();if(sc)sc.scrollTop=y;toast(isOut(p)?"Checked out: "+PBY[p].label:"Back in practice: "+PBY[p].label);return}
  if(isOut(p)){toast("Checked out. Tap the box to bring it back.");return}
  D.set.drill=[p];save();startDrill()});
$("go-day").addEventListener("click",startLesson);
$("go-weak").addEventListener("click",startWeak);
$("go-weak-h").addEventListener("click",startWeak);
$("weaklist").addEventListener("click",startWeak);
$("again").addEventListener("click",function(){var k=LAST.kind;if(k==="drill")startDrill();else if(k==="round")startRound(LAST.pids);else if(k==="weak"&&(weakPats().length||weakItems().length))startWeak();else startRound(PIDS)});
$("sum-weak").addEventListener("click",startWeak);
$("sum-home").addEventListener("click",function(){renderHome();show("v-home")});
$("exp").addEventListener("click",doExport);$("sum-exp").addEventListener("click",doExport);
$("quit").addEventListener("click",function(){
  if(!S)return;
  if(S.kind==="drill"){finish();return}
  if(S.attempts>0&&!confirm("End this session? Your progress so far is saved."))return;
  S=null;renderHome();show("v-home");
});
$("reset").addEventListener("click",function(){if(confirm("Erase all progress and weak spots on this device?")){var th=D.set.theme;D=normalize({set:{theme:th}});save();renderHome();toast("Progress reset")}});
$("theme").addEventListener("click",function(){var r=document.documentElement,cur=r.getAttribute("data-theme");
  var dark=cur?cur==="dark":!window.matchMedia("(prefers-color-scheme: light)").matches;var nt=dark?"light":"dark";r.setAttribute("data-theme",nt);D.set.theme=nt;save();paintChrome();themeLabel()});
/* v5.5f: the footer link names the mode you would switch to */
function isDark(){var cur=document.documentElement.getAttribute("data-theme");return cur?cur==="dark":!window.matchMedia("(prefers-color-scheme: light)").matches}
function themeLabel(){var d=isDark(),b=$("theme");b.textContent=d?"Day mode":"Night mode";b.setAttribute("aria-label",d?"Switch to day mode":"Switch to night mode")}
if(D.set.theme)document.documentElement.setAttribute("data-theme",D.set.theme);
paintChrome();themeLabel();
try{window.matchMedia("(prefers-color-scheme: light)").addEventListener("change",function(){paintChrome();themeLabel()})}catch(e){}

S=null;
/* keep the bottom buttons clear of the host's floating badge (it can be closed with ×) */
function hostBadge(){var x=document.querySelector("ship-page-badge"),on=false;if(x){var r=x.getBoundingClientRect();on=r.height>0&&getComputedStyle(x).display!=="none"}document.documentElement.classList.toggle("hb",on)}
hostBadge();
try{new MutationObserver(hostBadge).observe(document.body,{childList:true});new MutationObserver(hostBadge).observe(document.documentElement,{childList:true})}catch(e){}
$("ver").textContent="Norsk drill v"+VERSION+(VERSION_NOTE?" "+VERSION_NOTE:"")+" · "+VERSION_DATE;
window.__nd={VERSION:VERSION,ITEMS:ITEMS,PATTERNS:PATTERNS,cur:function(){return S&&S.cur},state:function(){return S&&S.state},S:function(){return S},D:function(){return D},exportText:exportText,makeCode:makeCode,fullText:fullText,missBg:missBg,tileWords:tileWords,tileX:tileX,keyOf:keyOf,ensureLesson:ensureLesson,todayFocus:function(t){return todayFocus(t)},buildLesson:function(t,f){t=t||today();f=f||todayFocus(t);var r=rng(hashStr("norsk-drill|"+t));return{ids:composeSession(r,LESSON_SIZE,function(nn){return buildLesson(r,nn,f)}),rev:buildLesson.rev,focus:f}},patStatusAll:function(){var o={};PIDS.forEach(function(p){o[p]=patStatus(p)});return o},isEasy:isEasy,LESSON_SIZE:LESSON_SIZE,tally:tally,tallyTxt:tallyTxt,tagIsWeak:tagIsWeak,patStatus:patStatus,buildSet:function(n,o){return {ids:buildSet(Math.random,n||SESSION_SIZE,o),rev:buildSet.rev}},readCode:readCode,genNext:function(){return genNext()},reload:function(){D=load();renderHome()},syncSummary:syncSummary,syncNow:syncNow,syncGet:syncGet,isOut:isOut,activePids:activePids,toggleOut:function(p){toggleOut(p);renderHome()},purgeLesson:purgeLesson,weakItems:function(){return weakItems().map(function(i){return i.id})},weakPats:weakPats,CHECK:CHECK,CHECK_IDS:CHECK_IDS,basicPoss:basicPoss,basicInf:basicInf,drillOut:drillOut,weakExprList:function(){return weakExprList().map(function(e){return e.id})},EXPR:EXPR,pickExprs:pickExprs,composeSession:composeSession};
if(location.protocol==="file:")$("filewarn").style.display="block";
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
(function(){var ok=false;try{localStorage.setItem("nd.probe","1");ok=localStorage.getItem("nd.probe")==="1";localStorage.removeItem("nd.probe")}catch(e){}SV.ok=ok;SV.t=Date.now()})();
save();   /* writes the migrated v2 data back (the v1 copy stays under norskdrill.v1.v1backup) */
renderHome();
try{if(syncGet().token)syncSoon("open")}catch(e){}
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){navigator.serviceWorker.register("sw.js").catch(function(){})}
}

CardParse.load().then(startApp).catch(function(){var w=document.getElementById('filewarn');if(w)w.style.display='block'});
