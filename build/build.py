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
SCHEMA = ROOT / "data" / "taxon.schema.json"
TEMPLATE = ROOT / "build" / "template.html"
OUT = ROOT / "plant-tree.html"
PLACEHOLDER = "/*__DATA__*/"

# viz-facing node fields, in output order (provenance is intentionally omitted —
# the visualization doesn't render it; it lives in the canonical data).
NODE_FIELDS = ["name", "rank", "common", "speciesCount", "examples", "blurb", "ids", "dist"]


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


def build_tree(taxa):
    """Reconstruct the nested tree, children in first-seen (file) order."""
    children = {}
    root = None
    for t in taxa:
        children.setdefault(t["parent"], []).append(t)
        if t["parent"] is None:
            root = t

    def node(rec):
        out = {}
        for f in NODE_FIELDS:
            if f == "ids":
                if rec.get("ids"):  # only emit when non-empty
                    out["ids"] = rec["ids"]
            elif f in rec:
                out[f] = rec[f]
        kids = children.get(rec["id"], [])
        if kids:
            out["children"] = [node(k) for k in kids]
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

    tree = build_tree(taxa)
    data = {"tree": tree}

    template = TEMPLATE.read_text()
    if PLACEHOLDER not in template:
        raise SystemExit(f"placeholder {PLACEHOLDER!r} not found in template")
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    OUT.write_text(template.replace(PLACEHOLDER, blob))

    fams = sum(1 for t in taxa if t["rank"] == "family")
    withids = sum(1 for t in taxa if t.get("ids", {}).get("gbif"))
    print(f"validated {len(taxa)} taxa ({fams} families), {withids} with GBIF ids")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
