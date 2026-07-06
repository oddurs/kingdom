#!/usr/bin/env python3
"""Derive divergence ages (Ma) for each clade from a dated plant megatree.

Source: the GBOTB.extended megatree assembled by Jin & Qian (2022) — Smith &
Brown (2018) for seed plants + Zanne et al. (2014) for ferns/pteridophytes. It's
an ultrametric tree of 72,570 vascular-plant species, dated in millions of years
(root ≈ 400 Ma = crown of vascular plants). A single 2.9 MB Newick file:

    https://github.com/megatrees/plant_20221117   ->   plant_megatree.tre
                                                        plant_genus_list.csv
Unzip/drop both into data/megatree/ (git-ignored) and run:

    python3 build/ages.py        # writes ageMy onto taxa.json, then run build.py

Method — crown age via MRCA, with outlier rejection:
    For each taxon we collect its megatree tips (a family's own tips; an internal
    node's = all tips of its descendant families) and take the age of the node
    where they coalesce. Mega-supertrees occasionally misplace a single genus,
    which would drag a strict MRCA far too deep (e.g. Asteraceae 132 Ma vs a real
    ~50). So we use the deepest node still containing ≥99.5% of the taxon's tips —
    this cleanly removes rogue tips (sharp cliffs) while preserving genuine
    early-diverging lineages (gradual structure). Ages are crown estimates from
    THIS tree and will differ from other studies by tens of Ma; provenance
    records the source. Bryophytes are non-vascular → absent here → left null.

Standard library only.
"""
import csv
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TRE = ROOT / "data" / "megatree" / "plant_megatree.tre"
GEN = ROOT / "data" / "megatree" / "plant_genus_list.csv"
DATA = ROOT / "data" / "taxa.json"
KEEP = 0.995  # deepest node retaining this fraction of tips (drops ≤0.5% rogues)


def parse_newick(s):
    """Iterative parser (the tree nests too deep for recursion). Returns parent,
    branch-length and name arrays; every node's parent has a lower index."""
    parent, bl, name = [-1], [0.0], [None]
    cur, i, N = 0, 0, len(s)
    while i < N:
        c = s[i]
        if c == "(":
            parent.append(cur); bl.append(0.0); name.append(None)
            cur = len(parent) - 1; i += 1
        elif c == ",":
            p = parent[cur]
            parent.append(p); bl.append(0.0); name.append(None)
            cur = len(parent) - 1; i += 1
        elif c == ")":
            cur = parent[cur]; i += 1
        elif c == ":":
            j = i + 1
            while j < N and s[j] not in "(),:;": j += 1
            bl[cur] = float(s[i + 1:j]); i = j
        elif c == ";":
            break
        else:
            j = i
            while j < N and s[j] not in "(),:;": j += 1
            name[cur] = s[i:j]; i = j
    return parent, bl, name


def main():
    if not TRE.exists():
        sys.exit(f"missing {TRE} — download the megatree (see this file's docstring)")

    print("parsing megatree …", file=sys.stderr)
    parent, bl, name = parse_newick(TRE.read_text())
    n = len(parent)
    depth = [0.0] * n
    level = [0] * n
    haschild = bytearray(n)
    for i in range(1, n):
        depth[i] = depth[parent[i]] + bl[i]
        level[i] = level[parent[i]] + 1
        haschild[parent[i]] = 1
    tips = [i for i in range(n) if not haschild[i]]
    H = max(depth[i] for i in tips)

    # tip -> genus -> family
    g2f = {}
    with GEN.open(encoding="latin-1") as f:
        for row in csv.DictReader(f):
            g2f[row["genus"]] = row["family"]
    fam_tips = {}
    for i in tips:
        fam = g2f.get((name[i] or "").split("_")[0])
        if fam:
            fam_tips.setdefault(fam, []).append(i)
    print(f"  {n} nodes, {len(tips)} tips, root age {H:.1f} Ma, "
          f"{len(fam_tips)} families in tree", file=sys.stderr)

    def age_of(tip_list):
        """(age, kind). ≥2 tips → trimmed crown age. Exactly 1 tip (monotypic in
        the tree, e.g. Ginkgoaceae) → stem age, i.e. when that lone lineage split
        from its sister. 0 tips → not datable here."""
        if len(tip_list) == 1:
            return round(H - depth[parent[tip_list[0]]], 1), "megatree-stem"
        if len(tip_list) < 2:
            return None, None
        cnt = {}
        for t in tip_list:
            v = t
            while v != -1:
                cnt[v] = cnt.get(v, 0) + 1
                v = parent[v]
        thresh = max(2, math.ceil(KEEP * len(tip_list)))
        best = None
        for v, c in cnt.items():
            if c >= thresh and (best is None or depth[v] > depth[best]):
                best = v
        return round(H - depth[best], 1), "megatree"

    doc = json.loads(DATA.read_text())
    taxa = doc["taxa"]
    kids = {}
    for t in taxa:
        kids.setdefault(t["parent"], []).append(t["id"])
    by_id = {t["id"]: t for t in taxa}

    def descendant_families(tid):
        out = []
        stack = [tid]
        while stack:
            cur = by_id[stack.pop()]
            if cur["rank"] == "family":
                out.append(cur["name"])
            stack.extend(kids.get(cur["id"], []))
        return out

    dated = 0
    for t in taxa:
        fams = [t["name"]] if t["rank"] == "family" else descendant_families(t["id"])
        pool = []
        for fam in fams:
            pool.extend(fam_tips.get(fam, []))
        age, kind = age_of(pool)
        if age is not None:
            t["ageMy"] = age
            t.setdefault("provenance", {})["ageMy"] = kind
            dated += 1
        else:
            t.pop("ageMy", None)

    doc["meta"].setdefault("sources", {})["megatree"] = {
        "name": "Dated plant megatree (GBOTB.extended): Jin & Qian 2022; "
                "Smith & Brown 2018; Zanne et al. 2014",
        "url": "https://github.com/megatrees/plant_20221117",
        "license": "CC-BY (see repository)",
    }
    DATA.write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    print(f"done: {dated}/{len(taxa)} taxa dated", file=sys.stderr)

    # ---- validation: backbone clades should match consensus geology ----
    checks = ["Tracheophytes", "Spermatophytes", "Angiosperms", "Monocots",
              "Eudicots", "Rosids", "Asterids", "Gymnosperms", "Poales",
              "Fabales", "Asterales", "Fagales"]
    print("\n  backbone validation (crown age Ma):", file=sys.stderr)
    for nm in checks:
        t = next((x for x in taxa if x["name"] == nm), None)
        if t and "ageMy" in t:
            print(f"    {nm:16} {t['ageMy']:7.1f}", file=sys.stderr)


if __name__ == "__main__":
    main()
