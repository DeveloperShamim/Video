#!/usr/bin/env node
// Render a promo HTML scene (Motion harness) to clip.mp4, preview.gif and poster.jpg.
// Usage: node render.mjs <path/to/index.html> [--out <dir>]
// Requests for lib/* are served from this skill's lib folder, so a project folder only needs index.html.
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(SKILL, 'lib');
const FPS = 30;

const args = process.argv.slice(2);
if (!args.length || args.includes('-h') || args.includes('--help')) {
  console.log('Usage: node render.mjs <index.html> [--out <dir>]');
  process.exit(args.length ? 0 : 1);
}
const input = path.resolve(args[0]);
const outIdx = args.indexOf('--out');
const out = path.resolve(outIdx >= 0 ? args[outIdx + 1] : path.join(path.dirname(input), 'out'));
fs.mkdirSync(out, { recursive: true });

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return req(p); } catch {}
  }
  throw new Error('playwright not found: npm i -g playwright (Chromium must be available)');
}
const { chromium } = loadPlaywright();

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const root = path.dirname(input);
const server = createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
  const m = rel.match(/(?:^|\/)lib\/(.+)$/);
  const local = path.join(root, rel);
  const file = fs.existsSync(local) && fs.statSync(local).isFile() ? local : (m ? path.join(LIB, m[1]) : local);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/${path.basename(input)}?render=1&embed=1`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  const { dur, size, poster } = await page.evaluate(() => ({ dur: window.__dur, size: window.__size, poster: window.__poster }));
  const [w, h] = size;
  await page.setViewportSize({ width: w, height: h });
  const frames = Math.round(dur * FPS);
  const mp4 = path.join(out, 'clip.mp4');
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', mp4], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => ff.on('close', c => c ? fail(new Error('ffmpeg exit ' + c)) : ok()));
  for (let f = 0; f < frames; f++) {
    await page.evaluate(t => window.__seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${frames}`);
  }
  ff.stdin.end();
  await done;
  await page.evaluate(t => window.__seek(t), Number.isFinite(poster) ? poster : dur - 0.3);
  await page.screenshot({ path: path.join(out, 'poster.jpg'), type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: w, height: h } });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-vf',
    `fps=12,scale=${w >= h ? '640:-1' : '-1:640'}:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    path.join(out, 'preview.gif')]);
  console.log(`\rOK ${frames} frames ${w}x${h} ${dur}s -> ${out}`);
} finally {
  await browser.close();
  server.close();
}
