# Tenet PG Management -- Live Audit Report

**Generated:** 2026-07-12 (initial multi-agent remediation)  
**Last verified:** 2026-07-16 (full FE audit + structural gap pipeline)  
**Repo:** `tenet_pg_management`  
**Methodology:** Parallel domain agents inspected every admin module (list / detail / new / edit), field matrices vs models and Zod routes, lifecycles, Flutter screen inventory. Open/closed gaps are maintained in feature MDs; LIVE Open P1 is **auto-generated**. **Code is truth.**

### 2026-07-16 full re-audit

- **23** admin modules under `apps/web/src/app/(admin)/` inventoried.
- **22** feature audit files under `docs/audit/features/` with **Last verified: 2026-07-16**.
- **4** interconnection docs updated.
- **Authoritative backlog:** [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) (Open P1 between `AUTO:OPEN-P1` markers).
- **Open P0 happy-path:** 0.
- **Open P1 (generated table):** **0** -- ELEC-P1-1 closed (date-windowed distribute share). Residual work is P2 polish.
- **Pipeline:** `scripts/audit/{normalize-gap-sections,build-live-gap-tables,lint-gap-sections,reconcile-open-gaps}.py` -- lint TOTAL FAIL 0.
- Prior README grades listing fixed items as open are **superseded**. Prefer LIVE_GAP + feature MDs.

---

## Executive summary

| Layer | Health | Notes |
|-------|--------|-------|
| **Admin CRUD** | Strong | Every module has list / detail / new / edit where applicable |
| **API surface** | Strong | CRUD + special actions; residual unused endpoints are P2 |
| **Open P0s** | **All closed** | Transfer, isActive, temp password, visitor filter, settings sanitize, etc. |
| **Open P1s** | **None material** | Generated Open P1 empty; remaining work is P2 polish in feature MDs |
| **Domain placement** | **Correct** | Room amenities `!isPerFloor`; floor ServiceStatus seeded on create; API `isValidFloorServiceType` enforces isPerFloor |
| **Flutter portal** | **MVP shipped** | Screens present; residual polish (e.g. password UX) in feature MDs |
| **Design system** | Strong | `saas` default; Form/DataTable stack; tokens dominate |

**Product split:** Next.js = admin only. Resident portals = one Flutter app (`mobile/`). See [docs/AGENT_CONTEXT.md](../AGENT_CONTEXT.md).

**Bottom line:** Core admin CRUD and closed P0/P1 integrity paths are solid. Domain placement for rooms/floors/services is correct in code. Remaining work is P2 polish in feature files -- not a greenfield rebuild.

---

## Domain placement (rooms / floors / services)

| Data | Belongs on | Live status |
|------|------------|-------------|
| Rent, beds, sharing, room number, room amenities (`!isPerFloor`) | **Room** | FE new/edit filter `!isPerFloor` -- correct |
| Floor number, label, amenity **counts** | **Floor** | Floor forms; counts only for isPerFloor |
| Operational status of isPerFloor amenities | **ServiceStatus** (floor-scoped) | Floor create **seeds** via `seedFloorServiceStatuses`; FloorServiceGrid |
| Amenity catalog + `isPerFloor` | **Settings** | AmenityTypesTab |
| API rejects room-only keys as floor services | Services POST/PUT | **PASS** -- `isValidFloorServiceType` requires `isPerFloor === true` |

Detail: [features/rooms.md](./features/rooms.md), [features/floors.md](./features/floors.md), [features/services.md](./features/services.md), [features/settings.md](./features/settings.md).

---

## What was fixed (do not re-file)

| Old claim | Live status |
|-----------|-------------|
| Missing CRUD routes / PUT holes | **Fixed** |
| Transfer non-atomic / free isActive / temp password lost | **Fixed** |
| Visitor filter invalid enums; PUT free status | **Fixed** -- lifecycle endpoints only |
| Floor create no ServiceStatus seed (FL-1) | **Fixed** -- `seedFloorServiceStatuses` |
| Services API accepts room-only keys (SV-1) | **Fixed** -- isPerFloor enforcement |
| Notice portal floor/room targeting (N1/N2) | **Fixed** -- resolveNoticeAudience |
| Notification F1/F2/F3 history + tenants-only all | **Fixed** |
| Audit sparse A1 (notices/visitors/notifications writers) | **Fixed** for those surfaces |
| Dashboard badges readBy / SSE never emits | **Fixed** -- unreadBy + broadcastBadgesUpdate |
| Settings empty phone/email 400; youtube social | **Fixed** |
| Flutter "missing" profile/leaves/attendance/notifications | **Screens exist** |

---

## Module health matrix (admin) -- 2026-07-16

| Module | Grade | Headline residual |
|--------|:-----:|-------------------|
| Tenants | **A** | P2 polish (bed picker reuse, docs) |
| Rooms | **A-** | Photos; P2 polish |
| Floors | **A-** | P2 (totalRooms create UX, seed keys) |
| Services | **A-** | P2 (lastUpdatedBy populate, labels) |
| Settings | **A-** | P2 types / amenity migration |
| Payments | **A-** | Unused special APIs P2 |
| Invoices | **A-** | P2 polish |
| Electricity | **A-** | ELEC-P1-1 share window **FIXED**; residual P2 (upload, list locks) |
| Complaints | **A** | photos URL attach live; ownership closed; status path clears resolvedAt |
| Assets | **A** | P2 service-due surface |
| Enquiries | **A** | Convert closed; P2 polish |
| Visitors | **A-** | Lifecycle solid; P2 polish |
| Guardians | **A** | P2 phantoms / TempCredentialsDialog |
| Attendance | **A-** | Flag default-off |
| Leaves | **A** | Flag-gated with attendance |
| Laundry | **A-** | Types package lag P2 |
| Meals | **A** | mealType unique edge residual |
| Menus | **A** | Always-on vs meals flag product split |
| Notices | **A-** | Portal targeting closed; P2 polish |
| Notifications | **A-** | F1-F3 closed; F5+ P2 |
| Dashboard | **A** | badges + SSE fixed |
| Export | **B** | Client multipage CSV |
| Audit Logs | **B+** | Writers expanded; residual coverage |

Full open/closed IDs: [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md).

---

## Role x UI surface

| Surface | admin | tenant | guardian |
|---------|:-----:|:------:|:--------:|
| Marketing landing | public | public | public |
| Login web | OK | **Rejected** | **Rejected** |
| Admin shell | OK | none | none |
| Flutter portal | none | **MVP** | **Present** |
| Invoices / UTR | CRUD | list + detail + UTR | -- |
| Complaints | CRUD | list + create | -- |
| Meals / menu / laundry | CRUD | basic | -- |
| Visitors | CRUD + lifecycle | list/register/status | -- |
| Ward / attendance | CRUD | check-in | ward + list + notices |
| Profile / leaves / notifs | admin | **Present** | thin |

---

## Flutter portal depth

Scaffold under `mobile/` is **not** a missing product. Major depth items (QR, PDF, home navigation, complaint detail, FeatureDisabledWidget, tenantId heal) closed in current tree -- see [features/FLUTTER_PORTAL.md](./features/FLUTTER_PORTAL.md). Residual polish remains in feature MDs.

---

## Documentation map for agents

| File | Role |
|------|------|
| [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) | **Authoritative** open/closed backlog (Open P1 AUTO-generated) |
| [features/*.md](./features/) | Per-module field/form/lifecycle (edit these; never put FIXED in Open gaps) |
| [interconnections/*.md](./interconnections/) | Cross-module flows |
| [AGENT_PLAYBOOK.md](./AGENT_PLAYBOOK.md) | Fix queues + audit MD pipeline |
| `scripts/audit/*.py` | normalize / build LIVE_GAP / lint / reconcile |

### Keep gaps honest

1. Edit feature MD Open gaps / Closed only.
2. `python3 scripts/audit/normalize-gap-sections.py`
3. `python3 scripts/audit/build-live-gap-tables.py`
4. `python3 scripts/audit/lint-gap-sections.py` -- must print TOTAL FAIL: 0
5. `python3 scripts/audit/reconcile-open-gaps.py` -- must PASS
