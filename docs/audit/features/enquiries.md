# Enquiries -- Gap Analysis

**Priority:** P0

## API

- POST public create
- GET list/detail admin
- PUT **only** `/:id/status`
- DELETE

## FE

- Edit: `put enquiries/${id}` full form body -- **404**
- New: public-style post as admin may work if auth allows (route is publicLimiter only -- OK)

## Fixes

- [ ] Add full PUT or change FE to status endpoint with whitelist
- [ ] Map status enum FE to model exactly
- [ ] Design Select native -- batch E

## Acceptance

- [ ] Status transitions work from admin edit/detail
