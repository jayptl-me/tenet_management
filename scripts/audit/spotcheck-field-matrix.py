#!/usr/bin/env python3
"""3-module field-matrix spot-check for plan verification step 2.

Modules: rooms/services (domain), payments (finance), complaints (ops).
Compares model/FE fields and feature MD open/closed claims vs source.
Writes {SCRATCH}/spotcheck-diff.md.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRATCH = Path(
    "/var/folders/89/2t3pc79j3h7bz4y9qs_323080000gn/T/grok-goal-9198ad9fa59e/implementer"
)
fails: list[str] = []
lines: list[str] = [
    "# Spot-check: 3-module field matrix (rooms/services + payments + complaints)\n",
    "**Last verified:** 2026-07-16\n",
]


def ok(name: str, cond: bool, evidence: str = "") -> None:
    if not cond:
        fails.append(name)
    lines.append(
        f"- {'PASS' if cond else 'FAIL'}: {name}"
        + (f" -- {evidence}" if evidence else "")
    )


def read(rel: str) -> str:
    p = ROOT / rel
    return p.read_text() if p.exists() else ""


def main() -> int:
    lines.append("\n## Module 1: Rooms + Services (domain placement)\n")
    room_new = read("apps/web/src/app/(admin)/rooms/new/page.tsx")
    room_edit = read("apps/web/src/app/(admin)/rooms/[id]/edit/page.tsx")
    room_detail = read("apps/web/src/app/(admin)/rooms/[id]/page.tsx")
    for field in ["roomNumber", "sharingType", "monthlyRent", "roomAmenities", "floorId"]:
        if field in ("roomNumber", "monthlyRent"):
            places = [room_new, room_edit, room_detail]
        elif field == "roomAmenities":
            places = [room_new, room_edit]
        else:
            places = [room_new, room_edit]
        ok(f"rooms FE has {field}", all(field in p for p in places))
    ok(
        "rooms new filters !isPerFloor",
        "!d.isPerFloor" in room_new or "filter((d) => !d.isPerFloor)" in room_new,
    )
    ok(
        "rooms edit filters !isPerFloor",
        "!d.isPerFloor" in room_edit or "filter((d) => !d.isPerFloor)" in room_edit,
    )
    ok(
        "floors new isPerFloor",
        "isPerFloor" in read("apps/web/src/app/(admin)/floors/new/page.tsx"),
    )
    ok("FL-1 seed", "seedFloorServiceStatuses" in read("apps/api/src/routes/floors.ts"))
    ok(
        "SV-1 isPerFloor API",
        "isValidFloorServiceType" in read("apps/api/src/routes/services.ts"),
    )
    svc_md = read("docs/audit/features/services.md")
    floors_md = read("docs/audit/features/floors.md")
    ok("services acceptance SV-1 [x]", "[x] API rejects serviceType" in svc_md)
    ok("floors acceptance FL-1 [x]", "[x] Creating a floor with isPerFloor" in floors_md)
    ok(
        "README domain not half-baked seed",
        "does **not** create ServiceStatus" not in read("docs/audit/README.md"),
    )
    ok(
        "services.md no false open SV-1 prose",
        "Admin could create ServiceStatus for `fan`" not in svc_md,
    )

    lines.append("\n## Module 2: Payments (finance)\n")
    pay_new = read("apps/web/src/app/(admin)/payments/new/page.tsx")
    for f in ["tenantId", "invoiceId", "amount", "method"]:
        ok(f"payments new {f}", f in pay_new)
    ok(
        "payments prefill",
        "prefillTenantId" in pay_new and "useSearchParams" in pay_new,
    )
    ok(
        "payments verify",
        "verify" in read("apps/web/src/app/(admin)/payments/[id]/page.tsx").lower(),
    )
    ok("payments offline API", "offline" in read("apps/api/src/routes/payments.ts"))
    ok(
        "payments.md no prefill FAIL",
        "FAIL** query prefill" not in read("docs/audit/features/payments.md"),
    )

    lines.append("\n## Module 3: Complaints (ops)\n")
    cmp_new = read("apps/web/src/app/(admin)/complaints/new/page.tsx")
    for f in ["title", "description", "priority", "category"]:
        ok(f"complaints new {f}", f in cmp_new)
    cmp_route = read("apps/api/src/routes/complaints.ts")
    ok(
        "CMP-authz code",
        "authUser.role === 'tenant'" in cmp_route and "complaintTenantId" in cmp_route,
    )
    cmp_md = read("docs/audit/features/complaints.md")
    ok(
        "complaints.md no IDOR open claim",
        "any authenticated role can load any complaint" not in cmp_md,
    )
    ok(
        "complaints.md CMP-authz closed",
        "ownership" in cmp_md.lower() or "CMP-authz" in cmp_md,
    )
    ok(
        "complaints acceptance ownership [x]",
        "[x] Tenant cannot GET another" in cmp_md,
    )

    lines.append("\n## Cross: visitors + guardians prose\n")
    vis_md = read("docs/audit/features/visitors.md")
    g_md = read("docs/audit/features/guardians.md")
    cmp_md = read("docs/audit/features/complaints.md")
    svc_md2 = read("docs/audit/features/services.md")
    ok(
        "visitors PUT free status PASS prose",
        "API PUT residual P1-V1" not in vis_md
        and (
            "PUT free status | **PASS**" in vis_md
            or "status intentionally omitted" in vis_md
        ),
    )
    ok(
        "visitors code omits status",
        "status intentionally omitted" in read("apps/api/src/routes/visitors.ts"),
    )
    ok(
        "visitors API table no free status / no transition guard",
        "no transition guard" not in vis_md
        and "expectedArrival/**status**" not in vis_md
        and "name/phone/purpose/expectedArrival/**status**" not in vis_md,
    )
    ok(
        "visitors remediation no P1-V1 bypass remains",
        "P1-V1 PUT status bypass remains" not in vis_md,
    )
    ok(
        "guardians header no P1-G1 open",
        "cascade orphan users from tenant delete (P1-G1)" not in g_md,
    )
    ok("guardians remediation closed", "Open: P1-G1" not in g_md)
    ok(
        "guardians lifecycle no Users may linger",
        "Users may linger" not in g_md,
    )
    ok(
        "complaints API surface no 'no tenant ownership check'",
        "no tenant ownership check" not in cmp_md,
    )
    ok(
        "services field table no 'API allows any def key'",
        "API allows any def key" not in svc_md2,
    )

    lines.append(f"\n**Unresolved contradictions:** {len(fails)}\n")
    r = subprocess.run(
        [sys.executable, str(ROOT / "scripts/audit/reconcile-open-gaps.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    lines.append("\n## Pipeline\n```\n" + r.stdout + "```\n")
    out = "\n".join(lines)
    SCRATCH.mkdir(parents=True, exist_ok=True)
    (SCRATCH / "spotcheck-diff.md").write_text(out)
    print(out)
    return 0 if not fails and r.returncode == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
