#!/usr/bin/env python3
"""Build plant-tree.html by injecting the taxonomy data into the template.

The template (build/template.html) holds all markup, CSS and JS with a single
`/*__DATA__*/` placeholder. This script replaces that placeholder with the
compact JSON from data/plant-taxonomy.json, producing the self-contained
plant-tree.html at the repo root.

Usage:  python3 build/build.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "plant-taxonomy.json"
TEMPLATE = ROOT / "build" / "template.html"
OUT = ROOT / "plant-tree.html"
PLACEHOLDER = "/*__DATA__*/"


def main() -> None:
    data = json.loads(DATA.read_text())
    template = TEMPLATE.read_text()
    if PLACEHOLDER not in template:
        raise SystemExit(f"placeholder {PLACEHOLDER!r} not found in template")
    # compact JSON, escaping </ so it can't break the inline <script>
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    OUT.write_text(template.replace(PLACEHOLDER, blob))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
