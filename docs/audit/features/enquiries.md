# Enquiries -- Feature Audit

**Last verified:** 2026-07-16  
**Grade:** **A-**  
**Priority of remaining work:** P2 polish (convert pipeline closed)

Code is truth. Prior audit claimed no full `PUT /:id` (edit 404) and loose status enums; both are fixed in source.

---

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/enquiry.ts` |
| Routes | `apps/api/src/routes/enquiries.ts` (mounted `/api/v1/enquiries`) |
| Types | `packages/types/src/enquiry.ts` |
| Admin list | `apps/web/src/app/(admin)/enquiries/page.tsx` |
| Admin detail | `apps/web/src/app/(admin)/enquiries/[id]/page.tsx` |
| Admin new | `apps/web/src/app/(admin)/enquiries/new/page.tsx` |
| Admin edit | `apps/web/src/app/(admin)/enquiries/[id]/edit/page.tsx` |
| Public landing | `apps/web/src/app/page.tsx` (unauthenticated POST) |
| Convert handoff | Detail -> `/tenants/new?name&phone&email&source=enquiry&enquiryId=...` |
| Flutter | **None** (lead capture is public web + admin; correct) |
| HTTP smoke | `apps/api/src/__tests__/module-http-e2e.test.ts` (create/edit/list/delete) |
| Dashboard | Recent enquiries + pending count on admin dashboard / sidebar badge |

---

## Model truth

| Field | Constraints | Notes |
|-------|-------------|-------|
| `name` | required, trim, max 100 | |
| `phone` | required, `/^\+91[6-9]\d{9}$/` | |
| `email` | optional, lowercase | |
| `preferredSharing` | enum **`2 \| 3 \| 4 \| single`** required | |
| `message` | max 1000, default `''` | |
| `status` | `new \| contacted \| converted \| lost`, default `new` | |
| `source` | `landing_page \| referral \| walk_in \| phone_call \| other`, default `landing_page` | |
| `notes` | max 1000, default `''` | staff notes |
| timestamps | **createdAt only** (`updatedAt: false`) | Detail page may show `updatedAt` -- **always empty** |

Indexes: status, createdAt desc.

---

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/` | **public** + `publicLimiter` | Create; optional source (default landing_page); preferredSharing required |
| GET | `/` | admin | status, fromDate, toDate; pagination; sort createdAt desc |
| GET | `/:id` | admin | |
| PUT | `/:id/status` | admin | `{ status, notes? }` |
| PUT | `/:id` | admin | Full partial: name, phone, email, message, source, status, notes, preferredSharing |
| DELETE | `/:id` | admin | Hard delete |

### Enums (API Zod === model === @pg/types)

- Status: `new`, `contacted`, `converted`, `lost`
- Source: `landing_page`, `referral`, `walk_in`, `phone_call`, `other`
- preferredSharing: `2`, `3`, `4`, `single`

No transition FSM -- any status may be set anytime.

---

## FE page matrix (admin + public)

| Page | Verdict | Calls | Notes |
|------|---------|-------|-------|
| List | **PASS** | GET + DELETE | Status filter all four enums; StatusBadge; preferredSharing **not** in columns |
| Detail | **PASS** status | GET; PUT `/:id/status` for status only | Shows preferredSharing, notes; Convert to Tenant CTA |
| New | **PASS** | POST with source | normalizeInPhone; preferredSharing + source Select |
| Edit | **PASS** | GET; full PUT `/:id` | preferredSharing, source, status, notes; pipeline status hints |
| Landing contact | **PASS** | public POST | preferredSharing native `<select>` values 2/3/4/single; phone validation client-side |

### Convert to tenant (detail)

Builds:

```
/tenants/new?name=...&phone=...&email=...&source=enquiry&enquiryId=...
```

`tenants/new` reads **name, phone, email** plus **`enquiryId`**. After successful tenant create it best-effort `PUT enquiries/:id/status` with `converted` and redirects to the enquiry when `enquiryId` was present.

---

## Field coverage

| Field | Model | Public POST | Admin new | Admin edit | Admin detail | List |
|-------|:-----:|:-----------:|:---------:|:----------:|:------------:|:----:|
| name | Y | Y | Y | Y | Y | Y |
| phone | Y | Y | Y (+91) | Y | Y | Y |
| email | Y | optional | Y | Y | Y | Y |
| preferredSharing | Y | Y | Y | Y | Y | **N** |
| message | Y | Y | Y | Y | Y | **N** |
| source | Y | default landing | Y | Y | Y | Y |
| status | Y | default new | -- | Y | Y form | Y + filter |
| notes | Y | -- | -- | Y | Y read | **N** |
| updatedAt | **N** | -- | -- | -- | shown if truthy (never) | -- |

---

## Lifecycle

```
Public landing / admin POST -> status=new, source set or landing_page
  -> admin PUT status or full: contacted
  -> admin PUT: converted | lost (no validation of order)
  -> optional "Convert to Tenant" -> tenants/new prefill + mark converted
DELETE hard remove
```

Suggested pipeline on edit UI (hints only, not enforced):

- new -> mark contacted after outreach
- contacted -> converted if becomes tenant
- converted / lost terminal hints

---

## Design

| Rule | Status |
|------|--------|
| FormPage stack | New + edit |
| StatusBadge | List + detail |
| Themed Select | Admin forms + list filter |
| Landing preferredSharing | **Native select** (marketing page exception) |
| Tokens | Admin yes |
| mobileCardRenderer | List yes (delete hidden on mobile card only; desktop table has delete) |

---

## Open gaps (ordered)

### P0

_None._ Full PUT exists; preferredSharing and status enums align FE/API/model; public create works; detail status endpoint works.

### P1

_None open for convert pipeline._ `tenants/new` reads `enquiryId`, prefills contact fields, and on successful create calls `PUT enquiries/:id/status` with `converted` (best-effort toast if status update fails).

### P2

2. Detail status form omits **notes** though `PUT /:id/status` accepts notes; staff must use edit page for notes.
3. Model `updatedAt: false` vs detail "Last updated" -- enable updatedAt or remove the row.
4. No status transition guards (e.g. converted -> new allowed); add only if product requires linear pipeline.
5. List column for preferredSharing (useful for bed planning).
6. Landing page native select -> themed control if marketing redesign allows.
7. SSE `new_enquiry` type unused on create (dashboard relies on poll/refresh).
8. Mobile list card hides delete while desktop allows -- intentional inconsistency? Align if desired.

### P3

9. Search by name/phone on list (API has no search query today).
10. Rate-limit / abuse metrics for public POST beyond publicLimiter defaults.

---

## Closed (verified 2026-07-16 -- do not re-file)

| Prior claim | Live status |
|-------------|-------------|
| Edit `PUT enquiries/:id` 404 (status-only API) | **FIXED** -- full `updateEnquirySchema` + PUT `/:id` |
| Status enum FE/model drift | **FIXED** -- new/contacted/converted/lost everywhere |
| preferredSharing mismatch | **FIXED** -- `2/3/4/single` on model, Zod, new, edit, landing |
| Design Select native on admin | **FIXED** for admin CRUD (Radix Select); landing still native |
| Convert ignores enquiryId / never marks converted | **FIXED** -- `tenants/new` consumes enquiryId + PUT status converted |

---

## Acceptance checklist

- [x] Public landing creates enquiry with preferredSharing + phone +91
- [x] Admin list filters by all four statuses
- [x] Admin new with source walk_in/phone/etc. 201
- [x] Admin edit full body PUT 200 including preferredSharing + notes
- [x] Admin detail status PUT `/:id/status` 200
- [x] Admin hard delete
- [x] Convert to tenant marks enquiry converted (best-effort after create)
- [x] enquiryId query param consumed on `tenants/new`
- [ ] Notes editable from detail status form (optional)
- [ ] updatedAt accurate or not shown

---

## Remediation log

- **2026-07-16:** Full source re-audit. Grade **A-**. Prior P0 full-PUT and enum claims closed.
- **2026-07-16 reconcile:** Convert pipeline **CLOSED** (`enquiryId` + status converted on tenant create). Residual P2: notes-on-status, updatedAt, optional FSM.
- **Earlier:** Batch A added full PUT and preferredSharing enum alignment (confirmed present).
