/**
 * The module contracts and their checker.
 *
 * WHAT A CONTRACT IS
 * A contract is the written agreement between what the operator believes, what the server
 * actually commits, what the screen shows and where the work goes next. It has five parts:
 *
 *   canonical loop:   what the operator is doing here, and what "done" looks like
 *   state machine:    every status, the inbound trigger that sets it, and the target dwell
 *   truth contract:   what the operator believes happened, what the server commits, how a
 *                     mismatch surfaces, where the provenance lives, what a stuck state means
 *                     and the 3am runbook step
 *   layout:           the archetype, the grammar tokens and the module own number
 *   next best action: per status and per empty state, each pointing at a real screen
 *
 * HOW TO FILL ONE IN
 * 1. Copy the shape from packages/types/src/contracts/payments.ts.
 * 2. Read the anchors out of source, never out of memory: the statuses from the model, the
 *    routes from the API route file, the screens from apps/web/src/app/(admin).
 * 3. Keep every anchor resolvable. A route path that does not exist, a status that no route
 *    can write, a next best action that points nowhere, a component that is not in
 *    apps/web/src/components/ui or a state change that owes a notification the domain never
 *    sends (neither its route file nor the modules that route file imports) are all failures.
 * 4. Register the contract in scripts/audit/check-contracts.ts.
 * 5. If a known gap cannot be closed yet, add one line to KNOWN_BASELINE with the reason. The
 *    checker then reports it as BASELINE instead of hiding it.
 *
 * THE GATE FOR A REBUILT MODULE
 * "This contract exists and its checker passes." A module without a contract cannot be called
 * rebuilt, no matter how many components it has.
 *
 * Run the checker from the repo root: bun scripts/audit/check-contracts.ts
 */

export { LAYOUT_ARCHETYPES } from './module';
export type {
  CanonicalLoop,
  ContractLayout,
  ContractNextBestAction,
  ContractNotification,
  ContractProvenance,
  ContractRuleId,
  ContractStateMachine,
  ContractStatus,
  ContractTruthEntry,
  LayoutArchetype,
  ModuleContract,
  NextBestAction,
  StatusEntryPoint,
} from './module';

export { PAYMENTS_CONTRACT } from './payments';
export { INVOICES_CONTRACT } from './invoices';
export { TENANTS_CONTRACT } from './tenants';
export { COMPLAINTS_CONTRACT } from './complaints';
export { LEAVES_CONTRACT } from './leaves';
export { VISITORS_CONTRACT } from './visitors';
export { ENQUIRIES_CONTRACT } from './enquiries';
export { ELECTRICITY_CONTRACT } from './electricity';
export { ROOMS_CONTRACT } from './rooms';
export { ATTENDANCE_CONTRACT } from './attendance';
export { ASSETS_CONTRACT } from './assets';
export { SERVICES_CONTRACT } from './services';
export { NOTIFICATIONS_CONTRACT } from './notifications';
export { NOTICES_CONTRACT } from './notices';
export { MEALS_CONTRACT } from './meals';
export { MENUS_CONTRACT } from './menus';
export { LAUNDRY_CONTRACT } from './laundry';
export { WASHING_MACHINES_CONTRACT } from './washing-machines';
export { GUARDIANS_CONTRACT } from './guardians';
export { FLOORS_CONTRACT } from './floors';
export { AUDIT_LOGS_CONTRACT } from './audit-logs';
export { EXPORT_CONTRACT } from './export';
export { DASHBOARD_CONTRACT } from './dashboard';

export { KNOWN_BASELINE } from './baseline';
export type { KnownBaselineEntry } from './baseline';
