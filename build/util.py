#!/usr/bin/env python3
"""Shared IO for the build scripts. Standard library only.

`data/taxa.json` is the canonical source of truth: four scripts read it, three
rewrite it, and one of those rewrites is a checkpoint *inside a network loop* —
the code path most likely to be interrupted. `Path.write_text` truncates before
it writes, so a Ctrl-C in that window leaves the file unparseable and takes
build.py, wcvp.py and ages.py down with it. Writing to a sibling temp file and
renaming makes the replacement atomic: readers see the old file or the new one,
never a half-written one.

Both helpers pin `encoding="utf-8"`. The data carries em dashes and a `×`, and
the page it builds declares UTF-8 — relying on the platform's default codec
would write mojibake anywhere the locale isn't UTF-8.
"""
import json
import os
import pathlib
import tempfile


def read_json(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def write_json(path, doc, **dumps_kwargs):
    """Serialise `doc` over `path` atomically. Defaults match the repo's style."""
    dumps_kwargs.setdefault("ensure_ascii", False)
    path = pathlib.Path(path)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=path.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(doc, f, **dumps_kwargs)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)          # atomic on POSIX and on Windows
    except BaseException:
        pathlib.Path(tmp).unlink(missing_ok=True)
        raise
