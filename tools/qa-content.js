/* Content checks for served drills and phrases. Exit 1 on any failure.
   node tools/qa-content.js
*/
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app.js"), "utf8");
const { parseAll } = require(path.join(root, "cards.js"));
const dir = path.join(root, "cards");
const names = fs.readFileSync(path.join(dir, "index.txt"), "utf8").split(/\n/).map(s => s.trim()).filter(s => s && s[0] !== "#");
let parsed;
try {
  parsed = parseAll(names.map(name => ({ name, body: fs.readFileSync(path.join(dir, name), "utf8") })));
} catch (err) {
  console.log("FAIL parse: " + err.message);
  process.exit(1);
}
const ITEMS = parsed.items;
const EXPR = parsed.expr;

function tileWord(w) {
  return String(w).toLocaleLowerCase("nb").replace(/[,;:]/g, "");
}
function tileWords(s) {
  const w = String(s || "").split(" ").map(tileWord);
  if (w.length) w[w.length - 1] = w[w.length - 1].replace(/[.?!]+$/, "");
  return w.filter(Boolean);
}
function tileX(x) {
  return tileWord(x).replace(/[.?!]+$/, "");
}
function count(list) {
  const c = {};
  list.forEach(w => { c[w] = (c[w] || 0) + 1; });
  return c;
}
function covers(bank, sentence) {
  const need = count(tileWords(sentence));
  const have = count(bank);
  return Object.keys(need).every(w => (have[w] || 0) >= need[w]);
}
function exprBank(it) {
  const need = {};
  (it.ok || []).concat(it.alt || []).forEach(s => {
    const c = count(tileWords(s));
    Object.keys(c).forEach(w => { if ((need[w] || 0) < c[w]) need[w] = c[w]; });
  });
  const words = [];
  Object.keys(need).forEach(w => { for (let i = 0; i < need[w]; i++) words.push(w); });
  (it.x || []).forEach(w => { const t = tileX(w); if (t) words.push(t); });
  return words;
}
function orderBank(it) {
  return tileWords(it.s || "").concat((it.x || []).map(tileX).filter(Boolean));
}

function basicPoss(it) {
  if (!it || it.t !== "possessives" || it.g !== "agreement") return false;
  const why = it.why || "";
  if (/\bdere\b/.test(why) && /\bderes\b/.test(why)) return false;
  return true;
}
function basicInf(it) {
  if (!it || it.expr) return false;
  const why = it.why || "";
  if (why.indexOf("After a preposition the verb comes as å + infinitive") >= 0) return true;
  if (why.indexOf("After å the verb is always the infinitive") >= 0) return true;
  if (why.indexOf("å goes in front of an infinitive, when there is no new subject") >= 0) return true;
  if (why.indexOf("the infinitive comes without å") >= 0) return true;
  if (why.indexOf("adjective + å + infinitive") >= 0) return true;
  if (why.indexOf("viktig + å + infinitive") >= 0) return true;
  if (why === "bestemme seg for å + infinitive.") return true;
  if (why === "tid til å + infinitive.") return true;
  if (why.indexOf("i stedet for + å + infinitive") >= 0) return true;
  return false;
}
function excluded(it) { return basicPoss(it) || basicInf(it); }

const FEM = ["døra","boka","jenta","dama","kua","sola","natta","hytta","klokka","jorda","uka","tida","kona","mora","jakka","veska","senga","lua","gata","øya","elva","nøkla","bua","stua","grensa","lomma","handa","trappa","søstra","dattera","hytta"];
const femRe = new RegExp("(?<![A-Za-zÆØÅæøå])(" + FEM.join("|") + ")(?![A-Za-zÆØÅæøå])", "i");
const eiRe = /(?<![A-Za-zÆØÅæøå])ei(?![A-Za-zÆØÅæøå])/i;

function stringsOf(o, out) {
  if (typeof o === "string") out.push(o);
  else if (Array.isArray(o)) o.forEach(x => stringsOf(x, out));
  else if (o && typeof o === "object") Object.keys(o).forEach(k => { if (k !== "en" && k !== "why") stringsOf(o[k], out); });
  return out;
}

const fails = [];
function bad(id, msg) { fails.push(id + ": " + msg); }

const ids = new Set();
ITEMS.forEach(it => {
  if (ids.has(it.id)) bad(it.id, "duplicate id");
  ids.add(it.id);
});
EXPR.forEach(it => {
  if (ids.has(it.id)) bad(it.id, "duplicate id");
  ids.add(it.id);
});

/* v5.8.2 file hygiene: no trailing whitespace, sequence rows unique and on a known pattern. */
const PAT_IDS = new Set((parsed.patterns || []).map(p => p.id));
names.concat(["README.md"]).forEach(name => {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return;
  const hits = [];
  fs.readFileSync(file, "utf8").split("\n").forEach((l, i) => { if (/[ \t]+\r?$/.test(l)) hits.push(i + 1); });
  if (hits.length) bad(name, "trailing whitespace on " + hits.length + " line(s), first at line " + hits[0] + " (fix: sed -i 's/[ \\t]*$//' cards/*.txt)");
});
const seqSeen = new Set();
fs.readFileSync(path.join(dir, "sequence.txt"), "utf8").split("\n").forEach(l => {
  const t = l.trim();
  if (!t || t[0] === "#") return;
  const id = t.split("|")[0].trim();
  if (seqSeen.has(id)) bad(id, "listed twice in sequence.txt");
  seqSeen.add(id);
});
ITEMS.forEach(it => { if (!PAT_IDS.has(it.t)) bad(it.id, "unknown pattern " + it.t); });

/* The same exercise twice: same card type and the same full sentence. */
function sameKey(it) {
  const n = s => String(s || "").toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
  if (it.type === "order") return "order|" + n(it.s);
  if (it.type === "fill") return "fill|" + n(it.s) + "|" + n(it.ans);
  if (it.type === "mc") return "mc|" + n(it.prompt) + "|" + n((it.options || [])[0]);
  if (it.type === "sense") return "sense|" + n(it.s) + "|" + n(it.word);
  if (it.type === "gap") return "gap|" + n(it.s) + "|" + n(it.adv);
  if (it.type === "typed") return "typed|" + n(it.s);
  return "";
}
const sameSeen = {};
ITEMS.forEach(it => {
  const k = sameKey(it);
  if (!k) return;
  if (sameSeen[k]) bad(it.id, "same exercise as " + sameSeen[k]);
  else sameSeen[k] = it.id;
});
EXPR.forEach(e => {
  const k = "expr|" + e.type + "|" + String(e.cue || "") + "|" + (e.ok || []).join("//").toLowerCase();
  if (sameSeen[k]) bad(e.id, "same phrase card as " + sameSeen[k]);
  else sameSeen[k] = e.id;
});

/* The service worker must precache every file the page loads. */
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const shellM = sw.match(/const SHELL = (\[[^\]]*\])/);
const SHELL = shellM ? [...shellM[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
if (!shellM) bad("sw.js", "SHELL list not found");
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
const loaded = [...page.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => m[1]).filter(f => !/^https?:/.test(f));
loaded.concat(["index.html", "manifest.webmanifest", "cards/index.txt"], names.map(n => "cards/" + n)).forEach(f => {
  if (SHELL.indexOf(f) < 0) bad("sw.js", "SHELL is missing " + f);
});
SHELL.forEach(f => { if (f !== "./" && !fs.existsSync(path.join(root, f))) bad("sw.js", "SHELL lists a missing file " + f); });
try {
  JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8")).icons.forEach(ic => { if (SHELL.indexOf(ic.src) < 0) bad("sw.js", "SHELL is missing " + ic.src); });
} catch (err) { bad("manifest.webmanifest", "does not parse: " + err.message); }

/* The version shown in the app matches the VERSION file. */
const appVer = (html.match(/var VERSION="([^"]+)"/) || [])[1];
const fileVer = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
if (appVer !== fileVer) bad("VERSION", "app.js says " + appVer + ", VERSION file says " + fileVer);

const served = ITEMS.filter(it => !excluded(it));
served.forEach(it => {
  if (excluded(it)) bad(it.id, "served item is on an exclusion list");
  const blob = stringsOf(it, []).join(" \n ");
  if (eiRe.test(" " + blob + " ") || femRe.test(blob)) bad(it.id, "feminine form");
  if (it.type === "order") {
    const bank = orderBank(it);
    if (!bank.length || !(it.s || "").trim()) bad(it.id, "empty bank or prompt");
    [it.s].concat(it.alt || []).forEach(s => { if (!covers(bank, s)) bad(it.id, "cannot build: " + s); });
  } else if (it.type === "fill") {
    const opts = [it.ans].concat(it.wrong || []);
    if (!it.s || !String(it.ans || "").trim()) bad(it.id, "empty prompt or answer");
    if (new Set(opts).size !== opts.length) bad(it.id, "duplicate options");
    if ((it.wrong || []).indexOf(it.ans) >= 0) bad(it.id, "correct option also listed as wrong");
    agree(it.id, it.s, it.ans, it.wrong || []);
  } else if (it.type === "sense") {
    const opts = it.options || [];
    if (opts.length !== 3) bad(it.id, "sense card needs 3 options");
    if (new Set(opts.map(o => String(o).trim())).size !== opts.length) bad(it.id, "duplicate options");
    if (!String(opts[0] || "").trim()) bad(it.id, "empty correct option");
    if (!(it.s || "").trim() || !(it.word || "").trim()) bad(it.id, "missing sentence or target");
    if (String(it.s).indexOf(it.word) < 0) bad(it.id, "target not in sentence");
    opts.forEach(o => {
      if (/\b(the|very|and|with|that|this|hungry|tired|cold|hot|wet|dry|busy|possible|mean)\b/i.test(o)) bad(it.id, "option is not Norwegian: " + o);
    });
  } else if (it.type === "mc") {
    const opts = it.options || [];
    if (!opts.length || !(it.prompt || it.en)) bad(it.id, "empty prompt or options");
    if (new Set(opts).size !== opts.length) bad(it.id, "duplicate options");
    agree(it.id, (it.prompt || "") + " " + (it.en || ""), opts[0], opts.slice(1));
  } else if (it.type === "gap" || it.type === "typed") {
    if (!(it.s || it.prompt || "").trim()) bad(it.id, "empty prompt");
  }
});

EXPR.forEach(it => {
  const blob = stringsOf(it, []).join(" \n ");
  if (eiRe.test(" " + blob + " ") || femRe.test(blob)) bad(it.id, "feminine form");
  const bank = exprBank(it);
  const answers = (it.ok || []).concat(it.alt || []);
  if (!bank.length || !answers.length) bad(it.id, "empty bank or answer");
  if (it.type === "reply" && !(it.cue || "").trim()) bad(it.id, "empty prompt");
  if (it.type !== "reply" && !(it.en || "").trim()) bad(it.id, "empty prompt");
  answers.forEach(s => { if (!covers(bank, s)) bad(it.id, "cannot build: " + s); });
});

function agree(id, prompt, ans, wrong) {
  const p = String(prompt || "");
  const a = String(ans || "").trim();
  const m = a.match(/^(en|et)\s+(\S+)/i);
  if (!m) return;
  const noun = m[2].replace(/[.,!?;:]/g, "").toLowerCase();
  const definite = wrong.some(w => {
    const t = String(w).trim().toLowerCase();
    return t === noun + "en" || t === noun + "et" || t === "den " + noun || t === "det " + noun;
  });
  const wantsDefinite = /\bthe\b/i.test(p) && !/\b(en|et)\b/.test(p.split("→")[0] || "");
  const wantsArticle = /→/.test(p) || /\b(en or et|gender)\b/i.test(p);
  if (definite && wantsDefinite && !wantsArticle) bad(id, "definite form marked wrong while the prompt is definite");
}

/* v5.8.1: no Portuguese anywhere in the cards or patterns (the Portuguese bridge was deleted). */
const ptRe = /[ãõçÃÕÇ]|portugu|\bpt-bridge\b|\b(sem|pôr|ficar|qualidade|música)\b/i;
ITEMS.forEach(it => { if (it.t === "pt-bridge" || stringsOf(it, []).concat([it.why || "", it.en || ""]).some(x => ptRe.test(x))) bad(it.id, "Portuguese in a card"); });
EXPR.forEach(e => { if (stringsOf(e, []).concat([e.why || "", e.en || ""]).some(x => ptRe.test(String(x)))) bad(e.id, "Portuguese in a phrase card"); });
(parsed.patterns || []).forEach(p => { if (ptRe.test(p.id + " " + p.label + " " + (p.hint || ""))) bad(p.id, "Portuguese pattern"); });

/* English pronouns, negation and numbers must show up in the Norwegian answer. */
const FN = "in|on|at|to|for|from|with|about|into|over|after|before|of|the|a|an|and|or|but|if|when|that|this|it|him|me|us|them|you|again|too|also|here|there|now|then|today|yesterday|tomorrow|still|just|even|not|so|as|by|up|out|off|away|next|time|well";
const PRON = {
  i: [/\b(i|me|i'm|i've|i'll|i'd)\b/i, /\b(jeg|meg)\b/i],
  we: [/\b(we|us|we're|we'll|let's)\b/i, /\b(vi|oss)\b/i],
  you: [/\byou('re|'ll|'ve)?\b/i, /\b(du|deg|dere|man)\b/i],
  he: [/\b(he|him|he's)\b/i, /\b(han|ham)\b/i],
  she: [new RegExp("\\b(she|she's)\\b|\\bher\\b(?=\\s*(?:$|[.,!?;:]|(?:" + FN + ")\\b))", "i"), /\b(hun|henne)\b/i],
  they: [/\b(they|them|they're)\b/i, /\bdem\b|\bde\b(?!\s+(?:\d+|tre|to|fire|fem|seks|sju|syv|åtte|ni|ti|en|et|nye|andre|gamle|små|store|første|samme|fleste|neste|siste|unge|eldre)\b)/i]
};
const ALLOW = { e74: 1, e133: 1, e133b: 1 };
const NEG_EN = /\b(not|never|no|nobody|nothing|cannot)\b|n't\b/i;
const NEG_NO = /\b(ikke|aldri|ingen|ingenting|slipper)\b|\bla være\b/i;
function englishNeg(s) {
  const t = s.replace(/,?\s*(?:isn't it|aren't you|don't you|won't you|haven't you|hasn't she|hasn't he)\b[^?]*\??/ig, "");
  if (/\bnever mind\b/i.test(t)) return false;
  return NEG_EN.test(t);
}
const NUM = { two: ["to"], three: ["tre", "tredje"], four: ["fire", "fjerde"], five: ["fem", "femte"], six: ["seks", "sjette"], seven: ["sju", "syv", "sjuende", "syvende"], eight: ["åtte", "åttende"], nine: ["ni", "niende"], ten: ["ti", "tiende"], eleven: ["elleve"], twelve: ["tolv", "tolvte"], twenty: ["tjue", "tjuende"], thirty: ["tretti"], hundred: ["hundre"] };

function accepted(it) {
  if (it.expr || it.type === "chunk" || it.type === "reply") return (it.ok || []).concat(it.alt || []).join(" ");
  if (it.type === "order") return [it.s || ""].concat(it.alt || []).join(" ");
  return "";
}
function english(it) { return it.en || ""; }

EXPR.concat(ITEMS.filter(it => it.type === "order" && !excluded(it))).forEach(it => {
  if (ALLOW[it.id]) return;
  const e = english(it);
  const a = accepted(it);
  Object.keys(PRON).forEach(k => {
    if (PRON[k][0].test(e) && !PRON[k][1].test(a)) bad(it.id, "English " + k + " has no Norwegian counterpart");
  });
  if (englishNeg(e) && !NEG_NO.test(a)) bad(it.id, "English negation has no ikke/aldri/ingen");
  if (/\bhalf past\b/i.test(e) && /\bhalv\b/i.test(a)) return;
  const low = a.toLowerCase();
  Object.keys(NUM).forEach(w => {
    if (new RegExp("\\b" + w + "\\b", "i").test(e) && !NUM[w].some(x => hasNo(low, x))) bad(it.id, "English " + w + " missing in Norwegian");
  });
});
function hasNo(s, w) {
  return new RegExp("(?<![A-Za-zÆØÅæøå])" + w + "(?![A-Za-zÆØÅæøå])", "i").test(s);
}

const summary = {
  items: ITEMS.length,
  served: served.length,
  excluded: ITEMS.length - served.length,
  phrases: EXPR.length,
  basicPoss: ITEMS.filter(basicPoss).length,
  basicInf: ITEMS.filter(basicInf).length,
  failures: fails.length
};
console.log(JSON.stringify(summary, null, 2));
fails.slice(0, 80).forEach(f => console.log("FAIL " + f));
if (fails.length > 80) console.log("... " + (fails.length - 80) + " more");
process.exit(fails.length ? 1 : 0);
