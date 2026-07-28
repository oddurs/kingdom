# Sprint Y — "Deep Time"

Make the timeline the thing people remember.

> **Status:** planned 2026-07-28. Two decisions taken up front: the frame follows
> the living tree with damped continuous reframing, and undated lineages stay on
> screen but are visibly marked as undated.

## The thesis

The timeline is conceptually the most spectacular thing in the app — 445 million
years of plant evolution, scrubbable — and it is currently the least impressive.
Measured at 340 Ma: **19 of 132 nodes alive**, clustered in the top-right of a
canvas that is otherwise empty, while the minimap, legend and footer all continue
to describe the present day.

The root problem is that time is implemented as **opacity, not layout**. Nodes
fade out but keep their present-day positions, so running the clock backwards
doesn't grow a tree — it dissolves a photograph and leaves the negative space
behind. Everything else follows from that.

| # | Defect | Evidence |
|---|--------|----------|
| 1 | The frame never follows the tree | 19/132 nodes at 340 Ma, in a corner |
| 2 | Minimap, legend and footer contradict the canvas | footer says 479 families over a 19-node screen |
| 3 | Period bands are anonymous colour smears | `buildBands()` emits no labels; 42% opacity |
| 4 | Nothing narrates | readout is `340 Ma · Carboniferous`; the hint above never changes |
| 5 | Undated lineages assert an age they don't have | `ageOpacity(a,T){ if(a==null) return 1; … }` |
| 6 | Births barely register | `ripple(n)` gated on `radius(n) > 6` |

---

## Y1 — The frame follows the living tree

The structural fix, and the one that changes the feel.

Add `livingBounds()` — the bounding box of nodes whose `ageOpacity` clears a
threshold — and, while the clock is moving, ease the viewport toward a fit on
*that* box rather than on the whole tree. At 445 Ma you are looking at a handful
of lineages, large and legible; as the clock runs the frame widens to make room
for what appears, and lands at exactly today's fit at 0 Ma.

- **Damping is the whole craft here.** A per-frame lerp toward the target
  transform, heavily smoothed, so the frame drifts rather than snaps. The
  angiosperm radiation around 140 Ma will be the stress case — a lot of tree
  appearing in a short interval.
- **Never fight the user.** If they pan or zoom while the clock runs, suspend
  auto-reframing until they let go; resume at the next era boundary.
- **`prefers-reduced-motion`** falls back to reframing only at era boundaries.

**Verify:** measure the living tree's share of the canvas at 445, 340, 200, 140
and 0 Ma — it should stay within a sane band at every stop instead of collapsing
to a corner. Today at 340 Ma it is a small fraction; that number is the test.
**Risk:** medium — continuous reframing can induce motion sickness, which the
damping, the pan-suspension and the reduced-motion path exist to manage.

## Y2 — A scrubber worth looking at

The geological periods *are* the story and they are currently unlabelled bands at
42% opacity in a 26px strip.

- **Taller track** with the period bands named in place, abbreviated where the
  band is too narrow (the Quaternary is 0.6% of the axis).
- **Era grouping above the bands** — Paleozoic · Mesozoic · Cenozoic — so the
  three-act structure is visible without knowing the periods.
- **Ticks every 100 Ma**, and the current period lit while the others recede.
- **A real handle** rather than a 13px dot, with the current time riding it.
- Keeps the existing `role="slider"` semantics and `aria-valuetext`, which are
  already good.

**Verify:** every period band is either labelled or has its name available;
keyboard stepping still works; no horizontal overflow at 390px.
**Risk:** low.

## Y3 — A readout that changes

The prime line is currently a static hint that persists while you scrub. Replace
it with what is true at this instant: the era and period, how many lineages have
originated, and — the good part — **what just appeared**.

> **Carboniferous** · 340 Ma — 14 families have originated · *first tree ferns*

**One thing this must not do: quote species counts through time.** A family's
species count is its count *today*. Showing "~2,000 species alive at 340 Ma"
would be fabrication of exactly the kind Sprint V spent its time removing. The
timeline knows **origins only** — so it counts lineages that have originated, and
says so in those words. Nothing in this data set goes extinct either, which the
copy should not imply.

**Verify:** smoke asserts the readout changes with time and that no species
figure appears anywhere in timeline mode.
**Risk:** low, but the wording carries the sprint's credibility.

## Y4 — Make emergence an event

A lineage appearing is the one genuinely cinematic moment in the app, and most
appearances are a silent opacity change because `ripple()` is gated on
`radius(n) > 6`.

- The bloom scales with the node rather than being gated by it, so a small family
  gets a small, brief event instead of nothing.
- **The branch draws in** — the link strokes on from parent to child as the child
  appears, so lineage growth reads as growth.
- Notable first appearances (first vascular plant, first seed, first flower) get
  a brief label as they arrive.
- `prefers-reduced-motion`: appearance without the bloom or the draw-on.

**Verify:** births fire for small nodes too; the suite's reduced-motion session
asserts no animation.
**Risk:** low–medium — this runs during playback, so it must not cost frames.
Measure with the existing perf HUD before and after.

## Y5 — Coherence and honesty

**Everything else follows the clock.** The minimap redraws to the living set, the
legend dims lineages that have not originated, and the footer counts follow the
time rather than continuing to describe the present.

**Undated lineages stop pretending.** `ageOpacity` returns 1 for a null age, so
all 13 bryophyte classes and 5 undated families are present at 445 Ma as though
their origin were known. They stay — they are genuinely the oldest land plants
and deleting them from deep time would be its own distortion — but they render
distinctly (hollow, dimmed), are excluded from the "originated" count, and are
named as undated in the readout.

**Verify:** smoke asserts undated nodes are visually distinguished and excluded
from the counts; minimap and legend reflect the clock.
**Risk:** low.

---

## Deliberately not in scope

- **Extinction.** The data carries origins, not extinctions — nothing in the tree
  ever disappears going forward in time. Implying otherwise would be inventing.
- **Species-through-time.** See Y3.
- **Palaeogeography.** Continents have moved a great deal over 445 Ma and the
  distribution map is present-day WGSRPD. Showing it under a running clock would
  be wrong; the map should simply not claim to be historical.
