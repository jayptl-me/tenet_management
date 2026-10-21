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
 */
export const KNOWN_BASELINE: KnownBaselineEntry[] = [
  {
    contract: 'payments',
    rule: 'NOTIFICATION_NOT_IMPLEMENTED',
    reason:
      'payment verify writes an audit log only (apps/api/src/routes/payments.ts:1054-1119), so the resident is never told; the notification lands in wave 2 of the rebuild program',
  },
];
