# Assets Module - Feature Listing

Module: assets
Scope: admin web + API + DB (no portal surface)
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only; resident portal = Flutter only; no Next tenant routes
Pass 1 record: docs/audit/features/assets_audit_pass1_20260908-004257.md

## Feature Listing

| Surface     | Capability                                                                                 | Status  |
| ----------- | ------------------------------------------------------------------------------------------ | ------- |
| List        | summary StatCards + server alert modes + search + placement/stock/category-visual columns  | WORKING |
| Create/Edit | 2-column forms + live preview/context + floor/room links + timeline + danger zone          | WORKING |
| Detail      | StatCards + timeline + stock meter + history card + links + reschedule CTA + retire        | WORKING |
| Shared      | AssetVisuals (meter/timeline/category icons) + banners + badges                             | WORKING |
| API         | enum filters, extended search, floor/room refs + populate, retire audit                    | WORKING |
