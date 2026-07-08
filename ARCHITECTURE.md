# Architecture

Yggdrasil ships as **one self-contained HTML file** with no runtime dependencies
and no network calls — it runs from a `file://` URL and inside sandboxes with a
strict content-security policy. That constraint shapes everything below: the
source is authored in pieces and **bundled at build time** into a single inline
page; nothing is loaded at runtime.

## Author-time source → one-file output

```
build/shell.html      HTML skeleton with three slots: /*__CSS__*/ /*__JS__*/ /*__DATA__*/
build/src/app.css     the stylesheet
build/src/*.js        the app, as ten ordered modules (one shared scope)
data/taxa.json        canonical taxa (flat, one record per taxon)
data/genera.json      the ~14k accepted genera (the genus tier)
        │
        │  python3 build/build.py
        ▼
plant-tree.html       one self-contained page (CSS + JS + data all inlined)
```

`build.py` reads the shell, inlines `app.css` into the `/*__CSS__*/` slot,
concatenates the JS modules **in the order listed in `MODULES`** into
`/*__JS__*/`, and injects the data into `/*__DATA__*/`. The modules share one
scope, exactly as the code did when it was a single file — the split is for
authoring, not isolation, so there is no module system at runtime.

The data is embedded as `JSON.parse('…')` rather than a raw JS object literal:
V8 parses a JSON string several times faster than the equivalent literal at this
size. Genera are stored compactly (`{n,s,p}` = name, speciesCount, powo id) and
rehydrated to full node fields by `prep()` on load.

### The JS modules

| Module | Responsibility |
|---|---|
| `01-prep.js` | data prep: nested tree, `_id`/`agg`/`effAge`/`lineage`; colour modes |
| `02-layout.js` | tidy-tree (horizontal) and radial cluster layouts |
| `03-render.js` | render loop, **viewport virtualization**, semantic-zoom LOD, lazy labels |
| `04-minimap.js` | the overview minimap |
| `05-views.js` | re-root / focus, treemap, sunburst |
| `06-interaction.js` | select / hover, the structural animation engine |
| `07-navigation.js` | pan / zoom / momentum, the search palette |
| `08-panels.js` | detail panel, geological time-bar, distribution map |
| `09-story.js` | storyline overlays, deep-linking, guided tours |
| `10-boot.js` | welcome, legend/footer, PNG export, time scrubber, boot, perf HUD |

## The render model

Data flows one way, recomputed on every structural change:

```
flat taxa ─prep()→ nested tree ─layout()→ positioned nodes ─applyMount()→ SVG
                    (_id, agg,              (x, y per node,     (only the
                     effAge, lineage,        tidy-tree or        on-screen
                     open/closed)            radial)             subset)
```

**Viewport virtualization** is the load-bearing idea. In tree/radial views the
DOM holds a `<g>` only for nodes within the viewport plus a margin, so the SVG
element count — and the pan/zoom recomposite cost — is bounded by the screen,
not the tree size. Panning re-culls, but only after the viewport has moved a
fraction of the margin (distance-throttled), so most pan frames are just the
viewport transform. Node shells are pooled to avoid element churn as nodes
stream in and out. Structural animations suspend culling and mount their whole
working set, then re-cull when they settle.

Two supporting economies: each node builds its label `<text>` and `+` toggle
glyph only when semantic zoom actually shows them (a crowded frontier carries no
invisible text), and the ambient "breathe" animation pauses itself once many
nodes are mounted (a continuously animating transform would otherwise
recomposite every node each frame). Everything ambient is gated behind
`prefers-reduced-motion`.

The dev perf HUD (backtick key, or `?perf` in the URL) shows live FPS, frame and
render time, the SVG element and visible-node counts, and JS heap.

## The data pipeline

`data/taxa.json` is the source of truth: **flat**, one record per taxon, keyed
by a stable `id` with a `parent` pointer — joinable, validatable, diff-friendly.
`build.py` validates it against `data/taxon.schema.json` and derives the nested
tree. Enrichment scripts are separate and idempotent:

- `fetch.py` — GBIF backbone identifiers + metrics (needs internet)
- `wcvp.py` — Kew WCVP accepted-species counts and native distribution (needs the bulk dump)
- `ages.py` — divergence ages from a dated plant megatree
- `genera.py` — the ~14k accepted genera from WCVP

Raw source dumps (WCVP, the megatree, geodata) are regenerated, not committed —
only the derived `*.json` and `worldmap.json` are. See the README for sources
and the run order.

## Testing

`test/smoke.mjs` boots headless Chrome against the built page over the DevTools
protocol and asserts the invariants — data integrity, all four views, the core
interactions, that virtualization bounds the DOM, and that reduced-motion falls
to instant — with no npm dependencies. `make check` builds and runs it; it is
the pre-commit gate.
