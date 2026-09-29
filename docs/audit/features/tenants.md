# Tenants Module - Feature Listing

Module: tenants
Scope: admin web + API + DB + Flutter resident portal
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Implementation spec: docs/audit/features/tenants_audit_pass1_20260908-230000.md

## Feature Listing

| Surface | Capability | Status |
| ------- | ---------- | ------ |
| List (admin) | search/status/floor filters, floor+room+bed column, inline KYC review badges (Verified/Pending/No Docs) in table, mobile cards, and CSV export, pagination, cascade-enumerated delete confirm | WORKING |
| Detail (admin) | stat strip, contact/room cards, KYC upload + verify, checkout modal with dues gate and per-invoice balances, reinstate with alternate-bed picker, Statement of Account PDF, guardians/payments/invoices/complaints cards, tenancy calendar, activity timeline | WORKING |
| Create (admin) | roomId+bedId deep-link prefill, temp credentials dialog, emergency contact all-or-none validation | WORKING |
| Edit (admin) | inactive lock banner, atomic room/bed transfer with BED_OCCUPIED handling | WORKING |
| API | CRUD, /:id/dues, /:id/checkout, /:id/reinstate, /:id/documents, /:id/verify-kyc, /:id/payments, /:id/complaints, /:id/invoices, /:id/statement.pdf, /:id/activity, full cascade delete | WORKING |
| API (self-service) | PATCH /tenants/me/profile - tenant updates own phone + emergency contact, duplicate-phone 409, audit logged; POST /tenants/me/documents - tenant Aadhaar/photo upload, resets KYC verification for admin re-review, notifies all active admins (kyc_uploaded push + SSE) | WORKING |
| Profile (tenant, Flutter) | hero header with photo, contact card with editable mobile, editable emergency contact (add/edit/call), room/rent incl. floor + move-out, KYC document upload/replace (Aadhaar also as PDF via file_picker) with progress and 5 MB pre-check, real KYC status from tenant.documents, change password | WORKING |
| Ward (guardian, Flutter) | ward identity card with avatar, floor, move-in, call-ward action, dues summary from remaining balances (open invoices, outstanding balance), attendance + notices navigation, change password | WORKING |
