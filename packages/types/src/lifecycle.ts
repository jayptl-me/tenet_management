/**
 * The shared lifecycle vocabulary.
 *
 * This file is the single source of truth for the question every module kept answering on its
 * own: which states a record can be in, who moves it there and what may follow. The data lives in
 * `./lifecycle.json` because Dart cannot import TypeScript. `scripts/audit/gen-lifecycle-dart.ts`
 * reads that JSON and emits `mobile/lib/core/models/lifecycle.dart`;
 * `scripts/audit/check-lifecycle-parity.ts` regenerates the Dart file in memory and fails when the
 * file on disk has drifted. One vocabulary, two clients, one generated artefact.
 *
 * Every value was read out of the API on 2026-10-21, not from imagination:
 *
 *   - the status unions: `apps/api/src/models/payment.ts:51`, `invoice.ts:21`, `complaint.ts:69`,
 *     `leaveApplication.ts:43`, `visitor.ts:56`, `enquiry.ts:49`
 *   - the transitions: the route handlers that write a status and the guard they apply to the
 *     previous status, in `apps/api/src/routes/`
 *   - the colour semantics: `packages/types/src/tokens.ts` STATUS_COLOR_MAP
 *
 * Rules for this file, enforced by the parity checker:
 *
 *   - a step key must exist in the status union of that domain's model
 *   - an `allowedNext` entry must be a key of the same domain
 *   - an `endpoint` must be a real API route, or a real shared service file when no route writes
 *     the status on its own
 *
 * A domain whose states do not form a progression declares `kind: "grid"`. It is not forced into a
 * ladder.
 */

import lifecycleJson from './lifecycle.json';

/**
 * `ladder` when the states form a progression (the common case), `grid` when they do not: a grid
 * has states but no path between them, so a stepper renders them as a set, not as steps.
 */
export type LifecycleKind = 'ladder' | 'grid';

/** The role that performs the transition. */
export type LifecycleActor = 'admin' | 'tenant' | 'guardian' | 'visitor' | 'system';

/** One state of one domain. */
export interface LifecycleStep {
  /** The status key exactly as the API writes it (lowercase, snake_case). */
  key: string;
  /** The human label of the state. */
  label: string;
  /**
   * The API route that writes this status, as `METHOD /path`. When no route writes the status on
   * its own and a shared service does it, this is `SERVICE <path under apps/api/src>`.
   */
  endpoint: string;
  /** The role that performs the transition. */
  actor: LifecycleActor;
  /** The status keys that may follow this one, read from the route guards. */
  allowedNext: string[];
}

/** The lifecycle of one domain. */
export interface LifecycleSpec {
  /** `ladder` for a progression, `grid` for a set of states with no path between them. */
  kind: LifecycleKind;
  /** The human label of the domain. */
  label: string;
  /**
   * The states, ordered so that the linear path comes first and the terminal branches follow. The
   * order is the contract: the stepper derives the path from it, so a branch is always listed
   * after the step it hangs off.
   */
  steps: LifecycleStep[];
}

/** The domains that carry a lifecycle. */
export type LifecycleDomain = keyof typeof lifecycleJson;

const raw = lifecycleJson as unknown as Record<LifecycleDomain, LifecycleSpec>;

/** Every lifecycle, keyed by domain. */
export const DOMAINS: Readonly<Record<LifecycleDomain, LifecycleSpec>> = raw;

/** Narrows an arbitrary string to a domain that has a lifecycle. */
export function isLifecycleDomain(value: string): value is LifecycleDomain {
  return Object.prototype.hasOwnProperty.call(DOMAINS, value);
}

/**
 * The lifecycle of one domain.
 *
 * Throws on an unknown domain: a caller that names a domain that does not exist is a bug, and a
 * blank stepper would hide it.
 */
export function lifecycleFor(domain: LifecycleDomain): LifecycleSpec {
  const spec = DOMAINS[domain];
  if (spec === undefined) {
    throw new Error(`Unknown lifecycle domain: ${String(domain)}`);
  }
  return spec;
}

/**
 * The linear path of a domain: the steps that lead from the first state to the last one.
 *
 * The path is derived from the order of the steps and from `allowedNext`: a step joins the path
 * when the step before it lists it as a possible next state. Everything after the first step that
 * is not on the path is a branch (a state the record can only reach by leaving the path, such as
 * `cancelled` or `rejected`).
 *
 * A grid domain has no path: every state is returned.
 */
export function lifecycleSpine(spec: LifecycleSpec): LifecycleStep[] {
  if (spec.kind === 'grid') return [...spec.steps];
  const spine: LifecycleStep[] = [];
  for (const step of spec.steps) {
    const previous = spine[spine.length - 1];
    if (previous === undefined) {
      spine.push(step);
      continue;
    }
    if (!previous.allowedNext.includes(step.key)) break;
    spine.push(step);
  }
  return spine;
}

/** The states that are not on the linear path. */
export function lifecycleBranches(spec: LifecycleSpec): LifecycleStep[] {
  const spineKeys = new Set(lifecycleSpine(spec).map((step) => step.key));
  return spec.steps.filter((step) => !spineKeys.has(step.key));
}

/**
 * The index of the step a branch hangs off.
 *
 * A branch is drawn where the record left the path: the earliest step of the path that can move
 * into the branch. The entry step is only used when no later step can, because a branch drawn at
 * the entry step means the record never advanced.
 */
export function lifecycleAnchorIndex(spec: LifecycleSpec, branchKey: string): number {
  const spine = lifecycleSpine(spec);
  for (let index = 1; index < spine.length; index++) {
    const step = spine[index];
    if (step !== undefined && step.allowedNext.includes(branchKey)) return index;
  }
  return 0;
}
