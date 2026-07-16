# Live Gap Inventory (re-verified 2026-07-16)

Master backlog from **code-verified** multi-agent FE + API + Flutter audit. Prefer this file over older batch notes when they disagree with source.

**Last verified:** 2026-07-16 (full audit + **worktree reconcile** + **lifecycle integrity pass**)  
**Method:** Parallel domain agents re-inspected every admin module (list/detail/new/edit), field/form/lifecycle against models + Zod routes + FE pages; Flutter screen matrix; interconnections. Second pass re-checked every OPEN row against **current tree**. Third pass (Grok) independently re-audited meals/tenants/finance/Flutter/ops and fixed dues residual, UTR unset, TZ check-in, reinstate placement, leave→attendance, Flutter password. **Code is truth.** See [SESSION_2026-07-16_LIFECYCLE_PASS.md](./SESSION_2026-07-16_LIFECYCLE_PASS.md).

**Product split (non-negotiable):**

| Surface | Path | Roles |
|---------|------|-------|
| Admin | `apps/web` Next.js | `admin` only |
| Resident portal | `mobile/` Flutter (Web + iOS + Android) | `tenant`, `guardian`, visitor desk |
| API | `apps/api` | JWT all roles |

**Theme priority:** preset **`saas`**. Design tokens + Form/DataTable stack.

Severity:

- **P0** = broken primary flow, integrity race that always fails happy path, missing credential path, or form that always 400s
- **P1** = incomplete hub / material UX / authz gap / domain mis-wiring / integrity under concurrency
- **P2** = polish, unused API surfaces, free-text IDs, types lag

---

## Verification snapshot (2026-07-16)

| Gate | Result |
|------|--------|
| Admin modules inventoried | **23** folders under `apps/web/src/app/(admin)/` |
| Feature MDs rewritten | **22** under `docs/audit/features/` (dashboard+export+audit-logs share one file) |
| Interconnection MDs | **4** re-verified |
| Open **P0** (product happy path) | **0** confirmed open |
| Open **P1** (material) | **1** generated (ELEC-P1-1); zero FIXED markers; from feature MD Open gaps only |
| Domain placement rooms/floors/services | **Documented** -- mostly correct FE split; P1 seed + API isPerFloor gaps |
| Worktree note | Uncommitted **product** diffs exist (invoices paid-delete gate, payments prefill, badges unreadBy, enquiry convert, CommandPalette flags, etc.). Audit MDs match **current** tree after reconcile. |

---

## Domain placement (strict) -- rooms / floors / services / amenities

| Concern | Correct home | Live status |
|---------|--------------|-------------|
| `roomNumber`, `sharingType`, `monthlyRent`, `beds`, `occupancyCount`, `photos` | **Room** | Correct on room model/forms |
| `roomAmenities[]` for `isPerFloor=false` defs | **Room** | FE new/edit filter `!isPerFloor` -- **correct** |
| `floorNumber`, `label`, `totalRooms`, `amenityCounts` | **Floor** | Correct; totalRooms server-synced after rooms exist |
| Operational health of `isPerFloor=true` amenities | **ServiceStatus** (floor-scoped) | FloorServiceGrid + Services CRUD; **seeded on floor create** (FL-1 closed) |
| Amenity catalog + `isPerFloor` flag | **Settings** `amenityDefinitions` | AmenityTypesTab + sanitizeSettingsPayload -- **correct** |
| API rejects room-only keys as floor services | Services POST/PUT | **PASS** -- `isValidFloorServiceType` requires isPerFloor (SV-1 closed) |

**Domain placement (current):** Floor create seeds ServiceStatus for isPerFloor amenities. Services API rejects room-only keys. Labels/status for floor services belong on Services / FloorServiceGrid; room forms use roomAmenities for `!isPerFloor` only.

Detail: [features/rooms.md](./features/rooms.md), [features/floors.md](./features/floors.md), [features/services.md](./features/services.md), [features/settings.md](./features/settings.md).

---

## P0 status (all still closed -- do not re-file)

| ID | Claim | Live status |
|----|-------|-------------|
| P0-T1 | Transfer non-atomic | **FIXED** -- validate free first; transaction; 409 |
| P0-T2 | Edit `isActive` bypass | **FIXED** -- removed from PUT + edit UI |
| P0-T3 | Temp password discarded | **FIXED** -- returned + TempCredentialsDialog |
| P0-V1 | Visitor filter invalid `pending` | **FIXED** -- expected/arrived/departed/cancelled |
| P0-F1 | Flutter null `tenantId` | **FIXED** -- seed + `/auth/me` heal (residual: some write paths skip refresh) |
| P0-D1 | Static `out` vs Next server build | **FIXED** -- `render.yaml` `pg-web` is `type: web` + `next start` |
| P0-FE-settings | Empty phone/email 400 on Save | **FIXED** -- `sanitizeSettingsPayload` + API preprocess |
| P0-FE-invoice-edit | Partial status clobber; paid editable | **FIXED** -- omit status for partial; lock paid |
| P0-FE-services-edit | Hardcoded serviceType keys | **FIXED** -- load amenityDefinitions |
| P0-tenant-create-500 | Session circular JSON | **FIXED** -- lean re-fetch after transaction |

**Ops-only P0 note (Flutter):** first-login credentials + `User.tenantId` still depend on seed/create quality; client heal helps after `/auth/me`. Not a missing-screen P0.

---

## Recently closed on reconcile (2026-07-16 worktree) -- do not re-file

<!-- AUTO:RECENTLY-CLOSED:START -->

| Claim | Live proof |
|-------|------------|
| Checkout dues gross total / electricity always 0 (FIN-DUES) | **FIXED 2026-07-16** -- residual via getInvoiceBalance + electricityAmount |
| UTR reject leaves utrNumber (blocks re-submit) | **FIXED** -- `$unset` on both verify paths |
| submit-utr create uses nullable invoice.dueDate | **FIXED** -- resolveInvoiceDueDate |
| Attendance check-in window UTC hours | **FIXED** -- currentHourInTZ |
| Menus isActive filter UTC | **FIXED** -- todayInTZ |
| Tenant feedback re-submit keeps actioned status | **FIXED** -- status reset to submitted |
| Reinstate only original bed | **FIXED** -- optional roomId/bedId body + FE picker |
| Checkout leaves guardian portal active | **FIXED** -- deactivate/reactivate guardian Users |
| Leave approve no attendance | **FIXED** -- on_leave upsert per day |
| Flutter no password change/forgot | **FIXED** -- profile + login |
| Flutter complaint no ensureTenantId | **FIXED** |
| Invoice detail no pay bridge (admin + Flutter) | **FIXED** -- Record payment CTA + Flutter query preselect |
| Flutter flag discoverability (nav always 403) | **FIXED 2026-07-16** -- `app_features.dart` + More/shell filter |
| Notification unread badge missing | **FIXED** -- Home Badge + unread-count API |
| Tenant leave cancel missing | **FIXED** -- POST leaves/:id/cancel + Flutter CTA + tests |
| Complaint photos dead contract | **FIXED** -- create/update photos + POST :id/photos + admin/Flutter display |
| Flutter password change/forgot | **FIXED** -- login + profile (prior lifecycle) |

| No GET by id / No PUT | **Fixed** -- both exist; edit is metadata-only |
| Detail/edit pages dead 404 | **Fixed** -- load via GET `/:id` |
| Dual compose entry points | **Fixed** -- `/new` redirects to list compose tab |
| Native OS select for type filter | **Fixed** -- themed `Select` |
| Sidebar badges use `readBy` (F4 / D1) | **FIXED** -- dashboard badges query `unreadBy` |
| F1 | **FIXED** |
| F2 | **FIXED** |
| F3 | **FIXED** |
| F4 | **CLOSED** |
| F6 | **FIXED** |
| Offline create missing | **Closed** -- full form + balance prefill |
| Verify CTA missing | **Closed** -- detail approve/reject |
| mobileCardRenderer missing | **Closed** |
| Receipt endpoint unused | **Closed** -- detail modal + print |
| UTR duplicate 409 | **Closed** API-side |
| List status filter for pending verification | **Closed** |
| `?tenantId=` prefill ignored (PAY-P1-1) | **Closed** -- `useSearchParams` + defaultValues + invoice load |
| Soft-delete ConfirmModal irreversible copy (RM-7) | **FIXED** -- title "Deactivate Room"; message marked inactive / hidden from new assignment |
| isValidServiceType any key (SV-1) | **FIXED** -- isValidFloorServiceType requires isPerFloor |
| No seed on floor create (SV-2) | **FIXED** -- seedFloorServiceStatuses |
| Feature flags partial PUT broken | features object optional booleans; findOneAndUpdate upsert |
| socialLinks.youtube UI-only / not in API | **FIXED** -- model + Zod + sanitizeSettingsPayload + settings FE + unit tests |
| Transfer non-atomic / free-before-validate (P0-T1) | **FIXED** -- validate then `withTransaction` |
| isActive free-set on PUT (P0-T2) | **FIXED** -- removed from schema + edit FE |
| temporaryPassword discarded (P0-T3) | **FIXED** -- returned + TempCredentialsDialog |
| Nested GET IDOR (P1-T6) | **FIXED** -- `assertAdminOrTenantOwner` |
| Occupied beds selectable on create | **FIXED** -- OccupancyBedPicker |
| FE rent min 1 vs API 1000 | **FIXED** -- FE min 1000 |
| Flutter profile missing | **FIXED** -- `profile_screen.dart` + leaves/attendance/notifs present |
| Detail missing reinstate / guardians hub | **FIXED** |
| FE lifecycle errors generic (P1-T3) | **FIXED** -- `parseApiError` on checkout/reinstate (detail page) |
| P1-V2 Flutter FEATURE_DISABLED UX | **FIXED** -- FeatureDisabledWidget on visitor home |
| List filter includes `pending`, omits expected/cancelled (P0-V1) | **FIXED** -- StatusFilterSelect enums match model |
| GET/arrive/depart no ownership (P1) | **FIXED** -- admin or owning tenant |
| No transition guards on arrive/depart | **FIXED** -- 409 INVALID_TRANSITION |
| Edit missing expectedArrival | **FIXED** |
| VisitorLifecycleActions missing | **FIXED** -- shared component on detail |
| Admin create 403 / /my shadowed | **FIXED** (prior) |
| Flutter tenantId hard fail without heal | **FIXED** -- refreshUser + seed/me backfill path |
| Admin PUT free-sets status (P1-V1) | **FIXED** -- `status intentionally omitted` in PUT handler |

<!-- AUTO:RECENTLY-CLOSED:END -->



## Open P1 -- ranked fix queue for later agents

> **Rule:** No row in this section may contain `FIXED`/`CLOSED`/`DONE`. Generated from feature MD Open gaps.
> Source of open rows: `scripts/audit/build-live-gap-tables.py`

<!-- AUTO:OPEN-P1:START -->

| ID | Domain | Gap | Paths |
|----|--------|-----|-------|
| -- | -- | (no open P1 rows in feature MDs) | -- |
<!-- AUTO:OPEN-P1:END -->



## Residual P2 (non-blocking sample -- not exhaustive)

| Item | Notes |
|------|-------|
| ATT/Leaves page-local name search | **FIXED 2026-07-16** -- server `search` on both list APIs (User name regex -> Tenant IDs) |
| ELEC-P1-2 API hard reconcile | FE warns at >0.5 and hard-blocks large drift; optional server-side check residual |
| Room photos | Model/API only; no upload UI |
| Unused APIs | `rooms/available`, `services/summary`, payments summary/qr/pending-verification dual-verify, invoice payment-status |
| Free-text Mongo IDs | Notices **FIXED** ResourceSelect; notification compose uses pickers |
| Types lag | laundry, meals, roomAmenities on IRoom, ITenantCreate temp password |
| Soft-delete modal copy | **Mostly FIXED** (rooms/guardians/assets Retire/Deactivate); residual polish elsewhere |
| Seed key drift | ServiceStatus seed keys vs AppConfig defaults |
| Electricity billImage URL-only | No Cloudinary |

**Not residual:** Settings `socialLinks.youtube` -- **FIXED** (model + Zod + `sanitizeSettingsPayload` + settings FE + tests).

---

## Module health matrix (admin) -- 2026-07-16 (reconciled)

Grades are **not more optimistic** than open gaps in each feature MD.

| Module | List | Detail | New | Edit | Grade | Open focus |
|--------|:----:|:------:|:---:|:----:|:-----:|------------|
| Tenants | OK | Hub OK | Creds OK | Transfer OK | **A** | P1 bed/cascade closed; P2 polish |
| Rooms | OK | OK | OK amenities | OK amenities | **A-** | photos; polish |
| Floors | OK | Grid OK | Seed services | OK | **A-** | residual polish |
| Services | OK | OK | isPerFloor only | PUT /full | **A-** | residual polish |
| Settings | Tabs OK | -- | -- | Sanitize OK | **A-** | types; amenity migration |
| Payments | OK + mCR | Verify OK | Prefill OK | OK | **A-** | unused APIs (P2) |
| Invoices | hide paid del | PDF OK | Generate OK | Paid lock inputs | **A** | -- |
| Electricity | month filter | Finalize/dist | reconcile warn | lock OK | **A-** | ELEC-P1-1 FIXED; residual P2 |
| Complaints | Kanban OK | photos | photo URLs | OK | **A** | photos live |
| Assets | retire UX | OK | OK | date clear | **A** | -- |
| Enquiries | preferredSharing | convert CTA | OK | OK | **A** | convert marks converted |
| Visitors | Filters OK | Lifecycle OK | OK | no free status | **A-** | residual P2 polish |
| Guardians | OK | OK | Temp pwd | OK | **A** | cascade Users FIXED |
| Attendance | Board OK | OK | OK | OK | **A-** | flag default deferred |
| Leaves | server search | Approve OK | OK | cancel | **A** | cancelled status + filter |
| Laundry | OK | OK | items min | OK | **A-** | types aligned; 409 UX |
| Meals | Summary OK | Edit CTA | OK | OK | **A** | DUPLICATE_FEEDBACK 409 |
| Menus | Week planner | OK | category | OK | **A** | always-on by design |
| Notices | OK | OK | ResourceSelect targets | targets OK | **A-** | residual P2 polish |
| Notifications | Compose OK | OK | Dual fixed | OK | **A-** | F1 history + F2 isRead + F3 tenants-only all |
| Dashboard | Rich | -- | -- | -- | **A** | badges unreadBy + badges-update emit FIXED |
| Export | Multipage CSV | -- | -- | -- | **B** | client-only by design |
| Audit Logs | actions+dates | N/A | N/A | N/A | **A-** | A1 Queue E writers expanded |

---

## Flutter portal matrix (brief)

| Area | Status |
|------|--------|
| Product split | **PASS** -- no resident UI in Next.js |
| Auth tenant/guardian; reject admin | **PASS** |
| Screens present (profile, leaves, attendance, notifications, invoice detail, meals categories) | **PASS** (prior "missing MVP screens" claims **stale**) |
| Depth | **B+** overall -- see [features/FLUTTER_PORTAL.md](./features/FLUTTER_PORTAL.md) |
| Half-baked residual | P2 polish only; P1-AUTH-PW / flags / leave cancel / unread **FIXED** |

---

## Lifecycle (code + UI)

| Flow | Status |
|------|--------|
| Tenant create + temp password | **PASS** |
| Transfer atomic + 409 | **PASS** |
| Checkout frees bed / reinstate | **PASS** (`parseApiError` on FE) |
| Invoice generate + offline pay → paid | **PASS** |
| Invoice list delete paid | **PASS** -- CTA hidden when paid |
| Payment new from tenant deep-link | **PASS** -- tenantId prefill |
| Enquiry convert to tenant | **PASS** -- marks converted |
| Electricity finalize/distribute | **PASS** with share math residual |
| Visitor expected → arrive → depart | **PASS** (PUT status free-set closed) |
| Leave approve/reject with body | **PASS** |
| Floor create → services grid populated | **PASS** -- ServiceStatus seed on floor create |
| Notice floor/room → tenant feed | **PASS** -- room/floor resolved from tenant doc |
| Dashboard badges unread count | **PASS** -- uses `unreadBy`; SSE `badges-update` emitted |

---

## Ordered fix queues for later sub-agents

> Derived from feature MD Open gaps after normalize (2026-07-16). **Open P1 master table is AUTO-generated** -- do not hand-edit FIXED into it.

### Queue A -- Domain residuals (P2)

1. ST-2/ST-3 amenity isPerFloor flip/delete migration
2. Seed key polish (SV-6 / FL-6 if still open as P2)

### Queue B -- Integrity -- **DONE**

P1-T1, P1-T2/G1, P1-V1, CMP-authz, N1/N2, SV-1, FL-1 -- closed in source.

### Queue C -- FE P2 polish

1. INV-P2-*, PAY-P2-*, RM-*, FL-2.., form polish
2. Assets/low-stock/service-due P2

### Queue D -- Flutter residual -- **DONE** (P1)

P1-AUTH-PW, flag prefetch, unread badge, leave cancel closed. Residual F5+ notification polish is P2.

### Queue E -- True open product work

1. ~~ELEC-P1-1~~ **FIXED** earlier
2. FLAG-menus always-on -- **documented product decision** (not open P1)
3. Notification F5+ / seed attendance default -- P2 / deferred product

---


## Closed / do-not-refile (selection)

| Old claim | Truth |
|-----------|-------|
| Soft-delete room leaves Floor.totalRooms stale | **FIXED** -- rooms DELETE recomputes |
| Room forms show per-floor services as room amenities | **FALSE** -- filter `!isPerFloor` |
| Settings strips amenityDefinitions | **FIXED** |
| Settings youtube not in API | **FIXED** -- full stack persists |
| Only laundry feature-flagged | **FALSE** -- six flags gated on API |
| CommandPalette ignores flags | **FIXED** -- same map as Sidebar |
| Invoice list delete always shown for paid | **FIXED** -- gated |
| Payments `?tenantId=` ignored | **FIXED** -- prefill |
| Dashboard badges `readBy` | **FIXED** -- `unreadBy` |
| Enquiry convert dead pipeline | **FIXED** -- enquiryId + converted |
| Tenant FE lifecycle generic errors only | **FIXED** -- parseApiError |
| Assets hard-delete copy / date clear | **FIXED** -- Retire modal + empty-string dates |
| Notices free-text targetIds | **FIXED** -- ResourceSelect |
| Notification badges F4 readBy | **FIXED** with D1 unreadBy |
| Flutter missing profile/leaves/attendance/notifications | **FALSE** -- screens exist |
| Build tenant portal in Next.js | **FORBIDDEN** -- Flutter only |
| Missing CRUD pages for core modules | **FALSE** -- full admin matrix present |
| P0 transfer / isActive / temp password / visitor filter | **FIXED** |

---

## Documentation map

| File | Role |
|------|------|
| [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) | This ranked backlog (authoritative for open gaps) |
| [README.md](./README.md) | Executive audit summary |
| [features/*.md](./features/) | Per-module field/form/lifecycle audits (Last verified 2026-07-16) |
| [interconnections/*.md](./interconnections/) | Cross-module flows |
| [fe-batch1-audit.md](./fe-batch1-audit.md) etc. | **Superseded** point-in-time notes -- use feature MDs + this file |
| [../AGENT_CONTEXT.md](../AGENT_CONTEXT.md) | Product split |
| [../PORTAL_CONNECTIVITY.md](../PORTAL_CONNECTIVITY.md) | CORS / auth / clients |

---

## How later fix agents should work

1. Pick a queue item and open the linked **feature MD** (field matrix + acceptance checklist).
2. Re-read the cited source files before editing (code may have moved).
3. Fix API then FE (or Flutter) in that order when contracts change.
4. Mark gap **FIXED** in the feature MD + this inventory with date and proof path.
5. Do not re-open closed P0s or reconcile-closed P1s without a re-broken source citation.
