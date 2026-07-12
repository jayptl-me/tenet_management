# Settings -- Gap Analysis

**Priority:** P1

## Source

- FE: `apps/web/src/app/(admin)/settings/page.tsx` + `AmenityTypesTab`, `AppearanceTab`
- API: `routes/appConfig.ts` GET/PUT

## Gaps

1. AppearanceTab uses **3 native `<select>`** for preset/mode/fonts -- design violation
2. Feature flag toggles -- ensure PUT features partial works (schema has optional booleans)
3. Amenity definitions editor must preserve key uniqueness and complaint category links
4. Brand color / theme tokens apply via CSS variables -- verify live preview path

## Fixes

- [ ] Replace AppearanceTab selects with themed Select
- [ ] Validate hex colors
- [ ] Document which settings need reseed vs runtime

## Acceptance

- [ ] Save app config persists features + theme
- [ ] Light/dark and preset switch without full reload issues
