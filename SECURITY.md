# Security

## Reporting a vulnerability

Please **don't** open a public issue for a security problem.

Use GitHub's private reporting — [Security → Report a
vulnerability](https://github.com/oddurs/kingdom/security/advisories/new) — or
email <oddurs@gmail.com>. I'll acknowledge within a few days.

## Scope, honestly

This is a static site. There is no server, no database, no accounts, no user
data, and no analytics or tracking of any kind. The app is a single HTML file
that makes **no network requests at runtime** — it runs offline and inside a
strict CSP.

That removes most of the usual attack surface, so the realistic concerns are:

- **Injection into the built page.** Taxon names and blurbs come from
  `data/taxa.json` and are escaped on the way in; the embedded JSON blob escapes
  `</` so a crafted name can't close the `<script>` early. A way past either of
  those is worth reporting.
- **The build and CI pipeline.** The build job runs PR-authored code, so it holds
  `contents: read` and nothing else; publish scopes live on the deploy job, which
  only ever runs from `main`. A path from a PR to a deploy credential is worth
  reporting.
- **Dependencies.** The shipped app has zero runtime dependencies. The dev
  toolchain (Storybook, Vite) is not shipped to users, and the Storybook build is
  `continue-on-error` precisely so it can never block or alter an app deploy.

## Not in scope

Findings against `yggdrasil.oddurs.com` that are really GitHub Pages platform
issues — report those to GitHub. Likewise anything requiring a compromised
maintainer machine.
