# Remaining work — data sprint

Status of the five-phase data sprint and what's still open. Each phase is
plan → build → review → one PR merged to `main`.

| Phase | Scope | Status |
|-------|-------|--------|
| **P1 Ground truth** | flat ID-keyed model, GBIF ids, build/fetch pipeline | ✅ done |
| **P2 Time** | divergence ages from a dated megatree, panel time-bar | ✅ done (PR #11) |
| **P3 Place** | WCVP native distribution, map lens | ✅ done (PR #10) |
| **P4 Meaning** | conservation · uses · traits · colour modes | 🟡 in progress |
| **P5 Depth** | media, reproducibility, downloadable dataset | ⬜ not started |

Everything below is what's left.

---

## P4 — Meaning (in progress)

### ✅ Colour modes — done (PR #12)
A **Colour** switcher in the legend recolours the whole tree by Lineage / Age /
Region, reusing `ageMy` (P2) and `dist` (P3). **Threat** and **Use** are designed
to slot in as two more modes once their data lands (below).

### 🔴 Conservation — blocked on a working IUCN token
- **Source:** [IUCN Red List API v4](https://api.iucnredlist.org) — per-species
  threat categories (LC → NT → VU → EN → CR → EW → EX).
- **Auth:** `Authorization: Bearer <token>`. Free token from an account at
  api.iucnredlist.org.
- **Blocker:** the token supplied returns **401 Unauthorized** with the correct
  Bearer format → IUCN is rejecting it. Likely inactive, or an old **v3** token
  (v3 is retired and does not migrate to v4).
- **To unblock:** confirm on the api.iucnredlist.org **account page** that the
  token is a live v4 token, then hand it over.
- **Then I:** write `build/iucn.py` (reads the token from an **env var** — never
  committed) → fetch assessed species per family, tally by category → store a
  per-family conservation summary (absolute threatened count **+ assessment
  coverage**, never a bare percentage — only ~18% of plants are assessed and
  unevenly, so a raw % would mislead). Add a **Threat** colour mode + a panel
  line. Reachability from this sandbox is unverified (GBIF timed out here), so
  the fetch may need to run on your machine like `fetch.py`.

### 🔴 Uses — blocked on the WCUPS data file
- **Source:** Kew's **World Checklist of Useful Plant Species** (Diazgranados
  2020, CC-BY) — ~40,292 species × 10 use categories (Food, Medicines,
  Materials, Poisons, …). Family classification follows WCVP, so it maps cleanly
  onto our families.
- **Blocker:** the machine-readable table isn't fetchable from this sandbox. The
  [KNB mirror](https://knb.ecoinformatics.org/view/doi:10.5063/F1CV4G34) hosts
  only the **PDF + EML metadata** (the `.xml` currently in `data/useful/` is that
  metadata, not the data). Kew's own portal is behind a Cloudflare challenge.
- **To unblock (pick one):**
  1. Download the actual data file (CSV/Excel, ~40k rows) from the
     [Kew data record](https://kew.iro.bl.uk/concern/datasets/7243d727-e28d-419d-a8f7-9ebef5b9e03e)
     in a browser → drop it in `data/useful/` (git-ignored). If that page only
     offers the PDF/XML, the table is likely request-only (contact
     m.diazgranados@kew.org).
  2. **Fallback I can fetch myself:** [GlobUNT](https://zenodo.org/records/7994433)
     on Zenodo — ~14k *useful tree* species with the same 10 categories, derived
     from WCUPS. Openly downloadable, but **trees only** (undercounts herbaceous
     / medicinal families); would be labelled as such.
- **Then I:** write `build/useful.py` → aggregate useful species per family per
  category → store `uses` per family (provenance `wcups`). Add a **Use** colour
  mode + a uses line in the panel; generalises the existing "Crops we eat"
  highlight.

### ⏸️ Traits — deferred
Growth form / woodiness / leaf traits live mostly in [TRY](https://www.try-db.org),
which is **gated** (manual request + approval lag), and traits are fuzzy at family
level. Low payoff → deferred unless specifically wanted. If pursued, look first
for an *open* growth-form/woodiness dataset (e.g. GIFT) rather than TRY.

---

## P5 — Depth, media & reproducibility (not started)

Candidate scope (to be planned when P4 closes):
- **Media** — a representative image per major clade. Needs a **licensing
  decision**: Wikimedia Commons images embedded as CSP-safe **data-URIs**
  (keeps the file self-contained, but adds weight and needs attribution), or
  stay illustration-free. This is a call for you.
- **Reproducibility** — surface `provenance` + `meta.sources` in the UI (a
  "sources" affordance per stat), and publish a **downloadable dataset**
  (`taxa.json` / a CSV export) so others can reuse it.
- **Methods doc** — a short write-up of how each field is derived (this file is
  a start).

---

## Manual tasks for you (quick checklist)

- [ ] **IUCN:** confirm a live **v4** token at api.iucnredlist.org → send it (unblocks Conservation).
- [ ] **Uses:** download the WCUPS data file from the Kew record → drop in `data/useful/` **or** tell me to use the Zenodo trees fallback.
- [ ] **P5 media:** decide — embed Wikimedia images (data-URIs) or stay illustration-free.
- [ ] *(optional)* **Traits:** say if you want them; otherwise they stay deferred.

## Regenerating the data (git-ignored source dumps)

The raw source files are git-ignored; scripts read them from these paths:

| Script | Reads | Writes | Get the source |
|--------|-------|--------|----------------|
| `build/fetch.py` | GBIF API (internet) | `ids.gbif`, `gbifSpeciesCount` | keyless |
| `build/wcvp.py` | `data/wcvp/` | `speciesCount`, `dist` | [WCVP dump](https://sftp.kew.org/pub/data-repositories/WCVP/) |
| `build/ages.py` | `data/megatree/` | `ageMy` | auto-fetched from [GitHub](https://github.com/megatrees/plant_20221117) |
| `build/iucn.py` *(todo)* | IUCN API + token | conservation | v4 token |
| `build/useful.py` *(todo)* | `data/useful/` | `uses` | WCUPS / GlobUNT |

After any enrichment: `python3 build/build.py` regenerates `plant-tree.html`.
