#!/usr/bin/env node
// Regression smoke for the built plant-tree.html.
//
// Boots headless Chrome against the self-contained file over the DevTools
// protocol and asserts the invariants that every sprint has checked by hand:
// it loads clean, the data is intact, all four views render, the core
// interactions work, viewport virtualization bounds the DOM, and
// reduced-motion falls to instant.
//
// Usage:   node test/smoke.mjs [path/to/plant-tree.html]
// Chrome:  set $CHROME to override the auto-detected browser binary.
// Exit:    0 = all checks passed, 1 = a check failed or the app errored.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(process.argv[2] || `${HERE}/../plant-tree.html`);
const PORT = 9222 + (process.pid % 900); // avoid collisions across parallel runs

const CHROME =
  process.env.CHROME ||
  [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find(existsSync);

if (!existsSync(TARGET)) {
  console.error(`✗ build not found: ${TARGET}\n  run: python3 build/build.py`);
  process.exit(1);
}
if (!CHROME) {
  console.error("✗ no Chrome/Chromium found — set $CHROME to the binary path");
  process.exit(1);
}

// ---------- minimal CDP session ----------
// Opens a headless page, exposes ev() to evaluate expressions in it, and
// collects any console errors / uncaught exceptions the app throws.
async function session(flags, run) {
  const proc = spawn(CHROME, [
    "--headless",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1400,880",
    ...flags,
    `file://${TARGET}`,
  ]);
  try {
    const target = await poll(async () => {
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
        return list.find((t) => t.type === "page");
      } catch {
        return null;
      }
    }, 8000, "devtools target");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => {
      ws.addEventListener("open", r, { once: true });
      ws.addEventListener("error", j, { once: true });
    });

    let id = 0;
    const send = (method, params) =>
      new Promise((res) => {
        const i = ++id;
        const on = (e) => {
          const d = JSON.parse(e.data);
          if (d.id === i) {
            ws.removeEventListener("message", on);
            res(d.result);
          }
        };
        ws.addEventListener("message", on);
        ws.send(JSON.stringify({ id: i, method, params }));
      });

    const errors = [];
    ws.addEventListener("message", (e) => {
      const d = JSON.parse(e.data);
      if (d.method === "Runtime.exceptionThrown")
        errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
      if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error")
        errors.push(d.params.args.map((a) => a.value).join(" "));
    });

    await send("Runtime.enable", {});
    const ev = async (expr) =>
      (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }))
        .result.value;

    // wait for the app to boot (ROOT prepped), then dismiss the welcome overlay
    await poll(() => ev(`typeof ROOT!=='undefined' && !!ROOT`), 8000, "app boot");
    await ev(`(()=>{const w=document.getElementById('wexplore'); if(w) w.click();})()`);
    await wait(600);

    return await run({ ev, errors, send });
  } finally {
    proc.kill();
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, timeoutMs, what) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await wait(120);
  }
}

// ---------- tiny assertion harness ----------
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}
const near = (a, b, tol) => typeof a === "number" && Math.abs(a - b) <= tol;

// ---------- the suite ----------
async function main() {
  console.log(`smoke: ${TARGET}\n`);

  await session([], async ({ ev, errors }) => {
    // wait for an expected condition rather than a fixed sleep — view morphs and the
    // treemap/sunburst crossfade land on their own timers, so we poll for the outcome.
    const until = async (expr) => {
      try { await poll(() => ev(expr), 4000, expr); return true; } catch { return false; }
    };

    // data integrity
    const nodes = await ev(`(function c(n){let k=1;(n.children||[]).forEach(x=>k+=c(x));return k;})(ROOT)`);
    check("tree has 14,740 nodes", nodes === 14740, String(nodes));
    const ang = await ev(`(()=>{const a=nodeByName('Angiosperms'); return a&&a.effAge;})()`);
    check("Angiosperms effAge ≈ 139 Ma", near(ang, 139, 1.5), String(ang));
    const genera = await ev(`(()=>{const a=nodeByName('Asteraceae'); return (a.children||[]).length;})()`);
    check("Asteraceae has 1,730 genera", genera === 1730, String(genera));
    const tar = await ev(`(()=>{const g=nodeByName('Taraxacum'); return g&&g.rank==='genus'&&!!(g.ids&&g.ids.powo);})()`);
    check("genus rehydrates (Taraxacum: genus + POWO id)", tar);

    // four views render. Each switch owns an animated transition (view-morph or crossfade)
    // with its own internal timers and a morphing guard, so we let one fully land before the
    // next — probing only once the view is idle in its target mode.
    const VIEW = 800;
    await ev(`switchMode('tree')`); await wait(VIEW);
    check("tree view renders nodes", (await ev(`mode==='tree' && document.querySelectorAll('.node').length>0`)) === true);
    await ev(`switchMode('treemap')`); await wait(VIEW);
    check("treemap view renders cells", (await ev(`mode==='treemap' && document.querySelectorAll('.tmcell').length>0`)) === true);
    await ev(`switchMode('sunburst')`); await wait(VIEW);
    check("sunburst view renders cells", (await ev(`mode==='sunburst' && document.querySelectorAll('.sbcell').length>0`)) === true);
    await ev(`switchMode('radial')`); await wait(VIEW);
    check("radial view renders nodes", (await ev(`mode==='radial' && document.querySelectorAll('.node').length>0`)) === true);

    // expand / collapse
    await ev(`document.getElementById('btnExpand').click()`);
    await until(`visibleNodes.length>400`);
    const expanded = await ev(`visibleNodes.length`);
    await ev(`document.getElementById('btnCollapse').click()`);
    await until(`visibleNodes.length<50`);
    const collapsed = await ev(`visibleNodes.length`);
    check("expand-all then collapse changes the frontier", expanded > collapsed, `${expanded} → ${collapsed}`);

    // depth segment reflects the active choice (regression: setActive name collision left it stuck)
    await ev(`document.getElementById('btnExpand').click()`); await wait(120);
    const depthState = await ev(`document.getElementById('btnExpand').classList.contains('on') && !document.getElementById('btnOrders').classList.contains('on')`);
    check("depth segment marks the active button", depthState === true);
    await ev(`document.getElementById('btnOrders').click()`); await wait(120);

    // search navigates
    await ev(`(()=>{const q=document.getElementById('q'); q.value='Poaceae'; q.dispatchEvent(new Event('input'));})()`);
    await until(`document.querySelectorAll('.qrow').length>0`);
    await ev(`(()=>{const r=document.querySelector('.qrow'); if(r) r.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));})()`);
    check("search navigates to a taxon", await until(`selected && selected.name==='Poaceae'`));

    // search-nav out of a focused subtree resets the root AND mounts the target (regression: resetFocus didn't re-render)
    await ev(`(()=>{const a=nodeByName('Asteraceae'); reroot(a);})()`); await until(`renderRoot && renderRoot.name==='Asteraceae'`, 4000);
    await ev(`(()=>{const q=document.getElementById('q'); q.value='Poaceae'; q.dispatchEvent(new Event('input'));})()`);
    await until(`document.querySelectorAll('.qrow').length>0`);
    await ev(`(()=>{const r=[...document.querySelectorAll('.qrow')].find(x=>/Poaceae/.test(x.textContent)); if(r) r.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));})()`);
    const navReset = await until(`renderRoot===ROOT && selected && selected.name==='Poaceae' && !!nodeEls.get(selected._id)`, 4000);
    check("search-nav from a focused subtree resets root and mounts target", navReset === true);

    // alt-view selection: nav in treemap must repaint the selection outline (regression: select() didn't render).
    // Use the orders frontier so the target is a leaf cell (an open internal node has no cell to outline).
    await ev(`closePanel(); closeResults(); toOrders(); switchMode('treemap')`); await wait(VIEW);
    await ev(`navTo(nodeByName('Asterales'))`); await wait(400);
    const tmSel = await until(`mode==='treemap' && selected && selected.name==='Asterales' && !!document.querySelector('#treemap [data-id="'+selected._id+'"] rect[stroke="#fff"]')`, 6000);
    check("treemap selection outline follows nav", tmSel === true);
    await ev(`switchMode('radial')`); await wait(VIEW);

    // accessibility: selecting a taxon announces it to the polite live region
    await ev(`select(nodeByName('Poaceae'))`); await wait(150);
    check("selection is announced to the live region", (await ev(`/Poaceae/.test(document.getElementById('a11y-status').textContent)`)) === true);

    // legend spotlight: hovering a lineage dims the rest (Sprint H)
    await ev(`(()=>{const lg=[...document.querySelectorAll('#lgitems .lg')].find(x=>/Rosids/.test(x.textContent)); if(lg) lg.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));})()`); await wait(120);
    check("legend spotlight dims to a lineage", (await ev(`document.getElementById('stage').classList.contains('focusing') && document.querySelectorAll('#nodes .node.lit').length>0`)) === true);
    await ev(`document.getElementById('lgitems').dispatchEvent(new MouseEvent('mouseleave',{bubbles:true}))`); await wait(80);

    // Sprint I: the record holder shows its superlative badge + rank context
    await ev(`select(nodeByName('Asteraceae'))`); await wait(120);
    check("superlative badge + rank shown on record holder",
      (await ev(`/Largest plant family/.test(document.getElementById('pbadge').textContent) && /largest of 479 families/.test(document.getElementById('pctx').textContent)`)) === true);

    // Sprint I: a Records chip jumps straight to the holder
    await ev(`(()=>{const b=[...document.querySelectorAll('#recordsbar .schip')].find(x=>/Most widespread/.test(x.textContent)); if(b) b.click();})()`); await wait(150);
    check("Records jump selects the holder", (await ev(`selected && selected.name==='Lycopodiaceae'`)) === true);

    // Sprint J: pin one clade, open another → compare tray fills with a verdict
    await ev(`select(nodeByName('Fabaceae'))`); await wait(120);
    await ev(`[...document.querySelectorAll('#pactions .ctl')].find(b=>/^Compare/.test(b.textContent)).click()`); await wait(100);
    await ev(`select(nodeByName('Asteraceae'))`); await wait(150);
    check("compare tray shows a two-clade verdict", (await ev(`!document.getElementById('comparebar').hidden && /(×|younger|matched)/.test(document.querySelector('.cmpverdict') ? document.querySelector('.cmpverdict').textContent : '')`)) === true);
    await ev(`clearCompare()`); await wait(80);

    // curated story highlight still works after the highlightSet refactor
    await ev(`setStory('crops')`); await wait(400);
    check("story highlight lights a constellation", (await ev(`activeStory==='crops' && document.querySelectorAll('.node.hl').length>0`)) === true);
    await ev(`clearStory()`); await wait(120);

    // Sprint K: facet filter highlights matching families with a live count
    await ev(`filter.rich=5000; filter.lineage=null; filter.region=null; filter.age=null; buildFilterUI(); applyFilter();`); await wait(400);
    check("filter highlights matching families",
      (await ev(`activeStory==='_filter' && /famil(y|ies) match/.test(document.getElementById('fcount').textContent) && document.querySelectorAll('.node.hl').length>0`)) === true);
    await ev(`clearFilter()`); await wait(120);

    // viewport virtualization bounds the DOM when zoomed in
    await ev(`exitFocus(); switchMode('tree')`); await wait(VIEW);
    await ev(`(()=>{const n=nodeByName('Asteraceae'); reroot(n);})()`);
    await until(`visibleNodes.length>1000`);
    await until(`_structRunning===false`); await wait(150); // let the reroot fit-animation settle so culling is live
    const dataN = await ev(`visibleNodes.length`);
    // zoom into the middle of the fan and read the mounted count in the SAME evaluate — a
    // stray headless resize would otherwise re-fit and clobber a manually-set transform.
    const mounted = await ev(`(()=>{ T.k=1; T.x=-100; T.y=-8000; applyT(); return document.querySelectorAll('#nodes .node').length; })()`);
    check("virtualization bounds the DOM zoomed in", mounted > 0 && mounted < dataN / 3, `${mounted} mounted of ${dataN}`);

    // timeline
    await ev(`exitFocus(); switchMode('radial')`); await wait(500);
    await ev(`document.getElementById('btnTime').click()`); await wait(500);
    const timeOn = await ev(`timeMode===true`);
    await ev(`setTime(200)`); await wait(300);
    await ev(`play()`); await wait(700);
    await ev(`pausePlay(); document.getElementById('btnTime').click()`); await wait(400);
    check("timeline toggles on, plays, and toggles off", timeOn && (await ev(`timeMode===false`)));

    // perf HUD (E1)
    await ev(`togglePerf(true)`); await wait(300);
    check("perf HUD toggles on", (await ev(`!document.getElementById('perfhud').hidden`)) === true);

    // secondary pages (About / Controls modals)
    await ev(`document.getElementById('btnAbout').click()`); await wait(200);
    const aboutOpen = await ev(`document.getElementById('modal').classList.contains('show') && /About Yggdrasil/.test(document.getElementById('mbody').textContent)`);
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); await wait(200);
    const aboutClosed = await ev(`!document.getElementById('modal').classList.contains('show')`);
    check("About page opens and Escape closes it", aboutOpen === true && aboutClosed === true);

    // PNG export builds its SVG/style without throwing (regression guard for the export path)
    const exportOk = await ev(`(()=>{ try{ buildExportSVG(); return true; }catch(e){ return 'threw: '+e.message; } })()`);
    check("PNG export builds without error", exportOk === true, exportOk === true ? "" : String(exportOk));

    check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" | "));
  });

  // reduced-motion: a fresh session with the media feature forced
  await session(["--force-prefers-reduced-motion"], async ({ ev, errors }) => {
    check("reduced-motion is active", (await ev(`matchMedia('(prefers-reduced-motion:reduce)').matches`)) === true);
    check("ambient breathe is off under reduced-motion",
      (await ev(`getComputedStyle(document.getElementById('svg')).animationName`)) === "none");
    await ev(`switchMode('tree'); (()=>{const n=nodeByName('Fabaceae'); if(n) toggle(n);})()`); await wait(500);
    check("structural change is instant (no animating class)",
      (await ev(`!document.getElementById('stage').classList.contains('animating')`)) === true);
    check("no console errors under reduced-motion", errors.length === 0, errors.slice(0, 3).join(" | "));
  });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error(`FAILED: ${failed.map((r) => r.name).join(", ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("smoke runner error:", e.message);
  process.exit(1);
});
