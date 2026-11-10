/* Deep-equal the loaded cards with v5.6.8 (668437d). */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { parseAll } = require("../cards.js");

const REF = "668437d";
const root = path.join(__dirname, "..");
const html = execFileSync("git", ["show", REF + ":index.html"], { cwd: root, encoding: "utf8", maxBuffer: 20e6 });

function grab(name) {
  const i = html.indexOf(name);
  const k = html.indexOf("[", i);
  let d = 0;
  for (let n = k; n < html.length; n++) {
    if (html[n] === "[") d++;
    else if (html[n] === "]") {
      d--;
      if (d === 0) return JSON.parse(html.slice(k, n + 1));
    }
  }
  throw new Error("missing " + name);
}

const dir = path.join(root, "cards");
const names = fs.readFileSync(path.join(dir, "index.txt"), "utf8").split(/\n/).map(s => s.trim()).filter(s => s && s[0] !== "#");
const got = parseAll(names.map(name => ({ name, body: fs.readFileSync(path.join(dir, name), "utf8") })));

function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const o = {};
    Object.keys(v).sort().forEach(k => { o[k] = canon(v[k]); });
    return o;
  }
  return v;
}
function same(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }

const checks = [
  ["patterns", grab("const PATTERNS="), got.patterns],
  ["items", grab("const ITEMS="), got.items],
  ["expr", grab("const EXPR="), got.expr]
];
let failed = 0;
checks.forEach(([name, old, cur]) => {
  const ok = same(old, cur);
  if (!ok) failed++;
  console.log(name + " " + (ok ? "deep-equal" : "DIFFER") + " " + cur.length);
});
if (failed) process.exit(1);
console.log("equivalence: deep-equal with " + REF);
