// Screenshot the built app across viewports, for looking at rather than asserting on.
//
// Usage:  node tools/shots.mjs            (or: make shots)
//         node tools/shots.mjs --w 390    only that width
//         node tools/shots.mjs --scene timeline
//
// Writes shots/<timestamp>/<scene>-<w>x<h>.png. The directory is timestamped
// because Chrome caches file:// responses by URL, so reusing a filename is a
// reliable way to review pixels from an earlier build and believe they are current.
//
// Why device emulation rather than --window-size: Chrome will not open a window
// narrower than ~500px and silently gives you one that is wider, so
// `--window-size=390,844` reports 390 in the flag and lays out at 500+. Every
// phone-width finding measured that way is fiction.
// Emulation.setDeviceMetricsOverride is the only honest route, and it is also the
// only one that sets deviceScaleFactor and the mobile flag the CSS is keyed on.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'plant-tree.html');
const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync);
const PORT = 9400 + (process.pid % 500);
const PROFILE = mkdtempSync(join(tmpdir(), 'cdp-shots-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };

// The two phone widths worth caring about are the common one and the narrow one
// that exposes anything sized in absolutes; the rest bracket them.
const VIEWPORTS = [
  { w: 360, h: 800, dpr: 3, mobile: true, label: 'small phone' },
  { w: 390, h: 844, dpr: 3, mobile: true, label: 'phone' },
  { w: 768, h: 1024, dpr: 2, mobile: true, label: 'tablet' },
  { w: 1400, h: 880, dpr: 1, mobile: false, label: 'desktop' },
];

// Each scene is the state, not the steps to reach it — a caption for what you are
// looking at when the PNG is on screen a week later with no context.
const SCENES = {
  landing: { about: 'first paint, welcome dismissed', setup: `fit(0)` },
  panel: { about: 'a taxon open', setup: `select(nodeByName('Rosaceae'))` },
  timeline: { about: 'timeline scrubbed back, with a taxon open', setup: `select(nodeByName('Rosaceae')); enterTime(); setTime(200)` },
  menu: { about: 'the overflow menu, which is where a phone finds Colour', setup: `document.querySelector('[data-menu="more"]').click()` },
};

if (!CHROME) { console.error('no Chrome/Chromium found — set $CHROME'); process.exit(1); }
if (!existsSync(FILE)) { console.error(`no build at ${FILE} — run: make build`); process.exit(1); }

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const outDir = join(ROOT, 'shots', stamp);
mkdirSync(outDir, { recursive: true });

const onlyW = arg('w') && +arg('w');
const onlyScene = arg('scene');
const shots = VIEWPORTS.filter((v) => !onlyW || v.w === onlyW);
const scenes = Object.entries(SCENES).filter(([k]) => !onlyScene || k === onlyScene);

const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  '--hide-scrollbars', '--force-color-profile=srgb',
  ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
  `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

async function poll(fn, timeoutMs, what) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await sleep(150);
  }
}

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
  // A scene that fails to set up must not quietly produce a screenshot of the
  // landing view — that is a picture that says the bug is fixed.
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`page threw evaluating ${expr}: ${r.exceptionDetails.text}`);
    return r.result.value;
  };

  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  for (const v of shots) {
    for (const [name, scene] of scenes) {
      // reload per shot: scenes mutate global state (timeMode, renderRoot, filters)
      // and unwinding each one is more code, and more ways to be wrong, than a reload
      await send('Emulation.setDeviceMetricsOverride',
        { width: v.w, height: v.h, deviceScaleFactor: v.dpr, mobile: v.mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: v.mobile, maxTouchPoints: v.mobile ? 5 : 0 });
      await send('Page.navigate', { url: 'file://' + FILE });
      await poll(() => ev(`typeof ROOT!=='undefined' && !!ROOT`), 30000, 'the app to boot');
      await ev(`(()=>{const w=document.getElementById('wexplore'); if(w) w.click();})()`);
      await sleep(700);
      await ev(scene.setup);
      await sleep(900);                      // let the animated reframe settle

      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      // a capture that failed, or raced the first paint, comes back tiny; a real one
      // at these densities is hundreds of KB. Same guard og.mjs uses, for the same
      // reason: a blank PNG that looks like a finished screenshot is worse than an error.
      if (buf.length < 5000) throw new Error(`${name}-${v.w}x${v.h} is only ${buf.length} bytes — the capture looks blank`);
      const file = join(outDir, `${name}-${v.w}x${v.h}.png`);
      writeFileSync(file, buf);
      console.log(`  ${name.padEnd(9)} ${String(v.w).padStart(4)}×${v.h}  ${v.label}`);
    }
  }
  console.log(`\n${shots.length * scenes.length} shots → shots/${stamp}/`);
} finally {
  proc.kill();
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}
