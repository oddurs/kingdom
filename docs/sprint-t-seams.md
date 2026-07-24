# Sprint T — "Seams"

Make the joints between sprints hold.

## The thesis

The July code review turned up ~30 findings, six of them user-visible breakages
on the live site. None of them are architectural, and none are bad code in
isolation — every one of them lives in a **seam**, where a feature sprint met a
layer built by an earlier sprint and each assumed the other's job.

Six of the top findings trace to the same shape: *a piece of derived state is
set at one call site and re-derived at another, and the two drifted.* So this
sprint is not thirty patches. It is **seven single-owner fixes**, plus the test
harness change that would have caught all six before they shipped.

| # | Root cause | Findings it closes |
|---|-----------|--------------------|
| 1 | The render layer paints only at mount — there is no restyle path | Colour modes inert · `#c=` deep links inert · labels lost on filter change |
| 2 | Overlay open/close state is hand-rolled at each call site | Highlight list unclickable · invisible panel in tab order · focus dropped on menu close |
| 3 | Stage input handlers guard *some* events against overlays, not all | Arrow keys collapse the tree · wheel can't scroll panel or About |
| 4 | `#toast` is parented outside the stage it positions against | Every "Surprise me" toast hidden on mobile |
| 5 | The pipeline can't tell failure from absence, and writes non-atomically | 28 frozen GBIF gaps · truncation risk on `taxa.json` · stale `dist` · blank `og.jpg` |
| 6 | Tests call functions instead of driving the UI | All six user-visible bugs shipped with 34/34 green |
| 7 | CI scoping and docs are workflow-wide / stale | PR jobs hold deploy creds · PRs queue on prod · three impossible doc procedures |

Five phases, each **plan → build → review → one PR to `main`**, in the house
rhythm. Ordered so the harness lands first and every later phase can prove
itself with it.

---

## T1 — The harness that would have caught this

**Why first:** every phase below needs a way to demonstrate a fix that a
synthetic `dispatchEvent` would have faked. `test/smoke.mjs` currently selects a
row by dispatching `click` directly at it, which bypasses hit-testing entirely —
that is precisely why an `inert` panel passed the suite.

- **`clickAt(sel)` helper** — resolve the element, take its centre, assert
  `document.elementFromPoint()` actually returns it (or a descendant), *then*
  dispatch. A blocked or inert target fails the check instead of silently
  succeeding. This single helper is the difference between 34/34 green and
  catching T2 and T3.
- **`tabTo(sel)` helper** — same idea for the keyboard: assert `focus()` lands
  where it was aimed. Catches the `inert` mirror bug and the focus-drop on menu
  close.
- **Drive real history** — replace the direct `applyHash()` call at `smoke.mjs:243`
  with an actual `history.back()` + `popstate` round-trip, so the listener and
  all seven teardown calls in `resetView()` get covered for the first time.
- **`send()` must time out** — `smoke.mjs:72-84` resolves only on a matching
  reply id, with no timeout and no reject on socket close. A crashed Chrome hangs
  the suite until GitHub's 6-hour default. Add a per-request timeout and reject
  on `close`/`error`.
- **Sequential sessions stop colliding** — `await once(proc,'exit')` and a
  per-session `--user-data-dir`, matching the port randomization already at
  `smoke.mjs:21`.

**Verify:** the new helpers, pointed at today's `main`, must **fail** on the
highlight-list panel and on the timeline arrow keys. If they pass, the helper is
wrong. Then they stay red until T2 turns them green.
**Risk:** none to the shipped page — test-only. **Self-contained:** yes.

---

## T2 — One owner for overlays, one rule for input

Two root causes, one PR, because they are the same story told twice: a
cross-cutting rule that most call sites follow and a few forgot.

### Overlay state gets a single owner

There are six places that open or close an overlay, each hand-writing the
`.open` / `aria-hidden` / `inert` triad. Four write all three; **two forgot
`inert`**, and those two are the bug:

```
08-panels.js:134  .open  aria-hidden=false  inert=false   ✅
08-panels.js:152  .open  aria-hidden=true   inert=true    ✅
10-boot.js:17     .show  aria-hidden=false  inert=false   ✅
10-boot.js:22     .show  aria-hidden=true   inert=true    ✅
09-story.js:50    .open  aria-hidden=false      —         🔴 list is dead to clicks
09-story.js:58    .open  aria-hidden=true       —         🔴 invisible close button stays tabbable
```

One `setOverlay(el, open, cls='open')` that owns all three, and six call sites
that use it. The bug class cannot recur — there is nowhere left to forget.
`welcome` / `tourcard` / `focusbar` / `comparebar` fold into the same helper for
free (they set `.show` + `inert` but no `aria-hidden`, which is the same
inconsistency, just not yet biting).

### Stage input handlers get a single rule

`OVERLAY_SEL` already exists (`07-navigation.js:44`) and `pointerdown` /
`pointermove` already respect it. `wheel` (`:117`) and `keydown` (`:104`) do
not, which is the whole of two findings:

- Wheel over `#panel` or `#modal` `preventDefault()`s and zooms the canvas
  behind them — About and Controls are unreadable past the fold on a mouse.
- Arrow keys on the time slider bubble to the tree's cursor handler. ← steps
  time *and* collapses the tree: 132 visible nodes → 1. Note the slider's
  `pointerdown`/`pointermove` siblings *do* `stopPropagation()` — only `keydown`
  was missed, which is why the guard belongs on the stage, not on each overlay.

Guard all four handlers with `OVERLAY_SEL`. One rule: **stage input handlers
ignore events originating inside an overlay.** Every future overlay inherits it.

### While we're in the overlays

- **Toast** (`shell.html:120`) moves inside `<main class="stage">`. It is
  `position:absolute; top:70px` but sits *outside* the only positioned ancestor,
  so it lands against the viewport — at 390×844 the header is 177px tall and the
  toast is entirely behind it. `main.stage` is already `position:relative`, so
  this is a **one-line move**, no CSS change.
- **Focus restore** — `closeMenu()` (`10-boot.js:290`) returns focus to the
  trigger instead of dropping it to `<body>`.
- **`role="menu"` semantics** — the four popovers advertise a menu with zero
  `menuitem`s. Either add `role="menuitem"` + roving focus, or drop `role="menu"`
  and let them be plain popovers with `aria-controls` on the trigger. **Recommend
  the latter** — they are not menus in the ARIA sense and pretending otherwise
  costs a roving-focus implementation for no gain.
- **Search combobox** — `aria-activedescendant` on `#q` + ids on the `role="option"`
  rows, so arrow-key navigation is announced rather than purely visual.

**Verify:** T1's `clickAt`/`tabTo` go green on the highlight list; a smoke case
asserts ← on the slider changes `timeNow` and leaves `visibleNodes` unchanged;
a case asserts wheel over `#panel` scrolls it and leaves `T.k` alone; toast rect
asserted below the header at 390×844.
**Risk:** low — additive guards and a helper extraction. **Self-contained:** yes.

---

## T3 — Repaint: the render layer learns to restyle

`acquireShell()` (`03-render.js:56`) sets `--lc`, `--glow`, halo and dot radius —
everything derived from data. `ensureNode()`'s update path (`:72-78`) refreshes
classes and transform only. So **derived appearance is written exactly once, at
mount**, and the viewport pooling from Sprint E means most nodes never remount.

Consequence: switching Colour → Age/Region recolours the legend and minimap
while 131 of 132 mounted nodes keep their old colour, and every `#c=` deep link
lands on a tree painted for the wrong mode. The feature looks implemented and
is, in practice, inert.

- **Extract `paint(el, n)`** — the single owner of "node appearance from data":
  `--lc`, `--glow`, halo `r`, dot `r`. Called from `acquireShell` (unchanged
  behaviour) and from a new `repaintAll()`.
- **`repaintAll()`** is three lines and has a precedent to match:
  `relabelAll()` (`06-interaction.js:4`) already does exactly this loop for
  labels. Same shape, same file, no new concept for a reader to learn.
- **Links too** — `ensureLink` (`:84`) has the identical mount-only bug for
  `--lc`/`--lw`.
- **Call it from the colour-mode setter** and from `applyHash`, which is the
  whole fix for both findings.

### Same root cause, one layer up: recompute after state change

`labelLOD()` runs inside `applyMount`, *before* filter code applies `hl`
classes — so matches that were already mounted lose their labels (measured: 64
of 76 labelled), and clearing a filter can't restore them because `setLabel`
physically removes the label node. Both directions need `labelLOD()` re-run
after the `hl` pass. Same discipline as `repaintAll`: **when derived state
changes, re-derive it for what's already mounted.**

**Verify:** smoke asserts that after `colorMode='age'; render()`, a sampled
mounted node's `--lc` equals `color(n)`; that `#c=region` loads with every
mounted node correct; that filter → filter keeps all matches labelled and Clear
restores the baseline count.
**Risk:** low-medium — touches the hot render path, so re-check the perf HUD
frame budget before/after. `repaintAll` is O(mounted), not O(all nodes), and
only runs on colour-mode change.
**Self-contained:** yes.

---

## T4 — The pipeline stops lying

Every finding here is the same failure of honesty: **the pipeline cannot
distinguish "this failed" from "there is nothing here."**

- **Atomic writes.** `fetch.py:101` truncates `data/taxa.json` in place — and it
  is a *checkpoint inside the network loop*, the one code path explicitly
  designed to be interrupted. A Ctrl-C in that window destroys the 350 KB source
  of truth and takes `build.py`, `wcvp.py` and `ages.py` with it. New
  `build/util.py` with `read_json` / `write_json` (temp file + `os.replace`,
  `encoding="utf-8"`, `ensure_ascii=False`), used by all four scripts. This is
  the sprint's only new file, and it also retires the 15 scattered
  `read_text()`/`write_text()` calls that omit `encoding=`.
- **Loud failure in `fetch.py`.** `metrics()` catches everything and returns
  `None`, indistinguishable from a genuine zero — and the `todo` filter skips any
  taxon that already has a `gbif` id, so a transient 429 freezes the gap
  permanently. **Verified: 28 of 579 taxa have a GBIF id and no
  `gbifSpeciesCount`**, including Rosaceae, Pinaceae, Euphorbiaceae, Myrtaceae.
  Distinguish error from empty, retry with backoff, and leave the taxon in `todo`
  on failure so the file's "re-run to fill gaps" promise becomes true. Then
  re-run to backfill the 28.
- **Stale `dist` in `wcvp.py:88`.** Not cleared when the distribution CSV is
  absent, so a names-only run refreshes all species counts while silently keeping
  the previous run's distributions — still tagged `provenance.dist = "wcvp"`.
  `ages.py:150` already handles the analogous case correctly with
  `t.pop("ageMy", None)`; match it.
- **Antarctica renders nowhere.** `worldmap.py:90` crops to `viewBox 0 0 360 150`
  but still emits region 9, whose 661 points all sit at y ≥ 153. The 63 families
  with an Antarctic distribution get a highlight that paints nothing, and every
  page load carries 5 KB of unrenderable path. Drop region 9 and label the map
  honestly as excluding Antarctica.
- **`og.mjs` validates its own output.** Fixed sleeps with no readiness poll, no
  `exceptionDetails` check, and no output validation — CI publishes whatever
  comes out, exit 0 either way. Poll for `ROOT` the way `smoke.mjs:101` already
  does, check `exceptionDetails` on every eval, assert a pixel-variance floor,
  exit non-zero otherwise. Randomize the port and profile dir to match
  `smoke.mjs:21`.
- **Build-time guards** (cheap, and each closes a bug class rather than a bug):
  - **Duplicate top-level declarations fail the build.** There are two
    `function surprise()` — `07-navigation.js:191` and `10-boot.js:160` — in one
    concatenated scope; `10-boot` wins and the other is dead, which is why
    "Surprise me" from the search footer leaves the stale dropdown open. Delete
    the dead one, then add ~10 lines to `build.py` so the next collision is a
    build error. The suite already regression-guards one instance of this
    (`setActive`), which is the tell that it needs a structural fix.
  - **Escape `</` in the JSON-LD block** (`build.py:60`) the way the data blob
    already is at `:243`. Currently benign, same injection path, one line.
  - **`validate()` requires ≥1 family**, so `max()`/`[0]` at `build.py:34,74`
    fail as a validation error rather than an unhandled traceback.

**Verify:** `make check` green; kill `fetch.py` mid-checkpoint and confirm
`taxa.json` still parses; re-run fills all 28 gaps; a deliberate duplicate
declaration fails the build; `og.jpg` byte size and variance asserted in CI.
**Risk:** low. Data changes are regenerable and diffable.
**Self-contained:** yes — no new runtime dependency; `util.py` is build-time only.

---

## T5 — Delivery: scope the pipeline, unblock the domain, fix the docs

- **Job-scope the CI permissions.** `deploy.yml:8-11` grants `pages: write` and
  `id-token: write` at *workflow* level, so the `build` job — which runs `npm ci`
  lifecycle scripts and executes PR-modified Python — holds them. `contents: read`
  at the top, the write scopes on the `deploy` job only.
- **Job-scope the concurrency.** `group: pages` is workflow-level, so PR builds
  queue against production deploys; one hung PR blocks every deploy. Use
  `pages-${{ github.ref }}` or move the block to `deploy`.
- **`timeout-minutes: 20`** on both jobs — belt to T1's `send()` timeout brace.
- **Decouple Storybook from the app deploy.** `npm run build-storybook` sits
  inside the job `deploy` declares as `needs:`, so a Vite transitive-dependency
  break blocks an urgent app fix — for tooling ARCHITECTURE.md calls "strictly
  dev-only." Separate job, or `continue-on-error` with a conditional copy.
- **`Disallow: /storybook/`** in `robots.txt`. The workshop is currently indexable
  under the brand domain.
- **The `<h1>` comes first.** The crawlable SEO block is injected as the first
  element of `<body>` (`build.py:83`), giving a document heading order of
  `H2 → H3 → H3 → H1`. Move it after the header, or demote it.
- **One species count.** Meta descriptions say "~390,000 species"
  (`shell.html:7,13,23,181`) while the same build prints 370,535 on the page.
  Derive the string from the data instead of hardcoding it, so it can't drift again.
- **Drop the "Approximate estimate" citation** from the JSON-LD `Dataset`
  (`build.py:37`) — `meta.sources` is flattened wholesale, so structured data
  currently cites a source named "Approximate estimate."
- **Fix the three doc procedures that cannot work:**
  - `README.md:26` calls `plant-tree.html` a commit artifact — it is gitignored
    and CI builds it.
  - `README.md:119` / `Makefile:34` tell you to run `storybook-deploy` and commit
    `storybook/`, which `.gitignore:7` makes impossible and CI already does.
    Delete the target and the instructions.
  - Node ≥ 21 (global `WebSocket`) is documented only as a comment in the
    workflow. Add `engines` to `package.json` and a line to the README, so
    `make test` on Node 20 doesn't fail as `WebSocket is not defined`.
  - Also `Makefile:8`'s help grep misses hyphens, hiding two documented targets.

**Verify:** a PR run shows no `pages`/`id-token` scope in the build job and does
not queue behind a deploy; `make help` lists every target; README procedures
followed literally on a clean clone actually work.
**Risk:** low. **Self-contained:** yes.

---

## The one thing I can't fix

**DNS for `yggdrasil.oddurs.com` does not exist.** `dig +short` returns nothing,
and `oddurs.github.io/kingdom/` still serves 200 with no redirect — so the custom
domain isn't applied in Pages settings either. Meanwhile the live page advertises
a canonical, `og:url`, `og:image` and sitemap all pointing at that unresolvable
host. Crawlers follow the canonical off a cliff; social unfurls fetch a dead
image. **This is currently worse than not having done the SEO sprint at all.**

Until it resolves, there are two options and they should be an explicit choice
rather than a default:

1. **Add the DNS record** (`CNAME` → `oddurs.github.io`) and set the custom
   domain in Pages settings. Preferred — everything else is already in place.
2. **Revert the canonical to `oddurs.github.io/kingdom/`** until the domain is
   live, so the site is at least self-consistent.

Sequenced last on purpose: it is a one-line change either way once the decision
is made, and it needs your hands, not mine.

---

## Sequencing rationale

T1 first so every later phase is provable — and so the two worst bugs are
demonstrated red before they are fixed green. T2 next because it holds three of
the six live breakages and is pure guard-adding. T3 is the largest behavioural
change (the render hot path) and wants a clean tree to land on. T4 and T5 touch
nothing the browser runs, so they can land in either order, or in parallel with
T3 if you want two tracks.

| Phase | Scope | Findings closed | Risk |
|-------|-------|-----------------|------|
| **T1 Harness** | hit-tested clicks, real history, CDP timeouts | root cause 6 | none |
| **T2 Overlays** | `setOverlay`, `OVERLAY_SEL` everywhere, toast, ARIA | root causes 2, 3, 4 | low |
| **T3 Repaint** | `paint()`/`repaintAll()`, label LOD re-run | root cause 1 | low-med |
| **T4 Pipeline** | atomic writes, loud failures, build guards | root cause 5 | low |
| **T5 Delivery** | CI scoping, SEO, docs | root cause 7 | low |

## Manual tasks for you

- [ ] **DNS:** add the `CNAME` record and set the Pages custom domain — or say
      "revert the canonical" and T5 does option 2 instead.
- [ ] **Menu semantics (T2):** confirm dropping `role="menu"` for plain popovers
      is fine, rather than implementing roving focus.
