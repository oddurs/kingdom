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
    await search("Poaceae");
    const qreach = await clickAt(".qrow", "Poaceae");
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
    await ev(`switchMode('radial')`); await wait(VIEW);

    // accessibility: selecting a taxon announces it to the polite live region
    await ev(`select(nodeByName('Poaceae'))`); await wait(150);
    check("selection is announced to the live region", (await ev(`/Poaceae/.test(document.getElementById('a11y-status').textContent)`)) === true);

    // an open panel must be genuinely reachable, not just visible — `inert` left
    // armed makes it look right in a screenshot and refuse every real interaction
    const pfocus = await tabTo("#pclose");
    check("open detail panel is keyboard-reachable", pfocus === true, pfocus === true ? "" : String(pfocus));

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

    // …and its result rows are reachable. The list used to open the panel without
    // clearing `inert`, so every row was sealed behind the canvas.
    const rowFocus = await tabTo(".lrow");            // focus first: clicking a row swaps the list out for the detail card
    const rowClick = await clickAt(".lrow");
    const rowWorked = await until(`selected && document.getElementById('plist').hidden`);
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

    // timeline
    await ev(`exitFocus(); switchMode('radial')`); await wait(500);
    await ev(`document.getElementById('btnTime').click()`); await wait(500);
    const timeOn = await ev(`timeMode===true`);
    await ev(`setTime(200)`); await wait(300);
    await ev(`play()`); await wait(700);
    await ev(`pausePlay(); document.getElementById('btnTime').click()`); await wait(400);
    check("timeline toggles on, plays, and toggles off", timeOn && (await ev(`timeMode===false`)));

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
