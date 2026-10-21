# Flow and Layout Audit (strict) - 2026-10-21

Owner complaint being answered: "the current pages are shitty laid out and feature flows feel
hollow. why?"

Scope: `apps/web` admin panel (84 pages under `apps/web/src/app/(admin)`), `apps/api` routes and
services, `mobile/` Flutter resident portal. Method: every claim below was read out of source on
2026-10-21 and is cited as `file:line`. Counts were re-measured by the main thread. Inferences are
marked as inferences.

Revision note: an independent reviewer fact-checked every citation and number in this document on
2026-10-21 and returned "request changes". The corrections from that review are already folded in
here. Where the reviewer's count and the main thread's count differ, both are stated with the method.

Status: RESEARCH complete. No product code changed by this audit. The decisions this audit implies
are proposed as DR-10..DR-12 in `pm/DECISIONS.md` and await Jay's pick.

---

## 1. The short answer (why)

**The previous audit program graded component presence, not truth and not flow.** It asked "does
this page have a StatCard, an EmptyState, a cross-link, a skeleton, a timeline" and marked the
module WORKING when the answer was yes. Every rebuild therefore added the parts and left the
behaviour. A page with a KPI row, an empty state and a link to another page still feels hollow when:

1. the screen asserts things the server never confirmed (a wrong balance, a promise the API
   contradicts),
2. nothing visibly advances when work happens (no visible state progression, no closing signal to
   the resident),
3. the operator has no next step and no way to share what they are looking at, and
4. the page is laid out with the same template as the other 23 modules.

Fixing layout alone will not fix holowness. Fixing copy alone will not fix layout. The audit
standard has to change first, because the standard is what produced 24 modules that all look the
same and all lie in slightly different ways.

Three root causes, in order of blast radius:

- **RC1 - The truth gap.** The UI claims a lot the backend does not do. An invoice is created
  `sent` (`apps/api/src/services/invoice.service.ts:160`) with no notification, so the resident sees
  it only the next time they load the app, never as an event; the compose form promises "Invoice
  will be issued in Draft status" (`apps/web/src/app/(admin)/invoices/new/page.tsx:710`) while the
  service hardcodes `sent`; the record-payment modal says "Excess will be credited"
  (`apps/web/src/components/admin/RecordPaymentModal.tsx:248-249`) while the API hard-rejects
  overpayment (`apps/api/src/routes/payments.ts:406`); and the record-payment form derives the
  balance locally as `found.balance ?? Math.max(0, found.totalAmount - (found.paidAmount ?? 0))`
  (`apps/web/src/app/(admin)/payments/new/page.tsx:204,210-211`). The server field `balance` is
  preferred but never sent, because `GET /invoices` returns lean invoices with no `paidAmount` and
  no `balance` (`apps/api/src/routes/invoices.ts:109-134`) and the invoice model has neither field
  (`apps/api/src/models/invoice.ts:8-24`). The fallback therefore always wins: a partly paid
  invoice shows the full total as due, pre-fills it, and the API rejects it with
  `AMOUNT_EXCEEDS_BALANCE`. The admin does the subtraction in their head and the screen asserts a
  wrong number.
- **RC2 - The missing close.** `createNotification` exists and has 11 call sites
  (`apps/api/src/routes/tenants.ts:1067`, `complaints.ts:513`, `complaints.ts:645`,
  `notices.ts:234`, `electricity.ts:855`, `electricity.ts:873`, `jobs.ts:121`, `jobs.ts:180`,
  `notifications.ts:115`, `apps/api/src/jobs/scheduler.ts:62,127`). It is absent from the money and
  decision paths: payment verify writes an audit log and nothing else
  (`apps/api/src/routes/payments.ts:1054-1119`, and `payments.ts:733-801` for the UTR route), KYC
  verification writes an audit log and nothing else (`apps/api/src/routes/tenants.ts:1185-1200`),
  leave decisions do not notify (`apps/api/src/routes/leaves.ts:569,624`), invoice creation does not
  notify (`apps/api/src/services/invoice.service.ts:151-173`). The resident's half of the money loop
  ends in silence. And the resident who actually pays has the least money visibility in the
  product: dues is admin-only (`apps/api/src/routes/tenants.ts:1723`) while the resident invoice
  list shows gross totals and the resident invoice detail shows the true balance.
- **RC3 - The missing spine.** 84 admin pages, one template. 27 pages import `StatCard`, 29 import
  `DetailCard`, 23 import `EmptyState`, 3 import `Timeline` (5 more render a wrapper around it), and
  only 7 pages use a two-column main-plus-rail layout (4 with a fixed 300/340px rail, 3 with an
  auto-sized filter rail). `ResponsiveContainer.tsx` (a `max-w-7xl` page frame) and `KpiHeader.tsx`
  (a 4-accent KPI strip) both exist with **zero importers** - the layout system was written and
  never wired. Every list page spends 450-720px of vertical space before the first data row. On the
  deepest records the primary action is far below the fold (inference, section 2 L3). And the form
  footer's `sticky bottom-0` (`apps/web/src/components/ui/FormCard.tsx:61`) sits inside a card that is
  `overflow-hidden` (`FormCard.tsx:70`), so the sticky footer cannot stick: the Save button scrolls
  away with the form on every FormCard surface (36 in total: 35 direct page importers plus
  `CrudFormPage.tsx:11`).

---

## 2. The layout findings (why the pages look bad)

### L1 - Two incompatible content widths in one product

The admin shell content area is `flex-1 p-6` with no max-width and no rail
(`apps/web/src/app/(admin)/layout.tsx:153`). `FormPage` independently caps and centres every body,
defaulting to `maxWidth = '2xl'` (`apps/web/src/components/ui/FormPage.tsx:52`, which maps to
`max-w-2xl`, 672px) with the allowed range `2xl`..`5xl` (`FormPage.tsx:27-33`) and `mx-auto`
(`FormPage.tsx:71,109`). Result: list pages are edge-to-edge, form and detail pages are a centred
ribbon with large empty gutters on a 1440px screen, while a page that passes `maxWidth="4xl"`
gets 896px. The eye reads two different products, and the same page class changes width depending
on a prop. The shell already has the fix available in dead code:
`apps/web/src/components/ui/ResponsiveContainer.tsx`.

### L2 - One template, 24 times, and no module has an identity

The identical `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` band appears on 15 distinct pages: 6 list
pages (floors, electricity, complaints, payments, invoices, assets) and 9 detail pages
(visitors/[id], leaves/[id], invoices/[id], tenants/[id], floors/[id]/edit, rooms/[id],
washing-machines/[id], assets/[id], payments/[id]). The tile is a fixed `min-h-[148px]`
(`apps/web/src/components/ui/StatCard.tsx:134`). Only 7 pages use a rail; the detail pages that do
not are built from `DetailCard` (29 pages import it) and the list pages from `DataTable` (24
importers), so the app has two shapes rather than 24 modules with identities. Consequence: a cropped
Tenants table and a cropped Assets table are interchangeable. There is no screenshot-confusion test
in the program, so nothing ever failed.

### L3 - The primary action is below the fold, and the sticky footer cannot save it

`FormCard.tsx:61` sets the footer `sticky bottom-0 z-[1]`; `FormCard.tsx:70` sets the same card
`overflow-hidden`, which establishes a scroll container and defeats the sticky (inference from CSS
sticky containment; no browser run, and no `overflow` override anywhere in `apps/web` CSS). On
`apps/web/src/app/(admin)/tenants/[id]/edit/page.tsx` (33 fields, 7 sections, one column, no rail)
the Save action sits thousands of pixels down; on `tenants/[id]/page.tsx` Check Out and on
`payments/[id]/page.tsx` Verify it is far below one viewport. All three numbers are inferences from
the cited component geometry, not browser measurements. The correct pattern already exists on one
page: `invoices/[id]/page.tsx` puts Record Payment in the header.

### L4 - Typography is arbitrary and partly illegible

`apps/web/src/app/globals.css:237-239` defines `--text-12/13/15`; `globals.css:385-387` defines
`--text-xs/sm/base` with the same three values (0.75rem / 0.8125rem / 0.9375rem) - two scales, one
set of numbers. On top of that, 278 lines in `apps/web/src` match `text-[Npx]`
(reviewer count; the main thread counted 275 with a narrower scope), of which 14 occurrences across
9 files render below 10px: `text-[8px]` in `TenantStayCalendar.tsx:239`,
`AttendanceMonthCalendar.tsx:246`, `FloorServiceGrid.tsx:219,348`; `text-[9px]` in
`FloorServiceGrid.tsx:262,273`, `ComplaintCategoryMatrix.tsx:122`, `MealFeedbackLedger.tsx:226`,
`HeatmapCalendar.tsx:207`, `RoomBedHeatmap.tsx:142`, `AmenityTypesTab.tsx:322,556`,
`NotificationBell.tsx:158,162`. A further 102 non-text px lines are hardcoded dimensions, and 21
table columns are pinned with `className: 'w-[Npx]'` (plus `rooms/[id]/page.tsx:94`). The practical
effect is that `DataTable`'s `overflow-x-auto` (`apps/web/src/components/ui/DataTable.tsx:213`) is the
app's responsive strategy.

### L5 - Nothing reflows

One fixed `p-6` at every viewport (`layout.tsx:153`). The sidebar is 260px wide
(`--sidebar-width` in `apps/web/src/app/globals.css:119`, applied at
`apps/web/src/components/admin/Sidebar.tsx:450`) and is `hidden ... lg:flex`
(`Sidebar.tsx:652`), so below 1024px it collapses to a hamburger overlay and above 1024px it eats
260px of every screen. Filter controls use fixed widths in 41 places (28 `sm:w-[Npx]` plus 13
`max-w-xs`; the narrower `max-w-xs` + `w-40` pattern alone is 16), and table columns are pinned in
21 places, so overflow becomes a horizontal scrollbar rather than a layout change.

### L6 - Colour hygiene is fine, so the "unfinished" feeling is type and spacing

Zero raw Tailwind palette classes in the admin tree. There are 25 lines with 6-digit hex literals in
`.tsx` files (`apps/web/src/app/(admin)/settings/page.tsx`,
`apps/web/src/components/admin/AppearanceTab.tsx`) plus raw `#fff` fallbacks in
`apps/web/src/components/ui/Button.tsx:77,79`; all of them are in the theme editor or the button
base, none in a module page. The debt is entirely in the type scale, the spacing and the dead
frame.

---

## 3. The flow findings (why the flows feel hollow)

### F1 - Records are created but nothing is dispatched

`generateSingleInvoice` hardcodes `status: 'sent'` (`apps/api/src/services/invoice.service.ts:160`)
and creates an auto-pending payment (`:151-173`) with no notification. The resident therefore
learns about it only by loading the app again (the tenant home and invoice list read
`GET /invoices/my`, `mobile/lib/features/tenant/presentation/invoices_screen.dart:33`), never as
an event, and there is no acknowledgement. `POST /payments/:id/verify`
(`apps/api/src/routes/payments.ts:1054-1119`) and `POST /payments/verify-utr/:paymentId`
(`payments.ts:733-801`) write an audit log only. The resident's screen says "UTR submitted for
verification" (`mobile/lib/features/tenant/presentation/payments_screen.dart:174`) and then the
resident must pull to refresh to learn whether it was approved. Contrast: a complaint status change
does push the resident (`apps/api/src/routes/complaints.ts:507-523`).

### F2 - Two different amounts on one resident screen

`GET /invoices/my` returns lean invoices (`apps/api/src/routes/invoices.ts:206-218`), so the Flutter
list computes `total - 0` (`mobile/lib/features/tenant/presentation/invoices_screen.dart:48-53`),
while the UPI QR on the same screen uses the true balance
(`apps/api/src/routes/payments.ts:572-575`). The invoice detail screen is correct because it calls
`GET /invoices/:id` (`apps/api/src/routes/invoices.ts:492-504`). A tenant can see "12,000 due" next
to a QR for 6,000.

### F3 - The resident who pays has less money visibility than the resident who watches

`GET /tenants/:id/dues` is `adminOnly` (`apps/api/src/routes/tenants.ts:1723`). That endpoint
already computes the true per-invoice remaining balance with `getInvoiceBalance`
(`apps/api/src/routes/tenants.ts:1743-1782`), so this is an authorization choice on top of an
existing computation, not a missing feature. The tenant home screen shows only `totalAmount`
(`mobile/lib/features/tenant/presentation/.../home_screen.dart:266-281`). The only dues summary
rendered anywhere belongs to the guardian (`apps/api/src/routes/guardians.ts:323-359`, rendered in
the Flutter ward screen). The admin tenants list has no balance column
(`apps/web/src/app/(admin)/tenants/page.tsx:154-205`).

### F4 - The true balance is already on the offending screen, and it is thrown away

`apps/web/src/app/(admin)/payments/new/page.tsx` already fetches `GET /tenants/:id/dues` (`:154`),
already types `unpaidInvoices[].remaining` (`:79-88`) and already renders the server-computed
`totalDue` (`:342-347`) - and then the pre-fill at `:204,210-211` re-derives the balance from the
lean invoice list anyway. The cheapest correct fix is to use the value the page already has, not a
new API field. A related leftover: `apps/api/src/routes/tenants.ts:1832` still selects a phantom
`paidAmount` from the Invoice collection, a field the model does not have
(`apps/api/src/models/invoice.ts:8-24`); Mongoose ignores it and the value is derived downstream at
`tenants.ts:1851`.

### F5 - The triage ribbon lands on unfiltered lists

`AttentionRequiredBanner` navigates to `/payments?status=pending_verification`,
`/complaints?status=open`, `/enquiries?status=new`
(`apps/web/src/components/admin/AttentionRequiredBanner.tsx:105,123,159`). The dashboard pushes
`/complaints?status=` and `?category=` (`apps/web/src/app/(admin)/dashboard/page.tsx:788,812`).
But `payments/page.tsx`, `enquiries/page.tsx` and `tenants/page.tsx` contain **zero**
`useSearchParams` calls (measured), and `complaints/page.tsx:286-288` reads only date params. Every
"act now" button lands on an unfiltered list - the most trust-building surface in the app is the
least truthful one.

### F6 - Statuses exist in the API but are never rendered as a progression

| Entity    | Statuses the API allows                                                                         | Visible progression today    | Gap                                                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Payment   | `pending, pending_verification, paid, overdue, cancelled` (`apps/api/src/models/payment.ts:51`) | status tabs, audit timeline  | no stepper; `overdue` is written only by the cron (`apps/api/src/jobs/scheduler.ts:99,101`) and by the cron-secret route (`apps/api/src/routes/jobs.ts:58,60,143`, gated at `jobs.ts:14-26`) - never by the UI           |
| Invoice   | `draft, sent, partial, paid, overdue, cancelled` (`apps/api/src/models/invoice.ts:21`)          | badge + payment progress bar | no stepper; `draft` only reachable by dragging an invoice backwards                                                                                                                                                      |
| Enquiry   | `new, contacted, converted, lost` (`apps/api/src/models/enquiry.ts:49`)                         | status badge                 | the API enforces a real FSM (`apps/api/src/routes/enquiries.ts:68-80`); no pipeline UI anywhere, and the Convert button never writes the status (F7)                                                                     |
| Complaint | `open, in_progress, resolved, dismissed` (`apps/api/src/models/complaint.ts:69`)                | kanban columns               | resident side has chips only, no progression                                                                                                                                                                             |
| Leave     | `pending, approved, rejected, cancelled` (`apps/api/src/models/leaveApplication.ts:43`)         | `LeaveLifecycleStepper`      | resident sees a plain chip; `mapLeave` returns `adminNotes` (`apps/api/src/routes/leaves.ts:106-107`) and no Flutter card renders it                                                                                     |
| Visitor   | `expected, arrived, departed, cancelled` (`apps/api/src/models/visitor.ts:56`)                  | `VisitorLifecycleStepper`    | the portal's shared `StatusChip` omits `expected`, `arrived` and `departed`, so 3 of the 4 statuses fall to neutral grey (`cancelled` maps to danger) (`mobile/lib/features/shared/widgets/portal_widgets.dart:144-175`) |
| Notice    | none - the model has no status (`apps/api/src/models/noticePost.ts`)                            | pinned/normal chip           | a broadcast with no read receipt and no acknowledgement                                                                                                                                                                  |

The portal `StatusChip` is the highest-leverage shared defect in the Flutter app: one function, one
hardcoded map, and every unlisted domain state renders the same grey - `expected`, `arrived`,
`departed`, `open`, `new`, `draft`, `in_progress` are all missing from it. Blast radius is every
portal screen that shows a status.

### F7 - The enquiry to tenant hop never reaches the FSM's terminal state

`apps/api/src/routes/enquiries.ts:68-80` refuses `converted` unless the enquiry has a linked
tenant, but the Convert button (`apps/web/src/app/(admin)/enquiries/[id]/page.tsx:421-431`, push at
`:425`) only navigates to `/tenants/new` carrying name, phone, email, `source` and `enquiryId`.
`tenants/new/page.tsx:89-94` uses `enquiryId` (`:96`) and ignores `source`; `preferredSharing`,
`message` and `notes` are dropped entirely. The enquiry stays `new` after conversion, and the
enquiries list has no Convert action at all (`apps/web/src/app/(admin)/enquiries/page.tsx:260-268`).
That is a bigger truth gap than the dropped fields: the record says the lead pipeline did not move.

### F8 - Two purpose-built screens exist and are called by nobody

`GET /payments/pending-verification` (`apps/api/src/routes/payments.ts:854-881`),
`GET /invoices/:id/payment-status` (`apps/api/src/routes/invoices.ts:806-841`) and
`GET /rooms/available` have zero consumers in `apps/web/src` or `mobile/lib`. The screens that
would have closed the loops were designed and never wired.

### F9 - Every mobile empty state is a dead end

The Flutter `EmptyState` takes a message and an icon only
(`mobile/lib/features/shared/widgets/portal_widgets.dart:32-33`) and is used at 19 call sites
across the portal; the web `EmptyState` does accept an action
(`apps/web/src/components/ui/EmptyState.tsx`). The mobile port dropped it, so every portal empty
state (for example `invoices_screen.dart:99`, `payments_screen.dart:415`, `leaves_screen.dart:134`,
`notices_screen.dart:139`) dead-ends.

### F10 - One shipped demo affordance with hardcoded credentials

`apps/web/src/app/login/page.tsx:301,309` - "Auto-fill Demo Admin" fills
`admin@pgmanagement.local` / `Admin@123456`.

### F11 - Admin and resident disagree about the same fact

| Concern             | Admin                                 | Resident                                                    | Verdict                       |
| ------------------- | ------------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| Outstanding balance | invoice detail shows the true balance | list shows gross total                                      | resident-visible wrong number |
| Payment verified    | audit timeline                        | no notification, silence                                    | one-way                       |
| Invoice issued      | `sent` badge                          | no notification; seen only on next load                     | no event                      |
| Leave rejected      | `adminNotes` shown in admin           | API returns `adminNotes`, the Flutter card never renders it | written, never shown          |
| KYC verified        | verify button and badge               | status chip, no notification                                | asymmetric                    |
| Notice reach        | post and export                       | read-only feed, no ack                                      | no proof of delivery          |

### F12 - The success signal is a local toast, and a receipt component already exists

`toast.success` is still fired on money and status writes:
`apps/web/src/app/(admin)/payments/page.tsx:187,268`,
`apps/web/src/app/(admin)/payments/[id]/page.tsx:304,618`,
`apps/web/src/app/(admin)/invoices/page.tsx:258,283,303,318`,
`apps/web/src/app/(admin)/invoices/new/page.tsx:275`,
`apps/web/src/app/(admin)/tenants/[id]/page.tsx:358`. Meanwhile a receipt renderer already exists -
`apps/web/src/components/admin/ReceiptDocument.tsx` (props at `:32-46`), rendered by
`apps/web/src/app/(admin)/payments/[id]/page.tsx:705`. The fix is not to invent a receipt system; it
is to promote the existing artifact to the write path and stop asserting success locally.

---

## 4. The strict standard (replaces the component-presence audit)

A module may be called rebuilt only when it passes all three gates. Each check is marked
**[M]** for mechanically enforceable by a script, **[H]** for a judgement call that a reviewer must
sign off with a written reason. The gates that need a convention to exist are introduced by the
wave that creates it (see section 5); until then they are listed as pending, not as failures.

### Gate A - TRUTH (the server is the only authority)

1. **[M]** No client-side money arithmetic. The offending shape is a local subtraction of a total
   minus a paid amount (`found.totalAmount - (found.paidAmount ?? 0)`,
   `apps/web/src/app/(admin)/payments/new/page.tsx:204,210-211`; Dart `total - paid`,
   `mobile/.../invoices_screen.dart:48-53`). The rule must key on the identifiers and the
   arithmetic, not on a literal string, or it will pass a violating codebase.
2. **[M]** Every mutating response carries a server-issued receipt: `receiptId, actor,
serverTimestamp, resource, resourceId, before, after`, where `before`/`after` are read from the
   database inside the handler, never echoed from the request body. A write whose receipt does not
   arrive renders FAILED. The artifact renderer already exists
   (`apps/web/src/components/admin/ReceiptDocument.tsx:32-46`); extend it, do not rebuild it.
3. **[M]** No `toast.success` on a money or status write. The baseline to clear is F12's list of 11
   call sites.
4. **[H]** Helper text that states an outcome must match the API's behaviour, or be deleted. The
   two known lies are "Invoice will be issued in Draft status"
   (`apps/web/src/app/(admin)/invoices/new/page.tsx:710` against
   `apps/api/src/services/invoice.service.ts:160`) and "Excess will be credited"
   (`apps/web/src/components/admin/RecordPaymentModal.tsx:248-249` against
   `apps/api/src/routes/payments.ts:406`). Scope: `apps/web` only. `apps/api` cannot share a
   TypeScript constant with the Dart portal, so for the portal the rule is "delete the promise",
   not "import the constant".
5. **[M]** Every state change a human is waiting on notifies them: invoice issued, payment
   verified or rejected, payment voided, leave approved or rejected, KYC verified.
   `createNotification` is the mechanism and it already has 11 call sites to copy.
6. **[M]** A number the resident can see must equal the number the admin sees. The known split is
   the invoice list versus the invoice detail (F2).
7. **[H]** Every endpoint has a consumer, or it is deleted - with an explicit exclusion list:
   test-only routes, cron-secret routes (`apps/api/src/routes/jobs.ts:14-26`), SSE routes and
   webhook routes. Before a route is deleted, read the client module and probe it at runtime; a
   Dart path built by interpolation (`'payments/$id/verify'`) is invisible to a grep.
8. **[H]** No control that does not act: no permanently disabled button, no "coming soon", no bulk
   select without a bulk endpoint, no chip that filters nothing, no cross-link whose target has no
   action for that record. When the endpoint or the data does not exist, delete the control. This
   is a reviewer's judgement with a written reason, not a grep.

### Gate B - FLOW (every state has an owner, a trigger and a clock)

9. **[H]** Every status has a named inbound trigger (method + path + condition). A status nothing
   can move out of is a dead letter box and must be reported as such. The trigger is derivable from
   the route guards, but the dwell time is a product decision and cannot be read from the repo.
10. **[H]** Every record and every empty state has a next best action that resolves to a real
    route. Mechanical half: the target route must exist. Judgement half: whether it is the right
    next action.
11. **[M]** The lifecycle is visible: one stepper component renders the real statuses with their
    real transitions. A domain that is not a progression declares itself a grid instead of being
    forced into a ladder. Because Dart cannot import TypeScript, the shared vocabulary has to be
    generated (one source of truth in `packages/types`, emitted for both sides) - otherwise "one
    stepper" silently becomes two, which is the failure this audit exists to kill. The portal also
    needs its shared status map fixed (F6): `expected`, `arrived`, `departed`, `open`, `new`,
    `draft`, `in_progress` are currently unlisted and render grey.
12. **[M]** URL is state: filter, sort, tab, open record and step live in the address bar, so a
    view can be linked, shared, cited and reviewed. Every internal link with a query parameter must
    be read by its target (F5). The baseline to clear is 3 pages with zero `useSearchParams`.
13. **[H]** Every outbound thing has a delivery chain that ends in acknowledged or returned - never
    in silence. Bulk operations report a per-item outcome (shipped / held / failed with a reason).
14. **[H]** Two clocks per journey: first-mile (enquiry to signed lease to first payment) and
    last-mile (complaint to resolution to confirmation). The module that owns each end is audited
    for it.

### Gate C - LAYOUT (one frame, one archetype, one protagonist)

15. **[M]** One content frame at the shell: main column, optional context rail, gutter. No page may
    invent its own width. This check can only exist once the frame exists (wave 4).
16. **[H]** Each module declares one archetype - ledger, roster, board, calendar, floor map,
    stepper, receipt, workspace - chosen by what the operator does there, and a reviewer signs off
    that no two module roots are interchangeable. There is no threshold that makes this automatic
    yet; the mechanical version is the screenshot-hash matrix in wave 4.
17. **[H]** Exactly one visual protagonist per page, and at least one number on the top band that
    no other module could compute. This contradicts a uniform four-tile band, which 15 pages still
    share (L2) - the band has to be replaced, not merely re-laid-out.
18. **[M]** The primary action on a record is within one viewport of the top, or it is pinned in a
    header or a rail footer. The sticky footer must actually stick. Measured at 1280x800 and
    1440x900 with a loaded fixture; requires the frame from wave 4.
19. **[M]** One type scale. No arbitrary `text-[Npx]`, nothing below 10px, no fixed px dimension
    where a token or a grid does the job. The baseline is L4: 278 arbitrary sizes, 14 sub-10px
    occurrences in 9 files, 102 hardcoded px lines, 21 pinned table columns.
20. **[M]** The first data row of a list page appears within 220px of the top, measured at
    1280x800 with a loaded fixture. This requires the four-tile band to go (wave 4), since
    `StatCard.tsx:134` is `min-h-[148px]` on its own.

### The per-module contract (what an agent fills in before touching code)

```
canonical loop:      what the operator is doing here, and what "done" looks like
state machine:       every status + the inbound trigger that sets it + target dwell
truth contract:      what the user believes happened / what the server commits /
                     how a mismatch surfaces / where provenance lives /
                     what a stuck state means / the 3am runbook step
layout archetype:    archetype + grammar tokens + the module's own number
next best action:    per status and per empty state, each pointing at a real route
```

A module that cannot fill this in is hollow by definition, no matter how many components it has.
The contract template and its checker are wave 0; the contracts themselves are filled per module in
wave 6, because three of the fields the contract references (one stepper, one frame, one archetype)
do not exist until waves 3-4.

---

## 5. The rebuild program (proposed)

Ordered by blast radius and by money, not by convenience. Dependencies respected: a wave never
depends on a convention that a later wave introduces.

| Wave | Work                                                                                                                                                                                                                                                                                                                                                                                             | Why first                                                                                                                                      | Gates                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 0    | The standard itself: rewrite the audit pipeline so it checks code and not audit prose; write the contract template and its checker (scoped per module, with a known-baseline allowlist so it is not red from day one); fix the pipeline's macOS-only scratch path                                                                                                                                | the program that produced the problem must be replaced before more building, and its gate must run off the Mac (it currently crashes on Linux) | pipeline runs on a Linux box, checker runs clean against the baseline it was allowed to fail |
| 1    | Truth on the money path: use the server balance the page already has (`payments/new/page.tsx:154,79-88,342-347`) instead of the local fallback at `:204,210-211`; promote the existing `ReceiptDocument.tsx` to the write path and clear the 11 `toast.success` sites; delete the "Draft status" and "Excess will be credited" copy; remove the phantom `paidAmount` select at `tenants.ts:1832` | this is the lie that costs money, and the cheapest fix is one line plus reusing what exists                                                    | API tests green, manual partly-paid invoice check, no client-side money arithmetic           |
| 2    | Close the loops: notify on invoice issued, payment verified/rejected/voided, leave decided, KYC verified; render the leave rejection reason in the portal; give the resident a dues view (`tenants.ts:1723` is a one-flag authorization change over an existing computation)                                                                                                                     | RC2, the resident half of the product                                                                                                          | notification tests, Flutter screens updated                                                  |
| 3    | One spine: a shared vocabulary in `packages/types` **generated** for both sides (Dart cannot import TypeScript), one stepper per side from that one source, and `useUrlState` so filters and tabs live in the URL and the dashboard's act-now links land filtered                                                                                                                                | kills the sameness and the dead links; the codegen step is what stops it becoming two steppers                                                 | URL state tests, generated-vocabulary parity test, screenshot-confusion matrix               |
| 4    | One frame: shell content frame with an optional rail; sticky footer fixed; record actions pinned to the header; **the four-tile band removed** (not just re-laid-out, or check 20 cannot pass); first data row within 220px                                                                                                                                                                      | kills the "laid out badly" feel at the source                                                                                                  | Playwright viewport assertions at 1280x800 and 1440x900, 4 archetypes rendered               |
| 5    | Type and spacing cleanup: one scale, no arbitrary px, nothing below 10px                                                                                                                                                                                                                                                                                                                         | what makes it read as unfinished                                                                                                               | lint rule for arbitrary values, visual diff                                                  |
| 6    | Per-module depth rebuilds in money order: payments, invoices, tenants, electricity, rooms, attendance, dashboard - each against the new gates, one module per commit, each with its contract filled in                                                                                                                                                                                           | the depth work itself, now against a standard that can catch hollowness                                                                        | the rewritten pipeline, lint, typecheck, tests, and the module's contract checked            |

Rules that apply to every wave: one module per commit; behaviour-preserving before depth; the
pipeline stays green; agents commit to their own branch only, Jay merges (DR-9); no production
writes by the agent (DR-8).

---

## 6. What was NOT done

- No browser run. Every pixel offset in this document is an inference from the cited component
  geometry, not a measurement. The sticky-footer finding (L3) is a CSS containment inference.
- No product code changed by this audit. One repair was made outside the product: the audit
  pipeline's two scripts hardcoded a macOS temp path
  (`scripts/audit/reconcile-open-gaps.py:97`, `scripts/audit/spotcheck-field-matrix.py:15-17`),
  which made the pipeline gate crash on Linux and in CI; they now use a portable scratch directory
  and were re-verified on a Linux box.
- The Flutter portal was read for its flows, its status map and its empty states, not audited line
  by line for layout.
- Counts were taken with stated methods (grep patterns and scopes are named inline). Where two
  methods disagree, both numbers are given.
- The audit pipeline scripts police the audit documents, not the code. That is why they stayed green
  while the flows stayed hollow, and it is what wave 0 fixes.

## 7. Sources

Repository (read 2026-10-21): `apps/web/src/app/(admin)/**`, `apps/web/src/components/ui/**`,
`apps/web/src/components/admin/**`, `apps/web/src/app/globals.css`,
`apps/api/src/routes/{payments,invoices,tenants,complaints,leaves,visitors,notices,enquiries,guardians,electricity,jobs}.ts`,
`apps/api/src/models/{invoice,payment,tenant,complaint,leaveApplication,visitor,enquiry,noticePost}.ts`,
`apps/api/src/services/{invoice,notification,payment-status}.service.ts`,
`mobile/lib/features/**`, `packages/types/src/{tokens,invoice,payment}.ts`,
`scripts/audit/*.py`, `docs/plans/crud-form-page-design.md`,
`docs/plans/2026-09-29-depth-implementation-plan.md`, `pm/{STATUS,DECISIONS}.md`.
Primary external sources for the standard: react.dev (state as source of truth, one state per
concern), react-hook-form.com (`formState.isDirty` semantics), react.dev "you might not need an
effect" (Effects only for synchronising with external systems), nextjs.org/docs (server/client
component boundaries, `useRouter` navigation semantics).
