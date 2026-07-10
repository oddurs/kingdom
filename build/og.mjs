// Regenerate og.jpg — the social-share preview image (1200×630).
// A crawler-only asset (Open Graph / Twitter); the app itself stays self-contained.
// Usage:  node build/og.mjs   (or: make og)   — needs Chrome/Chromium + a built plant-tree.html.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'plant-tree.html');
const OUT = join(ROOT, 'og.jpg');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9378;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  '--window-size=1200,630', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--user-data-dir=/tmp/cdp-og-gen', 'about:blank',
], { stdio: 'ignore' });

try {
  await sleep(1400);
  let list;
  for (let i = 0; i < 40; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (list.length) break; } catch {}
    await sleep(150);
  }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  let id = 0;
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id;
    ws.addEventListener('message', function h(e) { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); res(d.result); } });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = (expr) => send('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => r.result.value);
  await new Promise((r) => ws.addEventListener('open', r));
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: 'file://' + FILE });
  await sleep(2600);
  await ev(`document.getElementById('wexplore') && document.getElementById('wexplore').click()`);
  await sleep(400);
  await ev(`typeof expandAll==='function' && expandAll()`); // a fuller tree reads better as a hero
  await sleep(600);
  await ev(`typeof fit==='function' && fit(0)`);
  await sleep(900);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`wrote og.jpg (${(Buffer.from(shot.data, 'base64').length / 1024).toFixed(0)} KB)`);
} finally {
  proc.kill();
}
