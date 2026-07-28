# Sprint V — "Front Page"

Make the work survive being looked at hard.

> **Status:** V1–V4 built 2026-07-28. V5 is the launch rehearsal; two of its
> steps need your Google account and a Pages toggle.

## The thesis

Sprint U made the tree *findable*. This one makes it *defensible*.

A Hacker News audience does not punish a rough edge — it punishes a number that
doesn't add up. So the question this sprint asked was not "is it polished" but
"what would a botanist find if they went looking", and the answer turned out to
be different from what we expected.

### What the investigation actually found

The sprint was planned around "three conflicting species totals". **There was no
conflict.** They reconcile exactly and measure different scopes:

```
389,873  the app's headline  =  365,557  counted from Kew WCVP (the genus tier)
                              +   4,966  ESTIMATED — 27 families WCVP circumscribes differently
                              +  19,350  ESTIMATED — 13 bryophyte classes
                              -      12  WCVP genus rows summing short of family rows (7 families)

370,535  the 479 families    =  vascular plants only — excludes every bryophyte
365,800  all genus counts    =  vascular, and only where genus data exists
```

445 of 452 families match their own genera *exactly*; the other seven differ by
one to four species.

The real defect was **false precision**. 24,316 species — 6.2% of the headline —
are round guesses, including a flat `Bryopsida: 11,000` that is 2.8% of the total
on its own, and the page printed all of it to six significant figures.

Two further things surfaced only because the numbers were checked against each
other:

- **The app disagreed with its own family pages.** The panel showed a family's
  leaf aggregate (Asteraceae 35,479) while `/family/asteraceae/` showed the
  family's own WCVP row (35,483) — both labelled "Kew WCVP".
- **41 of 479 blurbs quoted a species count in their prose**, 16 of them more
  than 15% adrift from the sourced figure printed directly beside them.
  Theaceae read "~200 species" next to a sourced 388; Polygonaceae "~1,200" next
  to 1,638.

And one claim in the project's own notes was wrong: that ~389,885 "matches Kew's
~390k known vascular plants". Kew's figure is **vascular only**. Our vascular
total is 370,535; this tree only reaches ~390,000 by *adding* the bryophytes that
Kew's figure excludes. The apparent corroboration was a coincidence.

---

## V1 — The headline stops claiming precision it hasn't got ✅

`provenance_split()` derives the sourced/estimated division from the same walk
the app sizes branches with, and **the build fails if the two don't reconcile**.
The split ships in `DATA.totals`, so the app's copy and the crawlable index quote
one derivation instead of each computing their own.

Footer, About and the crawl index now read **~390,000**. About states the split,
and pre-empts the Kew comparison rather than leaving it as a trap.

**Verify:** smoke asserts no visible total quotes the exact leaf sum, and that
About states a split which reconciles with it.

## V2 — Every figure says where it came from ✅

The static pages named a source beside each number while the app — the surface
people actually read — asserted them bare.

Species, age and range each carry an attribution. Two compact flags (`est`,
`stem`) carry the canonical provenance into the app without shipping the whole
dict across 14k nodes. An estimated count reads *"approximate — WCVP
circumscribes this family differently"*; a bryophyte reads *"estimated — WCVP
covers vascular plants only"*. An undated lineage now states **why** instead of
rendering nothing.

Families quote their own WCVP row, so the app and its pages agree. The 43
contradicting blurbs are fixed — 38 stripped by pattern, 5 rewritten — and
`validate()` fails the build on any blurb that quotes a species count, so they
cannot come back.

## V3 — About states the method and the gaps ✅

**Method:** ages are computed, not looked up — MRCA over the 72,570-species
GBOTB.extended megatree with the outermost 0.5% of tips rejected first, because
one misplaced genus can age a family by tens of millions of years (Asteraceae at
~45 Ma versus a spurious 132). Monotypic lineages carry a stem age. Counts are
*accepted* names, not name records — the GBIF backbone counts synonyms and would
inflate most families, which is why those are held separately and never shown as
richness. And published divergence dates for one clade routinely differ by tens
of millions of years, so every age is one defensible estimate, not a settled
figure.

**Known gaps:** the 27 circumscription mismatches, bryophytes being outside WCVP
entirely, the 5 vascular families with no sampled tips, and the tree stopping at
genus. All counts derive from the data, so they can't go stale.

## V4 — A composed share card ✅

The old `og.jpg` was a screenshot of the UI: toolbar across the top, minimap and
legend in the corners, 479 rotated labels that became noise below ~500px.

It now composes — chrome and labels hidden, the tree scaled about the stage
centre to clear the lower third, and the substance burned in. Verified legible at
1200, 400 and 260px. The stats derive from the same totals as the rest of the
site, so the card can't drift from it.

## V5 — Launch rehearsal

- Cold-cache load of the **live domain** on a throttled phone, not localhost
- The first-run path end to end: welcome → tour → a family → a static page
- **Enforce HTTPS** in Settings → Pages *(yours)*
- **Search Console** via Cloudflare TXT *(yours — steps in `sprint-u-findable.md`)*

### The submission

**Title:** `Show HN: Yggdrasil – an interactive tree of every plant family`

Keep it descriptive, no superlatives — HN titles that oversell get flattened in
the comments. "Every plant family" is a concrete, checkable claim, which is the
right kind.

**First comment** (post it yourself, immediately after submitting):

> I built this to answer a question I kept failing to answer for myself: where
> does a plant I recognise actually sit among the others?
>
> It's the 479 families of land plants and their 14,135 accepted genera, sized by
> species richness, coloured by lineage, and dated to geological time. Four linked
> views — tree, radial, sunburst, treemap.
>
> On the data, since that's the part worth being sceptical about: the backbone is
> APG IV and PPG I. Counts are accepted names from Kew's WCVP, not name records —
> the GBIF backbone includes synonyms and would inflate most families. Ages aren't
> looked up anywhere; they're computed as the MRCA of each clade's tips in the
> Jin & Qian (2022) dated megatree, with the outermost 0.5% of tips rejected first
> because one misplaced genus can age a family by tens of millions of years.
>
> About 6% of the species total is estimated rather than counted — 27 families
> WCVP circumscribes differently, plus the bryophytes, which WCVP doesn't cover at
> all. That's why the headline says ~390,000 and not a six-digit number, and the
> About page breaks down which is which. Worth noting Kew's own widely quoted
> ~390,000 refers to vascular plants; the vascular families here sum to 370,535,
> and this reaches ~390,000 only by also counting mosses and liverworts.
>
> It's one self-contained HTML file, no frameworks, no tracking, works offline.
> Every family also has a plain static page if you'd rather read than pan around.

Lead with the honest caveat rather than waiting to be asked — on HN that reads as
confidence, and it moves the top comment from "your numbers are wrong" to
something more interesting.

**Timing:** weekday mornings US Eastern. Be around for the first two hours; the
first few comments set the thread's direction.

---

## Still open

1. **Enforce HTTPS** in Settings → Pages (`https_enforced: false`).
2. **Search Console** — needs your Google account.
3. **Bryophyte counts are 13 round estimates.** Labelled as such now; sourcing
   them properly (World Flora Online has bryophyte coverage) would remove the
   last unsourced 5% of the total. Deliberately deferred — it's a data-fetch task
   of unknown size and this sprint was about being honest, not about being
   complete.
