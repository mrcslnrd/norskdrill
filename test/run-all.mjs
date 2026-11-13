/* Runs every browser check in test/ against a local copy of the site.
   node test/run-all.mjs   (needs Node 22+ and Google Chrome at /usr/bin/google-chrome) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.txt':'text/plain; charset=utf-8', '.png':'image/png', '.webmanifest':'application/manifest+json', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = String(server.address().port);
const tests = fs.readdirSync(here).filter(f => f.endsWith('.mjs') && f !== 'run-all.mjs').sort();
const failed = [];
for (const t of tests) {
  const code = await new Promise(resolve => {
    const p = spawn(process.execPath, [path.join(here, t)], { env: { ...process.env, PORT }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    const kill = setTimeout(() => { out += '\ntimed out'; p.kill('SIGKILL'); }, 120000);
    p.on('close', c => { clearTimeout(kill); if (c) console.log(out.trim()); resolve(c); });
  });
  console.log((code ? 'FAIL ' : 'ok   ') + t);
  if (code) failed.push(t);
}
server.close();
for (const d of fs.readdirSync('/tmp')) if (d.startsWith('chrome-nd')) { try { fs.rmSync(path.join('/tmp', d), { recursive: true, force: true }); } catch {} }
console.log(failed.length ? failed.length + ' of ' + tests.length + ' failed' : 'all ' + tests.length + ' passed');
process.exit(failed.length ? 1 : 0);
