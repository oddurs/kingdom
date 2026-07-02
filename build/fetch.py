#!/usr/bin/env python3
"""Enrich data/taxa.json with authoritative identifiers and metrics from GBIF.

Run this with an internet connection to populate every taxon that isn't already
resolved. It is idempotent (skips taxa that already carry a GBIF id) and polite
(throttled), so it can be re-run to fill gaps.

    python3 build/fetch.py            # fill all missing
    python3 build/fetch.py --limit 50 # first 50 only (testing)
    python3 build/fetch.py --force     # re-fetch everything

What it writes per taxon:
    ids.gbif           GBIF backbone usageKey (stable identifier + deep links)
    gbifSpeciesCount   GBIF backbone species count  ── NOTE: includes synonyms and
                       unplaced names, so it is stored as documentation, NOT as the
                       display `speciesCount`.

Accepted-species counts (the honest display number) come from Kew's WCVP, which is
a bulk download rather than a per-taxon API:
    https://powo.science.kew.org/about-wcvp   (or the `rWCVP` / `expowo` R packages)
Populate speciesCount from a WCVP snapshot and set provenance.speciesCount = "wcvp".

Only the Python standard library is used — no dependencies.
"""
import argparse
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "taxa.json"
API = "https://api.gbif.org/v1"
UA = {"User-Agent": "biomi/kingdom (github.com/oddurs/kingdom)"}

# GBIF rank vocabulary for the ranks we use.
GBIF_RANK = {"family": "FAMILY", "order": "ORDER", "class": "CLASS",
             "subclass": "SUBCLASS", "phylum": "PHYLUM", "genus": "GENUS",
             "subfamily": "SUBFAMILY"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
        return json.loads(r.read().decode())


def match(name, rank):
    q = {"name": name, "kingdom": "Plantae", "strict": "true"}
    if rank in GBIF_RANK:
        q["rank"] = GBIF_RANK[rank]
    d = get(f"{API}/species/match?{urllib.parse.urlencode(q)}")
    if d.get("matchType") in ("EXACT", "FUZZY") and d.get("usageKey"):
        return d["usageKey"], d.get("matchType")
    return None, d.get("matchType", "NONE")


def metrics(key):
    try:
        return get(f"{API}/species/{key}/metrics").get("numSpecies")
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--sleep", type=float, default=0.2)
    args = ap.parse_args()

    doc = json.loads(DATA.read_text())
    taxa = doc["taxa"]
    todo = [t for t in taxa if t["rank"] != "kingdom"
            and (args.force or not t.get("ids", {}).get("gbif"))]
    if args.limit:
        todo = todo[:args.limit]
    print(f"enriching {len(todo)} taxa via GBIF …", file=sys.stderr)

    ok = miss = 0
    for i, t in enumerate(todo, 1):
        try:
            key, mt = match(t["name"], t["rank"])
        except Exception as e:
            print(f"  ! {t['name']}: {e}", file=sys.stderr)
            continue
        if key:
            t.setdefault("ids", {})["gbif"] = key
            t.setdefault("provenance", {})["ids"] = "gbif"
            ns = metrics(key)
            if ns is not None:
                t["gbifSpeciesCount"] = ns
                t["provenance"]["gbifSpeciesCount"] = "gbif"
            ok += 1
        else:
            miss += 1
            print(f"  ? no match: {t['name']} ({mt})", file=sys.stderr)
        if i % 25 == 0:
            print(f"  … {i}/{len(todo)}", file=sys.stderr)
            DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=1))  # checkpoint
        time.sleep(args.sleep)

    DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    print(f"done: {ok} matched, {miss} unmatched", file=sys.stderr)


if __name__ == "__main__":
    main()
