/* One-line card files. See cards/README.md. Works in the page and in Node. */
(function (root) {
  function parts(line) {
    return line.split("|").map(function (s) { return s.trim(); });
  }
  function need(row, n) {
    while (row.length < n) row.push("");
    return row;
  }
  function words(s) {
    if (s === "[]") return [];
    if (!s) return null;
    return s.split(" / ").map(function (x) { return x.trim(); });
  }
  function sents(s) {
    if (s === "[]") return [];
    if (!s) return null;
    return s.split(" // ").map(function (x) { return x.trim(); });
  }
  function opt(o, k, v) { if (v !== null && v !== undefined && v !== "") o[k] = v; }
  function list(o, k, v) { if (v !== null) o[k] = v; }

  function parseItem(row, file) {
    var type = row[1];
    if (type === "order") {
      need(row, 8);
      var o = { type: "order", id: row[0], t: "", en: row[2], s: row[3], why: row[4] };
      opt(o, "g", row[5]); list(o, "alt", sents(row[6])); list(o, "x", words(row[7]));
      return o;
    }
    if (type === "fill") {
      need(row, 8);
      var f = { type: "fill", id: row[0], t: "", en: row[2], s: row[3], ans: row[4], wrong: words(row[5]) || [], why: row[6] };
      opt(f, "g", row[7]);
      return f;
    }
    if (type === "mc") {
      need(row, 7);
      var m = { type: "mc", id: row[0], t: "", en: row[2], prompt: row[3], options: words(row[4]) || [], why: row[5] };
      opt(m, "g", row[6]);
      return m;
    }
    if (type === "gap") {
      need(row, 6);
      var g = { type: "gap", id: row[0], t: "", en: row[2], s: row[3], why: row[4] };
      opt(g, "adv", row[5]);
      return g;
    }
    if (type === "typed") {
      need(row, 6);
      return { type: "typed", id: row[0], t: "", en: row[2], s: row[3], acc: words(row[4]) || [], why: row[5] };
    }
    if (type === "sense") {
      need(row, 6);
      var marked = row[3];
      var a = marked.indexOf("*"), b = marked.indexOf("*", a + 1);
      if (a < 0 || b < 0) throw new Error(row[0] + ": mark the target with *asterisks*");
      var word = marked.slice(a + 1, b);
      if (word !== row[2]) throw new Error(row[0] + ": *word* does not match the word column");
      return { type: "sense", id: row[0], t: "vocab", s: marked.slice(0, a) + word + marked.slice(b + 1), word: word, options: words(row[4]) || [], why: row[5] };
    }
    throw new Error((file || "") + ": unknown card type on " + row[0]);
  }

  function parseExpr(row) {
    need(row, 15);
    var type = row[1];
    var e = { id: row[0], fam: row[2], cluster: row[3], expr: true, type: type, t: "expr", status: row[4], en: row[6], why: row[8], sit: row[9], intent: row[10] };
    list(e, "tiles", sents(row[11]));
    list(e, "bad", sents(row[12]));
    list(e, "x", words(row[13]));
    list(e, "alt", sents(row[14]));
    if (type === "reply") {
      e.cue = row[5];
      var choices = (words(row[7]) || []).map(function (t) {
        var ok = /\*$/.test(t);
        return { t: ok ? t.slice(0, -1) : t, ok: ok };
      });
      e.choices = choices;
      e.ok = choices.filter(function (c) { return c.ok; }).map(function (c) { return c.t; });
    } else {
      e.ok = sents(row[7]) || [];
    }
    return e;
  }

  function parsePattern(row) {
    need(row, 6);
    var p = { id: row[0], label: row[1], hint: row[2], pfx: row[3] };
    opt(p, "short", row[4]);
    if (row[5] === "yes") p.b1 = true;
    else if (row[5] === "1") p.b1 = 1;
    else if (row[5]) throw new Error(row[0] + ": b1 must be yes, 1, or blank");
    return p;
  }

  function lines(body) {
    return body.split(/\r?\n/).filter(function (l) { return l.trim() && l.trim().charAt(0) !== "#"; });
  }

  function parseAll(files) {
    var byName = {};
    files.forEach(function (f) { byName[f.name] = f.body; });
    var patterns = lines(byName["patterns.txt"]).map(function (l) { return parsePattern(parts(l)); });
    var patOf = {};
    patterns.forEach(function (p) { patOf[p.id] = p; });
    var bag = {};
    ["order.txt", "fill.txt", "mc.txt", "gap.txt", "typed.txt", "sense.txt"].forEach(function (name) {
      if (!byName[name]) throw new Error("missing " + name);
      lines(byName[name]).forEach(function (l) {
        var it = parseItem(parts(l), name);
        if (bag[it.id]) throw new Error("duplicate id " + it.id);
        bag[it.id] = it;
      });
    });
    var items = lines(byName["sequence.txt"]).map(function (l) {
      var r = parts(l);
      var it = bag[r[0]];
      if (!it) throw new Error("sequence id missing from card files: " + r[0]);
      it.t = r[1] || it.t;
      if (!it.t) throw new Error("no pattern for " + r[0]);
      return it;
    });
    if (items.length !== Object.keys(bag).length) throw new Error("sequence.txt does not list every card");
    var expr = lines(byName["expr.txt"]).map(function (l) { return parseExpr(parts(l)); });
    return { patterns: patterns, items: items, expr: expr, bag: bag, patOf: patOf };
  }

  function load() {
    return fetch("cards/index.txt").then(function (r) {
      if (!r.ok) throw new Error("cards/index.txt");
      return r.text();
    }).then(function (text) {
      var names = lines(text);
      return Promise.all(names.map(function (name) {
        return fetch("cards/" + name).then(function (r) {
          if (!r.ok) throw new Error(name);
          return r.text().then(function (body) { return { name: name, body: body }; });
        });
      })).then(function (files) {
        var parsed = parseAll(files);
        delete parsed.bag; delete parsed.patOf;
        return parsed;
      });
    });
  }

  var api = { parseAll: parseAll, lines: lines, load: load };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CardParse = api;
})(typeof self !== "undefined" ? self : this);
