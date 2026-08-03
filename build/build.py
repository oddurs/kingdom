#!/usr/bin/env python3
"""Build plant-tree.html from the flat canonical data + template.

Pipeline:  data/taxa.json  (flat, source of truth)
             |  validate against data/taxon.schema.json (lightweight, no deps)
             |  derive nested tree (children in first-seen order)
             v
           build/template.html  (/*__DATA__*/ placeholder)
             |
             v
           plant-tree.html      (self-contained)

Usage:  python3 build/build.py
"""
import datetime
import hashlib
import html
import json
import re
import pathlib
import sys

from pages import slug          # one slug rule for the app's links and the pages themselves
from util import read_json

# The canonical origin, with its trailing slash — the one place the host is written.
# Everything that names a URL (canonical, og:url, both social images, robots, sitemap)
# derives from this; `assert_no_literal_host` below keeps it that way. A canonical is
# the one piece of metadata that is worse than useless when wrong — it argues the page
# shouldn't be indexed at all — and it can only be checked against the live network,
# which is what test/live.mjs does after each deploy.
SITE = "https://yggdrasil.oddurs.com/"


def assert_no_literal_host(shell):
    """Fail the build if the shell writes the canonical host itself.

    Sprint S left the host hand-copied into five places here; they drifted from
    `SITE` and the live site spent thirteen days declaring itself a duplicate of a
    domain with no DNS record. A grep is the cheapest structural fix: there is no
    legitimate reason for the shell to name the origin when `__SITE__` exists.
    """
    host = SITE.split("//", 1)[-1].rstrip("/")
    if host in shell:
        raise SystemExit(
            f"build/shell.html hard-codes {host!r} — use the __SITE__ placeholder so "
            "the canonical can never drift from SITE in build.py")


def seo_blocks(taxa, meta, ngenera, total_spp, sourced, estimated):
    """Build two SEO payloads: JSON-LD structured data (head) and a crawlable,
    screen-reader text index of the tree (body). The visualization is drawn in
    JS/SVG, so without these a crawler — and a screen reader — sees almost no
    content. Both are generated from the same rigorous data the app renders."""
    fams = [t for t in taxa if t.get("rank") == "family"]
    nfam = len(fams)
    # two significant figures: 6% of the total is round estimates, so the exact
    # figure would claim a precision the data does not have
    approx_spp = f"{round(total_spp / 10000) * 10000:,}"
    by_rich = sorted(fams, key=lambda t: t.get("speciesCount", 0), reverse=True)
    aged = [t for t in fams if t.get("ageMy") is not None]
    oldest = max(aged, key=lambda t: t["ageMy"]) if aged else None
    widest = max(fams, key=lambda t: len(t.get("dist") or {}))

    # `estimate` is a stand-in for "no source yet", not a citation — a Dataset that
    # cites "Approximate estimate" is noise in Google Dataset Search
    sources = meta.get("sources", {})
    cites = [n for k, v in sources.items() if k != "estimate"
             for n in [v.get("name") or v.get("title") or ""] if n]

    ld = [
        {"@context": "https://schema.org", "@type": "WebSite", "name": "Yggdrasil",
         "url": SITE, "description": meta.get("description", ""),
         "inLanguage": "en"},
        {"@context": "https://schema.org", "@type": "Dataset",
         "name": "Yggdrasil — the plant tree of life",
         "description": (f"An interactive classification of the plant kingdom: {nfam} "
                         f"families of land plants and ~{ngenera:,} genera, sized by "
                         "accepted-species richness, coloured by lineage, and dated to "
                         "geological time. Built on APG IV, PPG I, Kew WCVP and GBIF."),
         "url": SITE, "license": "https://creativecommons.org/licenses/by/4.0/",
         # the claim is now backed by DATA-LICENSE in the repo; it was
         # asserted to crawlers for weeks while the repo carried no licence at all
         "isAccessibleForFree": True,
         "creativeWorkStatus": "Published",
         "creator": {"@type": "Person", "name": "Oddur", "url": "https://github.com/oddurs"},
         "keywords": ["plant taxonomy", "tree of life", "phylogeny", "APG IV", "PPG I",
                      "botany", "plant families", "species richness", "WCVP"],
         "variableMeasured": ["accepted species richness", "divergence age (Ma)",
                              "native distribution (WGSRPD)"],
         "citation": cites},
    ]
    # same tag-safety the data blob gets below: `name`/`title` come from hand-edited
    # data, and one "</script>" in there would close this block early
    jsonld = ('<script type="application/ld+json">'
              + json.dumps(ld, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
              + "</script>")

    def esc(s):
        return html.escape(str(s), quote=False)

    def li(t):
        com = f" ({esc(t['common'])})" if t.get("common") else ""
        # each family now links to its own page (build/pages.py). The section stays
        # visually hidden — it is a screen-reader index, which was always the better
        # justification for it — but the links are real, so this doubles as the
        # in-app crawl path to all 479 documents.
        # tabindex="-1" because `clip` hides these links from sight but not from the
        # tab order: all 479 sat between the header and the canvas as focusable
        # elements with no visible focus ring, so reaching the tree by keyboard meant
        # 479 presses into nothing. A screen reader still reaches them by virtual
        # cursor and a crawler never looks at tabindex, so nothing is lost.
        href = f"/family/{slug(t['name'])}/"
        return (f'<li><a href="{href}" tabindex="-1"><b>{esc(t["name"])}</b></a>{com} — '
                f"~{t.get('speciesCount', 0):,} accepted species.</li>")

    rows = "".join(li(t) for t in by_rich)
    records = []
    records.append(f"the largest family is <b>{esc(by_rich[0]['name'])}</b> "
                   f"(~{by_rich[0].get('speciesCount', 0):,} species)")
    if oldest:
        # The winner is Ginkgoaceae, whose 269.7 Ma is a *stem* age — provenance
        # 'megatree-stem'. The panel and the family pages both read the provenance
        # before naming the figure; this, the one surface Google indexes, hard-coded
        # "crown".
        kind = "stem" if str((oldest.get("provenance") or {}).get("ageMy", "")).endswith("stem") else "crown"
        records.append(f"the oldest surviving lineage here is <b>{esc(oldest['name'])}</b> "
                       f"({kind} age ≈{round(oldest['ageMy'])} million years)")
    records.append(f"the most widely distributed is <b>{esc(widest['name'])}</b>")
    src_list = "".join(f"<li>{esc(n)}</li>" for n in cites)

    crawl = (
        '<section class="visually-hidden" aria-label="The plant kingdom in text">'
        "<h2>Yggdrasil — the plant kingdom in text</h2>"
        f"<p>An accessible, text-only index of the interactive tree above. It covers "
        f"roughly {approx_spp} accepted species across the {nfam} families of land "
        f"plants (Embryophyta) — from mosses and ferns through gymnosperms to the "
        f"flowering plants — with ~{ngenera:,} genera. Of those, {sourced:,} are "
        f"accepted names counted from Kew's World Checklist of Vascular Plants and "
        f"~{round(estimated / 1000) * 1000:,} are estimates: 27 families WCVP "
        f"circumscribes differently, plus the bryophyte classes, which WCVP does not "
        f"cover. The classification follows APG IV and PPG I; divergence ages are "
        f"crown estimates from the Jin &amp; Qian (2022) dated megatree.</p>"
        f"<p>Notably, {'; '.join(records)}.</p>"
        f"<h3>All {nfam} plant families, by species richness</h3><ul>{rows}</ul>"
        f"<h3>Sources</h3><ul>{src_list}</ul>"
        "</section>"
    )
    return jsonld, crawl

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "taxa.json"
GENERA = ROOT / "data" / "genera.json"
WORLDMAP = ROOT / "data" / "worldmap.json"
SCHEMA = ROOT / "data" / "taxon.schema.json"
SHELL = ROOT / "build" / "shell.html"
SRC = ROOT / "build" / "src"
DESIGN = ROOT / "design"
OUT = ROOT / "plant-tree.html"
PLACEHOLDER = "/*__DATA__*/"

# CSS is concatenated in this order into the single <style>. fonts.css declares
# the inlined @font-face; tokens.css (the shared source of truth Storybook also
# imports) defines the custom properties; app.css consumes them.
CSS_PARTS = [DESIGN / "fonts.css", DESIGN / "tokens.css", SRC / "app.css"]

# The single inline <script> body, concatenated from these modules in this order.
# They share one scope (as the original monolith did); order is load order.
MODULES = [
    "01-prep.js", "02-layout.js", "03-render.js", "04-minimap.js", "05-views.js",
    "06-interaction.js", "07-navigation.js", "08-panels.js", "09-story.js", "10-boot.js",
]

# viz-facing node fields, in output order (provenance is intentionally omitted —
# the visualization doesn't render it; it lives in the canonical data).
NODE_FIELDS = ["name", "rank", "common", "speciesCount", "examples", "blurb", "ids", "dist", "ageMy"]


# One rule, two surfaces: prose may not quote a count the UI already prints
# beside it. Used by validate() for the blurbs and check_narration() for the tours.
QUOTED_COUNT = re.compile(r"\d[\d,]*\+?\s*(?:species|gener(?:a|ic)|genus)\b", re.I)


def check_collisions():
    """Fail the build on a duplicate top-level declaration across the JS modules.

    The modules are concatenated into one script and share one scope, so two
    modules declaring the same name silently keep the last one — `surprise()`
    existed twice, and the dead copy's `q.value=''` reset was quietly lost. The
    smoke suite already regression-guards one instance of this (`setActive`),
    which is the tell that it wants a structural check rather than another test.
    """
    decl = re.compile(r"^(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)", re.M)
    seen = {}
    for m in MODULES:
        for name in decl.findall((SRC / m).read_text(encoding="utf-8")):
            seen.setdefault(name, []).append(m)
    dupes = {n: ms for n, ms in seen.items() if len(ms) > 1}
    if dupes:
        lines = "\n".join(f"  {n}: {', '.join(ms)}" for n, ms in sorted(dupes.items()))
        raise SystemExit(f"duplicate top-level declarations (one scope, last one wins):\n{lines}")


def check_narration():
    """Hold the guided tours to the rule the blurbs already follow.

    Sprint V stripped self-quoted counts from 41 blurbs because the sourced figure
    is printed right beside them. The tour narration does exactly the same thing —
    showTourStep() calls select(), so the panel renders alongside the prose — but
    it lives in 09-story.js, where validate() never looked. It had drifted: the
    orchid step said "Around 28,000 species — the largest family of flowering
    plants" while the panel beside it read 31,892 and "2nd-largest of 479
    families", and the angiosperm step said 340,000 against an aggregate of 350,580.
    """
    src = (SRC / "09-story.js").read_text(encoding="utf-8")
    start = src.index("const TOURS")
    block = src[start:src.index("\n};", start)]
    bad = QUOTED_COUNT.findall(block)
    if bad:
        raise SystemExit(
            "09-story.js tour narration quotes a count, and the panel prints the "
            f"sourced figure beside it: {', '.join(sorted(set(bad)))}")


def agg_species(node):
    """Total species the way the app counts them (01-prep.js `agg`).

    Leaves contribute speciesCount or 1; parents sum their children. Summing
    family speciesCount instead drops every family whose count is still an
    estimate, which is why the footer read ~389,873 while the crawlable index
    said 370,535 — two totals for the same tree on the same page.
    """
    kids = node.get("children") or []
    if not kids:
        # genera are stored compactly (n/s/p) and rehydrated by prep(); "s" is their count
        return node.get("speciesCount") or node.get("s") or 1
    return sum(agg_species(k) for k in kids)


def provenance_split(taxa, genera_by_family):
    """Split the leaf aggregate into sourced and estimated species.

    The app sizes every branch from a leaf aggregate: genus counts where a family
    has them, the family's own count where it doesn't, and the bryophyte classes,
    which are not families at all. Those three kinds of leaf do not carry equal
    authority. The genus counts come from Kew's WCVP; the 27 families WCVP
    circumscribes differently and all thirteen bryophyte classes carry round
    estimates — `Bryopsida: 11,000` is 2.8% of the headline on its own.

    About 6% of the total is therefore guesswork, which is why the page must not
    print it to six significant figures. Returns (sourced, estimated).
    """
    children = {}
    for t in taxa:
        children.setdefault(t["parent"], []).append(t)
    sourced = estimated = 0
    for t in taxa:
        gs = genera_by_family.get(t["name"]) if t.get("rank") == "family" else None
        if gs:                                    # genus tier: WCVP-derived
            sourced += sum(g["speciesCount"] for g in gs)
        elif not children.get(t["id"]):           # a leaf in the app's sense
            n = t.get("speciesCount") or 1
            if (t.get("provenance") or {}).get("speciesCount") == "wcvp":
                sourced += n
            else:
                estimated += n
    return sourced, estimated


def validate(meta, taxa):
    """Lightweight structural validation — no external dependency."""
    ranks = set(meta.get("rankOrder", []))
    ids = {t["id"] for t in taxa}
    errors = []
    seen = set()
    roots = 0
    for i, t in enumerate(taxa):
        where = f"taxa[{i}] {t.get('id', '?')!r}"
        for req in ("id", "parent", "rank", "name"):
            if req not in t:
                errors.append(f"{where}: missing {req!r}")
        if t.get("rank") not in ranks:
            errors.append(f"{where}: rank {t.get('rank')!r} not in rankOrder")
        if t.get("id") in seen:
            errors.append(f"{where}: duplicate id")
        seen.add(t.get("id"))
        if t.get("parent") is None:
            roots += 1
        elif t.get("parent") not in ids:
            errors.append(f"{where}: parent {t.get('parent')!r} does not exist")
        if "speciesCount" in t and not isinstance(t["speciesCount"], (int, float)):
            errors.append(f"{where}: speciesCount must be numeric")
        if "ids" in t and not isinstance(t["ids"], dict):
            errors.append(f"{where}: ids must be an object")
    if roots != 1:
        errors.append(f"expected exactly 1 root (parent=null), found {roots}")
    # the SEO helpers take max()/[0] over the family list; an empty one should fail
    # here, by name, rather than as a traceback 100 lines later
    if not any(t.get("rank") == "family" for t in taxa):
        errors.append("no taxa with rank 'family' — the crawlable index needs them")
    # A blurb must not quote its own species count. The panel and the family page
    # both print the sourced figure immediately beside the blurb, so a number in
    # the prose is redundant at best — and 16 of them were more than 15% adrift
    # (Theaceae read "~200 species" next to a sourced 388).
    #
    # `[\d,]{3,}` means three or more digits, so every two-digit claim walked
    # through it: Sarraceniaceae said "~30+ species" beside a sourced 54, Clethraceae
    # "~75" beside 100. Genus counts were never guarded at all, though the panel
    # prints genCount just as prominently. Any digit, either unit, now.
    for t in taxa:
        if t.get("blurb") and QUOTED_COUNT.search(t["blurb"]):
            errors.append(f"{t['id']!r}: blurb quotes a count — the sourced "
                          f"figure is displayed beside it: {t['blurb']!r}")
    # This file's own docstring has always said taxa.json is validated against
    # data/taxon.schema.json. Nothing read the schema. What actually rots is
    # `additionalProperties: false` — a field added to the data and never written
    # down — so that is the part enforced here, still with no dependency.
    known = set(read_json(SCHEMA).get("properties", {}))
    for i, t in enumerate(taxa):
        undeclared = sorted(set(t) - known)
        if undeclared:
            errors.append(f"taxa[{i}] {t.get('id', '?')!r}: "
                          f"{', '.join(undeclared)} not declared in {SCHEMA.name}")
    return errors


def build_tree(taxa, genera_by_family=None):
    """Reconstruct the nested tree, children in first-seen (file) order.

    When genera_by_family is given, each family gains its accepted genera as a
    third tier of (leaf) children."""
    genera_by_family = genera_by_family or {}
    children = {}
    root = None
    for t in taxa:
        children.setdefault(t["parent"], []).append(t)
        if t["parent"] is None:
            root = t

    def genus_node(g):
        # Compact genus record (E5): the 14k genera dominate the payload, so they use short keys
        # (n=name, s=speciesCount, p=powo) and drop the constant rank="genus". prep() in the
        # template rehydrates them to full node fields. Family/order nodes keep readable keys.
        out = {"n": g["name"], "s": g["speciesCount"]}
        if g.get("powo"):
            out["p"] = g["powo"]
        return out

    def node(rec):
        out = {}
        for f in NODE_FIELDS:
            if f == "ids":
                if rec.get("ids"):  # only emit when non-empty
                    out["ids"] = rec["ids"]
            elif f in rec:
                out[f] = rec[f]
        # Two flags rather than the whole provenance dict — the panel needs to say
        # whether a figure was counted or guessed, and 14k nodes make the full
        # object too expensive to ship. `est` = the count is an estimate, not a
        # WCVP tally; `stem` = the age is a stem age (monotypic lineage), not crown.
        prov = rec.get("provenance") or {}
        if rec.get("speciesCount") is not None and prov.get("speciesCount") != "wcvp":
            out["est"] = 1
        if str(prov.get("ageMy") or "").endswith("stem"):
            out["stem"] = 1
        kids = [node(k) for k in children.get(rec["id"], [])]
        if rec["rank"] == "family":
            kids += [genus_node(g) for g in genera_by_family.get(rec["name"], [])]
        if kids:
            out["children"] = kids
        return out

    return node(root)


def check_readme(nfam, ngenera) -> None:
    """The README's headline must be the build's own arithmetic.

    It read "479 families · 14,135 accepted genera" while the app rendered 14,129 —
    the file's record count rather than the tree's, six of them sitting in families
    WCVP circumscribes differently. Small, and exactly the kind of thing this
    project has spent two sprints removing: a number in prose that nothing checks.
    """
    readme = ROOT / "README.md"
    if not readme.exists():
        return
    m = re.search(r"\*\*([\d,]+) families · ([\d,]+) accepted genera", readme.read_text(encoding="utf-8"))
    if not m:
        raise SystemExit("README.md has no '**N families · M accepted genera' headline to check")
    said_fam, said_gen = (int(x.replace(",", "")) for x in m.groups())
    if (said_fam, said_gen) != (nfam, ngenera):
        raise SystemExit(f"README.md headline says {said_fam:,} families and {said_gen:,} genera; "
                         f"this build renders {nfam:,} and {ngenera:,}")


def require_inputs() -> None:
    """Every input here is committed, so a missing one is a broken checkout rather
    than a valid build. Both data files used to be guarded with `if EXISTS`: remove
    genera.json and the build printed "611 taxa + 0 genera", exited 0, and wrote a
    page with 611 nodes instead of 14,740 — half the payload, no warning, and only
    the smoke suite to catch it."""
    missing = [p for p in (DATA, GENERA, WORLDMAP, SCHEMA) if not p.exists()]
    if missing:
        raise SystemExit("missing committed input(s): "
                         + ", ".join(str(p.relative_to(ROOT)) for p in missing))


def check_stamp(meta, taxa) -> None:
    """Fail the build when the data has moved on from the date it claims.

    `meta.compiled` is what the sitemap hands crawlers as `lastmod` for all 567
    URLs — pages.py chose it over build time deliberately, since these pages are a
    pure function of the data. But it was written once in P1 and never touched
    again through four rewrites of taxa.json, so it said 2026-07-02 while the prose
    it dated had changed on 2026-07-27. pages.py's own comment warns that Google
    discounts a lastmod it catches lying.

    A date nobody is obliged to update is a date that rots, so the stamp now
    carries a fingerprint of the records it describes. Change the data and the
    build stops until the date is restated: `python3 build/build.py --stamp`.
    """
    digest = hashlib.sha256(
        json.dumps(taxa, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        .encode("utf-8")).hexdigest()[:16]
    if meta.get("dataStamp") == digest:
        return
    if "--stamp" in sys.argv:
        raw = DATA.read_text(encoding="utf-8")
        today = datetime.date.today().isoformat()
        for key, value in (("compiled", today), ("dataStamp", digest)):
            old = f'"{key}": {json.dumps(meta.get(key))}'
            raw = (raw.replace(old, f'"{key}": "{value}"', 1) if old in raw
                   else raw.replace('"compiled":', f'"{key}": "{value}",\n  "compiled":', 1))
        DATA.write_text(raw, encoding="utf-8")
        print(f"stamped {DATA.name}: compiled {today}, dataStamp {digest}")
        raise SystemExit(0)
    raise SystemExit(
        f"data/taxa.json has changed since it was stamped {meta.get('compiled', '?')} "
        f"(expected dataStamp {digest}, found {meta.get('dataStamp')!r}).\n"
        "The sitemap dates all 567 URLs from meta.compiled, so changed data needs a "
        "restated date:\n  python3 build/build.py --stamp")


def main() -> None:
    require_inputs()
    doc = read_json(DATA)
    meta, taxa = doc["meta"], doc["taxa"]

    check_stamp(meta, taxa)
    errors = validate(meta, taxa)
    if errors:
        print(f"validation FAILED ({len(errors)} error(s)):", file=sys.stderr)
        for e in errors[:25]:
            print("  -", e, file=sys.stderr)
        raise SystemExit(1)

    genera_by_family = {}
    ngenera = 0
    for g in read_json(GENERA):
        genera_by_family.setdefault(g["family"], []).append(g)
        ngenera += 1

    # warn on genera whose family name matches no family taxon — they are silently dropped
    family_names = {t["name"] for t in taxa if t.get("rank") == "family"}
    orphan_fams = [f for f in genera_by_family if f not in family_names]
    if orphan_fams:
        dropped = sum(len(genera_by_family[f]) for f in orphan_fams)
        print(f"warning: {dropped} genera in {len(orphan_fams)} unmatched famil"
              f"{'y' if len(orphan_fams) == 1 else 'ies'} were dropped "
              f"(e.g. {', '.join(sorted(orphan_fams)[:5])})", file=sys.stderr)
        # …and they must stop being counted, not just warned about. ngenera feeds the
        # JSON-LD description and the crawlable index, while the footer counts the
        # prepped tree — so the same page told Google 14,135 and the reader 14,129.
        # The tree's number is the true one: it is what is actually here.
        ngenera -= dropped

    tree = build_tree(taxa, genera_by_family)
    data = {"tree": tree}
    # the sourced/estimated split travels with the data so the app's copy and the
    # crawlable index quote one derivation rather than each doing their own
    sourced, estimated = provenance_split(taxa, genera_by_family)
    data["totals"] = {"sourced": sourced, "estimated": estimated}
    data["worldmap"] = read_json(WORLDMAP)

    # Assemble the single self-contained page: the HTML shell with the CSS and the
    # concatenated JS modules inlined, then the data injected.
    shell = SHELL.read_text(encoding="utf-8")
    css = "".join(p.read_text(encoding="utf-8") for p in CSS_PARTS)
    js = "".join((SRC / m).read_text(encoding="utf-8") for m in MODULES)
    check_collisions()
    check_narration()
    total_spp = agg_species(tree)
    # the split must account for exactly the aggregate the app sizes branches from,
    # or the page would describe a total it isn't showing
    if sourced + estimated != total_spp:
        raise SystemExit(f"provenance split {sourced:,}+{estimated:,}={sourced + estimated:,} "
                         f"does not reconcile with the leaf aggregate {total_spp:,}")
    check_readme(sum(1 for t in taxa if t.get('rank') == 'family'), ngenera)
    jsonld, crawl = seo_blocks(taxa, meta, ngenera, total_spp, sourced, estimated)
    for ph, where in ((PLACEHOLDER, "shell"), ("/*__CSS__*/", "shell"), ("/*__JS__*/", "shell"),
                      ("<!--__JSONLD__-->", "shell"), ("<!--__CRAWL__-->", "shell"),
                      ("__SPECIES__", "shell"), ("__SITE__", "shell")):
        if ph not in shell:
            raise SystemExit(f"placeholder {ph!r} not found in {where}")
    assert_no_literal_host(shell)
    # Embed as JSON.parse('…') rather than a raw JS object literal: V8 parses a JSON string
    # ~4x faster than the equivalent object literal for a payload this size (E5). Escape the
    # blob into a single-quoted JS string (backslash first, then quote, then </ for tag safety).
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    esc = blob.replace("\\", "\\\\").replace("'", "\\'").replace("</", "<\\/")
    # the copy quotes a round number; derive it so it can never drift from the data
    rounded = f"{round(total_spp / 10000) * 10000:,}"
    out = (shell
           .replace("/*__CSS__*/", css)
           .replace("/*__JS__*/", js)
           .replace("<!--__JSONLD__-->", jsonld)
           .replace("<!--__CRAWL__-->", crawl)
           .replace("__SPECIES__", rounded)
           .replace("__SITE__", SITE)
           .replace(PLACEHOLDER, "JSON.parse('" + esc + "')"))
    OUT.write_text(out, encoding="utf-8")

    fams = sum(1 for t in taxa if t["rank"] == "family")
    withids = sum(1 for t in taxa if t.get("ids", {}).get("gbif"))
    print(f"validated {len(taxa)} taxa ({fams} families) + {ngenera} genera, "
          f"{withids} with GBIF ids")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
