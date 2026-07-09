#!/usr/bin/env python3
"""Regenerate design/fonts.css — the inlined @font-face for the UI sans.

The app ships as one self-contained, offline, CSP-safe file, so the webfont is
embedded as a base64 data URI rather than linked. Source is the npm package
@fontsource-variable/hanken-grotesk (OFL-1.1); run `npm install` first.

Usage:  python3 build/fonts.py   (or: make fonts)
"""
import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
WOFF2 = ROOT / "node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2"
OUT = ROOT / "design" / "fonts.css"


def main() -> None:
    if not WOFF2.exists():
        raise SystemExit(f"missing {WOFF2} — run `npm install` first")
    b64 = base64.b64encode(WOFF2.read_bytes()).decode()
    css = (
        "  /* Hanken Grotesk (variable, latin) — inlined so the app stays one self-contained,\n"
        "     offline, CSP-safe file. Regenerate with: make fonts. OFL-1.1 licensed. */\n"
        "  @font-face{\n"
        "    font-family:'Hanken Grotesk';\n"
        "    font-style:normal;\n"
        "    font-weight:100 900;\n"
        "    font-display:swap;\n"
        f"    src:url(data:font/woff2;base64,{b64}) format('woff2');\n"
        "  }\n"
    )
    OUT.write_text(css)
    print(f"wrote {OUT.relative_to(ROOT)} — {len(css) / 1024:.0f} KB "
          f"(base64 of {WOFF2.stat().st_size / 1024:.0f} KB woff2)")


if __name__ == "__main__":
    main()
