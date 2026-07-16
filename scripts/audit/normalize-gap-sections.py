#!/usr/bin/env python3
"""Move FIXED/CLOSED/DONE table rows from ## Open gaps to ## Closed sections
in feature MDs. Does not touch product code.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FEATURES = ROOT / "docs/audit/features"
BANNED = re.compile(r"\b(FIXED|CLOSED|DONE)\b", re.I)


def process(text: str) -> tuple[str, int]:
    moved = 0

    def repl_open(m: re.Match) -> str:
        nonlocal moved
        sec = m.group(0)
        lines = sec.splitlines(keepends=True)
        keep = []
        closed_rows = []
        for line in lines:
            raw = line.rstrip("\n")
            if raw.strip().startswith("|") and BANNED.search(raw):
                if re.search(r"\|\s*ID\s*\|", raw, re.I) or re.match(r"\|\s*[-:| ]+\|", raw.strip()):
                    keep.append(line)
                    continue
                closed_rows.append(raw.lstrip())
                moved += 1
                continue
            keep.append(line)
        new_open = "".join(keep)
        # store closed rows on match object via nonlocal list
        repl_open.closed_rows.extend(closed_rows)  # type: ignore
        return new_open

    repl_open.closed_rows = []  # type: ignore

    # Process each Open gaps section
    text2 = re.sub(r"## Open gaps.*?(?=\n## |\Z)", repl_open, text, flags=re.S | re.I)
    rows = repl_open.closed_rows  # type: ignore

    if not rows:
        return text2, 0

    # Append to Closed section or create one
    closed_block = "\n".join(rows) + "\n"
    if re.search(r"## Closed", text2, re.I):
        def add_closed(m: re.Match) -> str:
            body = m.group(0)
            # insert after first table header if present
            if "|---" in body or "| ---" in body:
                # append before end of section
                return body.rstrip() + "\n" + closed_block + "\n"
            return body.rstrip() + "\n\n| Claim | Live status |\n|-------|-------------|\n" + closed_block + "\n"

        text2 = re.sub(r"## Closed.*?(?=\n## |\Z)", add_closed, text2, count=1, flags=re.S | re.I)
    else:
        # insert before Acceptance or Remediation or end
        insert = (
            "\n## Closed / do-not-refile\n\n"
            "| Claim | Live status |\n"
            "|-------|-------------|\n"
            + closed_block
            + "\n"
        )
        if re.search(r"\n## Acceptance", text2):
            text2 = re.sub(r"\n## Acceptance", insert + "## Acceptance", text2, count=1)
        elif re.search(r"\n## Remediation", text2):
            text2 = re.sub(r"\n## Remediation", insert + "## Remediation", text2, count=1)
        else:
            text2 = text2.rstrip() + "\n" + insert

    return text2, moved


def main() -> int:
    total = 0
    for p in sorted(FEATURES.glob("*.md")):
        t = p.read_text()
        nt, n = process(t)
        if n:
            p.write_text(nt)
            print(f"{p.name}: moved {n} rows")
            total += n
    print(f"TOTAL moved: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
