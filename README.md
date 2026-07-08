# Kingdom — a living tree of the plant kingdom

An interactive taxonomic tree of every family of land plant, from mosses to
orchids. Nodes are **sized by species richness** and **coloured by lineage**;
the tree opens collapsed at order level and expands to families on click.

`plant-tree.html` is a single self-contained page — no build tools, no external
dependencies, no network calls. Open it in any browser.

## What's inside

```
data/taxa.json          canonical data — flat, one record per taxon (source of truth)
data/taxon.schema.json  JSON Schema for a taxon record
build/build.py          validates taxa.json, derives the nested tree, injects it
build/fetch.py          enriches taxa.json with GBIF ids + metrics (run with internet)
build/wcvp.py           applies Kew WCVP accepted-species counts (needs the dump)
build/ages.py           derives divergence ages from a dated megatree (auto-fetchable)
build/genera.py         extracts the ~14k accepted genera from WCVP (the genus tier)
build/shell.html        HTML shell with /*__CSS__*/, /*__JS__*/, /*__DATA__*/ placeholders
build/src/app.css       the stylesheet
build/src/*.js          the app, split into ordered modules (concatenated by build.py)
plant-tree.html         generated, self-contained visualization (commit artifact)
test/smoke.mjs          headless-Chrome regression suite (node test/smoke.mjs)
```

## Data

611 taxa arranged `Plantae → clades → orders → families`. Vascular plants are
resolved to **family** (~479 families); bryophytes stop at **class**. The data is
stored **flat** — one record per taxon, keyed by a stable `id` with a `parent`
pointer — which is joinable, validatable, and diff-friendly. `build.py` derives
the nested tree the visualization consumes.

Each record:

```jsonc
{
  "id": "Fabaceae",                // stable key (currently the name; unique)
  "parent": "Fabales",             // parent id; null for the root
  "rank": "family",                // kingdom|clade|phylum|class|subclass|order|family|subfamily|genus
  "name": "Fabaceae",
  "common": "Legumes — beans, peas, acacia, clover",  // optional
  "speciesCount": 19500,           // accepted-species richness (for scaling)
  "examples": ["Phaseolus (bean)", "Pisum (pea)", "Acacia", "Trifolium (clover)"],
  "blurb": "Legume family: nitrogen-fixing plants bearing pod fruits …",
  "ids": { "gbif": 5386 },         // external identifiers (see fetch.py)
  "provenance": { "speciesCount": "estimate" }        // per-field source
}
```

Sources: **APG IV** (angiosperm orders & families), **PPG I** (lycophytes &
ferns), and standard gymnosperm/bryophyte treatments for the topology; **GBIF
Backbone** for identifiers; **Kew WCVP** for accepted-species counts. Counts
carrying `provenance: estimate` are approximate and await a sourced value —
`fetch.py` and a WCVP snapshot replace them (see below).

## Build & enrich

```sh
python3 build/build.py     # validate taxa.json → derive tree → plant-tree.html
python3 build/fetch.py     # (with internet) fill GBIF ids + metrics into taxa.json
python3 build/wcvp.py      # apply Kew WCVP accepted-species counts (needs the dump)
python3 build/ages.py      # derive divergence ages from a dated megatree
```

`fetch.py` is idempotent and throttled. It writes GBIF `usageKey`s (identifiers +
deep links) and GBIF species counts (stored separately as `gbifSpeciesCount`,
since the backbone count includes synonyms and is *not* the accepted-species
display number).

`wcvp.py` sets the honest `speciesCount` (accepted species only) and native
`dist`ribution from Kew's [WCVP](https://sftp.kew.org/pub/data-repositories/WCVP/).
WCVP is a bulk download (~440 MB), not an API: unzip it into `data/wcvp/`
(git-ignored) and run the script. Families WCVP circumscribes differently
(e.g. Adoxaceae → Viburnaceae, some fern families) keep their estimate.

`ages.py` derives a divergence `ageMy` for each clade from the dated
[plant megatree](https://github.com/megatrees/plant_20221117) (Jin & Qian 2022;
Smith & Brown 2018; Zanne 2014) — a single 2.9 MB Newick it reads from
`data/megatree/` (git-ignored). Crown age via the MRCA of a clade's tips, with
light outlier rejection to reject the occasional misplaced genus; monotypic
lineages get a stem age. Vascular plants only, so bryophytes stay undated.

Edit the data in `data/taxa.json` or the presentation in `build/template.html`,
then rebuild.

## Controls

Drag to pan, scroll or pinch to zoom. **Click** a node to open its detail panel
(blurb, example genera, stats, clickable lineage breadcrumb) and expand it.
**Search** jumps to a family; **hover** traces a lineage back to the root.
**Highlight** chips light up curated sets — carnivores, crops, biggest families —
and list them for exploring. Keyboard: arrow keys traverse, Enter expands.

Links are shareable: opening a node writes `#sel=<family>` to the URL, so
`…/plant-tree.html#sel=Orchidaceae` opens straight to that family.
