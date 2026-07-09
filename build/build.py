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
import json
import pathlib
import sys

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

# CSS is concatenated in this order into the single <style>. The design tokens
# (design/tokens.css) are the shared source of truth Storybook also imports;
# they must come first so every rule below can reference the custom properties.
CSS_PARTS = [DESIGN / "tokens.css", SRC / "app.css"]

# The single inline <script> body, concatenated from these modules in this order.
# They share one scope (as the original monolith did); order is load order.
MODULES = [
    "01-prep.js", "02-layout.js", "03-render.js", "04-minimap.js", "05-views.js",
    "06-interaction.js", "07-navigation.js", "08-panels.js", "09-story.js", "10-boot.js",
]

# viz-facing node fields, in output order (provenance is intentionally omitted —
# the visualization doesn't render it; it lives in the canonical data).
NODE_FIELDS = ["name", "rank", "common", "speciesCount", "examples", "blurb", "ids", "dist", "ageMy"]


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
    doc = json.loads(DATA.read_text())
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
        for g in json.loads(GENERA.read_text()):
            genera_by_family.setdefault(g["family"], []).append(g)
            ngenera += 1

    tree = build_tree(taxa, genera_by_family)
    data = {"tree": tree}
    if WORLDMAP.exists():
        data["worldmap"] = json.loads(WORLDMAP.read_text())

    # Assemble the single self-contained page: the HTML shell with the CSS and the
    # concatenated JS modules inlined, then the data injected.
    shell = SHELL.read_text()
    css = "".join(p.read_text() for p in CSS_PARTS)
    js = "".join((SRC / m).read_text() for m in MODULES)
    for ph, where in ((PLACEHOLDER, "shell"), ("/*__CSS__*/", "shell"), ("/*__JS__*/", "shell")):
        if ph not in shell:
            raise SystemExit(f"placeholder {ph!r} not found in {where}")
    # Embed as JSON.parse('…') rather than a raw JS object literal: V8 parses a JSON string
    # ~4x faster than the equivalent object literal for a payload this size (E5). Escape the
    # blob into a single-quoted JS string (backslash first, then quote, then </ for tag safety).
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    esc = blob.replace("\\", "\\\\").replace("'", "\\'").replace("</", "<\\/")
    out = (shell
           .replace("/*__CSS__*/", css)
           .replace("/*__JS__*/", js)
           .replace(PLACEHOLDER, "JSON.parse('" + esc + "')"))
    OUT.write_text(out)

    fams = sum(1 for t in taxa if t["rank"] == "family")
    withids = sum(1 for t in taxa if t.get("ids", {}).get("gbif"))
    print(f"validated {len(taxa)} taxa ({fams} families) + {ngenera} genera, "
          f"{withids} with GBIF ids")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
