#!/usr/bin/env python3
"""Enrich data/taxa.json with accepted-species counts from Kew's WCVP.

WCVP (World Checklist of Vascular Plants, CC-BY) is the authoritative source for
*accepted* species richness — unlike the GBIF backbone counts, which include
synonyms. This writes two things per family and tags provenance "wcvp":

    speciesCount   accepted species (replaces the placeholder estimate)
    dist           native species richness per WGSRPD level-1 continent,
                   e.g. {"8": 12000, "4": 9000, ...}  (drives the map lens)

    python3 build/wcvp.py            # apply both, then run build.py

The raw WCVP dump is a bulk download, not an API, and is far too large to commit
(~440 MB). Fetch it yourself and unzip into data/wcvp/ (git-ignored):

    https://sftp.kew.org/pub/data-repositories/WCVP/   ->   wcvp.zip
        wcvp_names.csv         (pipe-delimited; the file this reads)

Families WCVP places under a different circumscription than our APG IV / PPG I
tree (e.g. Adoxaceae -> Viburnaceae, several small fern families) won't match by
name; those keep their existing estimate and are reported at the end. Bryophyte
classes are non-vascular, so WCVP does not cover them — expected.

Only the Python standard library is used.
"""
import csv
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "taxa.json"
NAMES = ROOT / "data" / "wcvp" / "wcvp_names.csv"
DIST = ROOT / "data" / "wcvp" / "wcvp_distribution.csv"

# WGSRPD level-1 "botanical continents" — the granularity of the map lens.
CONTINENTS = {"1": "Europe", "2": "Africa", "3": "Asia-Temperate",
              "4": "Asia-Tropical", "5": "Australasia", "6": "Pacific",
              "7": "N. America", "8": "S. America", "9": "Antarctic"}


def scan_names():
    """One pass over names.csv: accepted-species count per family, and a
    plant_name_id -> family map for the accepted species (to join distribution)."""
    counts, pid2fam = {}, {}
    with NAMES.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="|"):
            if row["taxon_rank"] == "Species" and row["taxon_status"] == "Accepted":
                fam = row["family"]
                if fam:
                    counts[fam] = counts.get(fam, 0) + 1
                    pid2fam[row["plant_name_id"]] = fam
    return counts, pid2fam


def distribution_by_family(pid2fam):
    """Native species richness per family per WGSRPD level-1 continent.

    A species spanning several level-3 areas within one continent counts once
    for that continent. Introduced and extinct occurrences are excluded."""
    seen = set()                     # (pid, continent) — dedupe level-3 -> level-1
    dist = {}                        # family -> {continent_code: distinct native species}
    with DIST.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="|"):
            if row["introduced"] != "0" or row["extinct"] != "0":
                continue
            l1 = row["continent_code_l1"]
            fam = pid2fam.get(row["plant_name_id"])
            if not fam or l1 not in CONTINENTS:
                continue
            key = (row["plant_name_id"], l1)
            if key in seen:
                continue
            seen.add(key)
            dist.setdefault(fam, {})[l1] = dist.setdefault(fam, {}).get(l1, 0) + 1
    return dist


def main():
    if not NAMES.exists():
        sys.exit(f"missing {NAMES} — download WCVP (see this file's docstring)")

    print("scanning WCVP names (counts + id→family) …", file=sys.stderr)
    wcvp, pid2fam = scan_names()
    print(f"  {len(wcvp)} families with accepted-species counts", file=sys.stderr)

    dist = {}
    if DIST.exists():
        print("aggregating native distribution per family …", file=sys.stderr)
        dist = distribution_by_family(pid2fam)
        print(f"  {len(dist)} families with distribution", file=sys.stderr)

    doc = json.loads(DATA.read_text())
    matched, unmatched, with_dist = 0, [], 0
    for t in doc["taxa"]:
        if t["rank"] != "family":
            continue
        n = wcvp.get(t["name"])
        if n is None:
            unmatched.append(t["name"])
            continue
        t["speciesCount"] = n
        t.setdefault("provenance", {})["speciesCount"] = "wcvp"
        matched += 1
        d = dist.get(t["name"])
        if d:
            # store descending by richness, ints keyed by continent code
            t["dist"] = {k: d[k] for k in sorted(d, key=lambda k: -d[k])}
            t["provenance"]["dist"] = "wcvp"
            with_dist += 1

    doc["meta"].setdefault("sources", {})["wcvp"] = {
        "name": "World Checklist of Vascular Plants (WCVP), Royal Botanic Gardens, Kew",
        "url": "https://powo.science.kew.org/about-wcvp",
        "license": "CC-BY",
    }

    DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    print(f"done: {matched} families given WCVP accepted counts, "
          f"{with_dist} with distribution; "
          f"{len(unmatched)} unmatched (kept estimate)", file=sys.stderr)
    if unmatched:
        print("  unmatched (WCVP uses a different family name/circumscription):",
              file=sys.stderr)
        for name in sorted(unmatched):
            print(f"    {name}", file=sys.stderr)


if __name__ == "__main__":
    main()
