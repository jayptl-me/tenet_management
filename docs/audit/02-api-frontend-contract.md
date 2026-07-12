# API / Frontend Contract Anti-Patterns

These patterns cause silent production failures while typecheck stays green.

## 1. Zod `strictObject` rejects extra keys

API update schemas use `z.strictObject({...})`. Frontend that spreads full form objects including display-only or load-shape fields gets **400 validation errors**.

| Feature | FE sends | API allows | Result |
|---------|----------|------------|--------|
| Guardians edit | `tenantId`, `isEmergencyContact`, `name`, `phone`, ... | name, phone, email, relation, isActive only | **REJECT** |
| Meals edit | `mealType`, rating, comment, status | rating, comment, status only | **REJECT** |
| Notices edit | `isPublished`, targetType individual, ... | createNoticeSchema.partial without isPublished | **REJECT**/model fail |

**Agent rule:** Build PUT body as an explicit whitelist matching Zod, never `json: data` of full RHF values unless schema matches 1:1.

## 2. Wrong HTTP path

| FE call | Actual API | Effect |
|---------|------------|--------|
| `PUT complaints/${id}` | `PUT /complaints/:id/status` | 404 |
| `PUT enquiries/${id}` | `PUT /enquiries/:id/status` | 404 |
| `PUT attendance/${id}` | (none) | 404 |
| `PUT notifications/${id}` | (none) | 404 |
| `POST menus` | (none) | 404 |
| `GET assets/${id}` | (none) | 404 |
| `GET notices/${id}` | (none) | 404 |
| `GET notifications/${id}` | (none) | 404 |

## 3. Static path after parametric path

Hono matches in registration order. Param routes steal fixed segments:

| File | Bad order | Broken path |
|------|-----------|-------------|
| `guardians.ts` | `GET /:id` then `GET /me/ward` | guardian portal dead |
| `visitors.ts` | `GET /:id` then `GET /my` | tenant visitor list dead |

**Fix:** Register `/me/*` and `/my` **before** `/:id`.

## 4. lean() vs toJSON transforms

`Visitor` toJSON aliases `visitorName` -> `name`, `visitorPhone` -> `phone`.  
Routes use `.lean()` which **skips** transforms.

Edit page maps:

```ts
visitorName: d.name ?? ''
visitorPhone: d.phone ?? ''
```

With lean, `name`/`phone` are undefined; form loads empty name/phone even when DB has data.

**Fix:** Map `d.visitorName ?? d.name` or stop using lean for that response / apply transform manually.

## 5. Enum divergence

| Domain | Frontend | Backend model |
|--------|----------|---------------|
| Complaint priority | `critical` | `urgent` |
| Notice targetType | Zod/route `individual` | model `room` (route Zod already diverged from model) |
| Guardian relation (edit options) | brother, sister, spouse, friend | father, mother, guardian, other |
| Menu isActive | FE filter + badge | **field does not exist** |

## 6. Role guards vs admin UI

| Endpoint | Guard | Admin UI |
|----------|-------|----------|
| `POST /visitors` | `tenantOnly` | Admin New Visitor always 403 |

## 7. Nested document field write mistakes

Tenant create sets top-level `aadhaarUrl` but schema stores `documents.aadhaarUrl`. Value is ignored or stripped unless strict mode errors.

## 8. List endpoint shape mismatches

| FE | API | Issue |
|----|-----|-------|
| `GET notices?page&limit` | `GET /notices` returns role-scoped feed, no meta pagination | Admin list expects meta.total |
| Should use | `GET /notices/admin` | paginated admin list |

## Agent checklist before claiming a form works

1. Open route file; confirm method + path exist.
2. Diff FE payload keys vs Zod strictObject keys.
3. Diff enums FE vs model.
4. Confirm static routes registered before `/:id`.
5. Confirm lean field names match FE mappers.
6. curl happy path + 400 path after fix.
