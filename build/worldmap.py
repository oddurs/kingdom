#!/usr/bin/env python3
"""Build data/worldmap.json — a compact equirectangular world map whose land is
grouped into the 9 WGSRPD level-1 botanical continents the distribution data uses.

Source: Natural Earth 1:110m admin-0 countries (public domain), read from the
git-ignored data/geo/ne110.geojson. Each country is assigned to a WGSRPD region
via its CONTINENT/SUBREGION (with a few overrides where WGSRPD and the UN scheme
disagree), projected lon/lat → x/y, rounded, and merged into one path per region.

    python3 build/worldmap.py     # writes data/worldmap.json, then run build.py

Only the derived worldmap.json is committed; the raw geojson is not.
Standard library only.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "geo" / "ne110.geojson"
OUT = ROOT / "data" / "worldmap.json"

# WGSRPD level-1: 1 Europe, 2 Africa, 3 Asia-Temperate, 4 Asia-Tropical,
# 5 Australasia, 6 Pacific, 7 Northern America, 8 Southern America, 9 Antarctic.
OVERRIDE = {  # ISO_A3 where UN subregion != WGSRPD region
    "RUS": "3", "MEX": "7", "GRL": "7",           # Russia→temperate Asia, Mexico/Greenland→N.America
    "IRN": "3", "AFG": "3", "PAK": "3",           # SW-Asian, not tropical
}


def region(p):
    iso = p.get("ISO_A3")
    if iso in OVERRIDE:
        return OVERRIDE[iso]
    cont, sub = p.get("CONTINENT"), p.get("SUBREGION")
    if cont == "Antarctica" or sub == "Antarctica":
        return "9"
    if cont == "Africa":
        return "2"
    if cont == "Europe":
        return "1"
    if cont == "South America" or sub in ("Caribbean", "Central America"):
        return "8"
    if sub == "Northern America":
        return "7"
    if sub == "Australia and New Zealand":
        return "5"
    if cont == "Oceania":
        return "6"
    if sub in ("Central Asia", "Eastern Asia", "Western Asia"):
        return "3"
    if sub in ("Southern Asia", "South-Eastern Asia"):
        return "4"
    return None


def ring_path(ring):
    # lon/lat -> equirectangular x/y (x: 0..360, y: 0..180, 90°N at top). Integer
    # precision: the distribution mini-map renders ~330px wide, so 1 map unit ≈ 0.9px —
    # sub-pixel detail is wasted. Drops consecutive duplicate points too (~36% smaller).
    pts = []
    last = None
    for lon, lat in ring:
        p = f"{round(lon + 180)},{round(90 - lat)}"
        if p != last:
            pts.append(p)
            last = p
    if len(pts) < 3:
        return ""
    return "M" + "L".join(pts) + "Z"


def main():
    if not SRC.exists():
        sys.exit(f"missing {SRC} — download Natural Earth 110m countries geojson")

    geo = json.loads(SRC.read_text())
    paths = {str(i): [] for i in range(1, 10)}
    for f in geo["features"]:
        reg = region(f["properties"])
        if not reg:
            continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            for ring in poly:           # first ring = outer, rest = holes (fine to draw)
                paths[reg].append(ring_path(ring))

    regions = {k: "".join(v) for k, v in paths.items() if v}
    doc = {"viewBox": "0 0 360 150", "regions": regions}  # crop Antarctica band (y>150)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size/1024:.0f} KB), "
          f"regions: {sorted(regions)}", file=sys.stderr)


if __name__ == "__main__":
    main()
