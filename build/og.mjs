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

  // Compose a card rather than screenshotting the app. A raw UI capture is
  // legible at full size and mush at the thumbnail size these are actually seen
  // at — the toolbar dominates, and 479 rotated labels turn to noise. So: strip
  // the chrome, drop the labels, let the radial burst fill the frame, and burn
  // in the one line of substance that has to survive being 400px wide.
  await ev(`(()=>{
    const s=document.createElement('style');
    s.id='ogstyle';
    s.textContent=\`
      header.bar, footer.meta, .legendbar, .minimap, .zoomctl, .panel,
      .focusbar, .timebar, .perfhud, .tourcard, .welcome, .modal, .toast {display:none !important}
      body{overflow:hidden}
      #nodes text, #treemap text {display:none !important}
      .ogscrim{position:fixed; inset:auto 0 0 0; height:52%; pointer-events:none;
        background:linear-gradient(to top, #0d1512 30%, #0d1512f2 48%, #0d1512b0 72%, transparent 100%)}
      .ogtext{position:fixed; left:64px; right:64px; bottom:52px; pointer-events:none;
        font-family:var(--sans); color:var(--ink)}
      .ogbrand{display:flex; align-items:center; gap:14px; margin-bottom:18px}
      .ogbrand svg{width:44px; height:44px; color:var(--l-fern)}
      .ogbrand b{font-size:44px; font-weight:700; letter-spacing:-.02em}
      .ogsub{font-family:var(--serif); font-size:34px; line-height:1.2; color:var(--ink); margin-bottom:16px}
      .ogstats{font-size:21px; color:var(--dim); letter-spacing:.01em}
      .ogstats b{color:var(--l-fern); font-weight:600}
    \`;
    document.head.appendChild(s);
    const d=document.createElement('div');
    d.innerHTML='<div class="ogscrim"></div><div class="ogtext">'+
      '<div class="ogbrand"><svg><use href="#ygg-mark"/></svg><b>Yggdrasil</b></div>'+
      '<div class="ogsub">Every family of land plant, from mosses to orchids &mdash; one tree.</div>'+
      '<div class="ogstats"><b>'+totFam+'</b> families &middot; <b>'+totGen.toLocaleString()+
      '</b> genera &middot; <b>~'+totSppApprox+'</b> species</div></div>';
    document.body.appendChild(d);
  })()`);

  await ev(`expandAll()`);                       // a fuller tree reads better as a hero
  await poll(() => ev(`visibleNodes.length>400`), 15000, 'the tree to expand');
  await ev(`switchMode('radial')`);
  await sleep(500);
  await ev(`fit(0)`);
  await poll(() => ev(`document.querySelectorAll('#nodes .node').length>0`), 10000, 'nodes to mount');
  await sleep(900);                              // let the fit settle
  // fit() fills the frame edge to edge, which puts the crown behind the text band
  // and crops it. Scale about the stage centre (so the tree stays centred) to
  // clear room, then lift it into the open upper two-thirds.
  await ev(`(()=>{
    const st=document.getElementById('stage');
    const cx=st.clientWidth/2, cy=st.clientHeight/2, s=0.74;
    T.x = cx + (T.x-cx)*s; T.y = cy + (T.y-cy)*s; T.k *= s;
    T.y -= 74;
    applyT();
  })()`);
  await sleep(500);

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
