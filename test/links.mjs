#!/usr/bin/env node
// External link check — the URLs this project asserts but does not control.
//
// The About page cites four sources with DOIs, DATA-LICENSE names seven upstream
// datasets with their terms, and the README links to Kew's SFTP and the megatree
// repository. Those are the project's evidence: a citation that 404s undermines
// the thing the provenance work was for. None of it is exercised by the other
// suites, because none of it is reachable from the built page at runtime — the
// app makes no network calls by design.
//
// Run on a schedule, not per-commit: link rot is a property of the internet, not
// of a change, and failing someone's PR because Kew is briefly down would be
// noise. See .github/workflows/health.yml.
//
// Usage:   node test/links.mjs
// Exit:    0 = every link resolved, 1 = one or more did not.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Where the project makes an external claim. Each is scanned for http(s) URLs.
const SOURCES = [
  "DATA-LICENSE",
  "README.md",
  "CITATION.cff",
  "build/src/10-boot.js",   // the About page's cited sources
  "build/build.py",         // the Dataset JSON-LD's licence + citations
  "build/pages.py",         // the taxon pages' source footer
];

// Not public URLs at all — documentation of local commands.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)([:\/]|$)/;

// Skipped deliberately rather than silently: a skip is reported, so the list
// can't grow into a way of hiding failures.
//
// Every pattern is anchored past the host — `^https://sftp.kew.org` without the
// trailing slash also matches sftp.kew.org.example.com, which would let an
// unrelated host inherit a skip. CodeQL flagged exactly this on its first run,
// in the list whose entire purpose is not hiding things.
const SKIP = [
  /^https:\/\/sftp\.kew\.org\//,       // SFTP over https, not a browsable page
  /^https:\/\/img\.shields\.io\//,     // badge service; its outage is not our bug
  /^https:\/\/github\.com\/oddurs\/kingdom\/(security|issues|actions)/, // needs auth
];

// A 403 is not a dead link. doi.org, Kew's POWO and GBIF all answer — they just
// refuse an unknown user-agent, and Kew sits behind a challenge. The URL exists;
// a human following the citation gets there. Only "gone" is a failure: 404, 410,
// DNS failure, connection refused, timeout. Conflating the two would make this
// suite cry wolf until nobody read it.
const BLOCKED_STATUS = new Set([401, 403, 405, 406, 418, 429, 503]);

const TIMEOUT = 15000;
const results = [];
function record(url, ok, detail, where) {
  results.push({ url, ok, detail, where });
  const mark = ok === "skip" ? "–" : ok === "blocked" ? "~" : ok ? "✓" : "✗";
  console.log(`  ${mark} ${url}${detail ? `  — ${detail}` : ""}`);
}

function collect() {
  const found = new Map();   // url -> the file that claims it
  for (const f of SOURCES) {
    let text;
    try { text = readFileSync(join(ROOT, f), "utf8"); } catch { continue; }
    for (const m of text.matchAll(/https?:\/\/[^\s"'`<>()\\]+/g)) {
      // trim trailing punctuation that belongs to the prose, not the URL
      const url = m[0].replace(/[.,;:]+$/, "");
      if (!found.has(url)) found.set(url, f);
    }
  }
  return found;
}

async function reach(url) {
  // HEAD first — cheap, and most of these are large documents. Some hosts answer
  // 403/405 to HEAD but serve GET fine, so fall back rather than report a dead
  // link that isn't.
  for (const method of ["HEAD", "GET"]) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT);
    try {
      const res = await fetch(url, { method, redirect: "follow", signal: ac.signal,
        headers: { "user-agent": "yggdrasil-linkcheck (+https://yggdrasil.oddurs.com)" } });
      clearTimeout(timer);
      if (res.status < 400) return { ok: true, detail: `HTTP ${res.status}` };
      if (BLOCKED_STATUS.has(res.status)) return { ok: "blocked", detail: `HTTP ${res.status} — answered, refused a bot` };
      if (method === "GET") return { ok: false, detail: `HTTP ${res.status}` };
    } catch (e) {
      clearTimeout(timer);
      if (method === "GET") return { ok: false, detail: e.name === "AbortError" ? "timed out" : e.message };
    }
  }
  return { ok: false, detail: "unreachable" };
}

const links = collect();
console.log(`links: ${links.size} external URLs claimed across ${SOURCES.length} files\n`);

for (const [url, where] of [...links].sort()) {
  if (LOCAL.test(url)) { record(url, "skip", "local dev URL, not a public link", where); continue; }
  if (SKIP.some((re) => re.test(url))) { record(url, "skip", "skipped by policy", where); continue; }
  const { ok, detail } = await reach(url);
  record(url, ok, detail, where);
}

const failed = results.filter((r) => r.ok === false);
const skipped = results.filter((r) => r.ok === "skip");
const blocked = results.filter((r) => r.ok === "blocked");
const ok = results.length - failed.length - skipped.length - blocked.length;
console.log(`\n${ok} ok, ${blocked.length} answered-but-bot-blocked, ${skipped.length} skipped, ${failed.length} dead`);
if (failed.length) {
  console.error("\nFAILED:");
  for (const f of failed) console.error(`  ${f.url}  (${f.detail})  — claimed in ${f.where}`);
  process.exit(1);
}
