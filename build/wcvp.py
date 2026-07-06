#!/usr/bin/env python3
"""Enrich data/taxa.json with accepted-species counts from Kew's WCVP.

WCVP (World Checklist of Vascular Plants, CC-BY) is the authoritative source for
*accepted* species richness — unlike the GBIF backbone counts, which include
synonyms. This replaces the placeholder `speciesCount` estimates on every family
WCVP recognises, and tags provenance as "wcvp".

    python3 build/wcvp.py            # apply counts, then run build.py

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


def accepted_species_by_family():
    """Count rank=Species, status=Accepted rows grouped by family."""
    counts = {}
    with NAMES.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="|"):
            if row["taxon_rank"] == "Species" and row["taxon_status"] == "Accepted":
                fam = row["family"]
                if fam:
                    counts[fam] = counts.get(fam, 0) + 1
    return counts


def main():
    if not NAMES.exists():
        sys.exit(f"missing {NAMES} — download WCVP (see this file's docstring)")

    print("counting accepted species per family in WCVP …", file=sys.stderr)
    wcvp = accepted_species_by_family()
    print(f"  {len(wcvp)} families with accepted-species counts", file=sys.stderr)

    doc = json.loads(DATA.read_text())
    matched, unmatched = 0, []
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

    doc["meta"].setdefault("sources", {})["wcvp"] = {
        "name": "World Checklist of Vascular Plants (WCVP), Royal Botanic Gardens, Kew",
        "url": "https://powo.science.kew.org/about-wcvp",
        "license": "CC-BY",
    }

    DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    print(f"done: {matched} families given WCVP accepted counts; "
          f"{len(unmatched)} unmatched (kept estimate)", file=sys.stderr)
    if unmatched:
        print("  unmatched (WCVP uses a different family name/circumscription):",
              file=sys.stderr)
        for name in sorted(unmatched):
            print(f"    {name}", file=sys.stderr)


if __name__ == "__main__":
    main()
