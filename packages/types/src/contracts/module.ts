/**
 * The per-module contract.
 *
 * A contract is the written agreement between what the operator believes, what the server
 * actually commits, what the screen shows and where the work goes next. A module that cannot
 * fill one in is hollow by definition, no matter how many components it has.
 *
 * Every anchor in a contract (a route path, a status, a screen, a component) is checked
 * against the live code by `bun scripts/audit/check-contracts.ts`. If the code moves and the
 * contract does not, the checker fails and the gate goes red.
 */

import type { INotificationType } from '../notification';

/**
 * The layout archetypes a module root may declare.
 * Exactly one per module, chosen by what the operator does there, not by a shared template.
 */
export const LAYOUT_ARCHETYPES = [
  'ledger',
  'roster',
  'board',
  'calendar',
  'floor-map',
  'stepper',
  'receipt',
  'workspace',
] as const;

/** The archetype of a module root. */
export type LayoutArchetype = (typeof LAYOUT_ARCHETYPES)[number];

/**
 * The rules the contract checker enforces.
 *
 * The ids are shared by the checker (scripts/audit/check-contracts.ts) and the known baseline
 * (packages/types/src/contracts/baseline.ts), so a baseline entry always names a real rule.
 */
export type ContractRuleId =
  | 'ROUTE_NOT_FOUND'
  | 'STATUS_NOT_SETTABLE'
  | 'STATUS_MISSING_ENTERED_BY'
  | 'NEXT_ACTION_TARGET_NOT_FOUND'
  | 'NOTIFICATION_NOT_IMPLEMENTED'
  | 'LAYOUT_ARCHETYPE_INVALID'
  | 'LAYOUT_GRAMMAR_TOKEN_MISSING';

/** The canonical loop: what the operator is doing here and what "done" looks like. */
export interface CanonicalLoop {
  /** What the operator is doing on this module, in one sentence. */
  operatorIsDoing: string;
  /** What "done" looks like, in observable terms the operator can see. */
  doneLooksLike: string;
  /** The single primary action of the module. */
  primaryAction: string;
}

/** The inbound trigger that can move a record into a status. */
export interface StatusEntryPoint {
  /** HTTP method of the route that sets the status. */
  method: string;
  /** API path of that route, without the API version prefix (for example /payments/:id/verify). */
  path: string;
  /** The condition under which the route actually sets the status. */
  condition?: string;
}

/** One status of the module state machine. */
export interface ContractStatus {
  /** The status literal, spelled exactly as the model spells it. */
  status: string;
  /** The route that can move a record into this status. */
  enteredBy: StatusEntryPoint;
  /** Target dwell time in this status; omitted while the product decision is still pending. */
  dwell?: number;
  /** Unit of the dwell time. */
  dwellUnit?: 'hours' | 'days';
}

/** The state machine of a module: a ladder (a progression) or a grid (a set of parallel states). */
export interface ContractStateMachine {
  /** The domain name; it resolves the API model, the API route file and the admin module. */
  domain: string;
  /**
   * The model file name without extension, when it differs from the domain
   * name (the route file is payments.ts, the model is payment.ts). When it is
   * omitted the checker tries the domain name and its singular form.
   */
  model?: string;
  /** Whether the module is a progression (ladder) or a set of parallel states (grid). */
  kind: 'ladder' | 'grid';
  /** Every status the module can hold, with the trigger that sets it. */
  statuses: ContractStatus[];
  /** The status a record ends in when the work is done. */
  terminal?: string;
  /** The status that is a dead letter box: nothing moves a record out of it. */
  deadEnd?: string;
}

/** The notification a state change owes to somebody. */
export interface ContractNotification {
  /** Who has to hear about it. */
  to: 'tenant' | 'admin';
  /** The notification type; a member of INotificationType from ../notification. */
  type: INotificationType;
  /** True when the state change is owed a notification and the server has to send it. */
  required: boolean;
}

/** Where the proof of a state change lives. */
export interface ContractProvenance {
  /** The audit action written by the handler, for example payment_verify. */
  auditAction?: string;
  /** The screen where the operator or the resident can see that proof. */
  screen?: string;
  /** Who performs the action. */
  actor?: string;
}

/** One action of the module, with the truth it must keep. */
export interface ContractTruthEntry {
  /** The action the operator takes. */
  action: string;
  /** What the operator believes happened when they take it. */
  operatorBelieves: string;
  /** What the server actually writes when they take it. */
  serverCommits: string;
  /** The notification the state change owes, when there is one. */
  notification?: ContractNotification;
  /** Where a mismatch between belief and server state becomes visible. */
  mismatchSurfacedAt?: string;
  /** Where the proof of the write lives. */
  provenance?: ContractProvenance;
  /** What a record stuck in this state means. */
  stuckStateMeans?: string;
  /** The one step to take at 3am when this action has gone wrong. */
  runbook3am?: string;
}

/** The layout declaration of a module root. */
export interface ContractLayout {
  /** The archetype of this module root. */
  archetype: LayoutArchetype;
  /** The grammar tokens of this module; each must exist in apps/web/src/components/ui. */
  grammarTokens: string[];
  /** What this module must never look like, so two module roots cannot be interchangeable. */
  mustNotLookLike?: string;
  /** The one number on the top band that no other module could compute. */
  ownNumber?: string;
}

/** One next best action. */
export interface NextBestAction {
  /** What the operator sees on the button. */
  label: string;
  /** Where the action goes; it must resolve to a real screen or route. */
  target: string;
  /** The condition under which the action is available. */
  enabledWhen?: string;
}

/** The next best action map of a module. */
export interface ContractNextBestAction {
  /** The next best action per status of the state machine. */
  perStatus: Record<string, NextBestAction>;
  /** The next best action per empty state of the module. */
  perEmptyState: Record<string, NextBestAction>;
}

/**
 * A module contract.
 *
 * The first three fields are the load bearing ones: the canonical loop, the state machine and
 * the truth contract. The layout and the next best action map are declared by the module that
 * owns the screen.
 */
export interface ModuleContract {
  /** What the operator is doing here and what "done" looks like. */
  canonicalLoop: CanonicalLoop;
  /** Every status, the trigger that sets it and the target dwell. */
  stateMachine: ContractStateMachine;
  /** One entry per action, with the truth the action has to keep. */
  truthContract: ContractTruthEntry[];
  /** The archetype, the grammar tokens and the module own number. */
  layout: ContractLayout;
  /** The next best action per status and per empty state. */
  nextBestAction: ContractNextBestAction;
}
