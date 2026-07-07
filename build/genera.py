#!/usr/bin/env python3
"""Extract the accepted genera from WCVP into data/genera.json.

This is the genus tier — one record per accepted genus (14k of them), kept in a
separate bulk file so the curated family-level taxa.json stays clean. build.py
nests these under their families when it derives the tree.

    python3 build/genera.py       # writes data/genera.json, then run build.py

Minimal per-genus payload (keeps the inlined size small):
    name           genus name
    family         parent family (WCVP circumscription)
    speciesCount   accepted species in the genus (WCVP)
    powo           POWO/IPNI id — a free verified deep link, straight from WCVP

Reads the git-ignored WCVP dump (see build/wcvp.py). Standard library only.
"""
import csv
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAMES = ROOT / "data" / "wcvp" / "wcvp_names.csv"
OUT = ROOT / "data" / "genera.json"


def main():
    if not NAMES.exists():
        sys.exit(f"missing {NAMES} — download WCVP (see build/wcvp.py)")

    genera = {}          # (family, genus) -> record
    counts = {}          # (family, genus) -> accepted species
    with NAMES.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="|"):
            fam, gen = row["family"], row["genus"]
            if not fam or not gen:
                continue
            if row["taxon_rank"] == "Genus" and row["taxon_status"] == "Accepted":
                genera[(fam, gen)] = {
                    "name": gen, "family": fam,
                    "powo": row.get("powo_id") or None,
                }
            elif row["taxon_rank"] == "Species" and row["taxon_status"] == "Accepted":
                counts[(fam, gen)] = counts.get((fam, gen), 0) + 1

    out = []
    for key, rec in genera.items():
        n = counts.get(key, 0)
        if n == 0:
            continue  # skip genera with no accepted species (e.g. nothogenera) —
                      # they carry no size and would inflate family/kingdom totals
        rec["speciesCount"] = n
        out.append(rec)
    out.sort(key=lambda r: (r["family"], -r["speciesCount"], r["name"]))

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    fams = {r["family"] for r in out}
    print(f"wrote {len(out)} genera across {len(fams)} families "
          f"({OUT.stat().st_size/1e6:.2f} MB)", file=sys.stderr)


if __name__ == "__main__":
    main()
