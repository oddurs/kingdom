# Sprint AA — "Guardrails"

Make the pipeline enforce what we already believed.

> **Shipped 2026-07-29.** #108 plus repo configuration.

## The thesis

The day before this sprint, a pull request with a **failing build was merged into
`main`** — by hand, without the result being read. Nothing stopped it, because
nothing was configured to. That is the sprint: not more CI, but CI that holds.

Three separate gaps, found by looking rather than assuming:

| # | Gap | Evidence |
|---|-----|----------|
| 1 | No branch protection at all | `GET /branches/main/protection` → 404 |
| 2 | PRs paid for the deploy | `og.mjs` + `build-storybook` ran on every PR |
| 3 | A label the issue templates rely on didn't exist | `data_correction.yml` applies `data`; `gh label list` had no `data` |

## AA1 — The gate

**Branch protection** requiring `build` and both CodeQL analyses, with `strict`
so a branch must be current with `main` before merging. Force-pushes and
deletions off. No required reviews — this is a one-maintainer repo and requiring
a second reviewer would lock the only maintainer out of their own work.

**`enforce_admins` is on**, and that was not the first attempt. With it off, the
protection is advisory for the repo owner: a direct push to `main` succeeded with
`remote: Bypassed rule violations`. Since bypassing-by-default is exactly the
failure this sprint exists to prevent, admins are now subject to the same rules.
Verified by pushing an empty commit at `main` and getting
`GH006: Protected branch update failed`.

**Repo settings:** squash-only merges, branches auto-deleted on merge, auto-merge
enabled. Squash-only means stacked PRs must be rebased between merges rather than
merged with merge commits — a real trade, taken deliberately for a linear
history.

## AA2 — PRs stop doing deploy work

`og.mjs` drives a headless Chrome to regenerate the social image; `npm ci` and
`build-storybook` exist for the dev-only workshop. All three are consumed **only**
by the published artifact, which only `main` uploads — and all three ran on every
pull request.

Gated to `main`, after verifying the PR path survives without them: with no
`og.jpg`, `site.py` reports it absent and continues, and the page suite still
passes 26/26. Only `live.mjs` looks for it, and that is main-only.

## AA3 — Labels

`data_correction.yml` applies a `data` label that did not exist, so every data
correction — the contributions this project most wants — would have filed
unlabelled. Created, along with `ci` and `needs-verification`.

## AA4 — Security

**CodeQL** for JavaScript and Python, on push, PR and weekly. It earned its place
on the first run: two high-severity findings, both in `test/links.mjs`, which
this same sprint had just added.

`/^https:\/\/sftp\.kew\.org/` has no terminating `$` or `/`, so it also matches
`sftp.kew.org.example.com`. The practical risk was nil — it reads URLs from our
own repo — but that regex lives in a skip-list whose stated purpose is that skips
stay visible and "can't grow into a way of hiding failures". A pattern matching
unrelated hosts does the opposite. Anchored, with tests for the over-match cases.

**Dependabot triage.** The five GitHub Actions and font bumps were armed with
auto-merge. The Storybook group and `vite 5 → 8` are held, labelled
`needs-verification`, with the reason stated on each: CI green does **not** prove
the workshop still renders, because `build-storybook` is `continue-on-error` by
design and — as of #108 — only runs on `main`. They need a local render check.

## AA5 — The things that rot

A weekly `health` workflow, because some failures arrive without anyone touching
the repo. The deploy workflow proves a *commit* is good; this proves the world
around it still is.

`test/links.mjs` checks the external URLs this project asserts but does not
control: four DOIs, seven upstream datasets in `DATA-LICENSE`, the megatree
repository. Nothing else exercises them — the app makes no network calls by
design — and they are the evidence the provenance work rests on.

**It distinguishes "blocked" from "dead", and that is the whole design.** A 403 is
not a dead link: doi.org, Kew's POWO and GBIF all answer, they simply refuse an
unknown user-agent. The first version reported seven broken citations and would
have taught everyone to ignore the suite within a month. Only *gone* fails — 404,
410, DNS failure, timeout.

Current: **14 ok, 6 answered-but-bot-blocked, 0 dead.**

## Deliberately not done

- **Required reviews.** One maintainer.
- **Pinning actions to commit SHAs.** Stricter than tags, but Dependabot manages
  versions and SHA pinning makes every bump unreadable. Revisit if the project
  gains contributors.
- **Caching Chrome.** `setup-chrome` is not the slow part; the smoke suite is,
  and it is slow because it drives a real browser, which is the point.
