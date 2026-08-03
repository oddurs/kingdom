# Sprint AC — "In Hand"

Make the phone a surface this app is willing to be judged on.

> **Shipped 2026-08-03.** #123–#126.

## The thesis

The question that started this was "is this going to completely break on mobile —
should we even attempt responsive design?", and the honest answer was: it doesn't
break, and the responsive design already works. Nothing overflows, the chrome
reflows, the panel becomes a bottom sheet, and the 567 static taxon pages are
already good on a phone — 16px body text, no overflow, sourced figures.

What failed was never layout. It was **density and stacking**: three surfaces
fighting for the bottom of the stage, a colour control whose key was hidden, and
132 nodes fitted into a 390px circle at 9.5px apart. Media queries do not fix
9.5px. That is arithmetic, and only the number of nodes moves it.

So this sprint fixes what was actually wrong and deliberately does **not** chase
parity with the desktop instrument.

## The finding that shaped it

Every mobile claim about this app had been inference, because the app had never
been tested below 1400px — `test/pages.mjs` checks the 567 static pages at 390,
but the thing those pages link *to* was measured only at desktop width.

The reason it stayed that way is worth writing down: **Chrome will not open a
window narrower than about 500px, and it does not say so.** `--window-size=390,844`
reports 390 in the flag and lays out at 500+. A suite built that way asserts
against the wrong viewport and passes, which is worse than no suite at all.
`Emulation.setDeviceMetricsOverride` is the only honest route, and the only one
that also sets `deviceScaleFactor` and the `mobile` flag the CSS keys on.

## AC1 — The phone enters the toolchain (#123)

A phone session in the smoke suite, and `make shots`: four scenes across four
widths into a gitignored `shots/<timestamp>/`. Timestamped because Chrome caches
`file://` by URL, so reusing a filename is a reliable way to review last build's
pixels and believe they are current.

AC1 asserts only what already held. Each later phase brought its own assertions
alongside its fix, so every PR stayed green.

Looking at the thing immediately paid for itself, twice — see AC2 and AC4.

## AC2 — Three things wanted the bottom of the stage (#124)

The detail panel is a bottom sheet, the time scrubber sits above the footer, and
the zoom pill sits in the corner. Each was positioned against the stage on its own
terms, so they overlapped: 105px of scrubber across the sheet, and the zoom pill
returning `#pdetail` from `elementFromPoint`.

Nothing was wrong with any one of them. There was no owner for the stack.
`syncStageChrome()` measures what is open and publishes `--tb-h` / `--sheet-h`;
the mobile CSS stacks against those rather than against constants that drift when
the panel's content changes height.

**What the screenshot found and the measurements hadn't:** the scrubber's period
labels were chosen by percentage of the axis, which is not a unit that knows how
wide a word is. The bands centre their label and clip it, so nine of ten names
rendered as their own middles — `Silu vonio nifermi iass iass tace oge`.

The footer was the near-miss. Five items on a nowrap line inside `overflow-x:auto`
meant 38% of it — including the source names Sprint V put there for credibility —
sat off-screen behind a scrollbar nobody can see. Letting it wrap costs 16px of
chrome at 390 and 34px at 360. Taken deliberately: names nobody on the majority
platform can see do not provide credibility.

## AC3 — Nine unexplained colours (#125)

Below 680px the legend is `display:none`, and the colour switcher it explains
survives, because Sprint G put a copy in the overflow menu. So a phone could
recolour all 14,740 nodes by native region and be handed nine hues with nothing to
read them by. Age is worse: ten geological periods.

The switcher was already built to render into every host that asks (`data-cmode-host`).
The key wasn't — it rendered into `#lgitems` by id, and `#lgitems` lives inside the
hidden legend. Now the key travels with the control.

Asserted in all three modes, because Age is the tall one: 454 / 494 / 514px of menu
against 667px of room. A key that pushes its own menu off the screen is no better
than no key.

## AC4 — A phone opens on nodes a finger can hit (#126)

Measured at 390 across cutoffs: `depth<2` gives 9 nodes at 80px, `depth<4` gives 55
at 26.5px, `depth<5` (the default) gives 133 at 9.1px. Tree mode is worse than
radial here (4.9px), so the layout stays as it is — radial suits a tall screen
better than a dendrogram does, which is not what I expected to find.

**The version that didn't ship.** The first attempt used `depth<2`. It clears the
24px floor by the widest margin, it is an existing preset so the Depth control
stayed honest, and drilling from it stays tappable — 80px, then 54, then 40, then
32, three levels down. Every number supported it.

It was wrong, and only a screenshot said so: nine dots in an empty field reads as a
broken app, not a tree of life. The whole-tree overview is the best thing this app
has on a phone, and that version threw it away to win an argument about pixels.

`depth<4` is the deepest cut that still clears the floor and still looks like what
it is. No Depth preset describes that state, so none is lit — the alternative was
leaving "Orders" checked while showing something else.

## One finding left open, on purpose

CodeQL flags `tools/shots.mjs` under `js/http-to-file-access` — network data written
to file. It is a source-to-sink rule, so validating the content cannot satisfy it:
a size guard and then a PNG-signature check both left the alert in place, following
the write to its new line.

The alert is **not dismissed**. It stays visible in the security tab, and the PR
conversation carries the reasoning: the socket is a DevTools connection this script
opens to a browser it spawns itself, on 127.0.0.1, rendering a `file://` URL from
this repo. There is no remote party. The tool is dev-only, never runs in CI, and
writes into a gitignored directory.

The PNG-signature check stays regardless, because it is right on its own terms —
a capture that raced the first paint would otherwise write a blank file that looks
like a finished screenshot, which is the failure this tool exists to prevent.

## Deliberately not done

- **Parity with the desktop instrument.** The canvas is a desktop tool with a
  usable phone mode; the 567 static pages are the phone product, and they are
  already good. The seam between them is worth a later look.
- **Sunburst and treemap on a phone.** Their labels already fail contrast at
  2.1–2.6:1, and on touch a treemap tap both selects and re-roots, so every tap
  drills a level with only the focus bar to get back. That is its own project.
- **The header.** 219px of chrome on a 360px screen, 27% of the viewport before
  the canvas starts, is now the largest single cost on mobile — larger than
  anything this sprint fixed. It wants an IA decision, not a media query.
- **The tablet's own bottom-of-stage collision.** At 768 the mobile block does not
  apply, and the panel and the minimap both sit over the scrubber. Same class of
  problem as AC2, a different breakpoint, and `syncStageChrome()` already publishes
  the numbers a fix would need.
- **Nearest-node tapping.** Considered instead of AC4: keep the dense overview and
  let a tap select the nearest node within ~22px. Rejected because at 9.5px spacing
  it would confidently open the wrong taxon, which is worse than a miss.
