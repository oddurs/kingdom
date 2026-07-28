<h1 align="center">Yggdrasil</h1>

<p align="center">
  <b>An interactive tree of the plant kingdom.</b><br>
  Every family of land plant, from mosses to orchids — sized by species richness,
  coloured by lineage, dated to geological time.
</p>

<p align="center">
  <a href="https://yggdrasil.oddurs.com"><b>yggdrasil.oddurs.com&nbsp;→</b></a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="Code: MIT" src="https://img.shields.io/badge/code-MIT-1f7a4d"></a>
  <a href="DATA-LICENSE"><img alt="Data: CC BY 4.0" src="https://img.shields.io/badge/data-CC%20BY%204.0-1f7a4d"></a>
  <a href="https://github.com/oddurs/kingdom/actions/workflows/deploy.yml"><img alt="Build" src="https://github.com/oddurs/kingdom/actions/workflows/deploy.yml/badge.svg"></a>
  <img alt="Runtime dependencies: zero" src="https://img.shields.io/badge/runtime%20deps-0-1f7a4d">
</p>

<p align="center">
  <a href="https://yggdrasil.oddurs.com">
    <img src="https://yggdrasil.oddurs.com/og.jpg" alt="The plant kingdom as a radial tree, each branch coloured by lineage" width="820">
  </a>
</p>

---

**479 families · 14,135 accepted genera · ~390,000 species · 445 million years.**

Four linked views — tree, radial, sunburst, treemap. A geological time scrubber
that grows the tree from its origin. Search across every genus. A distribution
map and a dated origin for each clade. Plus a plain [static
page](https://yggdrasil.oddurs.com/families/) for every family and order, if
you'd rather read than pan around.

`plant-tree.html` is **one self-contained file** — no frameworks, no runtime
dependencies, no network calls. It runs from a `file://` URL, offline, inside a
strict CSP. See [ARCHITECTURE.md](ARCHITECTURE.md) for how it's authored and how
it renders.

## Quick start

Needs **Python 3.12+**, **Node 22+**, and Chrome/Chromium for the tests.

```sh
make serve     # build + assemble + serve at http://localhost:8000
make check     # build + both test suites — the pre-commit gate
make           # list every target
```

Never edit `plant-tree.html` — it's generated and git-ignored. Edit
`build/src/`, `build/shell.html` or `data/taxa.json`, then rebuild.

## What's inside

```
data/taxa.json          canonical data — flat, one record per taxon (source of truth)
data/genera.json        14,135 accepted genera (the genus tier)
data/taxon.schema.json  JSON Schema for a taxon record

build/build.py          validates taxa.json, derives the nested tree, injects it
build/pages.py          generates a static page per family and order
build/site.py           assembles _site/ — the app plus every page
build/shell.html        HTML shell with the /*__CSS__*/, /*__JS__*/, /*__DATA__*/ slots
build/src/app.css       the stylesheet
build/src/*.js          the app, as ten ordered modules (concatenated by build.py)
design/tokens.css       design tokens, shared with the Storybook workshop

build/fetch.py          enriches taxa.json with GBIF ids + metrics (needs internet)
build/wcvp.py           applies Kew WCVP accepted-species counts (needs the dump)
build/ages.py           derives divergence ages from a dated megatree (auto-fetches)
build/genera.py         extracts the accepted genera from WCVP

test/smoke.mjs          headless-Chrome regression suite for the app
test/pages.mjs          structural + layout checks for the generated pages
test/live.mjs           verifies the PUBLISHED site (canonical, robots, sitemap)
```

## Data

611 taxa arranged `Plantae → clades → orders → families`. Vascular plants resolve
to **family** (479 of them); bryophytes stop at **class**. Stored **flat** — one
record per taxon, keyed by a stable `id` with a `parent` pointer — which is
joinable, validatable and diff-friendly. `build.py` derives the nested tree the
visualisation consumes.

```jsonc
{
  "id": "Fabaceae",                 // stable key (currently the name; unique)
  "parent": "Fabales",              // parent id; null for the root
  "rank": "family",                 // kingdom|clade|phylum|class|subclass|order|family
  "name": "Fabaceae",
  "common": "Legumes — beans, peas, acacia, clover",
  "speciesCount": 22808,            // accepted species (drives node size)
  "ageMy": 84.8,                    // crown age, millions of years
  "examples": ["Phaseolus (bean)", "Pisum (pea)", "Acacia", "Trifolium (clover)"],
  "blurb": "Legume family: nitrogen-fixing plants bearing pod fruits …",
  "ids": { "gbif": 5386 },          // external identifiers (see fetch.py)
  "provenance": {                   // where each value came from — per field
    "speciesCount": "wcvp", "ageMy": "megatree", "dist": "wcvp", "ids": "gbif"
  }
}
```

### What the data is, and isn't

Every value carries its own provenance, and the app displays it — because roughly
**6% of the species total is estimated rather than counted**: 27 families that
WCVP circumscribes differently, plus every bryophyte class (WCVP covers vascular
plants only). That's why the headline reads *~390,000* and not a six-digit
number.

Divergence ages are **computed, not looked up**: the MRCA of each clade's tips in
a dated megatree of 72,570 vascular-plant species, with the outermost 0.5% of
tips rejected first — one misplaced genus can age a family by tens of millions of
years. They are one defensible estimate; published dates for the same clade
routinely differ by tens of millions of years.

Worth knowing: Kew's widely quoted ~390,000 refers to *vascular* plants. The 479
families here sum to 370,535 vascular species; this tree reaches ~390,000 only by
also counting the bryophytes, which Kew's figure excludes.

## Build & enrich

```sh
python3 build/build.py     # validate taxa.json → derive tree → plant-tree.html
python3 build/site.py      # assemble _site/ (app + 567 taxon pages + sitemap)
python3 build/fetch.py     # (with internet) fill GBIF ids + metrics into taxa.json
python3 build/wcvp.py      # apply Kew WCVP accepted-species counts (needs the dump)
python3 build/ages.py      # derive divergence ages from a dated megatree
```

`fetch.py` is idempotent and throttled. It writes GBIF `usageKey`s and GBIF
species counts — stored *separately* as `gbifSpeciesCount`, because the backbone
count includes synonyms and is **not** the accepted-species display number.

`wcvp.py` sets `speciesCount` (accepted species only) and native `dist`ribution
from Kew's [WCVP](https://sftp.kew.org/pub/data-repositories/WCVP/) — a ~440 MB
bulk download, not an API. Unzip into `data/wcvp/` (git-ignored) and run it.

`ages.py` derives `ageMy` from the dated
[plant megatree](https://github.com/megatrees/plant_20221117) (Jin & Qian 2022;
Smith & Brown 2018; Zanne 2014), a 2.9 MB Newick it fetches into `data/megatree/`.

## Develop & test

```sh
make build       # rebuild plant-tree.html
make site        # assemble _site/ — app + every taxon page
make serve       # assemble, then serve _site (the same layout CI deploys)
make test        # the headless-Chrome app suite
make test-pages  # the generated-pages suite
make check       # both — the pre-commit gate
make live        # verify the PUBLISHED site
```

`test/smoke.mjs` drives the built page in headless Chrome and asserts the
invariants — data integrity, all four views, the interactions, that
virtualization bounds the DOM, that reduced-motion falls to instant, and that the
figures on screen name their sources.

`test/pages.mjs` checks the generated pages: one `h1` each, self-referencing
canonicals, unique titles, a resolving link graph with no orphans, a sitemap that
matches the pages that exist, and — because Google indexes the mobile rendering —
no page overflowing a 390px viewport.

`make live` verifies the deployed site, which is the only place a canonical URL
can be checked at all. CI runs it after every deploy.

## Design system

A small **CSS-class design system** — tokens in `design/tokens.css`, components
in `build/src/app.css` — documented in a Storybook workshop that imports the
*same* files the app build uses, so it can't drift from the shipped page. Dev-only;
the app keeps zero runtime dependencies.

**Live workshop: <https://yggdrasil.oddurs.com/storybook/>**

```sh
npm install             # one-time (dev-only toolchain)
make storybook          # workshop at http://localhost:6006
```

## Controls

Drag to pan, scroll or pinch to zoom. **Click** a node for its detail panel and
to expand it. **Search** jumps to any family or genus. **Hover** traces a lineage
back to the root. **Timeline** grows the tree through 445 million years.
Keyboard: arrows traverse, Enter expands, `?` for the full list.

Links are shareable — the URL encodes the full view, so *Share this view* gives a
link that reopens exactly what you're looking at.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the build,
the test gate, and the few rules the build enforces about data honesty.
Taxonomic corrections are especially welcome; bring a citation.

For security reports, see [SECURITY.md](SECURITY.md) — please don't open a public
issue.

## Licence

**Code is [MIT](LICENSE). Data is [CC BY 4.0](DATA-LICENSE).**

The split isn't arbitrary: the data derives from Kew's WCVP and the Jin & Qian
megatree, both CC BY, so it carries their attribution requirement. If you
redistribute the data, credit those sources — [DATA-LICENSE](DATA-LICENSE) lists
them all, with terms.

To cite this work, see [CITATION.cff](CITATION.cff).
