# Contributing

Thanks for looking. This is a small project with a specific shape, and knowing
that shape up front will save you time.

## The shape

**The app is one self-contained HTML file.** No frameworks, no runtime
dependencies, no network calls — it runs from `file://` and inside sandboxes with
a strict CSP. That constraint is deliberate and it is not up for negotiation in a
PR: the source is authored in pieces under `build/src/` and bundled at build time
into `plant-tree.html`.

**Never edit `plant-tree.html`.** It is generated and git-ignored. Edit
`build/src/*.js`, `build/src/app.css`, `build/shell.html` or `data/taxa.json`,
then rebuild.

**The published site is that file plus 567 generated taxon pages.** Those are
ordinary documents on an ordinary host, so they deliberately do *not* inherit the
single-file rule — they share a cached stylesheet. See `ARCHITECTURE.md`.

## Getting set up

You need **Python 3.12+** and **Node 22+** (the tests use global `fetch` and
`WebSocket`). Chrome or Chromium is needed for the test suites.

```sh
make build     # data + source -> plant-tree.html
make site      # assemble _site/ (the app + every taxon page)
make serve     # assemble, then serve at http://localhost:8000
make check     # build + both test suites — the pre-commit gate
```

`make` with no target lists everything.

The design-system workshop needs `npm install` first, then `make storybook`. It
is dev-only tooling; the app ships with zero npm dependencies.

## Before you open a PR

**Run `make check` and make sure it's green.** It runs two suites:

- `test/smoke.mjs` — drives the built page in headless Chrome and asserts the
  invariants (data integrity, all four views, interactions, virtualization,
  reduced-motion).
- `test/pages.mjs` — checks the generated taxon pages: one `h1` each,
  self-referencing canonicals, unique titles, a resolving link graph, no orphans,
  a sitemap that matches the pages that exist, and no page overflowing a 390px
  viewport.

There is also `make live`, which verifies the **published** site. It is the only
place a canonical URL can be checked at all, and it runs in CI after deploy.

**Add a check for what you changed.** Nearly every bug this project has shipped
was invisible to the suite at the time. If you fix something, the fix should come
with the assertion that would have caught it — and it's worth confirming the new
check actually *fails* against the unfixed build.

## Working with the data

`data/taxa.json` is the source of truth: a flat array, one record per taxon,
keyed by `id` with a `parent` pointer. `build/build.py` validates it, derives the
nested tree, and injects it into the page.

Some rules the build enforces, so you'll hit them rather than guess:

- **Every record's `provenance` says where each value came from.** A count that
  isn't from WCVP is an estimate and is displayed as one. Please keep that
  honest — it's the thing this project is most careful about.
- **A blurb may not quote a species count.** The sourced figure is displayed
  directly beside it, and the two used to disagree by up to 48%. `validate()`
  fails the build on this.
- **The species total is not quoted to six significant figures**, because ~6% of
  it is estimated. The build fails if the sourced/estimated split doesn't
  reconcile with the aggregate.

Enrichment scripts (`fetch.py`, `wcvp.py`, `ages.py`, `genera.py`) need network
access or bulk downloads that aren't committed. See the README.

## Style

Match the surrounding code. A few things that are consistent throughout and
worth preserving:

- **Comments explain *why*, not *what*.** Most comments here record a decision or
  a defect that motivated the code. If you remove a subtlety, remove its comment;
  if you add one, say why it's there.
- **The design system is CSS classes**, not a component runtime. Tokens live in
  `design/tokens.css`, components in `build/src/app.css`.
- **The UI accent is `--accent`, never a lineage hue.** Lineage colours encode
  data; borrowing one for a button makes a chip look like a clade. A test
  enforces this.

## Reporting things

Bugs and ideas are welcome as issues. For anything security-related, see
`SECURITY.md` — please don't open a public issue for those.
