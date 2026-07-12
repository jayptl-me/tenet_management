# Flutter Portal -- Gap Analysis (code-verified 2026-07-12)

**Priority:** P0 tenantId; P1 MVP depth  
**Path:** `mobile/` only (Web + iOS + Android)  
**Do not** add resident UI under `apps/web`.

## Layout

```
mobile/lib/
  core/           env, Dio, router, storage, theme
  features/
    auth/         login; rejects admin
    tenant/       home, invoices, payments, visitors tab, complaints, meals, laundry, notices, more
    guardian/     ward, attendance
    visitor/      list, register, status (tenant-authenticated desk)
    shared/       portal widgets
```

Router: `mobile/lib/core/router/app_router.dart`.

API base: `API_BASE_URL` dart-define (`core/config/env.dart`).

## Completeness matrix

### Tenant

| Screen | Mode | API | Grade |
|--------|------|-----|-------|
| Login / splash / role redirect | full | auth | A |
| Home | snippets | invoices/my, complaints/my | C+ |
| Invoices | list only | invoices/my | C |
| Payments | list + UTR submit | payments/my, submit-utr | B |
| Visitors tab | embeds visitor home | visitors/my | B- (tenantId) |
| Complaints | list + create | complaints/my, POST | B |
| Meals | menu + feedback | menus/today, meals/feedback | C+ |
| Laundry | list + book | laundry-slots | B- (tenantId) |
| Notices | list | notices | C |
| More | nav hub | -- | C |
| Profile / KYC / password | **missing** | tenants/:id | F |
| Leaves | **missing** | leaves APIs | F |
| Attendance check-in | **missing** | attendance check-in/out | F |
| Notifications | **missing** | notifications | F |

### Guardian

| Screen | Mode | Grade |
|--------|------|-------|
| Ward overview | me/ward | B |
| Ward attendance | list | B |
| Ward finance / notices | missing | F |

### Visitor desk

| Screen | Mode | Grade |
|--------|------|-------|
| Home list | my visitors | B |
| Register | create | C (tenantId P0) |
| Status + arrive/depart | detail actions | B |
| Approve | admin only (correct absence) | -- |

## P0

- [ ] Reliable `User.tenantId` (seed + /auth/me enrich + client resolve)
- [ ] Credentials path depends on admin tenant create returning password (API P0-T3)

## P1 MVP screens

- [ ] ProfileHeader: name, room, bed, rent, status
- [ ] Invoice detail / open PDF if API returns url
- [ ] UPI/QR display if payments/qr-code usable
- [ ] Meal CategoryChipSelect + feedback history
- [ ] Leaves list (+ create if allowed)
- [ ] Attendance check-in/out
- [ ] Notifications inbox
- [ ] FEATURE_DISABLED empty states

## P2 design

- [ ] Replace Colors.black54 / fixed reds with ColorScheme
- [ ] Shared StatusChip tokens aligned with admin semantics
- [ ] Loading/empty/error consistency across screens

## Connectivity

See [docs/PORTAL_CONNECTIVITY.md](../../PORTAL_CONNECTIVITY.md):

- Web: localhost any port CORS in dev
- iOS: host machine API URL
- Android emulator: `10.0.2.2:8000`
- Prod: PORTAL_URL on API CORS

## Acceptance (portal MVP)

- [ ] Seed tenant can login Flutter Web and iOS
- [ ] View invoices, submit UTR, create complaint, register visitor, submit meal feedback, book laundry
- [ ] Profile shows room assignment
- [ ] flutter analyze clean
- [ ] No admin CRUD in Flutter; no resident pages in Next

## Remediation log

- 2026-07-12: Portal scaffold confirmed present; depth gaps documented for agents.
