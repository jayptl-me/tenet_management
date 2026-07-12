# Guardians -- Gap Analysis

**Priority:** P0 -- edit save dead; portal routes shadowed; phone validation mismatch.

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/guardian.ts` |
| Routes | `apps/api/src/routes/guardians.ts` |
| Types | `packages/types/src/guardian.ts` |
| FE | `apps/web/src/app/(admin)/guardians/**` |

## Model fields (truth)

- userId (unique, ref User)
- tenantId (ref Tenant)
- name, phone (+91 regex), email?, relation enum `father|mother|guardian|other`
- isActive default true
- **No** `isEmergencyContact` field (computed in mapGuardian as father/mother)

## API surface

| Method | Path | Notes |
|--------|------|-------|
| POST | `/guardians` | admin; transaction User role=guardian + Guardian |
| GET | `/guardians` | admin list + mapGuardian populate |
| GET | `/guardians/:id` | **registered before /me/** |
| PUT | `/guardians/:id` | updateGuardianSchema strictObject |
| DELETE | `/guardians/:id` | soft deactivate guardian + user |
| GET | `/guardians/me/ward` | **DEAD** -- matched as id="me" |
| GET | `/guardians/me/ward/attendance` | **DEAD** same |

### updateGuardianSchema allows only

```
name?, phone? (+91), email?, relation? (enum 4), isActive?
```

Does **not** allow: tenantId, isEmergencyContact, any extra keys (strictObject).

## FE failures (brutal)

### Edit page `guardians/[id]/edit/page.tsx`

1. **Load reset:** `reset(res.data)` expects flat FormData with `tenantId` string and `isEmergencyContact`. API returns nested `tenant` object and computed isEmergencyContact; `tenantId` may be populated object after populate -- ResourceSelect value breaks.

2. **Submit:** `api.put(..., { json: data })` sends full form including:
   - `tenantId` -- **rejected**
   - `isEmergencyContact` -- **rejected**
   - phone as 10-digit possible -- **rejected** by +91 regex
   - relation may be brother/sister/spouse/friend from options -- **rejected** by enum

3. **Relation options** include values outside model enum (edit only; new page is correct enum).

### New page

- Relation enum correct.
- Phone `min(10)` without forcing `+91[6-9]\d{9}` -- create fails unless user types full E.164.

### List / Detail

- Component stack OK (PageHeader, DataTable, StatusBadge, TableActions).
- Detail uses mapGuardian tenant nesting -- OK for display.

## Feature flag

`guardianPortalEnabled` never checked in routes.

## Required fixes (ordered)

1. **Route order:** Register `/me/ward` and `/me/ward/attendance` **before** `/:id`.
2. **Edit submit whitelist:**
   ```ts
   const payload = {
     name: data.name,
     phone: normalizeInPhone(data.phone),
     email: data.email || undefined,
     relation: data.relation, // constrained enum
     isActive: data.isActive,
   };
   ```
3. **Edit load map:**
   ```ts
   tenantId: typeof d.tenantId === 'string' ? d.tenantId : d.tenantId?._id ?? d.tenant?._id
   // do not put isEmergencyContact in PUT body; display-only checkbox or remove
   ```
4. **Phone helper** shared: strip non-digits, if 10 digits prepend +91, validate.
5. **Relation options** on edit = new page enum only.
6. Optional: allow tenant reassignment with explicit schema field + validation.
7. Handle user unique phone 11000 on create.
8. Gate portal routes with `guardianPortalEnabled`.

## Acceptance

- [ ] Create guardian with +91 phone succeeds; User role guardian
- [ ] Edit name/phone/relation/isActive succeeds
- [ ] Edit no longer 400 on strictObject
- [ ] GET /guardians/me/ward returns 200 for guardian JWT
- [ ] DELETE deactivates guardian + user
