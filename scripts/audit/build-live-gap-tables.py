#!/usr/bin/env python3
"""Regenerate LIVE_GAP_INVENTORY Open P1 and Recently closed blocks
from feature MD Open gaps / Closed sections.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FEATURES = ROOT / "docs/audit/features"
LIVE = ROOT / "docs/audit/LIVE_GAP_INVENTORY.md"

OPEN_START = "<!-- AUTO:OPEN-P1:START -->"
OPEN_END = "<!-- AUTO:OPEN-P1:END -->"
CLOSED_START = "<!-- AUTO:RECENTLY-CLOSED:START -->"
CLOSED_END = "<!-- AUTO:RECENTLY-CLOSED:END -->"

BANNED = re.compile(r"\b(FIXED|CLOSED|DONE)\b", re.I)


def parse_open_rows(text: str) -> list[tuple[str, str, str, str]]:
    """Return list of (id, sev, gap, paths) for true open table rows."""
    rows = []
    for m in re.finditer(r"## Open gaps.*?(?=\n## |\Z)", text, re.S | re.I):
        sec = m.group(0)
        for line in sec.splitlines():
            if not line.strip().startswith("|"):
                continue
            if re.search(r"\|\s*ID\s*\|", line, re.I) or re.match(r"\|\s*[-:| ]+\|", line.strip()):
                continue
            if BANNED.search(line):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 2:
                continue
            gid = re.sub(r"\*+", "", cells[0]).strip()
            if not gid or gid.lower() in {"id", "claim", "item"}:
                continue
            # skip pure severity headers
            if re.match(r"^P[0-3]$", gid):
                continue
            sev = cells[1] if len(cells) > 1 else ""
            # only collect P0/P1 for Open P1 master table; include P2 if marked P1 domain critical
            sev_clean = re.sub(r"\*+", "", sev).strip()
            gap = cells[2] if len(cells) > 2 else (cells[1] if len(cells) > 1 else "")
            paths = cells[3] if len(cells) > 3 else ""
            # If second col is gap not severity (ID | Gap | Paths)
            if not re.match(r"^P[0-3]", sev_clean) and len(cells) >= 2:
                gap = cells[1]
                paths = cells[2] if len(cells) > 2 else ""
                # Infer severity from ID: ELEC-P1-1, P1-G2, RM-7, F5, ST-1, etc.
                im = re.search(r"P([0-3])(?:[-_]|$)", gid.upper())
                sev_clean = f"P{im.group(1)}" if im else "P2"
            rows.append((gid, sev_clean, gap, paths))
    return rows


def parse_closed_rows(text: str) -> list[tuple[str, str]]:
    rows = []
    for m in re.finditer(r"## Closed.*?(?=\n## |\Z)", text, re.S | re.I):
        sec = m.group(0)
        for line in sec.splitlines():
            if not line.strip().startswith("|"):
                continue
            if re.search(r"\|\s*(Claim|Old claim|Prior claim|ID)\s*\|", line, re.I):
                continue
            if re.match(r"\|\s*[-:| ]+\|", line.strip()):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 2:
                continue
            claim = re.sub(r"\*+", "", cells[0]).strip()
            status = cells[1] if len(cells) > 1 else ""
            if claim:
                rows.append((claim[:80], status[:120]))
    return rows


def main() -> int:
    all_open: list[tuple[str, str, str, str, str]] = []  # id, sev, gap, paths, file
    all_closed: list[tuple[str, str, str]] = []  # claim, status, file

    for p in sorted(FEATURES.glob("*.md")):
        t = p.read_text()
        for gid, sev, gap, paths in parse_open_rows(t):
            all_open.append((gid, sev, gap, paths, p.name))
        for claim, status in parse_closed_rows(t):
            all_closed.append((claim, status, p.name))

    # Open P1 master table: P0/P1 only
    def is_p01(sev: str, gid: str) -> bool:
        s = re.sub(r"\*+", "", sev).upper().strip()
        g = gid.upper()
        # Prefer severity column
        if s.startswith("P0") or s.startswith("P1"):
            return True
        if s.startswith("P2") or s.startswith("P3"):
            return False
        # Infer from ID: must have P0/P1 token, not P2/P3
        if re.search(r"P2|P3", g):
            return False
        if re.search(r"(^|[-_])P0([-_]|$)", g) or re.search(r"(^|[-_])P1([-_]|$)", g) or g.startswith("P1"):
            return True
        # Short historic P1 ids
        if g in {"A1", "F1", "F2", "F3", "D1", "D2", "N1", "N2", "N3", "SV-1", "FL-1"}:
            return True
        if g.startswith("FLAG-"):
            return True
        if g.startswith("CMP-") or g.startswith("ATT-") or g.startswith("MEAL-") or g.startswith("LDY-"):
            return True
        return False

    p01 = [r for r in all_open if is_p01(r[1], r[0])]

    # Dedupe by id
    seen = set()
    open_lines = []
    for gid, sev, gap, paths, src in p01:
        key = gid.upper()
        if key in seen:
            continue
        seen.add(key)
        domain = src.replace(".md", "").replace("-", " ")
        # strip backticks mess in paths
        paths_clean = paths.replace("`", "").strip()
        open_lines.append(
            f"| **{gid}** | {domain} | {gap[:100]} | {paths_clean[:90] or src} |"
        )

    open_block = (
        OPEN_START
        + "\n\n"
        + "| ID | Domain | Gap | Paths |\n"
        + "|----|--------|-----|-------|\n"
        + ("\n".join(open_lines) if open_lines else "| -- | -- | (no open P1 rows in feature MDs) | -- |")
        + "\n\n"
        + OPEN_END
    )

    # Recently closed: take last ~40 closed claims that mention FIXED
    fixed_closed = [(c, s, f) for c, s, f in all_closed if re.search(r"FIXED|CLOSED|DONE", s, re.I) or re.search(r"FIXED|CLOSED", c, re.I)]
    # also include all if few
    if len(fixed_closed) < 5:
        fixed_closed = all_closed[-40:]
    else:
        fixed_closed = fixed_closed[-40:]

    closed_lines = []
    for claim, status, src in fixed_closed:
        closed_lines.append(f"| {claim[:70]} | {status[:90]} |")

    closed_block = (
        CLOSED_START
        + "\n\n"
        + "| Claim | Live proof |\n"
        + "|-------|------------|\n"
        + ("\n".join(closed_lines) if closed_lines else "| -- | -- |")
        + "\n\n"
        + CLOSED_END
    )

    live = LIVE.read_text()

    # Ensure markers exist
    if OPEN_START not in live:
        # replace Open P1 section body
        if "## Open P1" in live:
            live = re.sub(
                r"(## Open P1[^\n]*\n)(.*?)(?=\n## Residual|\n## Module health|\n## Flutter)",
                r"\1\n" + open_block + "\n\n",
                live,
                count=1,
                flags=re.S,
            )
        else:
            live += "\n\n## Open P1\n\n" + open_block + "\n"
    else:
        live = re.sub(
            re.escape(OPEN_START) + r".*?" + re.escape(OPEN_END),
            open_block,
            live,
            count=1,
            flags=re.S,
        )

    if CLOSED_START not in live:
        if "## Recently closed" in live:
            live = re.sub(
                r"(## Recently closed[^\n]*\n)(.*?)(?=\n## Open P1|\n## Open)",
                r"\1\n" + closed_block + "\n\n",
                live,
                count=1,
                flags=re.S,
            )
        else:
            # insert before Open P1
            live = live.replace("## Open P1", "## Recently closed\n\n" + closed_block + "\n\n## Open P1", 1)
    else:
        live = re.sub(
            re.escape(CLOSED_START) + r".*?" + re.escape(CLOSED_END),
            closed_block,
            live,
            count=1,
            flags=re.S,
        )

    # Strip any FIXED from open block if generator put any (safety)
    if OPEN_START in live:
        pre, rest = live.split(OPEN_START, 1)
        mid, post = rest.split(OPEN_END, 1)
        mid_lines = []
        for line in mid.splitlines():
            if line.strip().startswith("|") and BANNED.search(line) and "ID" not in line:
                continue
            mid_lines.append(line)
        live = pre + OPEN_START + "\n".join(mid_lines) + OPEN_END + post

    LIVE.write_text(live)
    print(f"Open rows written: {len(open_lines)}")
    print(f"Closed rows written: {len(closed_lines)}")
    print("Updated", LIVE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
