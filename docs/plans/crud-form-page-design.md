# CrudFormPage design (evidence pack for plan step 3.1)

Status: research complete, implementation NOT started (Gate P applies to the code changes
described here). This document is the design input for extracting a shared CRUD form shell
over the admin form pages.

Evidence base:

- Line counts are `wc -l` on the working tree, 2026-09-30, re-verified after the main
  thread landed `74894f6` (TanStack Query migration) and `143bc33` (decision records)
  during this review. The tree then held 68 modified + 2 untracked files; before those
  commits it held 144 modified + 5 untracked. Every row in sections 1.1/1.2 and every
  categorical claim in sections 1.3, 2 and 3 was re-checked against the post-commit tree
  and still holds (the migration touched 11 form pages but did not change their line
  counts, tiering, or read/write shape).
- Counts mostly drift 1-8 lines from the committed baseline quoted in
  `docs/plans/2026-09-29-depth-implementation-plan.md` (that plan was written against an
  earlier commit). Exceptions with larger drift: `settings` 1,371 -> 1,398, `invoices/new`
  784 -> 756, `floors/[id]/edit` 794 -> 806. Counts here supersede the plan's.
- Every claim below was read out of the source files under `apps/web/src/`, not inferred from
  the plan.
- Stack as installed: `next@16.3.4`, `react@19.2.4`, `react-hook-form@^7.54.0`,
  `@hookform/resolvers@^3.9.0`, `zod@^3.24.0`, `@tanstack/react-query@^5.62.0`
  (from `apps/web/package.json`).

---

## 1. Cohort inventory (verified)

There are exactly **40 new/edit form pages** under `apps/web/src/app/(admin)/`
(20 modules x {new, edit}). "Fields" = distinct `register('x')` names + `<Controller>`
count (approximate upper bound; a few controllers duplicate a registered name).
"Effects" = actual `useEffect(` call sites (imports excluded).

### 1.1 Create pages (20)

| Page                   | Lines |                     Fields | Effects | Load / extra data                                                                                                                             | Write                                                | After success                                  | Tier                |
| ---------------------- | ----: | -------------------------: | ------: | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- | ------------------- |
| `laundry/new`          |   154 |                          5 |       0 | none                                                                                                                                          | POST `laundry-slots`                                 | `/laundry`                                     | A                   |
| `meals/new`            |   160 |                          6 |       0 | none                                                                                                                                          | POST `meals`                                         | `/meals`                                       | A                   |
| `washing-machines/new` |   165 |                          6 |       0 | none                                                                                                                                          | POST `washing-machines`                              | `/washing-machines`                            | A                   |
| `enquiries/new`        |   185 |                          7 |       0 | none                                                                                                                                          | POST `enquiries`                                     | `/enquiries`                                   | A                   |
| `attendance/new`       |   229 |                          7 |       0 | none                                                                                                                                          | POST `attendance/manual`                             | `/attendance`                                  | A                   |
| `notices/new`          |   241 |                          5 |       0 | none                                                                                                                                          | POST `notices`                                       | `/notices`                                     | A                   |
| `services/new`         |   240 |                          4 |       1 | GET `app-config` (effect, service-type options); GET `floors?limit=100` runs inside submit when "apply to all"                                | POST `services` (1, or one per floor)                | `/services`                                    | B                   |
| `guardians/new`        |   279 |                          5 |       0 | `useSearchParams` prefill + GET `tenants/:id` on select                                                                                       | POST `guardians`                                     | dialog first, then `/guardians`                | B                   |
| `assets/new`           |   326 |                         12 |       0 | none                                                                                                                                          | POST `assets`                                        | `/assets/:id` else `/assets`                   | A                   |
| `leaves/new`           |   310 |                          4 |       0 | GET `tenants/:id` on tenant change (host preview panel)                                                                                       | POST `leaves`                                        | `/leaves/:id` else `/leaves`                   | A                   |
| `menus/new`            |   307 |             4 field arrays |       0 | `useSearchParams` prefill                                                                                                                     | POST `menus`                                         | `/menus`                                       | B                   |
| `visitors/new`         |   361 |                          5 |       0 | GET `tenants/:id` on tenant change (host preview panel)                                                                                       | POST `visitors`                                      | `/visitors/:id` else `/visitors`               | A                   |
| `floors/new`           |   451 | 3 + dynamic amenity fields |       2 | GET `app-config` + GET `floors`, then `reset()` of async-built defaults                                                                       | POST `floors`                                        | `/floors`                                      | B                   |
| `complaints/new`       |   430 |                          7 |       2 | `useSearchParams` prefill + GET `tenants/:id` (room autofill)                                                                                 | POST `complaints`                                    | `/complaints/:id` else `/complaints`           | B                   |
| `rooms/new`            |   404 |                          6 |       2 | `useSearchParams` + `app-config` (photo URL rules)                                                                                            | POST `rooms`                                         | `/rooms`                                       | B                   |
| `electricity/new`      |   466 |            6 + field array |       0 | GET `rooms?limit=100` (populate button)                                                                                                       | POST `electricity` then POST `electricity/:id/image` | `/electricity` (or detail when upload fails)   | excluded            |
| `payments/new`         |   671 |                          4 |       3 | 3 x `useApiQuery` (tenant, dues, invoices)                                                                                                    | POST `payments`                                      | `/payments/:id` else `/payments`               | excluded            |
| `tenants/new`          |   576 |                         19 |       1 | `useSearchParams` prefill; in-page reads: 1 GET `rooms/:id` on room change (plus reads inside `OccupancyBedPicker`/`ResourceSelect` children) | POST `tenants`                                       | `/enquiries/:enquiryId` else `/tenants`        | excluded            |
| `invoices/new`         |   756 |   n/a (no react-hook-form) |       0 | 3 x `useApiQuery`, manual line-item state                                                                                                     | POST `invoices`                                      | `/invoices/:id` else `/invoices`               | excluded            |
| `notifications/new`    |    18 |                          0 |       1 | none                                                                                                                                          | none (redirect stub)                                 | `router.replace('/notifications?tab=compose')` | excluded (plan 3.2) |

### 1.2 Edit pages (20)

| Page                         | Lines |                 Fields | Effects | Load / extra data                                                 | Write                                            | After success                                                                        | Tier                              |
| ---------------------------- | ----: | ---------------------: | ------: | ----------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------- |
| `laundry/[id]/edit`          |   200 |                      5 |       1 | GET `laundry-slots/:id`                                           | PUT                                              | `/laundry`                                                                           | A                                 |
| `guardians/[id]/edit`        |   210 |                      6 |       1 | GET `guardians/:id`                                               | PUT (whitelisted payload)                        | `/guardians`                                                                         | A                                 |
| `services/[id]/edit`         |   212 |                      3 |       1 | GET `services/:id` + GET `app-config` (parallel)                  | PUT `services/:id/full`                          | `/services`                                                                          | B                                 |
| `washing-machines/[id]/edit` |   234 |                      5 |       1 | GET `washing-machines/:id`                                        | PUT                                              | `/washing-machines`                                                                  | A                                 |
| `meals/[id]/edit`            |   246 |                      5 |       1 | GET `meals/:id`                                                   | PUT                                              | `/meals`                                                                             | A                                 |
| `notices/[id]/edit`          |   277 |                      5 |       1 | GET `notices/:id`                                                 | PUT                                              | `/notices`                                                                           | A                                 |
| `enquiries/[id]/edit`        |   294 |                      8 |       1 | GET `enquiries/:id`                                               | PUT                                              | `/enquiries`                                                                         | A                                 |
| `complaints/[id]/edit`       |   320 |                      7 |       1 | GET `complaints/:id`                                              | PUT                                              | `/complaints`                                                                        | A                                 |
| `attendance/[id]/edit`       |   328 |                      5 |       1 | GET `attendance/:id`; duplicate-check GET inside submit           | PUT                                              | `/attendance/:id`                                                                    | A                                 |
| `notifications/[id]/edit`    |   327 |                      5 |       1 | GET `notifications/:id`                                           | PUT                                              | `/notifications?tab=history`                                                         | A                                 |
| `menus/[id]/edit`            |   337 |         4 field arrays |       1 | GET `menus/:id`                                                   | PUT                                              | `/menus`                                                                             | B                                 |
| `leaves/[id]/edit`           |   333 | 0 (no react-hook-form) |       1 | GET `leaves/:id`                                                  | PUT `leaves/:id/approve` + PUT `leaves/:id`      | `/leaves/:id`                                                                        | excluded (workflow page)          |
| `assets/[id]/edit`           |   466 |                     12 |       1 | GET `assets/:id`                                                  | PUT + DELETE `assets/:id` (retire, ConfirmModal) | `/assets/:id` or `/assets`                                                           | B                                 |
| `rooms/[id]/edit`            |   429 |                      7 |       1 | GET `rooms/:roomId` + `app-config`                                | PUT                                              | `/rooms/:roomId`                                                                     | B                                 |
| `visitors/[id]/edit`         |   407 |                      4 |       1 | GET `visitors/:id`                                                | PUT                                              | `/visitors/:id`                                                                      | A                                 |
| `payments/[id]/edit`         |   376 |                      5 |       1 | GET `payments/:id`                                                | PUT, blocked when paid                           | `/payments/:id`                                                                      | excluded (own dirty guard + lock) |
| `invoices/[id]/edit`         |   437 |                      5 |       1 | GET `invoices/:id`                                                | PUT, blocked when paid                           | `/invoices/:id`                                                                      | excluded (own dirty guard + lock) |
| `electricity/[id]/edit`      |   494 |        6 + field array |       1 | GET `electricity/:id`                                             | PUT + image upload                               | `/electricity/:id`                                                                   | excluded (deep)                   |
| `tenants/[id]/edit`          |   704 |                     35 |       1 | GET `tenants/:id` + GET `rooms/:roomId` on change                 | PUT (nested payload builder)                     | `/tenants/:id`                                                                       | excluded (deep)                   |
| `floors/[id]/edit`           |   806 |                      2 |       1 | GET `floors/:id` + 4 more (`app-config`, floors, rooms, machines) | PUT `floors/:id`                                 | `/floors` (its other 10 `router.push` sites are embedded room/machine panel actions) | excluded (do-not-regress)         |

### 1.3 Verified cohort totals

| Bucket                                                   |  Pages | Definition                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form pages that exist                                    |     40 | 20 modules x new+edit                                                                                                                                                                                                                       |
| Enumerated in plan section 4.3 as "cohort"               |     35 | plan list, mislabeled "(14)"                                                                                                                                                                                                                |
| **Tier A: strict clone signature (first-cut target)**    | **19** | inline zod schema + `useForm` + `FormPage`/`FormCard`/`FormActions`, <= 1 effect (edit = load only, create = 0), no `useSearchParams`, no `useFieldArray`, no post-create dialog, redirect expressible as one string or created-id fallback |
| Tier B: shell-compatible, needs one extra slot or config |     10 | prefill, second load, footer actions, deferred redirect, dynamic schema                                                                                                                                                                     |
| Excluded from CrudFormPage                               |     11 | deep pages, hand-rolled pages, the no-form workflow page, non-form pages (list in section 6)                                                                                                                                                |
| Uses no react-hook-form at all                           |      3 | `invoices/new`, `leaves/[id]/edit`, `notifications/new`                                                                                                                                                                                     |
| Uses `FormPage`                                          |     38 | all form pages except `invoices/new` and `notifications/new`                                                                                                                                                                                |
| Uses `FormCard`                                          |     38 | all except `invoices/new` and `notifications/new`                                                                                                                                                                                           |
| Uses TanStack `useMutation`                              |      0 | repo-wide; submits are hand-rolled `onSubmit` everywhere                                                                                                                                                                                    |
| Uses `useApiQuery` for the edit-form load                |      0 | the edit-fetch effect is the last un-migrated read path                                                                                                                                                                                     |

Tier A exact list (19):

- create: `assets/new`, `attendance/new`, `enquiries/new`, `laundry/new`, `leaves/new`,
  `meals/new`, `notices/new`, `visitors/new`, `washing-machines/new`
- edit: `attendance/[id]/edit`, `complaints/[id]/edit`, `enquiries/[id]/edit`,
  `guardians/[id]/edit`, `laundry/[id]/edit`, `meals/[id]/edit`, `notices/[id]/edit`,
  `notifications/[id]/edit`, `visitors/[id]/edit`, `washing-machines/[id]/edit`

Tier B exact list (10): `complaints/new`, `floors/new`, `guardians/new`, `menus/new`,
`rooms/new`, `services/new`, `assets/[id]/edit`, `menus/[id]/edit`, `rooms/[id]/edit`,
`services/[id]/edit`.

### 1.4 Plan assumptions that did not survive the code

1. **"Template-clone cohort (14)" vs 35 enumerated vs "~25 pages" retired (step 3.1).**
   Three different numbers in one section. The tree has 40 form pages; the strict clone
   signature matches 19. Plan step 3.1 should say 19 first-cut, 10 after slot review.
2. **The section 4.3 list is a shallow-score list, not an extraction-safe list.** It includes
   `floors/new` (async schema built from `app-config` + live preview + collision detection),
   `tenants/new` (room/bed picker + lease passport + temp-credentials dialog +
   search-params prefill), `electricity/new`
   (field array, file upload, two-request submit with partial-failure redirect),
   `tenants/edit` (35 fields, nested payload builder, 2 upload widgets), `payments/edit` and
   `invoices/edit`
   (hand-rolled dirty guards). Extracting from these first is exactly the risk the plan's
   own risk table warns about.
3. **`leaves/[id]/edit` is in the cohort but has no form.** Zero `register`/`Controller`
   calls; it is an approve/reject workflow page (`useState adminNotes`, two PUTs, conditional
   footers). It can consume the chrome, never the form machinery.
4. **Five pages are missing from the enumeration with no stated reason:**
   `electricity/[id]/edit`, `floors/[id]/edit`, `payments/new`, `invoices/new`,
   `notifications/new`. (Three of the five are covered elsewhere in the plan --
   `floors/edit` in the do-not-regress list, `invoices/new` in the hand-rolled list,
   `notifications/new` in the stub note -- `electricity/[id]/edit` and `payments/new`
   are not mentioned at all.)
5. **"1 nav" is true only for the back/cancel pair.** 17 pages choose their post-save
   redirect dynamically (created-id fallback, detail id, or query-param target) and 1 page
   uses `router.replace`. `floors/[id]/edit` is a page-within-a-page: of its 11
   `router.push` call sites only 1 is the save redirect; the other 10 drive an embedded
   room/machine management panel.
6. **"0 cross-module links" holds for `<Link>` in 30 of 40 pages** (10 pages import
   `<Link>`), but cross-module _navigation_ exists via `router.push` (`payments/new ->
   /invoices/new?tenantId=`, `floors/[id]/edit -> /services`, `/washing-machines`,
   `/rooms/new?floorId=`), and cross-module _data_ references are ubiquitous through
   `ResourceSelect`. Breadcrumbs are also not absent: `components/admin/Breadcrumbs.tsx`
   renders route-derived labels globally from `(admin)/layout.tsx`.
7. **`PageShell` is dead code.** `apps/web/src/components/ui/PageShell.tsx` (69 lines,
   "shared page wrapper for list/detail admin pages") has **0 importers** in `apps/web/src`.
   CrudFormPage must not become a second orphan; decide fold-or-delete during Wave 0.

---

## 2. Shared form infrastructure that already exists

The design extends this stack; it must not duplicate it.

| Component / hook                                           | File                                                  | Current API                                                                                                                                                                                                                                       | Current users                                                                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FormPage`                                                 | `apps/web/src/components/ui/FormPage.tsx` (117 lines) | `{ title, description?, backHref?, error?, isLoading?, actions?, badge?, maxWidth?, children }`. When `isLoading` it renders header + card skeleton INSTEAD of children; otherwise `PageHeader` + `ErrorBanner` + max-width wrapper.              | 38 of 40 form pages (all but `invoices/new`, `notifications/new`); also all detail `page.tsx` files                                                                                               |
| `FormCard`                                                 | `components/ui/FormCard.tsx` (96 lines)               | `{ title?, description?, footer?, onSubmit?, id?, fullWidth?, children }`. Renders `<motion.form>` when `onSubmit` given, else `motion.div`; sticky footer slot.                                                                                  | every form page except `invoices/new`, `notifications/new`                                                                                                                                        |
| `FormActions`                                              | `components/ui/FormActions.tsx` (86 lines)            | `{ loading?, disabled?, submitLabel?, cancelHref?, onCancel?, cancelLabel?, hideCancel?, leading?, hideSubmit?, submitIcon?, divided? }`. Cancel = `router.push(cancelHref)` or `onCancel` override (falls back to `router.back()` when neither). | the 38 `FormPage` form pages' footers                                                                                                                                                             |
| `FormSection` / `FormGrid` / `FormFullWidth`               | `components/ui/FormSection.tsx`                       | `{ title?, description?, icon?, divided?, action?, children }`                                                                                                                                                                                    | 38 of 40 form pages                                                                                                                                                                               |
| `PageHeader`                                               | `components/ui/PageHeader.tsx`                        | back button + title + description + `action`/`badge` slots (used directly by `invoices/new`)                                                                                                                                                      | via `FormPage`; directly by `invoices/new`                                                                                                                                                        |
| `ErrorBanner`                                              | `components/ui/ErrorBanner.tsx`                       | `message` string banner (inside `FormPage`)                                                                                                                                                                                                       | via `FormPage`                                                                                                                                                                                    |
| Skeletons                                                  | `components/ui/Skeleton.tsx`                          | `HeadingSkeleton`, `ShimmerBlock`, `FormFieldSkeleton` (used by `FormPage` loading state)                                                                                                                                                         | via `FormPage`                                                                                                                                                                                    |
| `DetailCard` / `DetailList` / `DetailRow`                  | `components/ui/DetailCard.tsx`                        | context panels above/around forms (`variant: default/warning/danger/success/info`)                                                                                                                                                                | 9 form pages: `assets/edit` (3 panels incl. danger zone), `assets/new`, `attendance/edit`, `complaints/edit`, `floors/edit`, `laundry/edit`, `leaves/edit`, `meals/edit`, `washing-machines/edit` |
| `useApiQuery` / `useApiBodyQuery`                          | `apps/web/src/hooks/useApiQuery.ts`                   | `(queryKey, path, options?)` -> `UseQueryResult<T, ApiQueryError>`; unwraps `{ success, data }`. Doc comment says it exists to replace exactly the hand-rolled fetch effect.                                                                      | 39 list/detail/settings pages + 2 create form pages (`invoices/new`, `payments/new`, for dependent reads); **0 edit-form loads**                                                                  |
| `queryData` / `queryJson` / `errorMessage` / `shouldRetry` | `apps/web/src/lib/query.ts`                           | `ApiQueryError { message, code, status }`, retry once for network/5xx, never for 4xx                                                                                                                                                              | via `useApiQuery`                                                                                                                                                                                 |
| `useUnsavedGuard`                                          | `apps/web/src/hooks/useUnsavedGuard.ts`               | `useUnsavedGuard(isDirty)` -> `beforeunload` listener; `useUnsavedGuardState(isDirty)` -> `{ isDirty, guardOpen, confirmLeave, requestLeave, cancelLeave }` for an in-app confirm modal                                                           | `payments/[id]/edit`, `invoices/[id]/edit` only (`settings` hand-rolls its own `window.confirm` on tab change; it does not import this hook)                                                      |
| `parseApiError`                                            | `apps/web/src/lib/errorParser.ts`                     | ky error -> `{ message, code }`                                                                                                                                                                                                                   | every form page with a submit handler (39/40; the stub has none)                                                                                                                                  |
| `ConfirmModal`, `EmptyState`, `ErrorState`, `DataTable`    | `components/ui/*`                                     | modal / list states / table                                                                                                                                                                                                                       | list + detail pages                                                                                                                                                                               |
| `PageShell`                                                | `components/ui/PageShell.tsx` (69 lines)              | list/detail wrapper (title, actions, error, children)                                                                                                                                                                                             | **0 users (orphan)**                                                                                                                                                                              |

Design consequence: `FormPage` already owns chrome, loading skeleton and error banner, and
`FormCard`/`FormActions` already own the card and footer. `CrudFormPage` therefore adds only
the _lifecycle_ layer (load, submit, redirect, dirty guard) and wires those three existing
components together. Anything it renders itself that `FormPage` already renders would be a
duplicate.

---

## 3. Intersection / divergence matrix

### 3.1 Genuinely identical across the clone cohort (shell-owned)

| Concern          | Evidence (pattern repeated in every Tier A page)                                                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page chrome      | `<FormPage title description backHref error>` with `backHref` = the parent list on create; on edit it is the entity detail route on 8 pages and the list on 12; `maxWidth` is explicit on 29 of 40 form pages (`3xl`/`4xl`/`5xl`/`full`) and left at FormPage's `2xl` default on the other 11 -- per-page config          |
| Loading          | Tier A creates: no loading state at all; edits: `useState(true)` + `setIsLoading(false)` in both then/catch + `isLoading={isLoading}` -> 3-5 lines (3 Tier B creates -- `complaints/new`, `rooms/new`, `floors/new` -- do add a loading state for their prefill reads)                                                    |
| Error            | `const [submitError, setSubmitError] = useState('')`, cleared at submit start, set from `parseApiError(err).message` in catch, rendered via `FormPage error` (present in 39/40 pages; only the stub lacks it)                                                                                                             |
| Submit           | `onSubmit = async (data) => { setSubmitError(''); try { await api.post/put(...); router.push(target) } catch { setSubmitError(...) } }`                                                                                                                                                                                   |
| Footer           | `<FormActions loading={isSubmitting} cancelHref={list} submitLabel="..." divided={false} />` inside `FormCard footer`                                                                                                                                                                                                     |
| Form state       | `useForm({ resolver: zodResolver(schema) })` in 37/40 pages, with the zod schema declared **in the same page file** in every case; `floors/new` builds it at runtime from config (`buildSchema(perFloorAmenities)`); the 3 non-RHF pages are excluded                                                                     |
| Reset after load | edit pages call `reset(mappedEntity)` inside the load effect, then clear loading                                                                                                                                                                                                                                          |
| Nav              | back button (via `PageHeader`) + cancel button (via `FormActions`) pointing at the same parent route; 12 edit pages use the list route as `backHref`, 8 use the entity detail route; breadcrumbs already render globally from `(admin)/layout.tsx` via `components/admin/Breadcrumbs.tsx` (route-derived, no page config) |
| Dirty guard      | **absent in 38/40 form pages** (only `payments/edit` and `invoices/edit` have one, via `useUnsavedGuardState`; `settings` hand-rolls `window.confirm` but is not a form page). This is a gap the shell fills, not a behavior to preserve                                                                                  |

### 3.2 Legit divergence (props and slots, never absorbed logic)

| Divergence                                                                           | Pages that need it                                                                                                                                                                                                       | Where it goes                                                                                                                                                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content above the card (context panel, status chip, lock banner)                     | `laundry/edit`, `attendance/edit`, `complaints/edit`, `meals/edit`, `washing-machines/edit` (DetailCard before FormCard); `payments/edit` (paid-lock banner); `leaves/edit` + `floors/edit` (excluded pages, same shape) | `preflight` slot (ReactNode)                                                                                                                                                |
| Side column beside the card (not above it)                                           | `assets/[id]/edit` (grid `[1fr_300px]`: sticky summary + service timeline + "Danger zone" retire panel beside the form; also passes a live `StatusBadge` to `FormPage badge`)                                            | page-level layout via a `card` wrapper slot + `headerBadge` passthrough; the retire action stays a `children`/column concern (it lives in the column today, not the footer) |
| Content inside the card body (belongs to `children`, not a slot)                     | `visitors/edit` (cross-module `/tenants/:id` link in the body), `tenants/edit` (inactive lock banner rendered inside FormCard)                                                                                           | `children`                                                                                                                                                                  |
| Header badge / actions                                                               | `assets/[id]/edit` is the only form page passing `badge`; `headerActions` is unused on form pages (detail pages use their equivalents)                                                                                   | `headerBadge` / `headerActions` passthrough to `FormPage`                                                                                                                   |
| Footer extras left of Cancel (approve/reject)                                        | `leaves/[id]/edit` only -- the single form page passing `FormActions leading`                                                                                                                                            | `footerLeading` slot; full `footer` override for the no-RHF workflow page                                                                                                   |
| Redirect after create to detail vs list                                              | `assets/new`, `complaints/new`, `leaves/new`, `visitors/new`, `payments/new`, `invoices/new`                                                                                                                             | `submit()` returns `{ redirectTo }`; shell falls back to `redirectTo` prop                                                                                                  |
| Redirect decided by query params                                                     | `tenants/new` (`afterCreateHref` from `enquiryId`)                                                                                                                                                                       | page computes `redirectTo` before calling; or returns its own string                                                                                                        |
| Redirect deferred until a dialog closes                                              | `guardians/new` (temp credentials dialog)                                                                                                                                                                                | `submit()` returns `{ redirectTo: null }` = "page navigates itself"                                                                                                         |
| Search-params prefill (needs `<Suspense>`)                                           | `complaints/new`, `guardians/new`, `menus/new`, `rooms/new`, `payments/new`, `invoices/new`, `tenants/new`                                                                                                               | stays in the page (Suspense wrapper is page-level; Next requires it for `useSearchParams` prerender)                                                                        |
| Second/parallel loads before the form is usable                                      | `services/edit` (entity + `app-config` in one `Promise.all`), `floors/new` (`app-config` + `floors`), `rooms/new` (`app-config`)                                                                                         | `load.prefetch[]` declared on the shell, or the page keeps its own read                                                                                                     |
| Dependent lookup on a field change (inline host preview panel)                       | `leaves/new`, `visitors/new` (GET `tenants/:id` in `onTenantChange`)                                                                                                                                                     | stays in the page (`setValue` + local preview state); the shell is agnostic                                                                                                 |
| Extra work inside the submit handler (duplicate check, per-floor POST loop)          | `attendance/edit`, `services/new`                                                                                                                                                                                        | stays inside the page's `submit` callback (page-owned, shell-agnostic)                                                                                                      |
| Derived readouts and cross-field UI (duration, reconcile warning, collision preview) | `attendance/new`, `electricity/new`, `floors/new`, `assets/edit`                                                                                                                                                         | `children` (page scope keeps `useWatch`/`watch`)                                                                                                                            |
| Field arrays                                                                         | `menus/*`, `electricity/*`                                                                                                                                                                                               | `useFieldArray` stays in the page; shell is agnostic                                                                                                                        |
| Conditional sections / disabled-by-status                                            | `guardians/edit` (tenant select disabled), `tenants/edit` (active vs inactive), `payments/edit` (paid lock)                                                                                                              | `children` + `preflight`                                                                                                                                                    |
| Dirty-guard opt-out / custom dirty computation                                       | `payments/edit`, `invoices/edit`                                                                                                                                                                                         | `dirtyGuard={false}` or custom `isDirty` override (section 5.4)                                                                                                             |
| Schema built asynchronously from config                                              | `floors/new`                                                                                                                                                                                                             | page keeps owning `useForm`; shell only needs `reset` after load (section 5.3)                                                                                              |
| No react-hook-form at all                                                            | `invoices/new`, `leaves/edit`, `notifications/new`                                                                                                                                                                       | excluded from the form machinery; `leaves/edit` may use chrome-only mode                                                                                                    |

---

## 4. What the shell must NOT absorb (anti-goals, from the deepest forms)

Read in full: `tenants/[id]/edit` (704), `electricity/new` (466), `invoices/new` (756),
`payments/[id]/edit` (376), `floors/new` (451).

1. **Payload shaping.** `tenants/edit` builds a nested `verificationProfile` /
   `emergencyContact` / `localReferences` object with whitelist rules, ISO date conversion
   and an "omit room/bed when inactive" branch (lines 210-306). `guardians/edit` trims,
   normalizes phone and whitelists fields for a strict server schema. The shell receives a
   finished payload decision; it never maps form values to API bodies.
2. **Multi-request submit sequences.** `electricity/new` POSTs the bill, then conditionally
   POSTs the image, and on upload failure still redirects to the new detail route with a
   partial-success message. `services/new` POSTs once per floor in a loop. One
   `POST -> redirect` contract is the common case; sequences stay in the page callback.
3. **Submit blocking rules.** `electricity/new` blocks submit when room sum vs bill total
   diverges by more than 10,000 (with a warn-below threshold). Domain validation gates stay
   in page code (they may call `setSubmitError` via a returned message, but the rule lives
   with the page).
4. **Forcing react-hook-form.** `invoices/new` is deliberately hand-rolled: manual line-item
   state, "adjust during render" seeding from `useApiQuery` results, toasts, no zod. Do not
   convert it as a side effect of the shell.
5. **Owning the schema.** `floors/new` builds its zod schema from `app-config` amenity
   definitions at runtime and re-`reset()`s when async defaults arrive. Schemas stay
   page-owned (or, later, in `packages/types`), never inside the shell.
6. **Replacing the existing dirty guards.** `payments/edit` and `invoices/edit` compute
   `isDirty` with `useWatch` + `useMemo` against an `initial` snapshot, gate it on
   `!isPaidLocked && !isSubmitting`, and render a confirm modal plus an inline "unsaved"
   chip. The shell must accept `dirtyGuard={false}` until those pages are re-verified; do not
   silently change their semantics.
7. **Conditional section trees and lock banners.** `tenants/edit` swaps the whole room
   section by `isActive`; `payments/edit` renders a paid-lock warning with a detail link.
   These are `preflight`/`children` concerns.
8. **Cross-link DSL.** Cross-links in form bodies are plain `<Link>` inside panels (10 of
   40 pages import `<Link>`). Breadcrumbs already exist globally
   (`components/admin/Breadcrumbs.tsx`, route-derived, rendered in `(admin)/layout.tsx`).
   Ship the `preflight` slot; do not invent a per-page link/breadcrumb config -- none of
   the 40 pages asks for one.
9. **Anything under the four hand-rolled pages**: `settings` (1,398), `invoices/new` (756),
   `export` (441), `dashboard` (1,147), plus the `notifications/new` stub (handled by plan
   step 3.2).

---

## 5. Proposed `CrudFormPage` API

File: `apps/web/src/components/ui/CrudFormPage.tsx` (new). It composes the existing
`FormPage` + `FormCard` + `FormActions`; it does not re-render their markup.

### 5.1 Exact TypeScript surface

```ts
'use client';

import type { ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { FormPageProps } from '@/components/ui/FormPage';
import type { FormCardProps } from '@/components/ui/FormCard';

export type CrudMode = 'create' | 'edit';

/** One declared read the shell must complete before the form is interactive. */
export interface CrudLoad<TEntity = unknown, TValues extends FieldValues = FieldValues> {
  /** Cache identity, same rule as useApiQuery: every input that changes the response. */
  queryKey: QueryKey;
  /** Path relative to the admin API base, e.g. `laundry-slots/${id}`. */
  path: string;
  /** Entity -> form values. The shell feeds the result to form.reset(). */
  mapToValues: (entity: TEntity) => TValues;
  /** Extra reads to await alongside the entity (e.g. app-config). */
  prefetch?: ReadonlyArray<{ queryKey: QueryKey; path: string }>;
}

export interface CrudSubmitArgs<TValues extends FieldValues> {
  values: TValues; // already validated by the page's zodResolver
  mode: CrudMode;
}

export interface CrudSubmitResult {
  /**
   * - string: shell navigates here after the write
   * - undefined: shell uses the `redirectTo` prop
   * - null: page owns navigation (post-create dialog flows)
   */
  redirectTo?: string | null;
  /** Non-fatal message to show above the form (e.g. "saved, image upload failed"). */
  notice?: string;
}

export interface CrudFormPageProps<TValues extends FieldValues = FieldValues> {
  // --- chrome (delegated to FormPage) ---
  title: string;
  description?: string;
  /** Back button + Cancel target. List route on create, detail or list on edit. */
  backHref: string;
  maxWidth?: FormPageProps['maxWidth']; // default '2xl', matching FormPage
  headerActions?: ReactNode;
  headerBadge?: ReactNode;

  // --- form ownership stays in the page ---
  form: UseFormReturn<TValues>;

  // --- lifecycle ---
  mode: CrudMode;
  /** Required when mode === 'edit'; omit for create. */
  load?: CrudLoad<unknown, TValues>;
  /** Page-owned write. Payload shaping, extra GETs and multi-step writes live here. */
  submit: (args: CrudSubmitArgs<TValues>) => Promise<CrudSubmitResult | void>;
  /** Landing route: create default, and edit default when submit returns nothing. */
  redirectTo: string;
  submitLabel?: string; // default 'Save Changes'
  /** Default true on edit pages, false on create pages. */
  dirtyGuard?: boolean;

  // --- divergence slots ---
  /** Rendered between the header and the card (context panels, lock banners). */
  preflight?: ReactNode;
  /** Left of Cancel/Save (retire, approve, reject). */
  footerLeading?: ReactNode;
  /** Full footer replacement; receives nothing, caller wires form.handleSubmit itself. */
  footer?: ReactNode;
  card?: Pick<FormCardProps, 'title' | 'description' | 'className' | 'id'>;
  /** Render instead of the default ErrorBanner when the load fails. */
  loadErrorFallback?: ReactNode;

  children: ReactNode; // FormSections etc., built in page scope with register/control
  className?: string;
}
```

Typical Tier A create page after migration (shape, not final code):

```tsx
const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: {...} });

return (
  <CrudFormPage
    title="New Laundry Slot"
    description="Book a laundry slot for a tenant"
    backHref="/laundry"
    redirectTo="/laundry"
    submitLabel="Book Slot"
    mode="create"
    form={form}
    submit={async ({ values }) => {
      await api.post('laundry-slots', { json: values }).json();
    }}
  >
    <FormSection title="Resident" ...>
      ...
    </FormSection>
  </CrudFormPage>
);
```

Edit pages add `mode="edit"` and `load={{ queryKey: ['laundry-slots', id], path: \`laundry-slots/${id}\`, mapToValues }}`.

### 5.2 What it owns vs what it never touches

| CrudFormPage owns                                                                                              | CrudFormPage never touches                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `FormPage` chrome: title, description, back button, `maxWidth`, header slots                                   | zod schema, resolver, `defaultValues` (all page-owned inside `useForm`)                    |
| Load state: `useApiQuery` + `useApiBodyQuery` for `load`, `isLoading` -> `FormPage` skeleton, `prefetch` await | field markup, `FormSection` tree, conditional sections                                     |
| Load error -> `ErrorBanner` (or `loadErrorFallback`); submit disabled until loaded                             | payload shaping, phone/date normalization, whitelists                                      |
| `submitError` state: cleared on submit start, filled from `ApiQueryError`/`parseApiError`                      | `useWatch`/`watch` derived readouts, field arrays, previews                                |
| `FormCard onSubmit={form.handleSubmit(...)}` + `isSubmitting` wiring                                           | extra data fetches the page performs itself (its own `useApiQuery` or handler GETs)        |
| `FormActions` footer: loading, cancel (through the guard), submit label, `footerLeading`                       | dialogs, toasts, temp-credential flows, upload widgets                                     |
| Redirect after a successful write per section 5.5                                                              | cross-links and badges inside the body (`preflight`/`children` instead)                    |
| Dirty guard: `useUnsavedGuard` (beforeunload) + `useUnsavedGuardState` (in-app confirm), armed only after load | business rules that block or reshape a submit (returned as `notice` / handled in `submit`) |
| One `useEffect` bridge: `load` data -> `form.reset(mapToValues(entity))` (the only effect in the shell)        | navigation the page declares as `redirectTo: null`                                         |

### 5.3 Load + reset strategy (the one effect the shell keeps)

- Reads go through the existing `useApiQuery` (TanStack v5), not a hand-rolled effect. This
  is the documented purpose of that hook and matches the 39 list/detail/settings pages that
  already use it (plus `invoices/new` and `payments/new` for dependent reads); retry policy
  and `ApiQueryError.message` come free (`apps/web/src/lib/query.ts`).
- RHF offers two ways to land the fetched entity:
  1. **Preferred:** pass the mapped entity as `useForm({ values, resetOptions: { keepDirtyValues: true } })`.
     Requires the query to live where `useForm` is created, i.e. the page. The shell exposes
     the same config as `load` so it can be lifted later; for Wave 1 keep the simple form.
  2. **Default for Wave 1:** shell-owned query + one bridge effect
     (`useEffect(() => { if (data) form.reset(mapToValues(data)); }, [data, form.reset])`).
     RHF's own docs warn against depending on the whole `useForm()` return value (it will
     become memoized); destructure `reset`.
- The bridge effect is legitimate per react.dev: it synchronizes form state with an external
  system (the query cache), which is the one case react.dev says needs an Effect.
- The shell keeps rendering `FormPage isLoading` until the entity lands, so fields never
  flash empty (same UX as today).

### 5.4 Dirty guard

- Default: enabled when `mode === 'edit'`, using the existing hooks so there is one guard
  implementation, not two:
  - `useUnsavedGuard(isDirty)` for reload/close (`beforeunload`),
  - `useUnsavedGuardState(isDirty)` wired into `FormActions onCancel` -> `requestLeave(backHref)`
    and the existing confirm modal pattern used by `payments/edit`.
- `isDirty` comes from `formState.isDirty`. RHF requires `defaultValues` (or `reset(data)`)
  as the single source of truth for dirtiness, and requires the value to be read during
  render to subscribe through its proxy. Edit pages already `reset(entity)` on load, so the
  guard must arm only after `load` resolves (`enabled = loadOk`), otherwise the untouched
  form can read as dirty against empty defaults.
- Known wart to fix or accept explicitly: `useUnsavedGuardState.confirmLeave` currently
  navigates with `window.location.assign(target)` (`useUnsavedGuard.ts:55`), which forces a
  full document load and bypasses Next's client-side transition. Prefer extending the hook
  with `router.push` (Next 16 `useRouter` docs: `push` = client-side navigation + history
  entry) rather than forking the guard into the shell.
- Opt-out: `dirtyGuard={false}` for locked forms (`payments/edit`, `invoices/edit`) until
  their behavior is re-verified side by side. RHF `isDirty` also ignores `File` inputs, so
  any form with file state (document uploads) needs a custom dirty source or an opt-out.

### 5.5 Error and redirect contracts

- Single banner channel as today: `error = submitError || loadError`, rendered by
  `FormPage`. Submit errors come from `parseApiError` / `ApiQueryError.message`
  (display-ready; do not re-parse).
- `submit()` returns nothing -> navigate to `redirectTo` (create pages and most edits).
  Returns `{ redirectTo: '/x/y' }` -> navigate there (created-id detail redirects, tenant
  detail on edit). Returns `{ redirectTo: null }` -> shell stays put; the page navigates
  after its own dialog (guardians/new). Returns `{ notice }` -> show an informational
  banner and still navigate unless `redirectTo: null`.
- Navigation uses `router.push` from `next/navigation` (client-side transition; 39 of 40
  current pages). Only the `notifications/new` stub uses `replace`, and it is excluded.

---

## 6. Adoption list

### 6.1 Explicit exclusions (never part of step 3.1)

| Page(s)                                                 | Reason                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings` (1,398), `export` (441), `dashboard` (1,147) | hand-rolled surfaces, per plan risk note; not form pages in the CRUD sense                                                                                                                                                                         |
| `invoices/new` (756)                                    | no react-hook-form; manual line-item state + 3 queries; plan keeps it hand-rolled                                                                                                                                                                  |
| `notifications/new` (18)                                | redirect stub; plan step 3.2 decides delete vs build                                                                                                                                                                                               |
| `leaves/[id]/edit` (333)                                | no form state at all: approve/reject workflow page. Chrome-only reuse at most                                                                                                                                                                      |
| `tenants/new` (576), `tenants/[id]/edit` (704)          | 19/35 fields; `tenants/new` has `useSearchParams` prefill + temp-credentials dialog + lease-passport panel + room/bed picker; `tenants/edit` has the nested payload builder, 2 `DocumentUpload` widgets and a dependent room fetch; plan queue 3.5 |
| `electricity/new` (466), `electricity/[id]/edit` (494)  | field arrays, two-step submit with partial failure, reconcile gating; plan queue 3.6                                                                                                                                                               |
| `payments/new` (671), `payments/[id]/edit` (376)        | money path, 3 queries, hand-rolled dirty guard + paid lock; plan queue 3.3                                                                                                                                                                         |
| `invoices/[id]/edit` (437)                              | hand-rolled dirty guard + paid lock; plan queue 3.4                                                                                                                                                                                                |
| `floors/[id]/edit` (806)                                | deepest edit page, 6 API calls (5 GET in one `Promise.all` + 1 PUT), 11 `router.push` call sites (10 are embedded room/machine panel actions); "do not regress" list                                                                               |

### 6.2 First-cut migration order

| Wave                              | Pages                                                                                                                                                                                                                                                                  | Why                                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                                 | `CrudFormPage.tsx` only (no page changes)                                                                                                                                                                                                                              | land the component + types behind gates; decide `PageShell` fold-or-delete; no behavior change                                                                               |
| 1 (4)                             | `laundry/new`, `laundry/[id]/edit`, `washing-machines/new`, `washing-machines/[id]/edit`                                                                                                                                                                               | smallest pages in the repo (154-234 lines); edit proves load+reset+guard, create proves the no-load path; `laundry/edit` proves the `preflight` slot (its "Booked by" panel) |
| 2 (5)                             | create side of Tier A: `meals/new`, `notices/new`, `enquiries/new`, `attendance/new` (duration readout stays in children), `assets/new` (created-id redirect)                                                                                                          | exercises both redirect flavors                                                                                                                                              |
| 3 (8)                             | edit side of Tier A: `meals/edit`, `notices/edit`, `enquiries/edit`, `guardians/edit` (payload whitelist stays in submit), `complaints/edit`, `notifications/edit`, `attendance/edit` (duplicate check stays in submit), `visitors/edit` (host link stays in children) | 17 of 19 Tier A pages done after Wave 3 (4 + 5 + 8)                                                                                                                          |
| 4 (rest of Tier A)                | `leaves/new`, `visitors/new`                                                                                                                                                                                                                                           | dependent GET + inline preview on tenant change; completes the 19 strict clones                                                                                              |
| 5 (Tier B, after Wave 1-4 review) | `services/new` + `services/edit`, `menus/edit`, `rooms/[id]/edit`, `assets/[id]/edit` (side column + header badge), `complaints/new`, `guardians/new` (deferred redirect), `menus/new`, `rooms/new`, `floors/new`                                                      | each needs exactly one slot or prefetch; revisit the API before starting this wave                                                                                           |
| later, separately gated           | `payments/[id]/edit`, `invoices/[id]/edit` (guard parity), `electricity/*`, `tenants/*`, `floors/[id]/edit`                                                                                                                                                            | only if the depth program calls for it; otherwise remain hand-rolled                                                                                                         |

Rules for every wave:

- One module (create + edit together) per commit; never batch unrelated modules.
- Migration is behavior-preserving first (same labels, same targets, same messages). Depth
  additions (cross-links, empty states, extra panels) belong to the module's own queue entry
  (plan 3.3-3.11), not to the extraction commit.
- Do not migrate a page and add a feature in the same commit; that is what makes the
  abstraction fight edge cases.

---

## 7. Risks

| Risk                                                                                  | Evidence                                                                              | Mitigation                                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Abstraction fights edge cases                                                         | plan's own risk row; confirmed: 10 Tier B pages each need a different extra           | tiers + slots; `redirectTo: null` escape hatch; Wave 5 explicitly gated                                                             |
| Two dirty-guard implementations drift                                                 | `useUnsavedGuardState` exists but only 2 form pages use it; both hand-roll `isDirty`  | shell uses the shared hooks; keep `dirtyGuard={false}` until those pages are ported                                                 |
| Guard performs hard navigation                                                        | `window.location.assign` in `useUnsavedGuard.ts:55` vs Next client-side `router.push` | extend the hook once in Wave 0; do not fork it into the shell                                                                       |
| RHF effect-dependency trap                                                            | RHF docs: depending on the whole `useForm()` return breaks once memoization ships     | destructure `reset`; only the bridge effect depends on it                                                                           |
| Double error state (page keeps `submitError` while shell adds one)                    | 39 of 40 form pages declare it                                                        | migration deletes the local state in the same commit; review diff for leftover `submitError`                                        |
| Suspense regressions                                                                  | 7 pages use `useSearchParams`; Next requires a Suspense boundary during prerender     | shell never removes the page-level `<Suspense>`; `next build` is part of the gate (typecheck alone does not catch prerender errors) |
| Behavior drift on money pages                                                         | `payments/edit`, `invoices/edit` guards are subtle (`!isPaidLocked && !isSubmitting`) | excluded in Wave 1-4; port only with a side-by-side checklist                                                                       |
| Working tree still has in-flight depth work (68 modified + 2 untracked at last check) | `git status` after commits `74894f6`/`143bc33`                                        | start Wave 0 only after the remaining depth work lands; re-run `wc -l` then                                                         |
| Orphan component repeats (`PageShell` has 0 users)                                    | grep across `apps/web/src`                                                            | Wave 0 decides: fold PageShell's list/detail role or delete it; add a "has consumer" note in the component header                   |
| Lint rules                                                                            | `.oxlintrc.json` shadcn rules, TS strict, no `any`                                    | gates below; `bun run lint` must be 0/0                                                                                             |

---

## 8. Verification plan

Per wave (and per module commit inside a wave), from the repo root:

1. `bun run lint` -- must exit 0 with 0 warnings and 0 errors (fix all `shadcn/*` findings
   per `.oxlintrc.json`).
2. `bun run typecheck` -- must exit 0 (strict TS; the new generics must not leak `any`).
3. `bun run format:check` -- file must be prettier-clean (repo was formatted wholesale in
   commit `35dd2cd`).
4. `bun run build` -- run at least once per wave (Wave 0 always): catches Next 16 prerender
   errors (`useSearchParams` without Suspense, client-boundary issues) that typecheck misses.
5. Tests and e2e: handled by the main thread (this document does not run them); flag any
   spec that asserts on form DOM structure.
6. Manual smoke per migrated page: admin login -> open create -> validation error shows ->
   submit -> lands on `redirectTo`; open edit -> skeleton then populated fields -> edit a
   field -> Cancel -> confirm dialog appears -> confirm lands on `backHref`; reload while
   dirty -> browser prompt.
7. After any file tree change: update `.sixthrules/workflows/codebase-index.md` and its
   `.claude/rules` mirror (AGENTS.md critical rule). Adding
   `apps/web/src/components/ui/CrudFormPage.tsx` is a file tree change (Wave 0).
8. Content rules: ASCII only, no emojis, kebab-case files, no direct imports of `apps/api`.
9. `flutter analyze` is not required for these waves (no `mobile/` changes), but the repo-wide
   definition of done still applies to the overall PR.

---

## 9. Sources

External primary sources:

- https://react.dev/learn/you-might-not-need-an-effect -- Effects are for synchronizing with
  external systems; data fetching in Effects needs cleanup, and modern frameworks provide
  built-in fetching; submissions belong in event handlers, not Effects. Basis for keeping
  exactly one bridge effect (query -> `form.reset`) and putting the write in `submit()`.
- https://react.dev/learn/sharing-state-between-components -- "Lifting state up", controlled
  vs uncontrolled components, and one source of truth per piece of state. Basis for keeping
  `useForm` in the page (children and readouts close over it) and handing only lifecycle
  state to the shell.
- https://react-hook-form.com/docs/useform/formstate -- `formState.isDirty` is true after any
  input change and requires `defaultValues`/`reset` as the single source of truth; the proxy
  only subscribes to properties read during render. Basis for section 5.4.
- https://react-hook-form.com/docs/useform -- `values` (v7.41+) reactively updates the form
  from server data, `resetOptions.keepDirtyValues` controls the reset, `defaultValues` are
  cached, and depending on the whole `useForm()` return value in an effect will break once
  memoization ships (destructure `reset`). Basis for section 5.3 and the Wave-1 bridge effect.
- https://react.dev/llms.txt -- sitemap used to verify the exact react.dev page URLs above.

Next.js 16 (read from `apps/web/node_modules/next/dist/docs/`, resolved from
`apps/web/AGENTS.md`, version `next@16.3.4`):

- `01-app/03-api-reference/04-functions/use-router.md` -- `router.push` performs a
  client-side navigation adding a history entry, `router.replace` does not; untrusted URLs
  must never be passed to either (XSS). Basis for the redirect contract in section 5.5.
- `01-app/01-getting-started/04-linking-and-navigating.md` -- client-side transitions keep
  shared layouts and avoid full page loads; recommends `loading.tsx` on dynamic routes for
  prefetch. Basis for keeping `router.push` rather than `location.assign` after a write.
- `01-app/03-api-reference/01-directives/use-client.md` -- `'use client'` marks the client
  entry point and requires serializable props across the boundary. Basis for the shell's
  `'use client'` directive and for keeping non-serializable config (schemas, callbacks,
  form methods) inside client components only.
- `01-app/02-guides/forms.md` -- Next's forms guide covers Server Actions/`<form action>`;
  this app deliberately submits from client event handlers to a separate HTTP API, so the
  guide's pattern is out of scope (documented here so implementation does not "fix" it).

Repository sources: the 40 page files under `apps/web/src/app/(admin)/`, plus
`components/ui/{FormPage,FormCard,FormActions,FormSection,PageHeader,ErrorBanner,DetailCard,
PageShell}.tsx`, `hooks/{useApiQuery,useUnsavedGuard}.ts`, `lib/{query,errorParser}.ts`, and
`docs/plans/2026-09-29-depth-implementation-plan.md` sections 4.3/4.4/8.
