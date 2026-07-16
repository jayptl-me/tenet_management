#!/usr/bin/env python3
"""FAIL if Open gaps sections contain FIXED/CLOSED/DONE table rows,
or if the same gap ID appears in both Open and Closed sections.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FEATURES = ROOT / "docs/audit/features"
LIVE = ROOT / "docs/audit/LIVE_GAP_INVENTORY.md"

BANNED = re.compile(r"\b(FIXED|CLOSED|DONE)\b", re.I)
ID_RE = re.compile(r"\|\s*\*?\*?([A-Z][A-Z0-9][A-Z0-9_\-/]*(?:\s*/\s*[A-Z0-9][A-Z0-9_\-/]*)?)\*?\*?\s*\|")


def open_section(text: str) -> str:
    parts = []
    for m in re.finditer(r"## Open gaps.*?(?=\n## |\Z)", text, re.S | re.I):
        parts.append(m.group(0))
    # also "Open P1" style subsections under Open gaps
    return "\n".join(parts)


def closed_section(text: str) -> str:
    parts = []
    for m in re.finditer(
        r"## Closed.*?(?=\n## |\Z)",
        text,
        re.S | re.I,
    ):
        parts.append(m.group(0))
    return "\n".join(parts)


def table_ids(section: str) -> set[str]:
    ids = set()
    for line in section.splitlines():
        if not line.strip().startswith("|"):
            continue
        if re.search(r"\|\s*ID\s*\|", line, re.I):
            continue
        m = re.match(r"\|\s*\*?\*?([A-Za-z][A-Za-z0-9_\-/ ]{1,40}?)\*?\*?\s*\|", line)
        if m:
            gid = m.group(1).strip()
            if gid.lower() in {"id", "claim", "old claim", "prior claim", "item", "sev", "---"}:
                continue
            if re.match(r"^-+$", gid):
                continue
            ids.add(gid)
    return ids


def main() -> int:
    fails: list[str] = []
    for p in sorted(FEATURES.glob("*.md")):
        t = p.read_text()
        osec = open_section(t)
        csec = closed_section(t)
        for i, line in enumerate(osec.splitlines(), 1):
            if not line.strip().startswith("|"):
                continue
            if re.search(r"\|\s*ID\s*\|", line, re.I) or re.match(r"\|\s*[-:| ]+\|", line):
                continue
            if BANNED.search(line):
                fails.append(f"{p.relative_to(ROOT)}: Open gaps has FIXED/CLOSED/DONE: {line[:100]}")
        oids = table_ids(osec)
        cids = table_ids(csec)
        both = oids & cids
        # only flag if same id appears as open table row AND closed claim row
        for gid in sorted(both):
            # skip very generic words
            if len(gid) < 2:
                continue
            fails.append(f"{p.relative_to(ROOT)}: ID {gid!r} in both Open and Closed")

    # LIVE open section
    if LIVE.exists():
        live = LIVE.read_text()
        if "## Open P1" in live:
            sec = live.split("## Open P1", 1)[1]
            # stop at next ## Residual or ## Module or ## Flutter
            for stop in ("## Residual", "## Module health", "## Flutter portal", "## Lifecycle"):
                if stop in sec:
                    sec = sec.split(stop, 1)[0]
                    break
            for line in sec.splitlines():
                if line.strip().startswith("|") and BANNED.search(line):
                    if re.search(r"\|\s*ID\s*\|", line, re.I):
                        continue
                    fails.append(f"LIVE_GAP Open P1 FIXED/CLOSED/DONE: {line[:110]}")

    for f in fails:
        print(f"FAIL: {f}")
    print(f"\nTOTAL FAIL: {len(fails)}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
