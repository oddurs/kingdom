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
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

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
  // a private profile per session: sessions run back-to-back on one port, and a
  // shared profile lets a still-dying browser answer the discovery poll
  const profile = mkdtempSync(join(tmpdir(), "smoke-chrome-"));
  const proc = spawn(CHROME, [
    "--headless",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--window-size=1400,880",
    ...(process.env.CI ? ["--no-sandbox", "--disable-dev-shm-usage"] : []),   // CI runners
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

    // Every request must be able to fail. A reply that never arrives — a browser
    // that crashed or was OOM-killed — would otherwise hang the suite until the
    // CI job's own timeout, holding the deploy queue behind it.
    //
    // This is a liveness guard, not a speed limit: a 2-core CI runner can spend
    // tens of seconds inside one evaluate (a relayout of the full frontier), and
    // failing that run would be a lie about what broke. Generous, but finite.
    let id = 0;
    const send = (method, params) =>
      new Promise((res, rej) => {
        const i = ++id;
        const done = (fn, arg) => {
          clearTimeout(timer);
          ws.removeEventListener("message", on);
          ws.removeEventListener("close", onGone);
          ws.removeEventListener("error", onGone);
          fn(arg);
        };
        const on = (e) => {
          const d = JSON.parse(e.data);
          if (d.id === i) done(res, d.result);
        };
        const what = `${method}${params?.expression ? `: ${params.expression.replace(/\s+/g, " ").slice(0, 90)}` : ""}`;
        const onGone = () => done(rej, new Error(`browser went away during ${what}`));
        const timer = setTimeout(() => done(rej, new Error(`timed out after 120s — ${what}`)), 120000);
        ws.addEventListener("message", on);
        ws.addEventListener("close", onGone);
        ws.addEventListener("error", onGone);
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

    // A dispatched event lands wherever you aim it — on an element covered by an
    // overlay, or inside an `inert` subtree that no real user could ever reach.
    // These two assert reachability first, so "the test clicked it" means what a
    // reader assumes it means. Both resolve to `true` or to a diagnostic string.
    const reach = (sel, text) => `(()=>{
      const sel=${JSON.stringify(sel)};
      const el=${text === undefined
        ? `document.querySelector(sel)`
        : `[...document.querySelectorAll(sel)].find(e=>e.textContent.includes(${JSON.stringify(text)}))`};
      const d=e=>e ? e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.getAttribute('class')?'.'+e.getAttribute('class').trim().split(/\\s+/).join('.'):'') : 'nothing';
      if(!el) return 'no element matches '+sel${text === undefined ? "" : ` + ' containing ' + ${JSON.stringify(text)}`};
      const r=el.getBoundingClientRect();
      if(!r.width || !r.height) return d(el)+' has zero size';
      const x=r.left+r.width/2, y=r.top+r.height/2;
      if(x<0 || y<0 || x>innerWidth || y>innerHeight) return d(el)+' centre is off-screen';
      const hit=document.elementFromPoint(x,y);
      if(!hit) return 'nothing is at the centre of '+d(el);
      if(hit!==el && !el.contains(hit)) return d(el)+' is covered by '+d(hit);
      return {hit,x,y};
    })()`;
    // mouse-level events only: enough for every handler the app binds (click,
    // mousedown), and it avoids faking a pointerId that setPointerCapture would reject.
    const clickAt = (sel, text) => ev(`(()=>{ const t=${reach(sel, text)};
      if(typeof t==='string') return t;
      for(const type of ['mousedown','mouseup','click'])
        t.hit.dispatchEvent(new MouseEvent(type,{bubbles:true,cancelable:true,clientX:t.x,clientY:t.y,view:window}));
      return true; })()`);
    const tabTo = (sel) => ev(`(()=>{
      const sel=${JSON.stringify(sel)}, el=document.querySelector(sel);
      if(!el) return 'no element matches '+sel;
      el.focus();
      const a=document.activeElement;
      if(a===el || el.contains(a)) return true;
      return 'focus refused — landed on '+(a ? a.tagName.toLowerCase() : 'nothing');
    })()`);

    // wait for the app to boot (ROOT prepped), then dismiss the welcome overlay
    await poll(() => ev(`typeof ROOT!=='undefined' && !!ROOT`), 8000, "app boot");
    await ev(`(()=>{const w=document.getElementById('wexplore'); if(w) w.click();})()`);
    await wait(600);

    return await run({ ev, errors, send, clickAt, tabTo });
  } finally {
    proc.kill();
    await Promise.race([once(proc, "exit"), wait(4000)]);   // don't race the next session onto this port
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
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

  await session([], async ({ ev, errors, send, clickAt, tabTo }) => {
    // wait for an expected condition rather than a fixed sleep — view morphs and the
    // treemap/sunburst crossfade land on their own timers, so we poll for the outcome.
    const until = async (expr) => {
      try { await poll(() => ev(expr), 4000, expr); return true; } catch { return false; }
    };
    // Typing is debounced and closeResults() only hides the dropdown — the previous
    // search's rows (and its hitList) stay in the DOM. So waiting for `.qrow` to
    // exist matches the *last* search; wait for a freshly opened list instead.
    const search = async (term) => {
      await ev(`closeResults()`);
      await ev(`(()=>{const q=document.getElementById('q'); q.value=${JSON.stringify(term)}; q.dispatchEvent(new Event('input'));})()`);
      return until(`!document.getElementById('qresults').hidden && document.querySelectorAll('.qrow').length>0`);
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

    // Row spacing must clear the circles it separates. A fixed DY step assumed
    // every row was the same size, but radius() scales with richness to 26px, so
    // a collapsed node carrying a huge clade overlapped the row above it
    // (Spermatophytes needed 33.9px of clearance and got 28).
    const spacing = await ev(`(()=>{
      collapseTop();
      const leaves=visibleNodes.filter(n=>!(n.open&&(n.children||[]).length)).sort((a,b)=>a.y-b.y);
      let worst=null;
      for(let i=1;i<leaves.length;i++){
        const a=leaves[i-1], b=leaves[i], slack=(b.y-a.y)-(radius(a)+radius(b));
        if(!worst||slack<worst.slack) worst={pair:a.name+'/'+b.name, slack:+slack.toFixed(1)};
      }
      return JSON.stringify(worst||{slack:99});
    })()`); await wait(600);
    const SP = JSON.parse(spacing);
    check("no two tree rows overlap", SP.slack >= 0, `tightest ${SP.pair}: ${SP.slack}px slack`);
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

    // Expanding a branch must not refit the viewport. fit(dur) always fits, so a
    // >200-node delta used to refit regardless of opts.fit: opening Asteraceae's
    // 1,730 genera zoomed to 1.25% and the node you clicked left the screen.
    const anchorHeld = await ev(`(()=>{
      switchMode('tree'); expandAll();
      return new Promise(res=>setTimeout(()=>{
        fit(0);
        setTimeout(()=>{
          const n=nodeByName('Asteraceae');
          const before={k:T.k, sx:T.x+n.x*T.k, sy:T.y+n.y*T.k};
          if(!n.open) toggle(n);
          setTimeout(()=>{
            const after={k:T.k, sx:T.x+n.x*T.k, sy:T.y+n.y*T.k};
            res(JSON.stringify({
              zoomKept: Math.abs(after.k-before.k) < 1e-6,
              driftX: +Math.abs(after.sx-before.sx).toFixed(1),
              driftY: +Math.abs(after.sy-before.sy).toFixed(1),
            }));
          }, 1400);
        }, 700);
      }, 1400));
    })()`);
    const AH = JSON.parse(anchorHeld);
    check("expanding a large branch holds zoom and keeps the node put",
      AH.zoomKept && AH.driftX < 2 && AH.driftY < 2, anchorHeld);
    await ev(`collapseTop()`); await wait(900);

    // depth segment reflects the active choice (regression: setActive name collision left it stuck)
    await ev(`document.getElementById('btnExpand').click()`); await wait(120);
    const depthState = await ev(`document.getElementById('btnExpand').classList.contains('on') && !document.getElementById('btnOrders').classList.contains('on')`);
    check("depth segment marks the active button", depthState === true);
    await ev(`document.getElementById('btnOrders').click()`); await wait(120);

    // search navigates
    await search("Poaceae");
    const qreach = await clickAt(".qrow", "Poaceae");
    // The tree stops at genus, so "Rosa canina" matched nothing — the single most
    // natural thing for a visitor to type. A binomial's first word IS its genus,
    // so it resolves with no species data at all, and the result says so rather
    // than silently showing something else.
    const binomial = await ev(`(()=>{
      const run=(t)=>{ closeResults&&closeResults(); const el=document.getElementById('q');
        el.value=t; runSearch(); 
        return { hits:[...document.querySelectorAll('.qrow .qnm')].map(e=>e.textContent.trim()),
                 note:(document.querySelector('.qfoot')||{}).textContent||'' }; };
      const rosa=run('Rosa canina'), nonsense=run('Zzz qqq'), plain=run('lavender');
      return JSON.stringify({
        resolvedTo: rosa.hits[0] || null,
        onlyOne: rosa.hits.length === 1,
        explained: /showing the genus/.test(rosa.note),
        nonsenseStillFails: nonsense.hits.length === 0,
        plainSearchUnaffected: plain.hits.length > 0 && !/showing the genus/.test(plain.note),
      });})()`); await wait(200);
    const BI = JSON.parse(binomial);
    check("a species binomial resolves to its genus, and says so",
      BI.resolvedTo === "Rosa" && BI.onlyOne && BI.explained
      && BI.nonsenseStillFails && BI.plainSearchUnaffected, binomial);
    await ev(`closeResults(); document.getElementById('q').value=''`); await wait(120);

    check("search result row is reachable and navigates", qreach === true && (await until(`selected && selected.name==='Poaceae'`)),
      qreach === true ? "" : String(qreach));

    // search-nav out of a focused subtree resets the root AND mounts the target (regression: resetFocus didn't re-render)
    await ev(`(()=>{const a=nodeByName('Asteraceae'); reroot(a);})()`); await until(`renderRoot && renderRoot.name==='Asteraceae'`);
    await search("Poaceae");
    const nav2 = await clickAt(".qrow", "Poaceae");
    const navReset = await until(`renderRoot===ROOT && selected && selected.name==='Poaceae' && !!nodeEls.get(selected._id)`, 4000);
    check("search-nav from a focused subtree resets root and mounts target", navReset === true,
      nav2 === true ? "" : String(nav2));

    // alt-view selection: nav in treemap must repaint the selection outline (regression: select() didn't render).
    // Use the orders frontier so the target is a leaf cell (an open internal node has no cell to outline).
    await ev(`closePanel(); closeResults(); toOrders(); switchMode('treemap')`); await wait(VIEW);
    await ev(`navTo(nodeByName('Asterales'))`); await wait(400);
    const tmSel = await until(`mode==='treemap' && selected && selected.name==='Asterales' && !!document.querySelector('#treemap [data-id="'+selected._id+'"] rect[stroke="#fff"]')`, 6000);
    check("treemap selection outline follows nav", tmSel === true);

    // SVG paints in document order, so an outline drawn on the cell itself is
    // overpainted by every cell after it — the hover ring came out clipped on its
    // right and bottom edges. It must be the LAST element in the group.
    const ring = await ev(`(()=>{
      const cells=[...document.querySelectorAll('.tmcell')];
      if(cells.length<3) return 'no cells';
      const g=cells[Math.floor(cells.length*0.35)];
      g.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));
      const r=document.getElementById('tmring');
      if(!r) return 'no ring';
      return JSON.stringify({
        visible: r.getAttribute('visibility')==='visible',
        paintsLast: r.parentNode.lastElementChild===r,
        sized: +r.getAttribute('width')>0 && +r.getAttribute('height')>0,
      });})()`); await wait(150);
    const RG = typeof ring === "string" && ring[0] === "{" ? JSON.parse(ring) : {};
    check("the treemap hover ring paints above every cell",
      RG.visible && RG.paintsLast && RG.sized, ring);
    await ev(`switchMode('radial')`); await wait(VIEW);

    // accessibility: selecting a taxon announces it to the polite live region
    await ev(`select(nodeByName('Poaceae'))`); await wait(150);
    check("selection is announced to the live region", (await ev(`/Poaceae/.test(document.getElementById('a11y-status').textContent)`)) === true);

    // an open panel must be genuinely reachable, not just visible — `inert` left
    // armed makes it look right in a screenshot and refuse every real interaction
    const pfocus = await tabTo("#pclose");
    check("open detail panel is keyboard-reachable", pfocus === true, pfocus === true ? "" : String(pfocus));

    // Enter had to open a taxon, and did not. The stage's keydown called toggle()
    // and never select(), so the blurb, origin bar, distribution map, references,
    // Focus subtree, Compare and Copy link — the whole content payload — were
    // reachable by pointer only. The mouse path has always done both.
    const kbOpen = await ev(`(()=>{
      closePanel(); setKb(nodeByName('Rosaceae'), false);
      document.getElementById('stage').dispatchEvent(
        new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
      return JSON.stringify({open:panel.classList.contains('open'), sel:selected&&selected.name});
    })()`); await wait(250);
    const KB = JSON.parse(kbOpen);
    check("Enter opens the taxon under the keyboard cursor", KB.open === true && KB.sel === "Rosaceae", kbOpen);

    // …and the cursor follows any other route to a selection, so the next ArrowDown
    // steps from what you are reading rather than from wherever you last arrowed.
    await ev(`select(nodeByName('Fabaceae'))`); await wait(200);
    check("the keyboard cursor follows the selection", (await ev(`kb && kb.name==='Fabaceae'`)) === true,
      await ev(`kb ? kb.name : 'null'`));

    // Searching used to end on document.body: navTo() called a bare q.blur(), so
    // the arrow keys — whose listener is on #stage — did nothing afterwards.
    await ev(`navTo(nodeByName('Orchidaceae'))`); await wait(250);
    check("search leaves focus somewhere the arrow keys work",
      (await ev(`document.activeElement===document.getElementById('stage')`)) === true,
      await ev(`document.activeElement.tagName+(document.activeElement.id?'#'+document.activeElement.id:'')`));
    await ev(`closePanel()`); await wait(80);

    // The crawlable index is 479 links hidden with `clip`, which removes them from
    // sight but not from the tab order — so reaching the canvas by keyboard meant
    // 479 presses into elements with no focus ring at all. And role="tree" on
    // <main> replaced the implicit main landmark (while promising treeitem
    // semantics no node has), so landmark navigation couldn't skip them either.
    const order = await ev(`(()=>{
      const all=[...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
        .filter(e=>e.tabIndex>=0 && !e.closest('[inert]') && !e.hasAttribute('disabled') && !e.closest('[hidden]'));
      const stage=document.getElementById('stage');
      const main=document.querySelector('main');
      return JSON.stringify({
        first: all[0] ? (all[0].className||all[0].tagName) : 'none',
        beforeStage: all.indexOf(stage),
        indexTabbable: [...document.querySelectorAll('.visually-hidden a')].filter(a=>a.tabIndex>=0).length,
        mainRole: main.getAttribute('role'),
        skipTarget: (document.querySelector('a.skip')||{}).hash,
      });})()`);
    const O = JSON.parse(order);
    check("the tree is a few tab stops away, not 479", O.beforeStage >= 0 && O.beforeStage < 20 && O.indexTabbable === 0, order);
    check("a skip link is the first tab stop", /skip/.test(O.first) && O.skipTarget === "#stage", order);
    check("<main> is still a landmark", O.mainRole === null, `role=${O.mainRole}`);

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

    // The panel's own controls rebuild the container they live in, and the click
    // then bubbles to the stage with a detached target — which matched neither
    // '.node' nor an overlay, so the background handler closed the panel on every
    // breadcrumb. The fix decides from the press, so these have to be *real* input:
    // clickAt() dispatches MouseEvents only, and never produces a pointerdown.
    // The probe is a constant: its arguments travel over the protocol as values
    // rather than being spliced into JavaScript source. Building the source would
    // be a CodeQL finding and a real hazard the day a selector holds a quote.
    // It also scrolls first — a control below the panel's fold is off-screen until
    // you bring it into view, which is what a reader does before clicking it.
    const PROBE = `function(sel, text){
      const all=[...document.querySelectorAll(sel)];
      const el = text==null ? all[0] : all.find(e=>e.textContent.includes(text));
      const d=e=>e ? e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.getAttribute('class')?'.'+e.getAttribute('class').trim().split(/\\s+/).join('.'):'') : 'nothing';
      if(!el) return 'no element matches '+sel+(text==null?'':' containing '+text);
      el.scrollIntoView({block:'center'});
      const r=el.getBoundingClientRect();
      if(!r.width || !r.height) return d(el)+' has zero size';
      const x=r.left+r.width/2, y=r.top+r.height/2;
      if(x<0 || y<0 || x>innerWidth || y>innerHeight) return d(el)+' centre is off-screen';
      const hit=document.elementFromPoint(x,y);
      if(!hit) return 'nothing is at the centre of '+d(el);
      if(hit!==el && !el.contains(hit)) return d(el)+' is covered by '+d(hit);
      return {x,y};
    }`;
    let pageObj = null;
    const probe = async (sel, text) => {
      if (!pageObj) pageObj = (await send("Runtime.evaluate", { expression: "window" })).result.objectId;
      const r = await send("Runtime.callFunctionOn", {
        functionDeclaration: PROBE, objectId: pageObj, returnByValue: true,
        arguments: [{ value: sel }, { value: text === undefined ? null : text }],
      });
      return r.result.value;
    };
    const press = async (sel, text) => {
      await probe(sel, text);          // first call scrolls it into view…
      await wait(80);
      const at = await probe(sel, text);   // …second measures where it settled
      if (typeof at === "string") return at;
      for (const type of ["mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", { type, x: at.x, y: at.y, button: "left", clickCount: 1, buttons: type === "mousePressed" ? 1 : 0 });
      return true;
    };

    await ev(`select(nodeByName('Rosaceae'))`); await wait(200);
    const crumb = await press("#pcrumb a", "Rosales");
    const crumbOk = await until(`selected && selected.name==='Rosales' && document.getElementById('panel').classList.contains('open')`);
    check("a breadcrumb navigates up and the panel stays open", crumb === true && crumbOk === true,
      `press=${crumb} then ${await ev(`JSON.stringify({open:panel.classList.contains('open'), sel:selected&&selected.name})`)}`);

    const cmp = await press("#pactions .ctl", "Compare");
    const cmpOk = await until(`compareA && document.getElementById('panel').classList.contains('open')`);
    check("Compare pins a clade without closing the panel it pinned", cmp === true && cmpOk === true,
      `press=${cmp} then ${await ev(`JSON.stringify({open:panel.classList.contains('open'), a:compareA&&compareA.name})`)}`);
    await ev(`clearCompare()`); await wait(80);

    // …and the background must still close it, which is the behaviour the press
    // gate could have quietly broken. Nothing covered it before.
    const bg = await ev(`(()=>{ const r=document.getElementById('stage').getBoundingClientRect();
      for(let y=r.top+40; y<r.bottom-40; y+=17) for(let x=r.left+12; x<r.left+180; x+=13){
        const h=document.elementFromPoint(x,y);
        if(h && !h.closest('.node') && !h.closest('#panel,.zoomctl,.minimap,.focusbar,.tourcard,.welcome,.timebar,.modal,.comparebar,.legendbar')) return {x,y};
      } return 'no empty background point found'; })()`);
    if (typeof bg === "string") check("clicking empty background closes the panel", false, bg);
    else {
      for (const type of ["mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", { type, x: bg.x, y: bg.y, button: "left", clickCount: 1, buttons: type === "mousePressed" ? 1 : 0 });
      check("clicking empty background closes the panel",
        (await until(`!document.getElementById('panel').classList.contains('open') && !selected`)) === true,
        await ev(`JSON.stringify({open:panel.classList.contains('open')})`));
    }
    await ev(`closePanel()`); await wait(80);

    // curated story highlight still works after the highlightSet refactor
    await ev(`setStory('crops')`); await wait(400);
    check("story highlight lights a constellation", (await ev(`activeStory==='crops' && document.querySelectorAll('.node.hl').length>0`)) === true);

    // …and its result rows are reachable. The list used to open the panel without
    // clearing `inert`, so every row was sealed behind the canvas.
    const rowFocus = await tabTo(".lrow");            // focus first: clicking a row swaps the list out for the detail card
    const rowClick = await clickAt(".lrow");
    const rowWorked = await until(`selected && document.getElementById('plist').hidden`);
    // Past the point where the tree stops labelling, expanding a clade gives a
    // dense unlabelled ring — the drawing has stopped answering "what is in here".
    // The panel routes to the list that already exists, but only when the tree
    // genuinely can't cope: a small family must not carry the affordance.
    const browse = await ev(`(()=>{
      const find=()=>[...document.querySelectorAll('#pactions .ctl')].find(b=>/Browse all/.test(b.textContent));
      select(nodeByName('Matoniaceae'));
      const small = !!find();
      const big=nodeByName('Asteraceae'); select(big);
      const btn=find(); if(!btn) return JSON.stringify({smallOffers:small, bigOffers:false});
      btn.click();
      const pl=document.getElementById('plist'), panel=document.getElementById('panel');
      const out={ smallOffers:small, bigOffers:true, label:btn.textContent,
        rows:pl.querySelectorAll('.lrow').length, listShown:!pl.hidden,
        panelScrolls: panel.scrollHeight > panel.clientHeight };
      pl.querySelector('.lrow').click();
      out.navigatedTo = selected && selected.name;
      out.returnedToDetail = pl.hidden;
      return JSON.stringify(out);
    })()`); await wait(200);
    const BR = JSON.parse(browse);
    check("a clade too large to draw offers its list, and only then",
      BR.bigOffers && !BR.smallOffers && BR.rows === 1730 && BR.listShown
      && BR.panelScrolls && !!BR.navigatedTo && BR.returnedToDetail, browse);
    await ev(`closePanel(); clearStory()`); await wait(200);

    check("highlight list rows are clickable and focusable", rowClick === true && rowFocus === true && rowWorked === true,
      [rowClick, rowFocus].filter((r) => r !== true).map(String).join(" | "));

    // closing the list must re-arm inert, or an invisible panel keeps its tab stop
    await ev(`closePanel(); setStory('crops')`); await wait(400);
    await ev(`clearStory()`); await wait(160);
    check("cleared highlight list leaves nothing focusable",
      (await ev(`(()=>{const p=document.getElementById('panel'); return !p.classList.contains('open') && p.inert===true;})()`)) === true);
    await ev(`clearStory()`); await wait(120);

    // Every figure in the panel names its source, and a family quotes its own WCVP
    // row rather than the sum of its genera — the two differ by 1-4 species in 7
    // families, and the static family page shows the family row, so quoting the
    // aggregate made the app disagree with its own page.
    const provPanel = await ev(`(()=>{
      const n=nodeByName('Asteraceae'); select(n);
      const stats=document.getElementById('pstats').textContent;
      const src=document.getElementById('pstatsrc').textContent;
      const origin=document.getElementById('porigin').textContent;
      const dist=document.getElementById('pdist').textContent;
      return JSON.stringify({
        quotesFamilyRow: stats.includes(n.speciesCount.toLocaleString()),
        speciesSourced: /Kew WCVP/.test(src),
        ageSourced: /megatree/.test(origin),
        distSourced: /WGSRPD/.test(dist),
      });})()`); await wait(150);
    const PP = JSON.parse(provPanel);
    check("the panel sources every figure and quotes the family's own count",
      PP.quotesFamilyRow && PP.speciesSourced && PP.ageSourced && PP.distSourced, provPanel);

    // an undated lineage says why rather than showing nothing
    const undated = await ev(`(()=>{
      const n=nodeByName('Bryopsida'); if(!n) return 'missing';
      select(n);
      return document.getElementById('porigin').textContent;
    })()`); await wait(150);
    check("an undated lineage explains its absence",
      /not dated/i.test(undated) && /non-vascular/i.test(undated), String(undated).slice(0, 70));
    await ev(`closePanel()`); await wait(120);

    // Sprint K: facet filter highlights matching families with a live count
    await ev(`filter.rich=5000; filter.lineage=null; filter.region=null; filter.age=null; buildFilterUI(); applyFilter();`); await wait(400);
    check("filter highlights matching families",
      (await ev(`activeStory==='_filter' && /famil(y|ies) match/.test(document.getElementById('fcount').textContent) && document.querySelectorAll('.node.hl').length>0`)) === true);
    await ev(`clearFilter()`); await wait(120);

    // Expanding a match under an active filter must label what it reveals.
    // filterMatches() only ever collects families, so a family's genera are never
    // in storySet — and labelLOD muted every non-match outright, which made those
    // genera permanently unlabelable. Drilling into a filtered family gave a ring
    // of anonymous dots.
    await ev(`switchMode('radial'); filter.rich=null; filter.lineage='fern'; filter.region=null; filter.age=null; buildFilterUI(); applyFilter();`); await wait(500);
    // fit first: viewport virtualization only mounts what is on screen, and the
    // preceding checks leave the view zoomed somewhere else entirely
    await ev(`fit(0)`); await wait(400);
    const drilled = await ev(`(()=>{
      const n=nodeByName('Matoniaceae'); if(!n) return 'no Matoniaceae';
      if(n.open) toggle(n);        // start closed regardless of what earlier checks left open
      select(n); toggle(n);
      const kids=n.children||[];
      const mounted=kids.filter(k=>nodeEls.get(k._id)).length;
      const labelled=kids.filter(k=>{const el=nodeEls.get(k._id); return el && el.__lab;}).length;
      return JSON.stringify({kids:kids.length, mounted, labelled});
    })()`); await wait(200);
    const D = typeof drilled === "string" && drilled[0] === "{" ? JSON.parse(drilled) : {};
    check("expanding a filtered family labels its genera",
      D.kids > 0 && D.mounted === D.kids && D.labelled === D.kids,
      `${D.labelled} labelled / ${D.mounted} mounted / ${D.kids} genera`);
    await ev(`clearFilter(); clearStory(); closePanel()`); await wait(200);

    // Colour modes must repaint what is already mounted. Pooled shells are painted
    // once at mount, so most nodes kept the previous mode's colour — the switcher
    // recoloured the legend and almost nothing else.
    await ev(`clearStory(); closePanel(); exitFocus(); switchMode('radial')`); await wait(VIEW);
    const repaint = await ev(`(()=>{
      const stale=m=>{ let bad=0, seen=0;
        for(const [id,el] of nodeEls){ const n=idMap.get(id); if(!n) continue;
          seen++; if(el.style.getPropertyValue('--lc').trim()!==color(n)) bad++; }
        return {mode:m, seen, bad}; };
      const out=[];
      for(const m of ['age','region','lineage']){ setColorMode(m); out.push(stale(m)); }
      return JSON.stringify(out);})()`);
    const repaintRows = JSON.parse(repaint);
    check("colour modes repaint every mounted node", repaintRows.every((r) => r.seen > 0 && r.bad === 0),
      repaintRows.map((r) => `${r.mode}: ${r.bad}/${r.seen} stale`).join(", "));

    // a #c= deep link paints the tree it lands on, not just the legend
    await ev(`history.pushState(null,'','#c=region'); applyHash();`); await wait(600);
    const deepPaint = await ev(`(()=>{ let bad=0, seen=0;
      for(const [id,el] of nodeEls){ const n=idMap.get(id); if(!n) continue;
        seen++; if(el.style.getPropertyValue('--lc').trim()!==color(n)) bad++; }
      return JSON.stringify({colorMode, seen, bad});})()`);
    const dp = JSON.parse(deepPaint);
    check("#c= deep link paints the tree it lands on", dp.colorMode === "region" && dp.seen > 0 && dp.bad === 0,
      `${dp.bad}/${dp.seen} stale in ${dp.colorMode}`);
    await ev(`setColorMode('lineage'); history.replaceState(null,'',location.pathname);`); await wait(150);

    // Labels are chosen inside render(), before the highlight classes exist, and a
    // culled label is removed from the DOM — so switching filters used to strip the
    // labels off matches that were already mounted, and clearing never restored them.
    // In tree mode every match is label-eligible, so the check doesn't depend on
    // whatever frontier an earlier test left behind (radial skips open interiors).
    // fit(0) then frames the whole tree, so the matches are mounted *before* the
    // filters change — which is the only state where losing a label is possible.
    // Without it the viewport sits wherever the last test left it and the tally
    // can come up empty on a slower runner.
    await ev(`clearFilter(); clearStory(); closePanel(); switchMode('tree')`); await wait(VIEW);
    await ev(`fit(0)`); await wait(400);
    const labels = await ev(`(()=>{
      // radial deliberately leaves *open* interior clades unlabelled, so measure
      // against the set the app is willing to label, not every match
      const tally=()=>{ let due=0, got=0;
        for(const el of document.querySelectorAll('#nodes .node.hl')){ const n=el.__node; if(!n) continue;
          if(mode!=='tree' && n.open && (n.children||[]).length) continue;
          due++; if(el.__lab) got++; }
        return {due, got}; };
      filter.rich=null; filter.lineage='mono'; filter.region=null; filter.age=null; buildFilterUI(); applyFilter();
      const a=tally();
      filter.lineage=null; filter.rich=1000; buildFilterUI(); applyFilter();
      const b=tally();
      clearFilter();
      const cleared=[...document.querySelectorAll('#nodes .node')].filter(e=>e.__lab).length;
      return JSON.stringify({a,b,cleared,lit:b.got});})()`);
    const L = JSON.parse(labels);
    check("every label-eligible match keeps its label across filter changes",
      L.a.due > 0 && L.a.got === L.a.due && L.b.due > 0 && L.b.got === L.b.due,
      `first ${L.a.got}/${L.a.due}, second ${L.b.got}/${L.b.due}`);
    check("clearing a highlight restores the ordinary labels", L.cleared > L.lit, `${L.lit} lit → ${L.cleared} after clear`);
    await wait(150);

    // Sprint O: the whole view round-trips through the URL hash (deep-linking)
    await ev(`switchMode('tree')`); await wait(VIEW);
    await ev(`select(nodeByName('Rosaceae'))`); await wait(150);
    const encoded = await ev(`shareHash()`);
    check("view state encodes into the hash", /m=tree/.test(encoded) && /sel=Rosaceae/.test(encoded), encoded);
    await ev(`closePanel(); switchMode('radial')`); await wait(VIEW);
    await ev(`history.pushState(null,'','#c=region&sel=Orchidaceae'); applyHash();`); await wait(400);
    check("hash restores colour + selection",
      (await ev(`colorMode==='region' && selected && selected.name==='Orchidaceae'`)) === true);
    await ev(`colorMode='lineage'; buildColorUI(); closePanel(); history.replaceState(null,'',location.pathname); render();`); await wait(150);

    // Back/Forward is what a user actually presses, and it runs a different path:
    // the popstate listener plus resetView()'s seven teardown calls. Calling
    // applyHash() directly (above) covers decoding only.
    await ev(`select(nodeByName('Rosaceae'))`); await wait(220);
    await ev(`select(nodeByName('Poaceae'))`); await wait(220);
    await ev(`history.back()`);
    const wentBack = await until(`selected && selected.name==='Rosaceae'`);
    await ev(`history.forward()`);
    const wentFwd = await until(`selected && selected.name==='Poaceae'`);
    check("Back and Forward restore the previous view", wentBack === true && wentFwd === true,
      `back=${wentBack} forward=${wentFwd}`);
    await ev(`closePanel(); history.replaceState(null,'',location.pathname);`); await wait(120);

    // The hash is the only untrusted input this app accepts, and five of its nine
    // parameters were taken on trust. #t=abc made timeNow NaN — a readout reading
    // "NaN Ma · Quaternary" and aria-valuenow="NaN" on a role="slider" — and then
    // shareHash() handed the corruption back out, so Share propagated it. Nothing
    // threw, which is exactly why the no-console-errors check couldn't see it.
    const junk = await ev(`(()=>{
      history.pushState(null,'','#t=abc&fl=notALineage&fg=42&fa=garbage&fr=notANumber&m=nope&c=nope');
      applyHash();
      const tb=document.getElementById('timebar');
      return JSON.stringify({
        emitted: shareHash(),
        filter: {...filter},
        timeNow: typeof timeNow==='number' ? (Number.isFinite(timeNow)?'finite':'NaN') : String(timeNow),
        readout: tb.textContent,
        aria: (tb.querySelector('[role=slider]')||{getAttribute:()=>null}).getAttribute('aria-valuenow'),
      });})()`); await wait(300);
    const J = JSON.parse(junk);
    check("a malformed link is refused, not absorbed",
      !/NaN|notALineage|garbage|notANumber|nope|42/.test(J.emitted + J.readout + String(J.aria))
      && J.timeNow !== "NaN"
      && Object.values(J.filter).every((v) => v === null), junk);
    await ev(`resetView(); history.replaceState(null,'',location.pathname);`); await wait(200);

    // …and a link the app itself produced must survive the round trip, which is the
    // one property that makes Share trustworthy. Compared as sets: the emitted order
    // is shareHash()'s business, not the caller's.
    const same = (a, b) => JSON.stringify([...new URLSearchParams(a.replace(/^#/, ""))].sort())
                        === JSON.stringify([...new URLSearchParams(b.replace(/^#/, ""))].sort());
    for (const [what, hash] of [
      ["view + colour + focus + selection", "#m=tree&c=region&fo=Asteraceae&sel=Asteraceae"],
      ["filter facets", "#fr=1000&fl=rosid&fa=ancient"],
      ["time", "#t=120"],
    ]) {
      await ev(`resetView(); history.pushState(null,'','${hash}'); applyHash();`); await wait(400);
      const out = await ev(`shareHash()`);
      check(`a shared link round-trips — ${what}`, same(hash, out), `${hash} → ${out}`);
    }
    await ev(`resetView(); history.replaceState(null,'',location.pathname);`); await wait(200);

    // Leaving the timeline does clear t= from the address bar, but only indirectly:
    // exitTime() clears timeMode, then calls pausePlay(), whose replaceHash() is what
    // actually rewrites the URL. Nothing says so at either site, and a reader tidying
    // pausePlay() out of exitTime() would strand #t=340 over a present-day tree.
    // Asserted on location.hash rather than shareHash(), which stops emitting t= on
    // its own the moment timeMode clears and so would pass either way. replaceHash()
    // below because setTime() deliberately doesn't write — the scrubber reflects a
    // settled time, on pointerup, rather than flooding history.
    await ev(`enterTime(); setTime(200); replaceHash();`); await wait(300);
    const tOn = await ev(`location.hash`);
    await ev(`exitTime()`); await wait(250);
    const tOff = await ev(`location.hash`);
    check("leaving the timeline takes its time out of the URL",
      /t=200/.test(tOn) && !/t=/.test(tOff), `${tOn || "(empty)"} → ${tOff || "(empty)"}`);
    await ev(`resetView(); history.replaceState(null,'',location.pathname);`); await wait(200);

    // The focused subtree is view state like any other: it belongs in the URL, Back
    // has to unwind it, and nothing may select a taxon it doesn't contain. It used
    // to do none of the three — a shared link dropped the focus, Back left the
    // address bar describing the landing view, and the panel would happily describe
    // a taxon with no node on screen while focusNode() panned to stale coordinates.
    await ev(`reroot(nodeByName('Asteraceae'))`); await wait(700);
    check("a focused subtree encodes into the hash", /fo=Asteraceae/.test(await ev(`shareHash()`)), await ev(`shareHash()`));
    await ev(`renderRoot=ROOT; updateFocusBar(); render(); relabelAll(); history.pushState(null,'','#fo=Fabaceae'); applyHash();`); await wait(400);
    check("hash restores the focused subtree", (await ev(`renderRoot && renderRoot.name==='Fabaceae'`)) === true);

    // selecting outside the focus must leave it, so the selection is something you can see
    await ev(`select(nodeByName('Orchidaceae'))`); await wait(300);
    check("selecting outside the focus leaves it, and the node is mounted",
      (await ev(`renderRoot===ROOT && selected.name==='Orchidaceae' && nodeEls.has(selected._id)`)) === true,
      await ev(`JSON.stringify({rr:renderRoot.name, mounted:nodeEls.has(selected._id)})`));

    await ev(`closePanel(); history.replaceState(null,'',location.pathname);`); await wait(120);
    await ev(`reroot(nodeByName('Poaceae'))`); await wait(700);
    await ev(`history.back()`);
    const focusBack = await until(`renderRoot===ROOT && document.getElementById('focusbar').getAttribute('aria-hidden')==='true'`);
    check("Back leaves a focused subtree", focusBack === true, await ev(`renderRoot.name`));
    await ev(`renderRoot=ROOT; updateFocusBar(); render(); relabelAll(); closePanel(); history.replaceState(null,'',location.pathname);`); await wait(150);

    // Sprint P: "Surprise me" flies to a notable taxon and names why in a toast
    await ev(`clearStory(); surprise()`); await wait(600);
    const surprised = await ev(`!!selected && wonderPool.some(([n])=>n===selected) && !document.getElementById('toast').hidden && document.getElementById('toast').textContent.trim().length>0`);
    check("surprise me lands on a notable taxon with a reason", surprised === true);
    await ev(`closePanel()`); await wait(80);

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

    // The minimap had no assertion of any kind: test/mutate.mjs made renderMinimap()
    // a no-op and the whole suite still passed. It is also the one un-virtualized
    // render path, so it is the one most likely to be quietly broken by work
    // elsewhere.
    const mm = await ev(`(()=>{
      switchMode('radial'); toOrders(); fit(0);
      const c=document.getElementById('mmcontent'), vp=document.getElementById('mmvp');
      const marks=c.children.length;
      const before=vp.getAttribute('x')+','+vp.getAttribute('width');
      T.k*=1.7; applyT();
      const after=vp.getAttribute('x')+','+vp.getAttribute('width');
      return JSON.stringify({marks, tracksViewport: before!==after, before, after});})()`); await wait(200);
    const MM = JSON.parse(mm);
    check("the minimap draws the tree and tracks the viewport",
      MM.marks > 50 && MM.tracksViewport === true, mm);
    await ev(`fit(0)`); await wait(200);

    // timeline
    await ev(`exitFocus(); switchMode('radial')`); await wait(500);
    await ev(`document.getElementById('btnTime').click()`); await wait(500);
    const timeOn = await ev(`timeMode===true`);
    await ev(`setTime(200)`); await wait(300);
    await ev(`play()`); await wait(700);
    await ev(`pausePlay(); document.getElementById('btnTime').click()`); await wait(400);
    check("timeline toggles on, plays, and toggles off", timeOn && (await ev(`timeMode===false`)));

    // The timeline knows ORIGINS, not abundance. A family's species count is its
    // count today, so quoting one for 340 Ma would fabricate exactly what Sprint V
    // removed — and nothing in this data goes extinct, so nothing may say "alive".
    const deep = await ev(`(()=>{
      enterTime(); setTime(340);
      const bar=document.getElementById('timebar').textContent;
      const foot=document.getElementById('footer').textContent;
      const r=timeReadout();
      const undatedMarked=document.querySelectorAll('.node.undated').length;
      const framed=livingNodes().length;
      return JSON.stringify({
        readoutChanged: /Carboniferous/.test(bar),
        noSpeciesClaim: !/species/i.test(bar) && !/~[\\d,]{4,}/.test(foot),
        footerFollows: /Carboniferous/.test(foot),
        undatedMarked, undatedCounted: r.undated, framed,
      });})()`); await wait(900);
    const DT = JSON.parse(deep);
    check("the timeline readout follows the clock", DT.readoutChanged && DT.footerFollows, deep);
    check("the timeline never quotes species through time", DT.noSpeciesClaim === true, deep);
    check("undated lineages are marked, not silently dated",
      DT.undatedMarked > 0 && DT.undatedCounted > 0, deep);

    // The picture and the number describe the same screen, so they must agree at
    // every instant. They did not: the render stamped __age = effAge while the
    // readout used `ageMy ?? effAge`, and the two diverge for twelve taxa — all of
    // them headline clades. Lamiales is the worst: crown 71.0 vs effAge 135.8, so
    // anywhere between them it was drawn at full opacity and left out of the count.
    const agree = await ev(`(()=>{
      const bad=[];
      for(const t of [50,100,140,200,300]){
        setTime(t);
        const r=timeReadout();
        let drawn=0;
        for(const n of visibleNodes){
          if(n.rank==='genus') continue;
          const el=nodeEls.get(n._id);
          if(el && el.__age!=null && t<=el.__age) drawn++;
        }
        if(drawn!==r.originated) bad.push({t, drawn, counted:r.originated});
      }
      const lam=nodeByName('Lamiales');
      setTime(0);
      return JSON.stringify({bad, gap:+(lam.effAge-lam.ageMy).toFixed(1)});
    })()`); await wait(300);
    const AG = JSON.parse(agree);
    // The check below compares el.__age against the count — both derived from the
    // data, neither from the screen. test/mutate.mjs exposed the gap: make
    // ageOpacity() return 1 unconditionally, so every lineage is painted at every
    // instant and Deep Time becomes decoration, and it still passed. So assert the
    // pixels first: things must actually be hidden, and only in deep time.
    const painted = await ev(`(()=>{
      const tally = t => { setTime(t); let dim=0, lit=0;
        for(const el of nodeEls.values()){ const o=parseFloat(el.style.opacity||'1');
          (o<0.5 ? dim++ : lit++); }
        return {dim, lit}; };
      const now=tally(0), deep=tally(320);
      setTime(0);
      return JSON.stringify({now, deep});})()`); await wait(200);
    const PT = JSON.parse(painted);
    check("the timeline actually hides what had not originated yet",
      PT.now.dim === 0 && PT.deep.dim > PT.deep.lit, painted);

    check("every lineage the timeline draws is one it counts", AG.bad.length === 0,
      AG.bad.length ? JSON.stringify(AG.bad) : `checked 5 instants; Lamiales crown/effAge gap ${AG.gap} Ma`);

    // ...but only while the clock is in deep time. At the present the tree is
    // simply today: nothing is uncertain, and 17 dashed nodes read as broken.
    const atNow = await ev(`(()=>{
      setTime(0);
      const present=document.querySelectorAll('.node.undated').length;
      setTime(120);
      const deep=document.querySelectorAll('.node.undated').length;
      setTime(0);
      return JSON.stringify({present, deep});
    })()`); await wait(300);
    const AN = JSON.parse(atNow);
    check("the undated marking is absent at the present day",
      AN.present === 0 && AN.deep > 0, atNow);

    // The frame must follow the living tree, not stay fitted to the present one.
    //
    // Twice now this has gone red on CI and green locally, because both attempts
    // measured the ANIMATION: first a fixed deadline, then a settle-detector that
    // rAF throttling tripped early. How fast a damped approach converges is a
    // property of the machine, not of the code.
    //
    // So the animated path only asserts direction — it moved toward a closer fit —
    // and the exact assertion lives in the reduced-motion session below, where the
    // same code snaps in one step and the result is deterministic.
    const framing = await ev(`(()=>{
      setTime(0);
      return new Promise(res=>setTimeout(()=>{
        const kPresent=T.k;
        setTime(340);
        setTimeout(()=>res(JSON.stringify({
          kPresent:+kPresent.toFixed(3), kDeep:+T.k.toFixed(3),
          target:+computeFitT(livingNodes(), mode).k.toFixed(3),
          movedCloser: T.k > kPresent,
          towardTarget: T.k <= computeFitT(livingNodes(), mode).k + 0.01,
        })), 2500);
      }, 2000));
    })()`);
    const FR = JSON.parse(framing);
    check("the frame moves toward a fit on the living tree",
      FR.movedCloser && FR.towardTarget, framing);
    await ev(`exitTime()`); await wait(400);

    // An overlay owns its own input. Both of these used to reach the stage: the
    // slider's arrows drove the tree cursor, and the wheel zoomed the canvas
    // instead of scrolling whatever was under the pointer.
    await ev(`exitFocus(); switchMode('radial'); closePanel()`); await wait(VIEW);
    await ev(`document.getElementById('stage').dispatchEvent(new Event('focus'))`); await wait(80);
    await ev(`document.getElementById('btnTime').click()`); await wait(600);
    const t0 = await ev(`JSON.stringify([Math.round(timeNow), visibleNodes.length])`);
    await ev(`(()=>{const s=document.getElementById('tbtrack'); s.focus();
      s.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));})()`); await wait(400);
    const t1 = await ev(`JSON.stringify([Math.round(timeNow), visibleNodes.length])`);
    const [ma0, vis0] = JSON.parse(t0), [ma1, vis1] = JSON.parse(t1);
    check("slider arrows step time without collapsing the tree", ma1 > ma0 && vis1 === vis0,
      `${ma0}Ma/${vis0} nodes → ${ma1}Ma/${vis1} nodes`);
    await ev(`document.getElementById('btnTime').click()`); await wait(400);

    await ev(`select(nodeByName('Asteraceae'))`); await wait(200);
    const wheel = await ev(`(()=>{const p=document.getElementById('panel');
      if(p.scrollHeight<=p.clientHeight) return 'panel is not scrollable — test is vacuous';
      const k0=T.k, r=p.getBoundingClientRect();
      const e=new WheelEvent('wheel',{deltaY:200,bubbles:true,cancelable:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2});
      p.dispatchEvent(e);
      return JSON.stringify({prevented:e.defaultPrevented, zoomed:Math.abs(T.k-k0)>1e-6});})()`);
    check("wheel over the panel neither zooms nor is swallowed",
      wheel === '{"prevented":false,"zoomed":false}', String(wheel));
    await ev(`closePanel()`); await wait(80);

    // closing a menu hands focus back to its trigger instead of dropping it to <body>
    const menuFocus = await ev(`(()=>{ toggleMenu('filter');
      const f=document.getElementById('fclear'); if(!f) return 'no filter control to focus';
      f.focus(); closeMenu();
      const a=document.activeElement;
      return a && a.dataset && a.dataset.menu==='filter' ? true : 'focus landed on '+(a?a.tagName.toLowerCase():'nothing');})()`);
    check("closing a menu returns focus to its trigger", menuFocus === true, menuFocus === true ? "" : String(menuFocus));

    // perf HUD (E1)
    await ev(`togglePerf(true)`); await wait(300);
    check("perf HUD toggles on", (await ev(`!document.getElementById('perfhud').hidden`)) === true);

    // secondary pages (About / Controls modals)
    await ev(`document.getElementById('btnAbout').click()`); await wait(200);
    const aboutOpen = await ev(`document.getElementById('modal').classList.contains('show') && /About Yggdrasil/.test(document.getElementById('mbody').textContent)`);
    await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); await wait(200);
    const aboutClosed = await ev(`!document.getElementById('modal').classList.contains('show')`);
    check("About page opens and Escape closes it", aboutOpen === true && aboutClosed === true);

    // Mutually exclusive options must expose radio semantics, not aria-pressed —
    // four independent toggles is what a screen reader heard before.
    const seg = await ev(`(()=>{
      const v=document.getElementById('viewseg'), d=document.getElementById('depthseg');
      const ok=g=>g && g.getAttribute('role')==='radiogroup'
        && [...g.querySelectorAll('button')].every(b=>b.getAttribute('role')==='radio' && b.hasAttribute('aria-checked'))
        && g.querySelectorAll('[aria-checked="true"]').length===1;
      return JSON.stringify({view:ok(v), depth:ok(d)});
    })()`);
    const SEG = JSON.parse(seg);
    check("view and depth segments expose radio semantics", SEG.view && SEG.depth, seg);

    // Colour left the toolbar for the legend that explains it; Depth took its
    // place in the bar. Assert the move, not just that the controls exist.
    const ia = await ev(`(()=>({
      colourInBar: !!document.querySelector('[data-menu="colour"]'),
      colourHosts: document.querySelectorAll('[data-cmode-host]').length,
      colourInLegend: !!document.querySelector('#legendbar [data-cmode-host]'),
      depthInBar: !!document.querySelector('[data-menu="depth"]'),
    }))()`);
    check("Colour lives with its legend and Depth is in the bar",
      !ia.colourInBar && ia.colourInLegend && ia.depthInBar && ia.colourHosts >= 1,
      JSON.stringify(ia));

    // the footer names the sources; it must let you ask about them (this binding
    // broke once by being attached before the footer was rendered)
    const srcAbout = await ev(`(()=>{
      const b=document.getElementById('btnSourcesAbout'); if(!b) return 'missing';
      b.click();
      const open=document.getElementById('modal').classList.contains('show');
      const txt=document.getElementById('mbody').textContent;
      closeModal();
      return JSON.stringify({open, isAbout:/About Yggdrasil/.test(txt)});
    })()`); await wait(200);
    const SA = typeof srcAbout === "string" && srcAbout[0] === "{" ? JSON.parse(srcAbout) : {};
    check("the footer's sources line opens About", SA.open === true && SA.isAbout === true, String(srcAbout));

    // The source was reachable only from inside About, itself behind an unlabelled
    // ellipsis. This asserts the visible route, and that every repository link
    // agrees — they were four separate string literals until the rename made the
    // cost of that obvious.
    const src = await ev(`(()=>{
      closeModal();
      const gh=document.querySelector('footer .gh');
      const all=[...document.querySelectorAll('a[href*="github.com"]')].map(a=>a.getAttribute('href'));
      const body=aboutHTML();
      const inAbout=[...body.matchAll(/href="(https:\\/\\/github\\.com[^"]*)"/g)].map(m=>m[1]);
      const hosts=new Set([...all,...inAbout].map(u=>u.split('/').slice(0,5).join('/')));
      return JSON.stringify({
        footerLink: gh ? gh.getAttribute('href') : null,
        opensInNewTab: gh ? gh.getAttribute('rel')==='noopener' && gh.getAttribute('target')==='_blank' : false,
        hasMark: !!(gh && gh.querySelector('svg use')),
        distinctRepos: [...hosts],
      });})()`); await wait(150);
    const SRC = JSON.parse(src);
    check("the source is one click from the footer, not buried in About",
      SRC.footerLink === "https://github.com/oddurs/yggdrasil" && SRC.opensInNewTab && SRC.hasMark, src);
    check("every repository link names the same repository", SRC.distinctRepos.length === 1, src);

    // The interface accent must stay distinct from every lineage hue. The UI used
    // to borrow --l-fern, which meant the primary control and the fern branches
    // were literally the same colour — a chip could be mistaken for a lineage, and
    // retuning one moved the other.
    const palette = await ev(`(()=>{
      const cs=getComputedStyle(document.documentElement);
      const v=n=>cs.getPropertyValue(n).trim().toLowerCase();
      const accent=v('--accent');
      const lineage=['--l-bryo','--l-fern','--l-gymno','--l-basal','--l-mono',
                     '--l-rosid','--l-asterid','--l-eudicot','--l-root'].map(v);
      return JSON.stringify({accent, clash: lineage.filter(h=>h===accent)});
    })()`);
    const PAL = JSON.parse(palette);
    check("the UI accent is not a lineage hue", !!PAL.accent && PAL.clash.length === 0,
      PAL.clash.length ? `${PAL.accent} collides with a lineage` : PAL.accent);

    // and the selected state is a tint, not a saturated block — the thing that
    // made one control shout beside a canvas full of lineage colour
    const activeFill = await ev(`(()=>{
      const b=document.querySelector('#viewseg .ctl.on'); if(!b) return 'no active control';
      const bg=getComputedStyle(b).backgroundColor;
      const m=bg.match(/[\\d.]+/g).map(Number);
      const alpha = m.length > 3 ? m[3] : 1;
      // getComputedStyle reports the DECLARED colour, so a tint shows up as the
      // accent at low alpha rather than as dark channels. Composite it over the
      // control surface to measure what a person actually sees.
      const S=[18,21,26];                                   // --fill-1
      const lit=[0,1,2].map(i=>m[i]*alpha + S[i]*(1-alpha));
      return JSON.stringify({bg, alpha, composited:lit.map(Math.round)});
    })()`);
    const AF = JSON.parse(activeFill);
    check("the active control is a tint, not a saturated fill",
      AF.alpha <= 0.35 && Math.max(...AF.composited) < 90,
      `${AF.bg} → rgb(${AF.composited})`);

    // SEO: JSON-LD structured data + a crawlable text index of the tree are in the DOM
    const seoOk = await ev(`(()=>{ try{
      const ld=JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent);
      const crawl=document.querySelector('section[aria-label="The plant kingdom in text"]');
      return ld.length>=2 && !!crawl && /Orchidaceae/.test(crawl.textContent);
    }catch(e){ return 'threw: '+e.message; } })()`);
    check("SEO structured data + crawlable index present", seoOk === true, seoOk === true ? "" : String(seoOk));

    // The title and description are the strongest signals the app has, and both are
    // truncated by search engines rather than wrapped. Sprint S shipped a 186-char
    // description; two-thirds of it was never shown to anyone.
    const meta = JSON.parse(await ev(`JSON.stringify({
      t: document.title,
      d: (document.querySelector('meta[name=description]')||{}).content || ''
    })`));
    check("the title names the subject, within 60 chars",
      meta.t.length <= 60 && /plant/i.test(meta.t), `${meta.t.length}: ${meta.t}`);
    check("the description fits a search snippet (<=155)",
      meta.d.length > 0 && meta.d.length <= 155, String(meta.d.length));

    // the page must quote one species total, not two: the footer counts the way the
    // app aggregates, and the crawlable index used to sum family counts instead
    const totals = await ev(`(()=>{
      const f=document.getElementById('footer').textContent.match(/species catalogued\\s*~?([\\d,]+)/);
      const c=document.querySelector('section[aria-label="The plant kingdom in text"]').textContent.match(/roughly ([\\d,]+) accepted species/);
      return JSON.stringify({foot:f&&f[1], crawl:c&&c[1]});})()`);
    const T2 = JSON.parse(totals);
    check("the page quotes one species total", !!T2.foot && T2.foot === T2.crawl, `footer ${T2.foot}, crawlable index ${T2.crawl}`);

    // 6.2% of the aggregate is round estimates (27 unmatched families + every
    // bryophyte class; Bryopsida alone is a flat 11,000). Quoting the exact leaf
    // sum claims a precision the data hasn't got, so no visible total may.
    const precision = await ev(`(()=>{
      const exact=ROOT.agg.toLocaleString();
      const foot=document.getElementById('footer').textContent;
      const crawl=document.querySelector('section[aria-label="The plant kingdom in text"]').textContent;
      return JSON.stringify({exact, inFooter:foot.includes(exact), inCrawl:crawl.includes(exact)});
    })()`);
    const P = JSON.parse(precision);
    check("no headline total is quoted to six significant figures",
      !P.inFooter && !P.inCrawl, `${P.exact}${P.inFooter ? " in footer" : ""}${P.inCrawl ? " in crawl index" : ""}`);

    // and the estimate is owned in the open, with a figure that reconciles
    const prov = await ev(`(()=>{
      openModal(aboutHTML());
      const t=document.getElementById('mbody').textContent;
      const ok = t.includes(TOTALS.sourced.toLocaleString()) && /estimat/i.test(t)
                 && /bryophyte/i.test(t) && t.includes(totVasc.toLocaleString())
                 // the method and its limits are stated, not implied
                 && /most recent common ancestor/i.test(t) && /0\.5%/.test(t)
                 && /stem/i.test(t) && /Known gaps/i.test(t) && /synonym/i.test(t);
      closeModal && closeModal();
      return JSON.stringify({ok, reconciles: TOTALS.sourced+TOTALS.estimated===ROOT.agg});
    })()`);
    const PR = JSON.parse(prov);
    check("About states the sourced/estimated split and it reconciles",
      PR.ok === true && PR.reconciles === true, JSON.stringify(PR));

    // the document's first heading is its <h1>; the crawlable section used to be
    // injected ahead of the header, opening the page on an <h2>
    const firstHeading = await ev(`(document.querySelector('h1,h2,h3,h4,h5,h6')||{}).tagName`);
    check("the document opens on its h1", firstHeading === "H1", String(firstHeading));

    // PNG export builds its SVG/style without throwing (regression guard for the export path)
    const exportOk = await ev(`(()=>{ try{ buildExportSVG(); return true; }catch(e){ return 'threw: '+e.message; } })()`);
    check("PNG export builds without error", exportOk === true, exportOk === true ? "" : String(exportOk));

    // The discovery toast is the whole payload of "Surprise me". On a phone the
    // header wraps to ~177px tall, and the toast used to position against the
    // viewport rather than the stage — landing squarely behind it.
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await wait(400);
    await ev(`toast('Reachable on a phone?')`); await wait(200);
    const toastBox = await ev(`(()=>{
      const t=document.getElementById('toast').getBoundingClientRect();
      const h=document.querySelector('header.bar').getBoundingClientRect();
      return JSON.stringify({toastTop:Math.round(t.top), headerBottom:Math.round(h.bottom)});})()`);
    const { toastTop, headerBottom } = JSON.parse(toastBox);
    check("discovery toast clears the header on a phone", toastTop >= headerBottom,
      `toast top ${toastTop}, header bottom ${headerBottom} @390×844`);
    await send("Emulation.clearDeviceMetricsOverride", {});
    await wait(300);

    // The scene used to drift 5px/-4px on a 24s loop. On a diagram whose whole
    // job is relative position, comparing two nodes meant comparing two moving
    // targets — and it read as the canvas panning by itself while idle.
    const drift = await ev(`(()=>{
      const svg=document.getElementById('svg');
      const anim=getComputedStyle(svg).animationName;
      const t0=getComputedStyle(svg).transform;
      return new Promise(res=>setTimeout(()=>res(JSON.stringify({
        animationName:anim, movedWhileIdle: getComputedStyle(svg).transform !== t0,
      })), 2500));
    })()`);
    const DR = JSON.parse(drift);
    check("the scene does not drift while idle",
      DR.animationName === "none" && DR.movedWhileIdle === false, drift);

    check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" | "));
  });

  // reduced-motion: a fresh session with the media feature forced
  await session(["--force-prefers-reduced-motion"], async ({ ev, errors }) => {
    check("reduced-motion is active", (await ev(`matchMedia('(prefers-reduced-motion:reduce)').matches`)) === true);
    check("no ambient animation under reduced-motion",
      (await ev(`getComputedStyle(document.getElementById('svg')).animationName`)) === "none");
    await ev(`switchMode('tree'); (()=>{const n=nodeByName('Fabaceae'); if(n) toggle(n);})()`); await wait(500);
    check("structural change is instant (no animating class)",
      (await ev(`!document.getElementById('stage').classList.contains('animating')`)) === true);
    check("no console errors under reduced-motion", errors.length === 0, errors.slice(0, 3).join(" | "));

    // Under reduced motion the timeline reframes in ONE step at each period
    // boundary rather than easing, so the frame can be asserted exactly here —
    // no animation to race, no dependence on how fast the runner is.
    const rmFrame = await ev(`(()=>{
      enterTime(); setTime(0);
      const kPresent=T.k;
      setTime(340);
      const target=computeFitT(livingNodes(), mode).k;
      const out={kPresent:+kPresent.toFixed(3), kDeep:+T.k.toFixed(3), target:+target.toFixed(3),
                 exact: Math.abs(T.k-target) < 1e-6, closerIn: T.k > kPresent};
      exitTime();
      return JSON.stringify(out);
    })()`);
    const RM = JSON.parse(rmFrame);
    check("reduced motion reframes exactly onto the living tree's fit",
      RM.exact && RM.closerIn, rmFrame);
  });

  // ---------- label scale ----------
  // Its own session: this measures geometry at four zoom levels on a fully expanded
  // tree, and the main session reaches this point with a genus expansion, a filter
  // and a panel behind it. Cheaper to start from a clean page than to unwind all of it.
  await session([], async ({ ev }) => {
    // Labels live inside the zoomed viewport, so their size was multiplied by the
    // zoom: 34px at the landing fit, 43px at the zoom a guided tour lands on, 85px
    // at k=1.5. Type that grows with the picture stays equally crowded forever — the
    // gap between two neighbours grows at the same rate as the words in it — so
    // zooming in could never resolve a collision, only enlarge both sides of it.
    //
    // One named label across four zooms, not a median over all of them: which nodes
    // carry a label changes with the zoom, so a median mixes different words at
    // different angles and measures the wrong thing.
    const labelZoom = await ev(`(()=>{
      switchMode('radial'); expandAll();
      const n=nodeByName('Asteraceae');
      const measure = k => {
        // re-centre as we zoom, or virtualization unmounts the node being measured
        const r=stage.getBoundingClientRect();
        T.k=k; T.x=r.width/2-n.x*k; T.y=r.height/2-n.y*k; applyT(); applyMount(false); labelLOD();
        const el=nodeEls.get(n._id), t=el&&el.__lab;
        if(!t||!t.textContent.trim()) return 0;
        const b=t.getBoundingClientRect();
        return +Math.hypot(b.width,b.height).toFixed(1);   // rotation-independent extent
      };
      return JSON.stringify({below:measure(0.5), atCap:measure(0.85), deep:measure(2.5), deeper:measure(3.5)});
    })()`); await wait(300);
    const LZ = JSON.parse(labelZoom);
    check("label type grows with the zoom, then stops",
      LZ.below > 0 && LZ.below < LZ.atCap            // below the cap it still scales, as designed
      && LZ.deep <= LZ.atCap * 1.02 && LZ.deeper <= LZ.atCap * 1.02, labelZoom);
  });

  // ---------- phone ----------
  // The app had never been exercised below 1400px. test/pages.mjs checks the 567
  // static pages at 390, but the thing those pages link *to* was measured only at
  // desktop width, so every mobile claim about it was inference.
  //
  // It has to be Emulation.setDeviceMetricsOverride, not a narrow --window-size:
  // Chrome refuses to open a window under ~500px and quietly gives you a wider one,
  // so a suite that asked for 390 would have been asserting against 500 and passing.
  await session([], async ({ ev, errors, send }) => {
    const phone = async (w, h) => {
      await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 3, mobile: true });
      await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await wait(700);
      await ev(`fit(0)`); await wait(400);
    };
    await phone(390, 844);
    check("the phone viewport is really 390 wide", (await ev(`innerWidth`)) === 390, String(await ev(`innerWidth`)));

    const layout = await ev(`(()=>{
      const d=document.documentElement;
      const p=document.getElementById('panel');
      return JSON.stringify({
        overflowsX: d.scrollWidth > d.clientWidth,
        minimapHidden: getComputedStyle(document.querySelector('.minimap')).display === 'none',
        searchFullWidth: document.getElementById('q').getBoundingClientRect().width > 300,
        mobileMediaActive: matchMedia('(max-width:680px)').matches,
      });})()`);
    const LY = JSON.parse(layout);
    check("the page does not scroll sideways on a phone", LY.overflowsX === false, layout);
    check("the phone layout is the one the CSS intends", LY.mobileMediaActive && LY.minimapHidden && LY.searchFullWidth, layout);

    await ev(`select(nodeByName('Rosaceae'))`); await wait(500);
    // flush with the bottom of the stage, not of the viewport — the footer lives
    // below the stage, and the panel is positioned against its stage ancestor
    const sheet = await ev(`(()=>{
      const r=document.getElementById('panel').getBoundingClientRect();
      const s=document.getElementById('stage').getBoundingClientRect();
      return JSON.stringify({panelBottom:Math.round(r.bottom), stageBottom:Math.round(s.bottom),
        width:Math.round(r.width), sheet: Math.abs(r.bottom-s.bottom)<2 && Math.abs(r.width-innerWidth)<2});})()`);
    check("the detail panel is a bottom sheet, not a floating card", JSON.parse(sheet).sheet === true, sheet);

    // A finger is not a mouse pointer: the close button is the way out of that sheet.
    const close = await ev(`(()=>{const r=document.getElementById('pclose').getBoundingClientRect();
      return JSON.stringify({w:Math.round(r.width), h:Math.round(r.height)});})()`);
    const C = JSON.parse(close);
    check("the panel's close button clears the 24px touch floor", C.w >= 24 && C.h >= 24, close);

    // Three surfaces are anchored to the bottom of the stage and each was placed
    // there independently: the sheet covered the zoom pill outright, and turning
    // the timeline on painted the scrubber across the sheet's lower third.
    const zoom = await ev(`(()=>{const r=document.querySelector('.zoomctl').getBoundingClientRect();
      const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
      const z=document.querySelector('.zoomctl');
      return JSON.stringify({reachable: !!hit && (hit===z || z.contains(hit)),
        coveredBy: hit ? (hit.id||hit.className||hit.tagName) : 'nothing'});})()`);
    check("the zoom pill is not buried under the bottom sheet", JSON.parse(zoom).reachable === true, zoom);

    await ev(`enterTime(); setTime(200)`); await wait(700);
    const stack = await ev(`(()=>{
      const p=document.getElementById('panel').getBoundingClientRect();
      const t=document.getElementById('timebar').getBoundingClientRect();
      const z=document.querySelector('.zoomctl').getBoundingClientRect();
      const over=(a,b)=>Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      return JSON.stringify({panelOverTimebar:Math.round(over(p,t)), zoomOverPanel:Math.round(over(z,p))});})()`);
    const ST = JSON.parse(stack);
    check("panel, scrubber and zoom pill stack instead of overlapping",
      ST.panelOverTimebar === 0 && ST.zoomOverPanel === 0, stack);

    // The bands centre their label and clip it, so a name that doesn't fit shows
    // its middle: "Carboniferous" rendered as "nifermi". The fit test was in
    // percent of the axis, which is not a unit that knows how wide a word is.
    const bands = await ev(`(()=>{
      const bad=[];
      for(const b of document.querySelectorAll('.tbbands .bd')){
        const s=b.querySelector('span'); if(!s) continue;
        if(s.scrollWidth > b.clientWidth) bad.push(b.dataset.per+': '+s.textContent);
      }
      // the era labels aren't clipped by anything, so their failure mode is running
      // off the end of the track rather than overlapping each other
      const track=document.getElementById('tbtrack').getBoundingClientRect();
      const spill=[...document.querySelectorAll('.tberas i')]
        .filter(i=>i.textContent && i.getBoundingClientRect().right > track.right+1)
        .map(i=>i.textContent);
      return JSON.stringify({clipped:bad, eraSpill:spill});})()`);
    const BD = JSON.parse(bands);
    check("no period label is drawn wider than the room it has",
      BD.clipped.length === 0 && BD.eraSpill.length === 0, bands);

    await ev(`exitTime(); closePanel()`); await wait(400);
    const foot = await ev(`(()=>{const f=document.querySelector('footer.meta');
      return JSON.stringify({hidden: f.scrollWidth>f.clientWidth, h:Math.round(f.getBoundingClientRect().height)});})()`);
    check("the footer hides none of itself behind an invisible scroll",
      JSON.parse(foot).hidden === false, foot);

    // The colour switcher is reachable on a phone (the overflow menu) but the legend
    // that explains what the colours mean is display:none below 680px — so you could
    // recolour all 14,740 nodes by native region and be handed nine unexplained hues.
    // Wherever the switcher goes, the key goes.
    const key = await ev(`(()=>{
      const out={};
      for(const m of ['lineage','age','region']){
        setColorMode(m);
        const host=[...document.querySelectorAll('[data-lgkey-host]')]
          .find(h=>h.offsetParent!==null || h.closest('#menu-more'));
        const menu=document.getElementById('menu-more');
        out[m]={entries: host?host.querySelectorAll('.lg').length:0,
                title: (menu.querySelector('[data-lgtitle-host]')||{}).textContent||''};
      }
      setColorMode('lineage');
      return JSON.stringify(out);})()`);
    const K = JSON.parse(key);
    check("every colour mode carries its key where a phone can reach it",
      K.lineage.entries >= 8 && K.age.entries >= 10 && K.region.entries >= 10
      && K.region.title === "Native region", key);

    // …and the menu that now holds it must still fit the screen it opens on
    const menuFit = await ev(`(()=>{
      setColorMode('age');
      document.querySelector('[data-menu="more"]').click();
      const r=document.getElementById('menu-more').getBoundingClientRect();
      const out={h:Math.round(r.height), bottom:Math.round(r.bottom), viewportH:innerHeight, fits:r.bottom<=innerHeight+1};
      closeMenu(); setColorMode('lineage');
      return JSON.stringify(out);})()`); await wait(200);
    check("the overflow menu still fits the phone with a key in it", JSON.parse(menuFit).fits === true, menuFit);

    check("no console errors on a phone", errors.length === 0, errors.slice(0, 3).join(" | "));
  });

  // The phone's opening depth is chosen so that the first thing anyone does — tap a
  // node — lands on a real target. This session reloads at 390 so it sees the boot
  // path rather than a desktop boot resized afterwards.
  await session([], async ({ ev, send }) => {
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Page.reload", {});
    await poll(() => ev(`typeof ROOT!=='undefined' && !!ROOT && visibleNodes.length>0`), 15000, "phone boot");
    await ev(`(()=>{const w=document.getElementById('wexplore'); if(w) w.click();})()`);
    await wait(1400);

    const gaps = await ev(`(()=>{
      const c=[];
      for(const el of document.querySelectorAll('#nodes .node')){const r=el.getBoundingClientRect();
        if(r.width) c.push([r.left+r.width/2, r.top+r.height/2]);}
      const d=c.map(([x,y],i)=>{let m=1e9; c.forEach(([a,b],j)=>{ if(i!==j) m=Math.min(m,Math.hypot(x-a,y-b)); }); return m;}).sort((a,b)=>a-b);
      const lit=[...document.querySelectorAll('#depthseg .ctl')].filter(b=>b.classList.contains('on')).map(b=>b.textContent);
      return JSON.stringify({visible:c.length, p10:+d[Math.floor(d.length*0.1)].toFixed(1),
        labelled:document.querySelectorAll('#nodes .node text').length, depthLit:lit});})()`);
    const G = JSON.parse(gaps);
    check("a phone opens on nodes a finger can hit", G.p10 >= 24, gaps);
    // …and on enough of them to still read as a tree rather than a broken app —
    // the first attempt at this cleared the touch floor with nine dots in an empty
    // field, which no measurement objected to and no one would call a tree of life
    check("a phone still opens on something that reads as a tree", G.visible >= 40 && G.labelled >= 20, gaps);
    check("no Depth preset claims a state it isn't", G.depthLit.length === 0, gaps);
  });

  // …and none of that reaches the desktop, which was never the problem
  await session([], async ({ ev }) => {
    const desk = await ev(`(()=>{
      const lit=[...document.querySelectorAll('#depthseg .ctl')].filter(b=>b.classList.contains('on')).map(b=>b.textContent);
      return JSON.stringify({visible:visibleNodes.length, depthLit:lit});})()`);
    const D = JSON.parse(desk);
    check("the desktop still opens on the full order-level tree",
      D.visible > 120 && D.depthLit.join() === "Orders", desk);
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
