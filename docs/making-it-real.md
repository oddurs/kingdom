# Making it real — a 3-sprint arc

A plan for moving Yggdrasil from an impressive visualization toward something a
skeptical botanist (or a curious expert) would trust and reach for.

## The premise

The data is *already* rigorous — this isn't a demo with invented numbers:

- **Taxonomy** — APG IV (angiosperms) and PPG I (ferns/lycophytes) backbones, the
  accepted scientific classifications; gymnosperms per Christenhusz et al. (2011).
- **Species counts** — Kew's WCVP, the authoritative checklist of *accepted*
  species (not inflated GBIF synonym counts).
- **Ages** — real crown-age estimates computed from the Jin & Qian (2022) dated
  megatree of 72,570 species, via MRCA with an outlier-rejection step that drops
  rogue misplaced genera (so Asteraceae dates to ~50 Ma, not a spurious 132).
- **Distributions** — WGSRPD level-1 native richness per continent.
- **14,135 genera** with verified POWO ids and their own species counts.

So "more real" is **not** an authenticity problem. The gap between a beautiful
demo and a real thing is three things: the rigor is **invisible**, the tree stops
at **families** (you can't reach a plant you recognize), and it's **abstract**
(no plant you can actually see). Sequenced cheapest-and-safest first:

## Sprint Q — "Provenance" (make the rigor visible)

No architecture risk, self-contained, highest credibility-per-hour.

- Every fact in the panel carries its source: *"~28,000 accepted species · Kew
  WCVP"*, origin *"crown ≈ 76 Ma · estimated from the Jin & Qian 2022 megatree"*,
  range *"native richness · WGSRPD"*. The data already tags provenance per field.
- **Honest uncertainty:** `≈` on ages (they differ from other studies by tens of
  Ma — say so), "accepted" on counts, and bryophytes' null ages read *"not dated
  — non-vascular"* instead of blank.
- Expand About into a real **Methodology & sources** page: the four sources, the
  age-derivation method in plain language (MRCA + outlier rejection), and the
  honest caveats (families unmatched under WCVP circumscription; bryophyte ages
  absent).
- **Verify:** smoke asserts provenance text renders; visual review.
- **Risk:** low. **Self-contained:** yes.

## Sprint R — "To the species" (depth) ⚠️ decision gate

Today the tree bottoms out at genera — you can't reach *Rosa canina*. Being able
to find *your* plant is the single biggest "this is real" lever.

- **The decision:** the full accepted-species set is ~340k names ≈ too big for one
  self-contained file (~7 MB of strings). Proposed bounded approach: the build
  pulls species-per-genus from WCVP but embeds only a **capped representative
  list** per genus (type species + economically notable, ~12 max) plus the *true*
  total count, and a **species search index**.
- **UI:** genus panel reads *"1,304 species — including Rosa canina (dog rose), R.
  rugosa…"*; species search resolves *"Rosa canina"* → navigates to Rosa;
  optionally the tree drills one more ring to show top species under a genus.
- **Payload budget:** hold `plant-tree.html` under ~1.5 MB (≈1 MB today). Measured
  each build.
- **Verify:** searching a real species lands correctly; genus panel lists species;
  payload under budget.
- **Risk:** medium (payload; pipeline against the 440 MB WCVP dump). **Self-contained:** yes if capped.

## Sprint S — "In the flesh" (tangibility) ⚠️ bigger decision gate

Plants are visual; the viz is beautiful abstract dots. Photos are the most
visceral "real" — and this one genuinely trades against the one-file constraint.

- **The decision — choose one:**
  1. **Embed curated photos** (data-URI WebP) for ~80 hero taxa. Keeps one-file +
     `file://`, costs ~2–4 MB. *(Recommended starting point.)*
  2. **Same-origin assets on Pages** — scales to far more taxa, tiny base file,
     but images no longer show from raw `file://` (graceful fallback).
  3. **Generative SVG botanical motifs** — fully self-contained and on-brand, but
     illustrative, not photographic.
- Whichever wins, images are **only CC / public-domain, credited** — which doubles
  as provenance (real photo, real attribution), tying back to Sprint Q.
- **Verify:** panel image slot renders for hero taxa, absent gracefully otherwise;
  payload re-checked.
- **Risk:** medium-high (licensing, payload, architecture). **Self-contained:** depends on option.

## Sequencing rationale

Q ships immediately with no decisions and makes the whole thing read as an
instrument. R and S each carry one real decision (species payload cap; image
architecture), pre-proposed so they don't block. Q's provenance framing also sets
up S's image-crediting — a natural thread from "show the sources" to "show the
plant, with its source."

## Open decisions

1. **Species (R):** OK to cap embedded species (representative list + true counts +
   search) rather than embed all ~340k?
2. **Images (S):** start with embedded-curated (recommended) or go
   same-origin-on-Pages?
