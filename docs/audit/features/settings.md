# Settings -- Feature Audit

**Last verified:** 2026-07-16
**Auditor:** code-verified source pass
**Grade:** A-

## Source map

| Layer | Path |
|-------|------|
| Model | `apps/api/src/models/appConfig.ts` |
| Routes | `apps/api/src/routes/appConfig.ts` (mounted `/api/v1/app-config`) |
| Types | `packages/types/src/appConfig.ts` |
| FE page | `apps/web/src/app/(admin)/settings/page.tsx` |
| Amenity types UI | `apps/web/src/components/admin/AmenityTypesTab.tsx` |
| Appearance UI | `apps/web/src/components/admin/AppearanceTab.tsx` |
| Save sanitizer | `apps/web/src/lib/sanitize-settings-payload.ts` (+ unit test) |
| Feature flag cache | `apps/api/src/middleware/featureFlags.js` invalidated on PUT |

## API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/app-config` | public | Singleton; non-admin strips gstNumber/panNumber; admin JWT returns full |
| PUT | `/api/v1/app-config` | adminOnly | Upsert; Zod includes amenityDefinitions, features, theme, GST/PAN; brandColor expands chroma tokens; invalidates feature-flag cache |

No separate settings routes; AppConfig is the settings store.

## FE page matrix

| Page | Path | Wired | FormPage/DataTable | Notes |
|------|------|-------|--------------------|-------|
| Settings (tabs) | `/settings` | Y | Custom tab shell (not FormPage) | Save All Settings top+bottom; hash tab persistence |
| Tab: general | #general | Y | Inputs | Brand, contact, address, social, primary colors, landing hero |
| Tab: pricing | #pricing | Y | Inputs | roomPricing sharing2/3/4 |
| Tab: payment | #payment | Y | Inputs | upiId, upiPayeeName |
| Tab: amenities | #amenities | Y | string list | Landing-page marketing strings (not amenityDefinitions) |
| Tab: amenity-types | #amenity-types | Y | AmenityTypesTab | Full editor for AmenityDefinition including isPerFloor |
| Tab: testimonials | #testimonials | Y | nested forms | Sanitize drops blank name/quote |
| Tab: features | #features | Y | Switch per flag | IFeatureFlags keys |
| Tab: appearance | #appearance | Y | AppearanceTab | preset/mode/brand/fonts via themed Select |
| Tab: advanced | #advanced | Y | Inputs | GST, PAN, terms |

## Field coverage

| Field | Model | Settings UI | Persist | Gap |
|-------|:-----:|:-----------:|:-------:|-----|
| pgName | Y | general | Y | required on model |
| tagline | Y | general | Y | |
| logoUrl / heroImageUrl | Y | general (URL only) | Y | no file upload picker |
| address.* | Y | general | Y if complete | sanitizer omits incomplete address |
| phone / email | Y | general | Y | empty -> undefined via preprocess/sanitize |
| upiId / upiPayeeName | Y | payment | Y | |
| socialLinks | Y | general | Y | |
| googleMapsEmbedUrl | Y | general | Y | |
| amenities[] (landing) | Y | amenities tab | Y | **distinct** from amenityDefinitions |
| amenityDefinitions[] | Y | AmenityTypesTab | Y | key, label, icon, category, showAsStatusLabel, isPerFloor, maxPerFloor, applicableComplaintCategories |
| roomPricing | Y | pricing | Y | defaults for new rooms UX elsewhere may not auto-apply |
| primaryColor / primaryColorDark | Y | general | Y | primaryColorLight model field not in form |
| landingHero* | Y | general | Y | |
| testimonials | Y | testimonials | Y | blank rows filtered |
| gstNumber / panNumber | Y | advanced | Y | admin-only on GET |
| termsAndConditions | Y | advanced | Y | |
| features.* | Y | features | Y | cache bust on save |
| theme | Y | appearance | Y | brandColor -> customTokens server-side |
| brandTokens | types only | via theme | derived | computed on brandColor |

### AmenityDefinition subfields (AmenityTypesTab)

| Field | Editor | Notes |
|-------|:------:|-------|
| key | Y | locked on edit; lowercase snake validation |
| label | Y | max 50 |
| icon | Y | lucide name picker (limited set) |
| category | Y | essential/appliance/furnishing/other |
| showAsStatusLabel | Y | drives ServiceStatusIndicator default filter |
| isPerFloor | Y | **domain switch**: floor ServiceStatus vs room roomAmenities |
| maxPerFloor | Y when isPerFloor | 0-10 optional |
| applicableComplaintCategories | Y | comma-separated -> array; services complaint enrich |

## Lifecycle / special actions

| Action | API | FE CTA | Status |
|--------|-----|--------|--------|
| Load settings | GET app-config | page mount | OK |
| Save all tabs | PUT app-config | Save All Settings | OK via sanitizeSettingsPayload |
| Edit amenity types | in-memory then save | AmenityTypesTab + global save | Definitions not saved until main Save |
| Toggle feature flags | PUT features | Switches + save | OK; middleware cache invalidated |
| Theme apply | PUT theme | AppearanceTab + save | triggerThemeUpdate after save |
| Delete amenity type | client filter | ConfirmModal | Warns orphan ServiceStatus may remain |

## Domain placement notes

- **amenityDefinitions live only in AppConfig (settings)** -- correct single source of truth.
- **isPerFloor=true:** floors store inventory in amenityCounts; operational health in ServiceStatus (services module); FloorServiceGrid / ServiceStatusIndicator consume these. Floor new/edit count fields and service type dropdowns load from this list.
- **isPerFloor=false:** rooms store status in roomAmenities[]; room new/edit filter `!isPerFloor`. Correct split.
- **Landing `amenities: string[]`** is marketing copy for public/landing -- intentionally separate from structured amenityDefinitions. Tab label "Landing Amenities" clarifies.
- Changing isPerFloor on an existing definition does **not** migrate ServiceStatus <-> roomAmenities data (orphan risk) -- product gap P2.
- AmenityTypesTab default empty template uses `isPerFloor: false` -- new amenities default room-scoped until toggled.

## Design / stack

- Not FormPage: multi-tab settings shell is appropriate
- AppearanceTab uses `@/components/ui/Select` (not native select) -- prior audit claim of native selects is **closed**
- AmenityTypesTab: themed tokens, ConfirmModal, category badges
- Feature switches: `@/components/ui/Switch`
- No StatusBadge needed on this page
- Save feedback: success/error banners

## Open gaps (ordered)

| ID | Sev | Gap | Paths | Later fix agent notes |
|----|-----|-----|-------|----------------------|
| ST-1 | P2 | `IAppConfigUpdate` in packages/types omits amenityDefinitions (and some fields API accepts) | `packages/types/src/appConfig.ts` | Align IAppConfigUpdate with route Zod + model |
| ST-2 | P2 | Toggling isPerFloor does not migrate or clean ServiceStatus / roomAmenities | AmenityTypesTab + services/rooms | On key flip: document admin steps, or cascade job |
| ST-3 | P2 | Deleting amenity definition leaves ServiceStatus / roomAmenities with orphan keys | AmenityTypesTab delete modal already warns | Optional cascade or admin cleanup tool |
| ST-4 | P2 | Logo/hero/photo settings are raw URL text only | settings general | Optional Cloudinary picker consistency |
| ST-5 | P2 | primaryColorLight in model not editable in UI | settings general | Add field or drop from model if unused |
| ST-6 | P3 | AmenityTypesTab changes require global Save (easy to forget) | settings page | Dirty-state hint on tab or auto-prompt |

## Closed / do-not-refile

| Claim | Why closed |
|-------|------------|
| amenityDefinitions stripped by Zod | appConfigUpdateSchema includes full amenityDefinitions array |
| GST/PAN not persisted | schema + model + advanced tab + sanitize payload |
| AppearanceTab uses 3 native selects | AppearanceTab imports themed Select component |
| Feature flags partial PUT broken | features object optional booleans; findOneAndUpdate upsert |
| Amenity types not on FE | AmenityTypesTab fully wired under #amenity-types |
| Landing amenities confused with definitions | Separate tabs: "Landing Amenities" vs "Amenity Types" |
| socialLinks.youtube UI-only / not in API | **FIXED** -- model + Zod + sanitizeSettingsPayload + settings FE + unit tests |
| ST-7 | P3 | Icon picker limited to fixed ICON_OPTIONS set | AmenityTypesTab | Allow free-text lucide name matching server icons |


## Acceptance checklist for fix agents

- [ ] Save persists amenityDefinitions with isPerFloor and reloads correctly
- [ ] Room forms only show !isPerFloor amenities after settings change
- [ ] Floor count forms and service type dropdowns only show isPerFloor amenities
- [ ] ServiceStatusIndicator respects showAsStatusLabel && isPerFloor
- [ ] IAppConfigUpdate types match API
- [ ] Feature flag toggles take effect within cache TTL (or immediately after invalidate)
- [ ] No emoji introduced in settings UI or docs

## Remediation log

| Date | Change |
|------|--------|
| 2026-07-16 | Full re-audit from source; domain placement for amenityDefinitions/isPerFloor documented; closed native-select and Zod-strip claims |
