# Flutter Portal - Audit Pass 1

Module: flutter-portal (tenant + guardian + visitor desk, Web/iOS/Android)
Scope: mobile/ only (Dart; flutter analyze clean)
Source verified: 2026-09-08 UTC
Access rule: tenant/guardian login only; admin rejected client-side; server role guards deny everything cross-portal

## 1. Selected Module

All resident portal screens (tenant tab set, guardian shell, visitor desk).

## 2. Findings Fixed

| Severity | Finding                                                                              | Fix                                                         | Files                                                | Status  |
| -------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- | ------- |
| BROKEN   | floorServices unwrapped {services,totalRooms} dict to [] (services always empty)     | Unwrap data['services']                                     | tenant_repository.dart                               | WORKING |
| BROKEN   | Report-issue deep link sent raw serviceType (water_supply/geyser invalid categories) | categoryMap water_supply->water, geyser->other              | services_screen.dart                                 | WORKING |
| BROKEN   | meals parse expected isHoliday/notes/special (absent in API)                         | Dead branches deleted; List-shape parse; snacks slot + icon | meals_screen.dart                                    | WORKING |
| BROKEN   | guardian notices() handled List only (API wraps)                                     | Map[data] unwrap mirror                                     | guardian_repository.dart                             | WORKING |
| BROKEN   | Bill proof rendered as raw URL text                                                  | Image preview + external open (PDF aware)                   | electricity_screen.dart                              | WORKING |
| SHALLOW  | Washing floor via 3-hop myFloorId chain                                              | myWashingMachines single-hop + fallback                     | washing_machines_screen.dart, tenant_repository.dart | WORKING |
| SHALLOW  | Laundry notes cap 150 vs API 300                                                     | maxLength 300                                               | laundry_screen.dart                                  | WORKING |
| SHALLOW  | bookLaundry sent tenantId (server forces own)                                        | Optional tenantId (admin flows only)                        | tenant_repository.dart                               | WORKING |
| MISSING  | Leave sheet no duration feedback                                                     | Inclusive day count + range warning                         | leaves_screen.dart                                   | WORKING |
| MISSING  | Invoices no balance/filter                                                           | Due math + status chips                                     | invoices_screen.dart                                 | WORKING |
| MISSING  | UTR form no screenshot URL                                                           | Optional screenshot field + passthrough                     | payments_screen.dart, tenant_repository.dart         | WORKING |
| MISSING  | Notices no pin affordance                                                            | Pinned chip (tenant + guardian lists)                       | notices_screen.dart, guardian_notices_screen.dart    | WORKING |
| MISSING  | Ward attendance fixed limit:100, no dates                                            | From/to pickers wired to repo params                        | ward_attendance_screen.dart                          | WORKING |
| MISSING  | Invoice detail no resident context                                                   | Billed Resident card (room/bed)                             | invoice_detail_screen.dart                           | WORKING |
| MISSING  | Laundry cards no items/notes                                                         | Subtitle items + notes                                      | laundry_screen.dart                                  | WORKING |

## 3. Verified Working (no change)

| Area                                                      | Proof                                  |
| --------------------------------------------------------- | -------------------------------------- |
| Auth reject-admin + tenant heal + session                 | auth_repository.dart, auth_provider    |
| Visitor register/status/home + tenant tab                 | visitor/*, visitors_tab_screen.dart    |
| Complaint create/detail + cancel leaves + payments QR/UTR | tenant screens                         |
| FeatureDisabledWidget on flag-off                         | laundry/leaves/notices/visitor screens |
| Receipt gating settled-only (portal-appropriate)          | payments_screen.dart                   |
| Complaint photo http(s) accepted (matches API z.url)      | complaints_screen.dart                 |

## 4. Verification

flutter analyze: No issues found; no emojis; portal boundaries respected (no Next resident routes added anywhere).
