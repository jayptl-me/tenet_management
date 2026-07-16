# Agent Playbook -- Live Remediation Order

Updated **2026-07-16** after full FE page-by-page re-audit + worktree reconcile. Historical Batches A-E closed all **P0** integrity items. Remaining work is **open P1/P2** from [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) queues A-E.

**Always load:** [AGENTS.md](../../AGENTS.md), [docs/AGENT_CONTEXT.md](../AGENT_CONTEXT.md), [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md), matching `docs/audit/features/<module>.md`.

**Theme priority:** Admin UI work targets **`saas`** preset + CSS tokens + shared Form/DataTable components. No emojis. Portal UI only in `mobile/`.

---

## Definition of Done (every feature fix)

- [ ] List: PageHeader + DataTable + TableActions + mobileCardRenderer + StatusBadge where status exists
- [ ] New/Edit: FormPage + FormCard + FormSection + FormActions
- [ ] Payload keys exact match Zod; no phantom fields
- [ ] Load maps actual API lean/mapped shape
- [ ] Save hits real route; 200/201
- [ ] Phone `normalizeInPhone`; dates ISO when required
- [ ] Errors show API `error.message` / code (`parseApiError`)
- [ ] Feature-flagged domains: `requireFeature` + Sidebar + CommandPalette (and Flutter FeatureDisabledWidget when portal)
- [ ] SaaS tokens only; no native OS selects for domain fields
- [ ] Domain placement: room amenities only `!isPerFloor`; floor services only `isPerFloor`
- [ ] `bun run typecheck` and `bun run lint` green
- [ ] Flutter: `cd mobile && flutter analyze` when mobile touched
- [ ] Update `docs/audit/features/<name>.md` + LIVE_GAP_INVENTORY (mark FIXED with date)

---

## Current fix queues (2026-07-16 reconcile)

Prefer [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) "Ordered fix queues" as source of truth.

### Queue A -- Domain residuals (P2)

1. Amenity isPerFloor flip/delete migration (ST-2/ST-3)
2. Seed key polish if any residual drift

### Queue B -- Integrity -- **DONE** (do not re-open)

P1-T1, P1-T2/G1, P1-V1, CMP-authz, N1/N2 all closed in current tree.

### Queue C -- FE UX residuals (P2)

1. Invoice residual polish (month filter, floor populate)
2. Assets P2 (banner filter, service-due)
3. ~~ELEC-P1-1 share math~~ **DONE** -- date-windowed distribute (2026-07-16)

### Queue D -- Flutter residual

1. **P1-AUTH-PW** change/forgot password UX (deferred portal polish)
2. ~~F1/F2 notification history / isRead~~ **DONE**
3. ~~QR/PDF/home/complaint/heal/flags/guardian~~ **DONE**

### Queue E -- Flags, audit, notifications

1. FLAG-menus / FLAG-emergency product decisions (P2 residual)
2. ~~A1 expand writeAuditLog~~ **DONE** (notices/services/visitors/notifications)
3. ~~F1/F2/F3 notification semantics~~ **DONE**
4. ~~D2 / FLAG-leaves / FLAG-flutter / P1-V2~~ **DONE**

### Do not re-implement (reconcile-closed)

| ID | Status |
|----|--------|
| INV-P1-1, PAY-P1-1, ENQ-convert, P1-T3 | **CLOSED** |
| D1 / D2 badges unreadBy + badges-update | **CLOSED** |
| FLAG-palette / FLAG-leaves / FLAG-flutter | **CLOSED** |
| youtube, AST-delete/dates, N3 ResourceSelect | **CLOSED** |
| FL-1 / SV-1 / SV-2 / N1 / N2 domain | **CLOSED** |
| P1-V1 / P1-V2 visitors | **CLOSED** |
| RM-7 / P2-G2 deactivate copy | **CLOSED** |
| P1-T1 / P1-T2 bed + cascade | **CLOSED** |
| ELEC-P1-1 distribute vs calculateElectricityShare | **CLOSED** -- date-windowed occupants |
| P1-PAY-QR / INV-PDF / HOME / CMP-DET / TID-HEAL / FLAG-UX / GUARD-DEPTH | **CLOSED** |

---

## Historical batches A-E (COMPLETE -- do not re-implement)

### A1-A5 P0 integrity -- DONE

- Transfer atomic, isActive removed, temp password returned, visitor filter enums, Flutter tenantId seed + heal

### B SaaS components -- DONE

### C Flutter MVP screens -- DONE (residual P1-AUTH-PW only)

### D Authz visitors/nested GET -- DONE

### E Tests + deploy render.yaml server web -- DONE

---

## Anti-patterns

| Do not | Do instead |
|--------|------------|
| Re-add Next.js tenant/guardian routes | Work in `mobile/` only |
| Put rent/beds on floor forms | Room model only |
| Store room-only amenities as ServiceStatus | roomAmenities + isPerFloor=false |
| Trust old fe-batch*.md open rows blindly | Re-read source + feature MD Last verified date |
| Mark FIXED without path proof | Cite file and briefly re-verify |
| Re-open closed IDs (INV/PAY/D1/D2/ENQ/flags/domain/Flutter depth) | Already fixed in current tree |
| Put FIXED text inside Open P1 table rows | Move to Recently closed only |

---

## Audit MD pipeline (keep gaps honest)

1. Edit **feature MD** Open gaps / Closed only (never put FIXED in Open gaps)
2. `python3 scripts/audit/normalize-gap-sections.py`
3. `python3 scripts/audit/build-live-gap-tables.py`
4. `python3 scripts/audit/lint-gap-sections.py` must print TOTAL FAIL: 0
5. `python3 scripts/audit/reconcile-open-gaps.py` must PASS

## File map

| Path | Role |
|------|------|
| [LIVE_GAP_INVENTORY.md](./LIVE_GAP_INVENTORY.md) | Ranked open/closed backlog |
| [README.md](./README.md) | Executive summary |
| [features/](./features/) | Per-module audits |
| [interconnections/](./interconnections/) | Cross-module flows |
| [fe-batch1-audit.md](./fe-batch1-audit.md) etc. | Superseded historical notes |
