// Regenerate og.jpg — the social-share preview image (1200×630).
// A crawler-only asset (Open Graph / Twitter); the app itself stays self-contained.
// Usage:  node build/og.mjs   (or: make og)   — needs Chrome/Chromium + a built plant-tree.html.
//
// CI copies whatever this writes straight into the published site, so the job is
// to fail loudly rather than ship a blank hero image with a green build: wait for
// real conditions instead of fixed sleeps, check every evaluate for an exception,
// and refuse to write an image that is a flat colour.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'plant-tree.html');
const OUT = join(ROOT, 'og.jpg');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9300 + (process.pid % 600);      // two runs must not fight over one port
const PROFILE = mkdtempSync(join(tmpdir(), 'cdp-og-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(fn, timeoutMs, what) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await sleep(150);
  }
}

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),   // CI runners
  '--window-size=1200,630', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

try {
  const target = await poll(async () => {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    return list.find((t) => t.type === 'page');
  }, 20000, 'the devtools target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0;
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    const timer = setTimeout(() => { ws.removeEventListener('message', h); rej(new Error(`${method} timed out`)); }, 60000);
    function h(e) {
      const d = JSON.parse(e.data);
      if (d.id !== i) return;
      clearTimeout(timer);
      ws.removeEventListener('message', h);
      res(d.result);
    }
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  // an evaluate that throws must be an error here, not a silently skipped step:
  // expandAll() and fit() are globals only by virtue of the concat-into-one-script
  // build, so a refactor that scopes them would otherwise ship an unfitted hero
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`page threw evaluating ${expr}: ${r.exceptionDetails.text}`);
    return r.result.value;
  };

  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: 'file://' + FILE });
  await poll(() => ev(`typeof ROOT!=='undefined' && !!ROOT`), 30000, 'the app to boot');

  await ev(`(()=>{const w=document.getElementById('wexplore'); if(w) w.click();})()`);
  await sleep(400);
  await ev(`expandAll()`);                       // a fuller tree reads better as a hero
  await poll(() => ev(`visibleNodes.length>400`), 15000, 'the tree to expand');
  await ev(`fit(0)`);
  await poll(() => ev(`document.querySelectorAll('#nodes .node').length>0`), 10000, 'nodes to mount');
  await sleep(900);                              // let the fit settle and labels land

  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
  const buf = Buffer.from(shot.data, 'base64');
  // a blank or single-colour capture compresses to almost nothing; the real hero is
  // tens of KB. This is the check that stops a silent blank image reaching production.
  if (buf.length < 20000) throw new Error(`og.jpg is only ${buf.length} bytes — the capture looks blank`);
  writeFileSync(OUT, buf);
  console.log(`wrote og.jpg (${(buf.length / 1024).toFixed(0)} KB)`);
} finally {
  // kill() returns before Chrome has finished flushing its profile, so wait for
  // the exit — and never let tidying a temp directory fail a build that already
  // wrote its image.
  proc.kill();
  await Promise.race([once(proc, 'exit'), sleep(4000)]);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}
