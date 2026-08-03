# Docs

Working documents, not user documentation. The things a reader wants are
elsewhere:

- **[README](../README.md)** — what this is, how to run it
- **[ARCHITECTURE](../ARCHITECTURE.md)** — how it's authored, built and rendered
- **[CONTRIBUTING](../CONTRIBUTING.md)** — the build, the test gate, the data rules
- **[DATA-LICENSE](../DATA-LICENSE)** — where the data comes from and its terms

## What's in here

**Sprint plans.** Each is written before the work, states its thesis and how each
phase will be verified, and is left in place afterwards as a record of the
reasoning — including where the plan turned out to be wrong.

| | Sprint | About |
|---|---|---|
| T | [Seams](sprint-t-seams.md) | 30 review findings reduced to 7 single-owner fixes |
| U | [Findable](sprint-u-findable.md) | 567 static taxon pages; a canonical that can't drift |
| V | [Front Page](sprint-v-front-page.md) | Making the numbers defensible before an audience |
| Y | [Deep Time](sprint-y-deep-time.md) | The timeline, rebuilt around framing rather than opacity |
| AA | [Guardrails](sprint-aa-guardrails.md) | CI that holds: branch protection, CodeQL, a weekly health check |
| AC | [In Hand](sprint-ac-in-hand.md) | The phone: a stack with an owner, a key that travels, a depth a finger can hit |

Not every sprint has a plan document — the design-system and navbar work (W, X)
was built directly from a critique rather than a written plan, and AB was an
audit-driven pass over six unrelated defects. The commit messages carry that
reasoning instead.

**Forward-looking notes.**

- [making-it-real.md](making-it-real.md) — a three-sprint arc toward depth
  (provenance, species, media). Partly overtaken: the provenance half shipped in
  Sprint V.
- [remaining-work.md](remaining-work.md) — the original data sprint's open items.
  Still accurate about what's *blocked* (IUCN, WCUPS) but predates everything
  from Sprint T onward.
