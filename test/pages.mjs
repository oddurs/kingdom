#!/usr/bin/env node
// Structural checks for the generated taxon pages in _site/.
//
// 567 documents are far too many to review by eye, and the ways a generator
// fails at that scale are quiet ones: a slug that stops matching its canonical,
// a link to a page that was never emitted, a family whose data thinned out until
// its page says almost nothing. None of those throw. All of them are the kind of
// thing that turns a real corpus into a thin-content liability.
//
// No browser needed — these are static documents, so this runs in a second.
//
// Usage:   node test/pages.mjs [_site]
// Exit:    0 = all checks passed, 1 = a check failed.

import { readFileSync, existsSync, statSync, globSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, extname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(process.argv[2] || `${HERE}/../_site`);

// A page below this reads as a stub to a quality rater, and 567 stubs is worse
// than none. The thinnest real page (a monotypic fern family) lands near 175.
const MIN_WORDS = 120;
const MAX_TITLE = 60;
const MAX_DESC = 155;

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}

// Attribute values arrive HTML-escaped, so an apostrophe reads as six characters
// and "&" as five. Search engines truncate the *decoded* text, which is what the
// generator clips against — measure the same thing it does, or every title with
// an apostrophe reports a false overrun.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) =>
  s.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([a-z]+));/g, (m, dec, hex, name) =>
    dec ? String.fromCodePoint(+dec)
    : hex ? String.fromCodePoint(parseInt(hex, 16))
    : (ENTITIES[name] ?? m));

const tag = (html, re) => {
  const v = (html.match(re) || [])[1];
  return v === undefined ? undefined : decode(v);
};
const textOf = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;|&#\d+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

async function main() {
  if (!existsSync(SITE)) {
    console.error(`pages runner error: ${SITE} not found — run build/site.py first`);
    process.exit(1);
  }

  // every generated page, as a URL path -> html
  const files = globSync("{family,order,families,orders}/**/index.html", { cwd: SITE });
  const pages = new Map();
  for (const f of files) pages.set("/" + f.replace(/index\.html$/, ""), readFileSync(join(SITE, f), "utf8"));

  console.log(`pages: ${SITE} — ${pages.size} documents\n`);
  check("the expected page count was generated", pages.size === 567, String(pages.size));

  // ---- per-page structure ----
  const bad = { h1: [], canon: [], desc: [], thin: [], ld: [] };
  const titles = new Map();
  for (const [path, html] of pages) {
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) bad.h1.push(path);

    const canon = tag(html, /<link rel="canonical" href="([^"]+)"/);
    if (!canon || new URL(canon).pathname !== path) bad.canon.push(`${path} -> ${canon}`);

    const title = tag(html, /<title>([\s\S]*?)<\/title>/);
    if (title) titles.set(title, (titles.get(title) || 0) + 1);

    const desc = tag(html, /name="description" content="([^"]*)"/);
    if (!desc || desc.length > MAX_DESC) bad.desc.push(`${path} (${desc ? desc.length : 0})`);

    const words = textOf(html).split(" ").length;
    if (words < MIN_WORDS) bad.thin.push(`${path} (${words}w)`);

    try {
      const parsed = JSON.parse(tag(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/));
      if (!Array.isArray(parsed) || !parsed.length) bad.ld.push(path);
    } catch { bad.ld.push(path); }
  }

  check("every page has exactly one h1", bad.h1.length === 0, bad.h1.slice(0, 3).join(", "));
  check("every canonical points at its own path", bad.canon.length === 0, bad.canon.slice(0, 2).join(", "));
  check("every page has a description within limit", bad.desc.length === 0, bad.desc.slice(0, 3).join(", "));
  check(`no page is thinner than ${MIN_WORDS} words`, bad.thin.length === 0, bad.thin.slice(0, 3).join(", "));
  check("every page carries parseable JSON-LD", bad.ld.length === 0, bad.ld.slice(0, 3).join(", "));

  const dupes = [...titles].filter(([, n]) => n > 1);
  check("every title is unique", dupes.length === 0, dupes.slice(0, 2).map(([t]) => t).join(" | "));
  const longTitles = [...titles.keys()].filter((t) => t.length > MAX_TITLE);
  check(`no title exceeds ${MAX_TITLE} characters`, longTitles.length === 0,
    longTitles.slice(0, 2).join(" | "));

  // ---- the link graph ----
  // Every internal href must resolve to something that exists, and every page
  // must be reachable from another page. A sitemap-only page is an orphan, which
  // is the weakest crawl signal there is — and the reason the app's footer links
  // to the hubs at all.
  const app = readFileSync(join(SITE, "index.html"), "utf8");
  const linkedTo = new Set();
  const broken = [];
  const sources = [["/", app], ...pages];
  for (const [from, html] of sources) {
    for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      const href = m[1];
      linkedTo.add(href);
      const target = href.endsWith("/") ? join(SITE, href, "index.html") : join(SITE, href);
      if (!existsSync(target) || !statSync(target).isFile()) broken.push(`${from} -> ${href}`);
    }
  }
  check("every internal link resolves to a file", broken.length === 0,
    broken.length ? `${broken.length} broken, e.g. ${broken.slice(0, 3).join(", ")}` : "");

  const orphans = [...pages.keys()].filter((p) => !linkedTo.has(p));
  check("no generated page is an orphan", orphans.length === 0,
    orphans.length ? `${orphans.length}, e.g. ${orphans.slice(0, 3).join(", ")}` : "");

  // ---- the app is the way in ----
  check("the app links to both hubs",
    app.includes('href="/families/"') && app.includes('href="/orders/"'));
  check("the app's hidden index links families to their pages",
    /href="\/family\/asteraceae\/"/.test(app));

  // ---- the pages lead back into the app ----
  const noCta = [...pages].filter(([p, h]) => /^\/(family|order)\//.test(p) && !h.includes('class="cta" href="/#sel='));
  check("every taxon page deep-links back into the tree", noCta.length === 0,
    noCta.slice(0, 3).map(([p]) => p).join(", "));

  // ---- the shared assets the pages depend on ----
  for (const asset of ["p.css", "favicon.svg", "robots.txt", "sitemap.xml", "404.html"]) {
    check(`${asset} was emitted`, existsSync(join(SITE, asset)));
  }

  // ---- the sitemap must describe the site that actually exists ----
  // A sitemap is a set of promises about URLs. The predecessor listed one URL on
  // a host with no DNS record; the failure mode is quiet, so it gets asserted.
  const xml = readFileSync(join(SITE, "sitemap.xml"), "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  check("the sitemap lists every generated page and the root",
    locs.length === pages.size + 1, `${locs.length} urls, ${pages.size} pages`);

  const notEmitted = locs.filter((p) => p !== "/" && !pages.has(p));
  check("every sitemap URL corresponds to a generated file", notEmitted.length === 0,
    notEmitted.slice(0, 3).join(", "));

  const notListed = [...pages.keys()].filter((p) => !locs.includes(p));
  check("every generated page appears in the sitemap", notListed.length === 0,
    notListed.slice(0, 3).join(", "));

  check("the sitemap carries a lastmod on every URL",
    (xml.match(/<lastmod>/g) || []).length === locs.length);

  // ---- robots points at a sitemap on the origin the pages claim ----
  const robots = readFileSync(join(SITE, "robots.txt"), "utf8");
  const smUrl = (robots.match(/^\s*Sitemap:\s*(\S+)/im) || [])[1];
  const origin = new URL(tag(pages.get("/families/"), /<link rel="canonical" href="([^"]+)"/)).origin;
  check("robots advertises the sitemap on the pages' own origin",
    !!smUrl && smUrl === `${origin}/sitemap.xml`, smUrl || "no Sitemap line");
  check("robots still keeps the dev-only workshop out", /Disallow:\s*\/storybook\//.test(robots));

  await layoutChecks();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error(`FAILED: ${failed.map((r) => r.name).join(", ")}`);
    process.exit(1);
  }
}

// ---------- layout, at the width Google actually indexes ----------
//
// Google indexes the mobile rendering, so a page that overflows on a phone is an
// SEO defect and not merely a cosmetic one. It cannot be caught statically: both
// bugs this found were CSS min-width:auto behaviour that only exists once a
// layout engine runs. A file:// load won't do either — these pages link /p.css
// absolutely — so the check serves _site over http, the way it ships.
//
// smoke.mjs has a richer CDP harness for driving the app; this needs one
// evaluate() at one viewport, so it keeps its own small one rather than growing
// that suite a second purpose.
const MIME = { ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml",
               ".jpg": "image/jpeg", ".xml": "application/xml", ".txt": "text/plain" };
const PROBES = ["/families/", "/orders/", "/family/asteraceae/", "/family/orchidaceae/",
                "/order/asterales/", "/family/equisetaceae/"];

function serve(root) {
  const server = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = join(root, p);
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

async function layoutChecks() {
  const CHROME = process.env.CHROME || [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/chromium",
  ].find((p) => existsSync(p));
  if (!CHROME) {
    check("a browser is available for the layout checks", false, "no Chrome found");
    return;
  }

  const server = await serve(SITE);
  const base = `http://127.0.0.1:${server.address().port}`;
  const profile = mkdtempSync(join(tmpdir(), "pages-"));
  const port = 9300 + (process.pid % 600);
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`,
    "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "about:blank"],
    { stdio: "ignore" });

  try {
    let targets;
    for (let i = 0; i < 40 && !targets; i++) {
      try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); }
      catch { await new Promise((r) => setTimeout(r, 250)); }
    }
    const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    const send = (method, params) => new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, res);
      setTimeout(() => pending.has(i) && (pending.delete(i), rej(new Error(`${method} timed out`))), 15000);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    const ev = async (expr) =>
      (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.result?.value;

    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride",
      { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

    const overflowing = [];
    for (const path of PROBES) {
      await send("Page.navigate", { url: base + path });
      await new Promise((r) => setTimeout(r, 600));
      // an element extending past the viewport is clipped by its container's own
      // overflow, so the document never scrolls — the content just vanishes
      const bad = await ev(`[...document.querySelectorAll('.wrap *')]
        .filter(el => el.getBoundingClientRect().right > innerWidth + 1).length`);
      const scrolls = await ev(`document.documentElement.scrollWidth > innerWidth + 1`);
      if (bad > 0 || scrolls) overflowing.push(`${path} (${bad} clipped${scrolls ? ", page scrolls" : ""})`);
    }
    check("no page overflows a 390px viewport", overflowing.length === 0,
      overflowing.slice(0, 3).join(", "));

    // the stylesheet must actually be reachable at the path the pages link
    await send("Page.navigate", { url: base + "/family/asteraceae/" });
    await new Promise((r) => setTimeout(r, 600));
    // Compare against the token rather than a literal colour: this asserted
    // rgb(13,21,18) and broke the moment the palette was neutralised, which is a
    // test failing for the wrong reason. What matters is that the stylesheet
    // arrived and its custom properties are in force.
    const styled = await ev(`(()=>{
      const g = getComputedStyle(document.documentElement).getPropertyValue('--ground').trim();
      if (!g) return 'no --ground: p.css did not load';
      const probe = document.createElement('div');
      probe.style.backgroundColor = g;
      document.body.appendChild(probe);
      const want = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const got = getComputedStyle(document.body).backgroundColor;
      return got === want ? true : got + ' != ' + want;
    })()`);
    check("p.css loads and applies at its linked path", styled === true, String(styled));
  } finally {
    // Wait for the process to exit before removing its profile — Chrome is still
    // flushing to that directory when kill() returns (smoke.mjs learned the same
    // thing in T1). Even then, kill() only reaps the parent: on Linux the zygote
    // and renderer children can outlive it and keep the directory busy, which
    // failed this job on CI with every check already green. Removing a temp dir
    // is housekeeping, not an assertion — the OS reclaims /tmp regardless, so it
    // must never be the thing that decides whether the suite passed.
    chrome.kill();
    await once(chrome, "exit").catch(() => {});
    server.close();
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch { /* left for the OS to reclaim */ }
  }
}

await main();
