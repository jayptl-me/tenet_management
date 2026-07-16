#!/usr/bin/env python3
"""Pipeline gate for audit MD correctness.
1) lint-gap-sections.py must exit 0
2) Open P1 AUTO block has zero FIXED/CLOSED/DONE
3) Domain placement source probes still hold
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
results: list[tuple[str, str, str]] = []


def ok(gid: str, cond: bool, ev: str) -> None:
    results.append(("PASS" if cond else "FAIL", gid, ev))


def read(rel: str) -> str:
    p = ROOT / rel
    return p.read_text() if p.exists() else ""


def main() -> int:
    # 1) lint
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts/audit/lint-gap-sections.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    ok("lint-gap-sections", r.returncode == 0, (r.stdout + r.stderr)[-200:].replace("\n", " "))

    live = read("docs/audit/LIVE_GAP_INVENTORY.md")
    if "<!-- AUTO:OPEN-P1:START -->" in live:
        open_blk = live.split("<!-- AUTO:OPEN-P1:START -->")[1].split("<!-- AUTO:OPEN-P1:END -->")[0]
    else:
        open_blk = live.split("## Open P1")[1].split("## Residual")[0] if "## Open P1" in live else ""

    fixed_rows = [
        ln
        for ln in open_blk.splitlines()
        if ln.strip().startswith("|") and re.search(r"\b(FIXED|CLOSED|DONE)\b", ln, re.I)
        and not re.search(r"\|\s*ID\s*\|", ln, re.I)
    ]
    ok("LIVE-open-zero-FIXED-markers", len(fixed_rows) == 0, f"FIXED rows={len(fixed_rows)}")

    # Domain placement
    rooms_new = read("apps/web/src/app/(admin)/rooms/new/page.tsx")
    ok(
        "domain-room-amenities",
        "!d.isPerFloor" in rooms_new or "filter((d) => !d.isPerFloor)" in rooms_new,
        "rooms filter !isPerFloor",
    )
    floors_new = read("apps/web/src/app/(admin)/floors/new/page.tsx")
    ok("domain-floor-isperfloor", "isPerFloor" in floors_new, "floors isPerFloor")
    floors = read("apps/api/src/routes/floors.ts")
    ok("FL-1-seed", "seedFloorServiceStatuses" in floors, "seedFloorServiceStatuses")
    svc = read("apps/api/src/routes/services.ts")
    ok(
        "SV-1-isPerFloor",
        "isValidFloorServiceType" in svc and "isPerFloor" in svc,
        "isValidFloorServiceType",
    )
    notices = read("apps/api/src/routes/notices.ts")
    ok(
        "N1-resolve-audience",
        "resolveNoticeAudience" in notices or ("Room.findById" in notices and "targetType: 'room'" in notices),
        "notice audience from tenant room",
    )
    ok("N1-no-jwt-floorId", "user.floorId" not in notices, "no user.floorId")

    # F1-A1 must not be open as broken claims
    ok("F1-not-open-as-unread-only-bug", "unread-only" not in open_blk.lower() or "FIXED" not in open_blk, "F1 not falsely open")
    ok("F1-not-in-open-table", "**F1**" not in open_blk, "F1 absent from open")
    ok("F2-not-in-open-table", "**F2**" not in open_blk, "F2 absent from open")
    ok("F3-not-in-open-table", "**F3**" not in open_blk, "F3 absent from open")
    ok("A1-not-in-open-table", "**A1**" not in open_blk, "A1 absent from open")

    # Source confirms F1/F3 fixed
    notif_model = read("apps/api/src/models/notification.ts")
    ok("F1-source-recipientUserIds", "recipientUserIds" in notif_model, "recipientUserIds field")
    notif_svc = read("apps/api/src/services/notification.service.ts")
    ok("F3-source-tenants-only", "role: 'tenant'" in notif_svc, "all -> tenants only")
    ok("A1-source-writeAuditLog-notif", "notification_send" in read("apps/api/src/routes/notifications.ts"), "audit on notif send")

    fails = [x for x in results if x[0] == "FAIL"]
    lines = ["# reconcile-open-gaps.py (pipeline)\n"]
    for st, gid, ev in results:
        lines.append(f"- {st}: {gid} -- {ev}")
    lines.append(f"\n**TOTAL:** {len(results)}  **FAIL:** {len(fails)}  **PASS:** {len(results)-len(fails)}\n")
    out = "\n".join(lines)
    print(out)
    scratch = Path("/var/folders/89/2t3pc79j3h7bz4y9qs_323080000gn/T/grok-goal-9198ad9fa59e/implementer")
    scratch.mkdir(parents=True, exist_ok=True)
    (scratch / "spotcheck-diff.md").write_text(out)
    (scratch / "reconcile-log.txt").write_text(out)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
