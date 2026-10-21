// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Source: packages/types/src/lifecycle.json
// Regenerate: bun run gen:lifecycle
//
// The admin panel reads the same JSON through packages/types/src/lifecycle.ts, so the portal and
// the admin panel render one vocabulary. scripts/audit/check-lifecycle-parity.ts fails the build
// when this file drifts from the source.
//
// ignore_for_file: lines_longer_than_80_chars

/// One state of one domain.
class LifecycleStep {
  const LifecycleStep({
    required this.key,
    required this.label,
    required this.endpoint,
    required this.actor,
    required this.allowedNext,
  });

  /// The status key exactly as the API writes it.
  final String key;

  /// The human label of the state.
  final String label;

  /// The API route that writes this status, or "SERVICE [path]" when a shared service writes it.
  final String endpoint;

  /// The role that performs the transition.
  final String actor;

  /// The status keys that may follow this one.
  final List<String> allowedNext;
}

/// The lifecycle of one domain.
class LifecycleDomain {
  const LifecycleDomain({
    required this.kind,
    required this.label,
    required this.steps,
  });

  /// "ladder" for a progression, "grid" for a set of states with no path between them.
  final String kind;

  /// The human label of the domain.
  final String label;

  /// The states, ordered so that the linear path comes first.
  final List<LifecycleStep> steps;

  /// The linear path of the domain.
  List<LifecycleStep> get spine {
    if (kind == 'grid') return List<LifecycleStep>.of(steps);
    final List<LifecycleStep> path = <LifecycleStep>[];
    for (final LifecycleStep step in steps) {
      if (path.isEmpty) {
        path.add(step);
        continue;
      }
      if (!path.last.allowedNext.contains(step.key)) break;
      path.add(step);
    }
    return path;
  }

  /// The states that are not on the linear path.
  List<LifecycleStep> get branches {
    final Set<String> onPath = <String>{};
    for (final LifecycleStep step in spine) {
      onPath.add(step.key);
    }
    final List<LifecycleStep> result = <LifecycleStep>[];
    for (final LifecycleStep step in steps) {
      if (!onPath.contains(step.key)) result.add(step);
    }
    return result;
  }

  /// The index of the step a branch hangs off.
  int anchorIndex(String branchKey) {
    final List<LifecycleStep> path = spine;
    for (int index = 1; index < path.length; index++) {
      if (path[index].allowedNext.contains(branchKey)) return index;
    }
    return 0;
  }
}

/// Every lifecycle, keyed by domain.
const Map<String, LifecycleDomain> lifecycleDomains = <String, LifecycleDomain>{
  'payment': LifecycleDomain(
    kind: 'ladder',
    label: 'Payment',
    steps: <LifecycleStep>[
      LifecycleStep(
        key: 'pending',
        label: 'Pending',
        endpoint: 'POST /invoices/generate-single',
        actor: 'admin',
        allowedNext: <String>['pending_verification', 'paid', 'overdue', 'cancelled'],
      ),
      LifecycleStep(
        key: 'pending_verification',
        label: 'Pending verification',
        endpoint: 'POST /payments/submit-utr',
        actor: 'tenant',
        allowedNext: <String>['paid', 'pending'],
      ),
      LifecycleStep(
        key: 'paid',
        label: 'Paid',
        endpoint: 'POST /payments/:id/verify',
        actor: 'admin',
        allowedNext: <String>['cancelled'],
      ),
      LifecycleStep(
        key: 'overdue',
        label: 'Overdue',
        endpoint: 'PUT /payments/:id',
        actor: 'admin',
        allowedNext: <String>['paid', 'cancelled'],
      ),
      LifecycleStep(
        key: 'cancelled',
        label: 'Cancelled',
        endpoint: 'POST /payments/:id/void',
        actor: 'admin',
        allowedNext: <String>[],
      ),
    ],
  ),
  'invoice': LifecycleDomain(
    kind: 'ladder',
    label: 'Invoice',
    steps: <LifecycleStep>[
      LifecycleStep(
        key: 'draft',
        label: 'Draft',
        endpoint: 'PUT /invoices/:id',
        actor: 'admin',
        allowedNext: <String>['sent', 'cancelled'],
      ),
      LifecycleStep(
        key: 'sent',
        label: 'Sent',
        endpoint: 'POST /invoices/generate-single',
        actor: 'admin',
        allowedNext: <String>['partial', 'paid', 'overdue', 'cancelled', 'draft'],
      ),
      LifecycleStep(
        key: 'partial',
        label: 'Partially paid',
        endpoint: 'SERVICE apps/api/src/services/payment-status.service.ts',
        actor: 'system',
        allowedNext: <String>['paid', 'cancelled'],
      ),
      LifecycleStep(
        key: 'paid',
        label: 'Paid',
        endpoint: 'SERVICE apps/api/src/services/payment-status.service.ts',
        actor: 'system',
        allowedNext: <String>[],
      ),
      LifecycleStep(
        key: 'overdue',
        label: 'Overdue',
        endpoint: 'PUT /invoices/:id',
        actor: 'admin',
        allowedNext: <String>['partial', 'paid', 'cancelled'],
      ),
      LifecycleStep(
        key: 'cancelled',
        label: 'Cancelled',
        endpoint: 'PUT /invoices/:id',
        actor: 'admin',
        allowedNext: <String>['draft', 'sent'],
      ),
    ],
  ),
  'complaint': LifecycleDomain(
    kind: 'ladder',
    label: 'Complaint',
    steps: <LifecycleStep>[
      LifecycleStep(
        key: 'open',
        label: 'Open',
        endpoint: 'POST /complaints',
        actor: 'tenant',
        allowedNext: <String>['in_progress', 'resolved', 'dismissed'],
      ),
      LifecycleStep(
        key: 'in_progress',
        label: 'In progress',
        endpoint: 'PUT /complaints/:id/status',
        actor: 'admin',
        allowedNext: <String>['resolved', 'dismissed', 'open'],
      ),
      LifecycleStep(
        key: 'resolved',
        label: 'Resolved',
        endpoint: 'PUT /complaints/:id/status',
        actor: 'admin',
        allowedNext: <String>['open'],
      ),
      LifecycleStep(
        key: 'dismissed',
        label: 'Dismissed',
        endpoint: 'PUT /complaints/:id/status',
        actor: 'admin',
        allowedNext: <String>['open'],
      ),
    ],
  ),
  'leave': LifecycleDomain(
    kind: 'ladder',
    label: 'Leave application',
    steps: <LifecycleStep>[
      LifecycleStep(
        key: 'pending',
        label: 'Pending',
        endpoint: 'POST /leaves',
        actor: 'tenant',
        allowedNext: <String>['approved', 'rejected', 'cancelled'],
      ),
      LifecycleStep(
        key: 'approved',
        label: 'Approved',
        endpoint: 'PUT /leaves/:id/approve',
        actor: 'admin',
        allowedNext: <String>[],
      ),
      LifecycleStep(
        key: 'rejected',
        label: 'Rejected',
        endpoint: 'PUT /leaves/:id/reject',
        actor: 'admin',
        allowedNext: <String>[],
      ),
      LifecycleStep(
        key: 'cancelled',
        label: 'Cancelled',
        endpoint: 'POST /leaves/:id/cancel',
        actor: 'tenant',
        allowedNext: <String>[],
      ),
    ],
  ),
  'visitor': LifecycleDomain(
    kind: 'ladder',
    label: 'Visitor pass',
    steps: <LifecycleStep>[
      LifecycleStep(
        key: 'expected',
        label: 'Expected',
        endpoint: 'POST /visitors',
        actor: 'tenant',
        allowedNext: <String>['arrived', 'cancelled'],
      ),
      LifecycleStep(
        key: 'arrived',
        label: 'Arrived',
        endpoint: 'POST /visitors/:id/arrive',
        actor: 'admin',
        allowedNext: <String>['departed'],
      ),
      LifecycleStep(
        key: 'departed',
        label: 'Departed',
        endpoint: 'POST /visitors/:id/depart',
        actor: 'admin',
        allowedNext: <String>[],
      ),
      LifecycleStep(
        key: 'cancelled',
        label: 'Cancelled',
        endpoint: 'POST /visitors/:id/cancel',
        actor: 'tenant',
        allowedNext: <String>['expected'],
      ),
    ],
  ),
  'enquiry': LifecycleDomain(
    kind: 'ladder',
    label: 'Enquiry',
    steps: <LifecycleStep>[
      LifecycleStep(
        key: 'new',
        label: 'New',
        endpoint: 'POST /enquiries',
        actor: 'visitor',
        allowedNext: <String>['contacted', 'converted', 'lost'],
      ),
      LifecycleStep(
        key: 'contacted',
        label: 'Contacted',
        endpoint: 'PUT /enquiries/:id/status',
        actor: 'admin',
        allowedNext: <String>['converted', 'lost', 'new'],
      ),
      LifecycleStep(
        key: 'converted',
        label: 'Converted',
        endpoint: 'PUT /enquiries/:id/status',
        actor: 'admin',
        allowedNext: <String>[],
      ),
      LifecycleStep(
        key: 'lost',
        label: 'Lost',
        endpoint: 'PUT /enquiries/:id/status',
        actor: 'admin',
        allowedNext: <String>['new', 'contacted'],
      ),
    ],
  ),
  'electricity': LifecycleDomain(
    kind: 'ladder',
    label: 'Electricity bill',
    steps: <LifecycleStep>[
      LifecycleStep(
        key: 'draft',
        label: 'Draft',
        endpoint: 'POST /electricity',
        actor: 'admin',
        allowedNext: <String>['finalized'],
      ),
      LifecycleStep(
        key: 'finalized',
        label: 'Finalized',
        endpoint: 'POST /electricity/:id/finalize',
        actor: 'admin',
        allowedNext: <String>['distributed'],
      ),
      LifecycleStep(
        key: 'distributed',
        label: 'Distributed',
        endpoint: 'POST /electricity/:id/distribute',
        actor: 'admin',
        allowedNext: <String>[],
      ),
    ],
  ),
};
