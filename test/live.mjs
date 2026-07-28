#!/usr/bin/env node
// Post-deploy verification for the published site.
//
// Everything else in this repo can be proven offline. Three things cannot:
// whether the canonical host resolves, whether it serves what we just built,
// and whether the URLs we hand crawlers are reachable. Those are exactly the
// things that broke — Sprint S shipped a canonical pointing at a domain with no
// DNS record, and 34/34 smoke checks stayed green for thirteen days while the
// live site told Google it was a duplicate of nothing.
//
// So this suite asks the network, and it runs *after* the deploy, against the
// origin the built page claims for itself.
//
// Usage:   node test/live.mjs [path/to/plant-tree.html]
// Exit:    0 = all checks passed, 1 = a check failed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(process.argv[2] || `${HERE}/../plant-tree.html`);

// Pages puts a new deploy behind its CDN in seconds, but not instantly, and a
// cold custom domain can 000 once while the edge picks up the certificate. Retry
// briefly so a green build isn't decided by a race; fail honestly after that.
const ATTEMPTS = 5;
const BACKOFF_MS = 3000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, init = {}) {
  let last;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const res = await fetch(url, { redirect: "follow", ...init });
      if (res.status < 500) return res;      // 4xx is an answer, not a flake
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    if (i < ATTEMPTS - 1) await wait(BACKOFF_MS * (i + 1));
  }
  throw last;
}

const canonicalOf = (html) =>
  (html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i) || [])[1];

// ---------- tiny assertion harness (mirrors test/smoke.mjs) ----------
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass: !!pass, detail });
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  const built = readFileSync(TARGET, "utf8");
  const canonical = canonicalOf(built);

  if (!canonical) {
    console.error(`live runner error: no <link rel="canonical"> in ${TARGET}`);
    process.exit(1);
  }
  console.log(`live: ${canonical}\n`);

  // 1. The canonical origin resolves and serves. This is the whole point: a
  //    canonical is a claim about a URL, and the claim is checkable.
  let res, html = "";
  try {
    res = await fetchWithRetry(canonical);
    html = await res.text();
    check("the canonical URL serves 200", res.status === 200, `HTTP ${res.status}`);
  } catch (e) {
    check("the canonical URL serves 200", false, e.message);
  }

  // 2. It serves *this* page. A canonical that resolves to somebody else's site
  //    is worse than one that 404s, and it looks identical from the outside.
  check("the served page declares the same canonical", canonicalOf(html) === canonical,
    canonicalOf(html) || "none");

  // 3. The crawler plumbing is reachable at the origin it advertises. Both files
  //    name the host, so both can be wrong in the same way the canonical was.
  const origin = new URL(canonical).origin;
  for (const path of ["/robots.txt", "/sitemap.xml", "/og.jpg"]) {
    try {
      const r = await fetchWithRetry(origin + path, { method: "HEAD" });
      check(`${path} serves 200`, r.status === 200, `HTTP ${r.status}`);
    } catch (e) {
      check(`${path} serves 200`, false, e.message);
    }
  }

  // 4. robots must point at a sitemap on the host that is actually serving it.
  try {
    const robots = await (await fetchWithRetry(origin + "/robots.txt")).text();
    const sm = (robots.match(/^\s*Sitemap:\s*(\S+)/im) || [])[1];
    check("robots.txt advertises a sitemap on this origin",
      !!sm && new URL(sm).origin === origin, sm || "no Sitemap line");
  } catch (e) {
    check("robots.txt advertises a sitemap on this origin", false, e.message);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error(`FAILED: ${failed.map((r) => r.name).join(", ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("live runner error:", e.message);
  process.exit(1);
});
