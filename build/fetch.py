#!/usr/bin/env python3
"""Enrich data/taxa.json with authoritative identifiers and metrics from GBIF.

Run this with an internet connection to populate every taxon that isn't already
resolved. It is idempotent (skips taxa already carrying both an id and a count) and polite
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

from util import read_json, write_json

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "taxa.json"
API = "https://api.gbif.org/v1"
UA = {"User-Agent": "biomi/kingdom (github.com/oddurs/kingdom)"}

# GBIF rank vocabulary for the ranks we use.
GBIF_RANK = {"family": "FAMILY", "order": "ORDER", "class": "CLASS",
             "subclass": "SUBCLASS", "phylum": "PHYLUM", "genus": "GENUS",
             "subfamily": "SUBFAMILY"}


def get(url, tries=3):
    """GET with backoff. GBIF rate-limits and occasionally 503s under load."""
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                return json.loads(r.read().decode())
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(2 ** attempt)


def match(name, rank):
    q = {"name": name, "kingdom": "Plantae", "strict": "true"}
    if rank in GBIF_RANK:
        q["rank"] = GBIF_RANK[rank]
    d = get(f"{API}/species/match?{urllib.parse.urlencode(q)}")
    if d.get("matchType") in ("EXACT", "FUZZY") and d.get("usageKey"):
        return d["usageKey"], d.get("matchType")
    return None, d.get("matchType", "NONE")


def metrics(key):
    """Species count for a GBIF key, or None when GBIF genuinely reports none.

    Raises on transport failure. Returning None for both cases is what froze 28
    taxa with an id and no count: the caller records the id either way, and the
    `todo` filter then skips anything that has one, so a single 429 was final.
    """
    return get(f"{API}/species/{key}/metrics").get("numSpecies")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--sleep", type=float, default=0.2)
    args = ap.parse_args()

    doc = read_json(DATA)
    taxa = doc["taxa"]
    # a taxon is done when it has BOTH an id and a count — an id alone means a
    # previous run lost the metric to a transient error and must be revisited
    todo = [t for t in taxa if t["rank"] != "kingdom"
            and (args.force
                 or not t.get("ids", {}).get("gbif")
                 or t.get("gbifSpeciesCount") is None)]
    if args.limit:
        todo = todo[:args.limit]
    print(f"enriching {len(todo)} taxa via GBIF …", file=sys.stderr)

    ok = miss = nometric = 0
    for i, t in enumerate(todo, 1):
        try:
            key, mt = match(t["name"], t["rank"])
        except Exception as e:
            print(f"  ! {t['name']}: {e}", file=sys.stderr)
            continue
        if key:
            t.setdefault("ids", {})["gbif"] = key
            t.setdefault("provenance", {})["ids"] = "gbif"
            try:
                ns = metrics(key)
            except Exception as e:      # leave the gap visible so a re-run retries it
                print(f"  ! {t['name']}: metrics failed: {e}", file=sys.stderr)
                nometric += 1
            else:
                if ns is not None:
                    t["gbifSpeciesCount"] = ns
                    t["provenance"]["gbifSpeciesCount"] = "gbif"
            ok += 1
        else:
            miss += 1
            print(f"  ? no match: {t['name']} ({mt})", file=sys.stderr)
        if i % 25 == 0:
            print(f"  … {i}/{len(todo)}", file=sys.stderr)
            write_json(DATA, doc, indent=1)      # checkpoint — atomic, so Ctrl-C here is safe
        time.sleep(args.sleep)

    write_json(DATA, doc, indent=1)
    print(f"done: {ok} matched, {miss} unmatched, {nometric} matched but metric-less "
          f"(re-run to retry those)", file=sys.stderr)


if __name__ == "__main__":
    main()
