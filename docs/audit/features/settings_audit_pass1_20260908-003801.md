# Settings Module - Audit Pass 1

Module: settings (AppConfig console)
Scope: admin web + API + DB
Source verified: 2026-09-08 UTC
Access rule: admin web = admin only

## 1. Selected Module

settings page (853 lines: identity, branding, landing, pricing, features, theme, amenities, password).

## 2. Findings Fixed

| Severity | Finding                                                                                      | Fix                                               | Files                                           | Status  |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- | ------- |
| MISSING  | primaryColorLight in API/model/types but no FE control                                       | Third color input + swatch + sanitize passthrough | settings/page.tsx, sanitize-settings-payload.ts | WORKING |
| SHALLOW  | Save generic error                                                                           | parseApiError                                     | settings/page.tsx                               | WORKING |
| SHALLOW  | Partial address silently dropped                                                             | All-or-nothing hint under Address                 | settings/page.tsx                               | WORKING |
| STALE    | New amenity defs default isPerFloor:false (API/model default true; invisible to floor forms) | Default true with rationale comment               | AmenityTypesTab.tsx                             | WORKING |

## 3. Verified Working (no change)

| Area                                                                          | Proof                                    |
| ----------------------------------------------------------------------------- | ---------------------------------------- |
| youtube + socials all layers                                                  | settings FE + appConfig route/model      |
| roomPricing, sanitize ''->undefined, testimonial filter, GST/PAN public strip | route + sanitize lib                     |
| Password change with token revoke + logout                                    | settings + auth route + guardian profile |

## 4. Verification

bun run lint clean; bun run typecheck clean; no tests executed; no emojis; portal boundaries respected.
