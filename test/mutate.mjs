#!/usr/bin/env node
// Does the suite have teeth?
//
// `make check` reporting 109/109 says the assertions pass. It does not say they
// would notice if the app broke — and a test that cannot fail is worse than no
// test, because it is a claim of coverage where there is none.
//
// This seeds a defect into build/src, rebuilds, runs the suite, and records
// whether the suite noticed. A mutation the suite fails to catch is a blind spot
// with a name and a location, which is a far more useful thing than a percentage.
//
// Each mutation is a real defect class this project has actually shipped or nearly
// shipped — see the `why` on each. Guessing at plausible-looking mutations measures
// nothing; these are drawn from the bug list.
//
// Usage:  node test/mutate.mjs            all of them (slow — a full suite run each)
//         node test/mutate.mjs --only virtualization-off
//         node test/mutate.mjs --list
//
// It edits tracked files and restores them in a finally block. It refuses to start
// on a dirty tree, because the restore is a `git checkout` of those paths and would
// take uncommitted work with it.
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'build', 'src');

// Each: the file, an exact string to replace, what to put there, and why this
// defect is worth being able to detect.
const MUTATIONS = [
  {
    name: 'virtualization-off',
    file: '03-render.js', find: 'function inView(', replace: 'function inView(){ return true } function _unused_inView(',
    why: 'Sprint E bounded the DOM by culling offscreen nodes. Losing the cull is invisible until the browser stalls on a 14k-node expansion.',
  },
  {
    name: 'radius-constant',
    file: '01-prep.js', find: 'function radius(n){', replace: 'function radius(n){ return 8; //',
    why: 'Node area encodes species richness. A constant radius still draws a correct-looking tree that means nothing.',
  },
  {
    name: 'age-opacity-always-on',
    file: '10-boot.js', find: 'function ageOpacity(', replace: 'function ageOpacity(){ return 1 } function _unused_ageOpacity(',
    why: 'The timeline hides lineages that had not originated yet. If everything is always drawn, Deep Time silently becomes decoration.',
  },
  {
    name: 'minimap-dead',
    file: '04-minimap.js', find: 'function renderMinimap(', replace: 'function renderMinimap(){ return } function _unused_renderMinimap(',
    why: 'The minimap has no direct assertions at all. This measures whether anything downstream would notice it going blank.',
  },
  {
    name: 'provenance-dropped',
    file: '08-panels.js', find: 'function speciesSource(n){', replace: 'function speciesSource(n){ return ""; //',
    why: 'Sprint V made every figure name its source. Losing the provenance line is the exact regression that sprint existed to prevent.',
  },
  {
    name: 'share-drops-selection',
    file: '09-story.js', find: "if(selected) p.push('sel='+encodeURIComponent(selected.name));", replace: '',
    why: 'Sprint O put the whole view in the URL. A Share link that quietly forgets the selection is the failure mode #114 found by hand.',
  },
  {
    name: 'panel-not-inert',
    file: '08-panels.js', find: '  el.inert=!open;', replace: '',
    why: 'Sprint T: an overlay that looks open in a screenshot and refuses every click. The suite was written to catch this one — it should.',
  },
  {
    name: 'labels-never-drawn',
    file: '06-interaction.js', find: 'function relabelAll(){', replace: 'function relabelAll(){ return; //',
    why: 'A tree of 479 anonymous circles renders, passes a smoke test that only counts nodes, and is useless.',
  },
  {
    name: 'timeline-counts-crown-age',
    file: '10-boot.js', find: '    const a = n.effAge;', replace: '    const a = n.ageMy!=null ? n.ageMy : n.effAge;',
    why: 'The exact defect #115 fixed: the picture and the count disagreeing. Its regression test should still be live.',
  },
  {
    name: 'phone-opens-dense',
    file: '10-boot.js', find: "  eachNode(n=>{ n.open=(n.children||[]).length>0 && n.depth<4; });", replace: '',
    why: 'The exact defect #126 fixed: a phone opening on 9.5px tap targets.',
  },
];

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };

if (process.argv.includes('--list')) {
  for (const m of MUTATIONS) console.log(`${m.name.padEnd(28)} ${m.file}`);
  process.exit(0);
}

const only = arg('only');
const chosen = only ? MUTATIONS.filter((m) => m.name === only) : MUTATIONS;
if (!chosen.length) { console.error(`no mutation named ${only}`); process.exit(1); }

// The restore is `git checkout -- build/src`, which would discard real edits.
const dirty = execSync('git status --porcelain -- build/src data', { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('build/src or data has uncommitted changes — commit or stash first.\n' + dirty);
  process.exit(1);
}

const run = (cmd, args) => {
  try { execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe' }); return true; }
  catch { return false; }
};

console.log(`seeding ${chosen.length} defect${chosen.length === 1 ? '' : 's'}; a suite run each\n`);
const results = [];
try {
  for (const m of chosen) {
    const path = join(SRC, m.file);
    const before = readFileSync(path, 'utf8');
    if (!before.includes(m.find)) {
      results.push({ ...m, outcome: 'STALE' });
      console.log(`  ~ ${m.name.padEnd(28)} mutation no longer applies — its target moved`);
      continue;
    }
    writeFileSync(path, before.replace(m.find, m.replace));
    const built = run('python3', ['build/build.py']);
    // A mutation that breaks the *build* is caught, just earlier than the suite.
    const caught = !built || !run('node', ['test/smoke.mjs']);
    writeFileSync(path, before);
    results.push({ ...m, outcome: caught ? 'killed' : 'SURVIVED', at: built ? 'suite' : 'build' });
    console.log(`  ${caught ? '✓' : '✗'} ${m.name.padEnd(28)} ${caught ? `caught by the ${built ? 'suite' : 'build'}` : 'SURVIVED — nothing noticed'}`);
  }
} finally {
  execSync('git checkout -- build/src', { cwd: ROOT });
  run('python3', ['build/build.py']);
}

const survived = results.filter((r) => r.outcome === 'SURVIVED');
const stale = results.filter((r) => r.outcome === 'STALE');
console.log(`\n${results.length - survived.length - stale.length}/${results.length - stale.length} defects caught`
  + (stale.length ? `  (${stale.length} stale)` : ''));
if (survived.length) {
  console.log('\nBlind spots:');
  for (const s of survived) console.log(`  ${s.name} — ${s.why}`);
}
process.exit(survived.length ? 1 : 0);
