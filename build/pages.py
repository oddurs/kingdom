#!/usr/bin/env python3
"""Static taxon pages — one document per family and per order, plus two hubs.

The app is a single URL. 479 families, 86 orders and 14,135 genera are all
addressed by `#`-fragments, which search engines collapse to `/`, so a question
this project answers well — *how many species are in Asteraceae, and how old is
it* — has no document to rank. `build.py` already half-recognises this: the
`.visually-hidden` crawlable index exists precisely because the SVG is invisible
to crawlers. But CSS-clipped text is discounted by design, because it is the
classic spam vector. The fix is not better hidden text. It is real pages.

    /family/asteraceae/     479 families
    /order/asterales/        86 orders
    /families/               hub, by richness
    /orders/                 hub, by richness

Deliberately NOT one page per genus: 14,135 documents each holding a name and a
count is textbook thin content, and at that ratio it risks a site-wide quality
assessment rather than merely failing to rank. Genera earn their keep listed on
their family's page, where they add substance instead of diluting it.

Every number here comes from the same `data/taxa.json` the app reads, and each
page names the source beside the figure rather than asserting it bare.

Usage:  python3 build/pages.py [outdir]     (default: _site/)
"""
import html
import json
import pathlib
import re
import sys

from util import read_json

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "taxa.json"
GENERA = ROOT / "data" / "genera.json"
TOKENS = ROOT / "design" / "tokens.css"
PAGECSS = ROOT / "build" / "src" / "page.css"

# Lineage keys, labels and hues mirror LINEAGES/ANCHORS in build/src/01-prep.js —
# a page must be tinted the same colour as the branch it describes, or the link
# between the document and the tree it opens is broken for the reader.
LINEAGES = {
    "bryo": ("Bryophytes", "#8fce9f"), "fern": ("Ferns & allies", "#46b06a"),
    "gymno": ("Gymnosperms", "#35b8b0"), "basal": ("Magnoliids & basal", "#bf8ad4"),
    "mono": ("Monocots", "#e3b24a"), "rosid": ("Rosids", "#e67e6b"),
    "asterid": ("Asterids", "#8f9be8"), "eudicot": ("Other eudicots", "#ec9a4f"),
    "root": ("Trunk", "#9fb0a4"),
}
ANCHORS = {
    "Bryophytes": "bryo", "Lycopodiopsida": "fern", "Polypodiopsida": "fern",
    "Gymnosperms": "gymno", "Basal angiosperms": "basal", "Magnoliids": "basal",
    "Chloranthales": "basal", "Monocots": "mono", "Ceratophyllales": "eudicot",
    "Eudicots": "eudicot", "Superrosids": "rosid", "Asterids": "asterid",
}
CONTINENTS = {"1": "Europe", "2": "Africa", "3": "Asia-Temperate", "4": "Asia-Tropical",
              "5": "Australasia", "6": "Pacific", "7": "Northern America",
              "8": "Southern America", "9": "Antarctic"}
# name, start Ma, end Ma — as build/src/08-panels.js GEOP
GEOP = [("Silurian", 444, 419), ("Devonian", 419, 359), ("Carboniferous", 359, 299),
        ("Permian", 299, 252), ("Triassic", 252, 201), ("Jurassic", 201, 145),
        ("Cretaceous", 145, 66), ("Paleogene", 66, 23), ("Neogene", 23, 2.6),
        ("Quaternary", 2.6, 0)]

# Only the 61 families with more than this many genera are truncated (median is 3).
# A page that dumps 1,730 genus names reads as a data spill, not a document.
GENUS_CAP = 60

MARK = ('<svg class="mark" viewBox="0 0 40 40" aria-hidden="true">'
        '<g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".42">'
        '<path d="M20 20 20 7"/><path d="M20 20 30.2 11.9"/><path d="M20 20 32.7 22.9"/>'
        '<path d="M20 20 25.6 31.7"/><path d="M20 20 14.4 31.7"/><path d="M20 20 7.3 22.9"/>'
        '<path d="M20 20 9.8 11.9"/></g><g fill="currentColor" opacity=".82">'
        '<circle cx="20" cy="7" r="2.3"/><circle cx="30.2" cy="11.9" r="2.3"/>'
        '<circle cx="32.7" cy="22.9" r="2.3"/><circle cx="25.6" cy="31.7" r="2.3"/>'
        '<circle cx="14.4" cy="31.7" r="2.3"/><circle cx="7.3" cy="22.9" r="2.3"/>'
        '<circle cx="9.8" cy="11.9" r="2.3"/></g>'
        '<circle cx="20" cy="20" r="3.9" fill="currentColor"/></svg>')


FAVICON = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'>"
           "<g fill='none' stroke='#46b06a' stroke-width='2' stroke-linecap='round' opacity='.55'>"
           "<path d='M20 20 20 7'/><path d='M20 20 30.2 11.9'/><path d='M20 20 32.7 22.9'/>"
           "<path d='M20 20 25.6 31.7'/><path d='M20 20 14.4 31.7'/><path d='M20 20 7.3 22.9'/>"
           "<path d='M20 20 9.8 11.9'/></g><g fill='#46b06a'>"
           "<circle cx='20' cy='7' r='3'/><circle cx='30.2' cy='11.9' r='3'/>"
           "<circle cx='32.7' cy='22.9' r='3'/><circle cx='25.6' cy='31.7' r='3'/>"
           "<circle cx='14.4' cy='31.7' r='3'/><circle cx='7.3' cy='22.9' r='3'/>"
           "<circle cx='9.8' cy='11.9' r='3'/></g>"
           "<circle cx='20' cy='20' r='5' fill='#46b06a'/></svg>")


def e(s):
    """Escape for text and double-quoted attributes alike."""
    return html.escape(str(s), quote=True)


def slug(name):
    """Latin taxon names are unique ASCII words, so the slug is the name lowered.

    Asserted rather than assumed: `assert_unique_slugs` fails the build if two
    taxa ever collapse together, which is the only way this could silently
    overwrite a page."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def short_common(common):
    """The headline-sized part of a common name.

    `common` is written for the detail panel and often carries a gloss —
    "Daisies — sunflower, lettuce, dandelion", "Horsetails (Equisetum)". Titles
    take the head only, or they nest parentheses inside parentheses."""
    head = common.split("—")[0].strip()
    return re.sub(r"\s*\([^)]*\)\s*$", "", head).strip() or head


def clip(s, limit):
    """Trim to `limit` at a word boundary. Search snippets get cut off anyway;
    cutting mid-word does it uglier and earlier than the search engine would."""
    s = " ".join(s.split())
    if len(s) <= limit:
        return s
    cut = s[:limit].rsplit(" ", 1)[0].rstrip(" .,;:—-")
    return cut + "…"


def period_of(ma):
    for name, hi, lo in GEOP:
        if ma <= hi and ma > lo:
            return name
    return GEOP[0][0] if ma > GEOP[0][1] else GEOP[-1][0]


class Tree:
    """The taxonomy, indexed the handful of ways the pages need to walk it."""

    def __init__(self, taxa, genera):
        self.by_id = {t["id"]: t for t in taxa}
        self.children = {}
        self.root = None
        for t in taxa:
            self.children.setdefault(t["parent"], []).append(t)
            if t["parent"] is None:
                self.root = t
        self.genera = {}
        for g in genera:
            self.genera.setdefault(g["family"], []).append(g)
        for gs in self.genera.values():
            gs.sort(key=lambda g: (-g.get("speciesCount", 0), g["name"]))
        self.lineage = {}
        self._assign_lineage(self.root, "root")
        self.families = [t for t in taxa if t["rank"] == "family"]
        self.orders = [t for t in taxa if t["rank"] == "order"]

    def _assign_lineage(self, node, inherited):
        lin = ANCHORS.get(node["name"], inherited)
        self.lineage[node["id"]] = lin
        for k in self.children.get(node["id"], []):
            self._assign_lineage(k, lin)

    def ancestors(self, t):
        """Root-first chain above `t`, excluding `t` itself."""
        chain = []
        p = self.by_id.get(t["parent"])
        while p is not None:
            chain.append(p)
            p = self.by_id.get(p["parent"])
        return list(reversed(chain))

    def families_under(self, t):
        if t["rank"] == "family":
            return [t]
        out = []
        for k in self.children.get(t["id"], []):
            out += self.families_under(k)
        return out

    def hue(self, t):
        return LINEAGES[self.lineage[t["id"]]][1]

    def lineage_label(self, t):
        return LINEAGES[self.lineage[t["id"]]][0]


# ---------- fragments ----------

def stat(label, value, source=None):
    src = f'<span class="src">{source}</span>' if source else ""
    return f'<div class="stat"><dt>{e(label)}</dt><dd>{value}{src}</dd></div>'


def species_stat(t):
    """The count, with the provenance of *this* record — an unsourced estimate is
    marked as one rather than borrowing WCVP's authority."""
    n = t.get("speciesCount")
    if not n:
        return ""
    prov = (t.get("provenance") or {}).get("speciesCount")
    if prov == "wcvp":
        src = "accepted names · Kew WCVP"
        val = f"{n:,}"
    else:
        src = "approximate — no sourced value yet"
        val = f'<span class="approx">≈{n:,}</span>'
    return stat("Accepted species", val, src)


def age_stat(t):
    """Crown age. Bryophytes are non-vascular and absent from the megatree, so
    they read as undated rather than blank — the absence has a reason."""
    ma = t.get("ageMy")
    if ma is None:
        return stat("Origin", '<span class="approx">not dated</span>',
                    "absent from the dated megatree")
    prov = (t.get("provenance") or {}).get("ageMy") or "megatree"
    kind = "stem age" if prov.endswith("stem") else "crown age"
    return stat("Origin", f"≈{round(ma)} Ma",
                f"{period_of(ma)} · {kind}, Jin &amp; Qian 2022 megatree")


def dist_block(t, hue):
    d = t.get("dist") or {}
    if not d:
        return ""
    rows = sorted(d.items(), key=lambda kv: -kv[1])
    top = rows[0][1]
    items = "".join(
        f'<li><span>{e(CONTINENTS.get(c, c))}</span>'
        f'<span class="bar"><i style="width:{max(2, round(v / top * 100))}%"></i></span>'
        f'<span class="v">{v:,}</span></li>'
        for c, v in rows)
    return ('<section><h2>Where it grows</h2>'
            f'<ul class="dist">{items}</ul>'
            '<p class="note">Native species richness by botanical continent '
            '(WGSRPD level 1), from Kew WCVP.</p></section>')


def taxa_list(rows, split=False):
    cls = "taxa split" if split else "taxa"
    return f'<ul class="{cls}">' + "".join(rows) + "</ul>"


def taxon_row(name, href, common=None, value=None):
    c = f'<span class="c">{e(common)}</span>' if common else '<span class="c"></span>'
    v = f'<span class="v">{value}</span>' if value else ""
    inner = f'<span class="n">{e(name)}</span>{c}{v}'
    return f'<li><a href="{href}">{inner}</a></li>' if href else f'<li><div class="row">{inner}</div></li>'


def breadcrumb(tree, t):
    """The taxonomic lineage, linked wherever a page exists for it.

    Ranks without pages (kingdom, clades, classes) stay as plain text — linking
    them to somewhere they don't exist would be the same class of error this
    sprint opened with."""
    parts = [f'<a href="/">Yggdrasil</a>']
    for a in tree.ancestors(t):
        if a["rank"] == "order":
            parts.append(f'<a href="/order/{slug(a["name"])}/">{e(a["name"])}</a>')
        else:
            parts.append(f'<span>{e(a["name"])}</span>')
    parts.append(f'<span class="here">{e(t["name"])}</span>')
    return crumb_nav(parts)


# The spaces around the separator are load-bearing: joined tight, an eleven-level
# lineage is one unbreakable run, and on a phone it forces the whole document
# wider than the viewport rather than wrapping.
CRUMB_SEP = ' <span class="sep">/</span> '


def crumb_nav(parts):
    return '<nav class="crumb" aria-label="Lineage">' + CRUMB_SEP.join(parts) + "</nav>"


def cta(name, lead):
    return (f'<a class="cta" href="/#sel={e(name)}">'
            f'<span class="lbl"><b>Open {e(name)} in the tree</b>'
            f'<span>{lead}</span></span><span class="arw" aria-hidden="true">&rsaquo;</span></a>')


def sources_footer(meta, extra=()):
    src = meta.get("sources", {})
    keys = ["apgIV", "ppgI", "christenhusz2011", "wcvp", "megatree", "gbif"]
    items = []
    for k in keys:
        s = src.get(k)
        if not s:
            continue
        label = s.get("name") or s.get("title") or k
        items.append(f'<li><a href="{e(s["url"])}">{e(label)}</a></li>' if s.get("url")
                     else f"<li>{e(label)}</li>")
    return ("<footer><h2>Sources</h2><ul>" + "".join(items) + "</ul>"
            "<p>Part of <a href=\"/\">Yggdrasil</a>, an interactive tree of the plant "
            "kingdom. Data CC-BY; see each source for its own terms.</p>"
            + "".join(extra) + "</footer>")


def document(*, site, path, title, description, hue, body, jsonld, noindex=False):
    """One page. Deliberately plain: a stylesheet link, no script, no webfont."""
    url = site.rstrip("/") + path
    # Pages serves 404.html with a 404 status for unmatched paths, but fetching
    # the file directly returns 200 — so it says so itself rather than relying on
    # the status code it happens to be served with.
    robots = '\n<meta name="robots" content="noindex, follow">' if noindex else ""
    return f"""<!doctype html>
<html lang="en" style="--lc:{hue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">{robots}
<link rel="canonical" href="{e(url)}">
<link rel="stylesheet" href="/p.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{e(url)}">
<meta property="og:site_name" content="Yggdrasil">
<meta property="og:image" content="{e(site.rstrip('/') + '/og.jpg')}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{jsonld}</script>
</head>
<body>
<div class="wrap">
<div class="top"><a class="home" href="/">{MARK}<span class="name">Yggdrasil</span></a><span class="sp"></span></div>
{body}
</div>
</body>
</html>
"""


def ld(objs):
    return json.dumps(objs, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def breadcrumb_ld(site, tree, t):
    items, pos = [], 1
    items.append({"@type": "ListItem", "position": pos, "name": "Yggdrasil",
                  "item": site.rstrip("/") + "/"})
    for a in tree.ancestors(t):
        pos += 1
        entry = {"@type": "ListItem", "position": pos, "name": a["name"]}
        if a["rank"] == "order":
            entry["item"] = f'{site.rstrip("/")}/order/{slug(a["name"])}/'
        items.append(entry)
    items.append({"@type": "ListItem", "position": pos + 1, "name": t["name"]})
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}


def term_ld(site, t, path, description):
    """schema.org has no Taxon type; DefinedTerm within the site's DefinedTermSet
    is the honest fit and is what Google actually parses."""
    return {"@context": "https://schema.org", "@type": "DefinedTerm",
            "name": t["name"], "description": description,
            "url": site.rstrip("/") + path,
            "termCode": str((t.get("ids") or {}).get("gbif") or t["name"]),
            "inDefinedTermSet": {"@type": "DefinedTermSet",
                                 "name": "Yggdrasil — the plant tree of life",
                                 "url": site.rstrip("/") + "/"}}


# ---------- the pages ----------

def family_page(site, tree, meta, t):
    name = t["name"]
    path = f"/family/{slug(name)}/"
    hue = tree.hue(t)
    genera = tree.genera.get(name, [])
    n = t.get("speciesCount") or 0
    common = t.get("common")

    title = f"{name} — {n:,} species" if n else name
    if common:
        title = f"{name} ({short_common(common)}) — {n:,} accepted species"
    title = clip(title, 60)

    # lead with the facts a searcher asked for, then the blurb — the snippet is
    # cut from the front, so the count must come before the prose
    ngen = len(genera)
    desc = (f"{name}"
            + (f" ({short_common(common)}). " if common else ". ")
            + (f"About {n:,} accepted species" if n else "A family of land plants")
            + (f" in {ngen:,} {'genus' if ngen == 1 else 'genera'}" if ngen else "")
            + f". {t.get('blurb', '')}")
    desc = clip(desc, 155)

    stats = [species_stat(t)]
    if genera:
        stats.append(stat("Genus" if len(genera) == 1 else "Genera", f"{len(genera):,}",
                          f"accepted {'genus' if len(genera) == 1 else 'genera'} · Kew WCVP"))
    stats.append(age_stat(t))
    if t.get("dist"):
        top = max(t["dist"].items(), key=lambda kv: kv[1])[0]
        stats.append(stat("Centre of diversity", e(CONTINENTS.get(top, top)),
                          "most native species · WGSRPD"))

    body = [breadcrumb(tree, t)]
    body.append(f'<span class="rank">Family · {e(tree.lineage_label(t))}</span>')
    body.append(f"<h1>{e(name)}</h1>")
    if common:
        body.append(f'<p class="common">{e(common)}</p>')
    if t.get("blurb"):
        body.append(f'<p class="lead">{e(t["blurb"])}</p>')
    body.append('<dl class="stats">' + "".join(s for s in stats if s) + "</dl>")
    body.append(cta(name, "Pan, zoom and dig into its genera in the interactive view."))

    if t.get("examples"):
        chips = "".join(f"<li>{e(x)}</li>" for x in t["examples"])
        body.append(f'<section><h2>Plants you might know</h2><ul class="chips">{chips}</ul></section>')

    if genera:
        shown = genera[:GENUS_CAP]
        rows = [taxon_row(g["name"], None, value=f'{g.get("speciesCount", 0):,} spp.')
                for g in shown]
        more = ""
        if len(genera) > GENUS_CAP:
            more = (f'<p class="note">The {len(genera) - GENUS_CAP:,} smaller genera are in '
                    f'<a href="/#sel={e(name)}">the interactive tree</a>.</p>')
        heading = ("Its genus" if len(genera) == 1 else
                   "Genera" if len(genera) <= GENUS_CAP else "Largest genera")
        body.append(f'<section><h2>{heading}</h2>{taxa_list(rows, split=len(rows) > 6)}{more}</section>')

    body.append(dist_block(t, hue))

    parent = tree.by_id.get(t["parent"])
    if parent is not None:
        sibs = [s for s in tree.children.get(parent["id"], []) if s["id"] != t["id"]
                and s["rank"] == "family"]
        sibs.sort(key=lambda s: -(s.get("speciesCount") or 0))
        rel = ""
        if parent["rank"] == "order":
            rel += (f'<p>{e(name)} sits in the order <a href="/order/{slug(parent["name"])}/">'
                    f'{e(parent["name"])}</a>.</p>')
        if sibs:
            rows = [taxon_row(s["name"], f'/family/{slug(s["name"])}/', s.get("common"),
                              f'{s.get("speciesCount", 0):,}') for s in sibs[:24]]
            rel += taxa_list(rows)
        if rel:
            body.append(f"<section><h2>Related families</h2>{rel}</section>")

    body.append(sources_footer(meta, [
        f'<p><a href="/families/">All 479 plant families</a> &middot; '
        f'<a href="/orders/">all 86 orders</a></p>']))

    return path, document(site=site, path=path, title=title, description=desc, hue=hue,
                          body="\n".join(body),
                          jsonld=ld([breadcrumb_ld(site, tree, t),
                                     term_ld(site, t, path, desc)]))


def order_page(site, tree, meta, t):
    name = t["name"]
    path = f"/order/{slug(name)}/"
    hue = tree.hue(t)
    fams = sorted(tree.families_under(t), key=lambda f: -(f.get("speciesCount") or 0))
    total = sum(f.get("speciesCount") or 0 for f in fams)
    ngen = sum(len(tree.genera.get(f["name"], [])) for f in fams)

    title = clip(f"{name} — {len(fams)} families, {total:,} species", 60)
    flowering = tree.lineage[t["id"]] in ("mono", "rosid", "asterid", "eudicot", "basal")
    desc = clip(f"{name} is an order of {'flowering plants' if flowering else 'plants'} "
                f"containing {len(fams)} famil{'y' if len(fams) == 1 else 'ies'} and about "
                f"{total:,} accepted species. {t.get('blurb', '')}", 155)

    stats = [stat("Families", str(len(fams))),
             stat("Accepted species", f"{total:,}", "sum of its families · Kew WCVP")]
    if ngen:
        stats.append(stat("Genera", f"{ngen:,}", "accepted genera · Kew WCVP"))
    stats.append(age_stat(t))

    body = [breadcrumb(tree, t)]
    body.append(f'<span class="rank">Order · {e(tree.lineage_label(t))}</span>')
    body.append(f"<h1>{e(name)}</h1>")
    if t.get("common"):
        body.append(f'<p class="common">{e(t["common"])}</p>')
    if t.get("blurb"):
        body.append(f'<p class="lead">{e(t["blurb"])}</p>')
    body.append('<dl class="stats">' + "".join(s for s in stats if s) + "</dl>")
    body.append(cta(name, "See where the order sits among the other land plants."))

    rows = [taxon_row(f["name"], f'/family/{slug(f["name"])}/', f.get("common"),
                      f'{f.get("speciesCount", 0):,}') for f in fams]
    body.append(f'<section><h2>Families in {e(name)}</h2>{taxa_list(rows)}</section>')

    body.append(sources_footer(meta, [
        '<p><a href="/orders/">All 86 orders</a> &middot; '
        '<a href="/families/">all 479 families</a></p>']))

    return path, document(site=site, path=path, title=title, description=desc, hue=hue,
                          body="\n".join(body),
                          jsonld=ld([breadcrumb_ld(site, tree, t),
                                     term_ld(site, t, path, desc)]))


def hub_page(site, tree, meta, *, kind):
    """The index a crawler (and a person) walks to reach every taxon page.

    No grand total is quoted here. The app's footer counts by aggregating leaves
    (389,873); these pages state each family's own sourced WCVP count, and those
    sum to 370,535. Both are defensible and they are not the same measurement, so
    the hub lists the parts and declines to invent a fourth headline number."""
    if kind == "family":
        rows_src = sorted(tree.families, key=lambda t: -(t.get("speciesCount") or 0))
        title = "All 479 plant families, by species richness"
        h1 = "Every plant family"
        lead = ("The 479 families of land plants — mosses, ferns, conifers and flowering "
                "plants — ordered by accepted-species richness. Each has its own page.")
        desc = ("A complete index of the 479 land-plant families, ordered by accepted "
                "species richness, with common names and species counts from Kew's WCVP.")
        href = lambda t: f'/family/{slug(t["name"])}/'
        other = '<p><a href="/orders/">All 86 orders &rsaquo;</a></p>'
    else:
        rows_src = sorted(tree.orders,
                          key=lambda t: -sum(f.get("speciesCount") or 0
                                             for f in tree.families_under(t)))
        title = "All 86 plant orders, by species richness"
        h1 = "Every plant order"
        lead = ("The 86 orders of land plants, ordered by the accepted-species richness "
                "of the families they contain.")
        desc = ("A complete index of the 86 land-plant orders, ordered by species "
                "richness, following APG IV and PPG I.")
        href = lambda t: f'/order/{slug(t["name"])}/'
        other = '<p><a href="/families/">All 479 families &rsaquo;</a></p>'

    path = "/families/" if kind == "family" else "/orders/"
    rows = []
    for t in rows_src:
        n = (t.get("speciesCount") or 0) if kind == "family" else \
            sum(f.get("speciesCount") or 0 for f in tree.families_under(t))
        rows.append(taxon_row(t["name"], href(t), t.get("common"), f"{n:,}"))

    body = [crumb_nav(['<a href="/">Yggdrasil</a>', f'<span class="here">{e(h1)}</span>']),
            f'<span class="rank">Index</span>',
            f"<h1>{e(h1)}</h1>",
            f'<p class="lead">{e(lead)}</p>',
            taxa_list(rows),
            other,
            sources_footer(meta)]

    return path, document(site=site, path=path, title=title, description=desc,
                          hue=LINEAGES["root"][1], body="\n".join(body),
                          jsonld=ld([{"@context": "https://schema.org",
                                      "@type": "CollectionPage", "name": title,
                                      "url": site.rstrip("/") + path,
                                      "description": desc,
                                      "isPartOf": {"@type": "WebSite", "name": "Yggdrasil",
                                                   "url": site.rstrip("/") + "/"}}]))


def sitemap(site, paths, lastmod):
    """Every URL we want crawled, with the date the underlying data was compiled.

    The hand-written predecessor listed one URL and no lastmod; it would have been
    wrong the moment 567 pages existed. `lastmod` is `meta.compiled` rather than
    build time — these pages are a pure function of the data, so a rebuild that
    changes nothing shouldn't claim the content is new. Google discounts a
    lastmod it catches lying."""
    base = site.rstrip("/")
    urls = ["/"] + sorted(paths)
    body = "".join(
        f"<url><loc>{base}{p}</loc><lastmod>{lastmod}</lastmod>"
        # the app is the thing being ranked for the general query; the taxon pages
        # are the long tail. Hubs sit between.
        f"<priority>{'1.0' if p == '/' else '0.8' if p in ('/families/', '/orders/') else '0.6'}</priority>"
        "</url>"
        for p in urls)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + body + "\n</urlset>\n")


def robots(site):
    return (f"# Yggdrasil — a living tree of the plant kingdom\n"
            f"User-agent: *\n"
            f"Allow: /\n\n"
            f"# the design-system workshop is dev-only tooling, not site content\n"
            f"Disallow: /storybook/\n\n"
            f"Sitemap: {site.rstrip('/')}/sitemap.xml\n")


def not_found(site):
    """GitHub Pages serves /404.html for any unmatched path. Without one it shows
    GitHub's generic page, which offers a visitor nothing and tells a crawler
    less."""
    body = (crumb_nav(['<a href="/">Yggdrasil</a>', '<span class="here">Not found</span>'])
            + '<span class="rank">404</span>'
            + "<h1>This branch isn&rsquo;t here</h1>"
            + '<p class="lead">The page you asked for doesn&rsquo;t exist — but the tree does. '
              "Every family and order has its own page, and the interactive view holds "
              "all 14,135 genera.</p>"
            + '<ul class="taxa">'
            + taxon_row("Every plant family", "/families/", "479 families, by richness")
            + taxon_row("Every plant order", "/orders/", "86 orders, by richness")
            + taxon_row("The interactive tree", "/", "search, four views, guided tours")
            + "</ul>")
    return document(site=site, path="/404.html", title="Not found — Yggdrasil",
                    description="That page doesn't exist. Browse every plant family and "
                                "order, or open the interactive tree of the plant kingdom.",
                    hue=LINEAGES["root"][1], body=body, noindex=True,
                    jsonld=ld([{"@context": "https://schema.org", "@type": "WebPage",
                                "name": "Not found"}]))


def assert_unique_slugs(tree):
    """Two taxa collapsing to one slug would silently overwrite a page."""
    seen = {}
    for t in tree.families + tree.orders:
        key = (t["rank"], slug(t["name"]))
        if key in seen:
            raise SystemExit(f"slug collision: {t['name']!r} and {seen[key]!r} both "
                             f"map to /{t['rank']}/{key[1]}/")
        seen[key] = t["name"]


def build(site, outdir):
    """Write every page under `outdir`. Returns the list of URL paths written."""
    doc = read_json(DATA)
    meta, taxa = doc["meta"], doc["taxa"]
    genera = read_json(GENERA) if GENERA.exists() else []
    tree = Tree(taxa, genera)
    assert_unique_slugs(tree)

    outdir = pathlib.Path(outdir)
    written = []

    def emit(path, text):
        target = outdir / path.strip("/") / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        written.append(path)

    for t in tree.families:
        emit(*family_page(site, tree, meta, t))
    for t in tree.orders:
        emit(*order_page(site, tree, meta, t))
    for kind in ("family", "order"):
        emit(*hub_page(site, tree, meta, kind=kind))

    css = TOKENS.read_text(encoding="utf-8") + PAGECSS.read_text(encoding="utf-8")
    (outdir / "p.css").write_text(css, encoding="utf-8")
    # the app carries its icon as a data: URI (it must stay self-contained); these
    # pages link a real file, so it is cached once instead of repeated 567 times
    (outdir / "favicon.svg").write_text(FAVICON, encoding="utf-8")

    # crawler plumbing, generated from the same page list rather than hand-kept
    (outdir / "sitemap.xml").write_text(
        sitemap(site, written, meta.get("compiled", "")), encoding="utf-8")
    (outdir / "robots.txt").write_text(robots(site), encoding="utf-8")
    (outdir / "404.html").write_text(not_found(site), encoding="utf-8")

    return written


def main():
    sys.path.insert(0, str(ROOT / "build"))
    from build import SITE
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_site"
    written = build(SITE, out)
    total = sum((out / p.strip("/") / "index.html").stat().st_size for p in written)
    print(f"wrote {len(written)} pages to {out.name}/ "
          f"({total / 1024:.0f} KB, {total / len(written) / 1024:.1f} KB average)")


if __name__ == "__main__":
    main()
