# Kingdom — a living tree of the plant kingdom

An interactive taxonomic tree of every family of land plant, from mosses to
orchids. Nodes are **sized by species richness** and **coloured by lineage**;
the tree opens collapsed at order level and expands to families on click.

`plant-tree.html` is a single self-contained page — no build tools, no external
dependencies, no network calls. Open it in any browser.

## What's inside

```
data/plant-taxonomy.json   canonical data — 611 taxa, the single source of truth
build/template.html        markup + CSS + JS, with a /*__DATA__*/ placeholder
build/build.py             injects the data into the template
plant-tree.html            generated, self-contained visualization (commit artifact)
```

## Data

611 taxa arranged `Plantae → clades → orders → families`. Vascular plants are
resolved to **family** (~479 families); bryophytes stop at **class**. Every leaf
carries an approximate species count (~340,000 total) and, where one exists in
common use, a plain-language name.

Each node:

```jsonc
{
  "name": "Fabaceae",              // scientific name
  "rank": "family",                // kingdom|clade|phylum|class|subclass|order|family
  "common": "Legumes — beans, peas, acacia, clover",  // optional
  "speciesCount": 19500,           // optional, approximate — for visual scaling
  "children": [ ... ]              // omitted on leaves
}
```

Sources: **APG IV** (angiosperm orders & families), **PPG I** (lycophytes &
ferns), standard gymnosperm and bryophyte treatments, and **Kew's Plants of the
World Online** for species counts. Counts are approximate and for scaling only.

## Build

The visualization is generated from the data + template:

```sh
python3 build/build.py     # → plant-tree.html
```

Edit the data in `data/plant-taxonomy.json` or the presentation in
`build/template.html`, then rebuild.

## Controls

Drag to pan, scroll or pinch to zoom. Click a node to expand or collapse it.
Search jumps to a family; hover traces a lineage back to the root. Keyboard:
arrow keys traverse, Enter expands.
