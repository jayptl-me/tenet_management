import type { ContractRuleId } from './module';

/**
 * One known failure of a contract that is allowed to fail for now.
 *
 * A baseline entry is not a waiver: it names the contract, the rule and the reason, so the
 * checker can report the failure as BASELINE instead of hiding it. The entry is deleted when
 * the reason stops being true, and the checker then goes red on it.
 */
export interface KnownBaselineEntry {
  /** The contract the entry applies to, by contract id. */
  contract: string;
  /** The rule the entry applies to; when omitted the whole contract is baselined. */
  rule?: ContractRuleId;
  /** One line on why this is known and allowed to fail for now. */
  reason: string;
}

/**
 * The known baseline of the contract checker.
 *
 * The contract checker is not allowed to be red from day one, but it is also not allowed to be
 * green while a known gap is still open. Every entry below turns one failure into a BASELINE
 * line in the report; nothing else is suppressed.
 *
 * The list is empty on 2026-10-21: the last entry (payment verification sent no notification to
 * the resident) was closed in wave 2, and the checker proved it - the NOTIFICATION_NOT_IMPLEMENTED
 * rule went green on its own, so the entry was deleted instead of being left to rot.
 */
export const KNOWN_BASELINE: KnownBaselineEntry[] = [];
