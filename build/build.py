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
import html
import json
import re
import pathlib
import sys

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


def seo_blocks(taxa, meta, ngenera, total_spp):
    """Build two SEO payloads: JSON-LD structured data (head) and a crawlable,
    screen-reader text index of the tree (body). The visualization is drawn in
    JS/SVG, so without these a crawler — and a screen reader — sees almost no
    content. Both are generated from the same rigorous data the app renders."""
    fams = [t for t in taxa if t.get("rank") == "family"]
    nfam = len(fams)
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
        return (f"<li><b>{esc(t['name'])}</b>{com} — "
                f"~{t.get('speciesCount', 0):,} accepted species.</li>")

    rows = "".join(li(t) for t in by_rich)
    records = []
    records.append(f"the largest family is <b>{esc(by_rich[0]['name'])}</b> "
                   f"(~{by_rich[0].get('speciesCount', 0):,} species)")
    if oldest:
        records.append(f"the oldest surviving lineage here is <b>{esc(oldest['name'])}</b> "
                       f"(crown ≈{round(oldest['ageMy'])} million years)")
    records.append(f"the most widely distributed is <b>{esc(widest['name'])}</b>")
    src_list = "".join(f"<li>{esc(n)}</li>" for n in cites)

    crawl = (
        '<section class="visually-hidden" aria-label="The plant kingdom in text">'
        "<h2>Yggdrasil — the plant kingdom in text</h2>"
        f"<p>An accessible, text-only index of the interactive tree above. It covers "
        f"roughly {total_spp:,} accepted species across the {nfam} families of land "
        f"plants (Embryophyta) — from mosses and ferns through gymnosperms to the "
        f"flowering plants — with ~{ngenera:,} genera. Species counts are accepted "
        f"names from Kew's World Checklist of Vascular Plants; the classification "
        f"follows APG IV and PPG I; divergence ages are crown estimates from the "
        f"Jin &amp; Qian (2022) dated megatree.</p>"
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
        kids = [node(k) for k in children.get(rec["id"], [])]
        if rec["rank"] == "family":
            kids += [genus_node(g) for g in genera_by_family.get(rec["name"], [])]
        if kids:
            out["children"] = kids
        return out

    return node(root)


def main() -> None:
    doc = read_json(DATA)
    meta, taxa = doc["meta"], doc["taxa"]

    errors = validate(meta, taxa)
    if errors:
        print(f"validation FAILED ({len(errors)} error(s)):", file=sys.stderr)
        for e in errors[:25]:
            print("  -", e, file=sys.stderr)
        raise SystemExit(1)

    genera_by_family = {}
    ngenera = 0
    if GENERA.exists():
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

    tree = build_tree(taxa, genera_by_family)
    data = {"tree": tree}
    if WORLDMAP.exists():
        data["worldmap"] = read_json(WORLDMAP)

    # Assemble the single self-contained page: the HTML shell with the CSS and the
    # concatenated JS modules inlined, then the data injected.
    shell = SHELL.read_text(encoding="utf-8")
    css = "".join(p.read_text(encoding="utf-8") for p in CSS_PARTS)
    js = "".join((SRC / m).read_text(encoding="utf-8") for m in MODULES)
    check_collisions()
    total_spp = agg_species(tree)
    jsonld, crawl = seo_blocks(taxa, meta, ngenera, total_spp)
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
