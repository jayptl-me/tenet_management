import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

/// Outstanding dues for the signed-in tenant.
///
/// Every amount on this screen is computed by the server
/// (`GET tenants/me/dues`): `totalDue` is the sum of the per-invoice
/// `remaining` balances the server derived from settled payments. The portal
/// never adds up money itself, so this screen and the invoice detail screen
/// cannot disagree.
class TenantDuesScreen extends ConsumerStatefulWidget {
  const TenantDuesScreen({super.key});

  @override
  ConsumerState<TenantDuesScreen> createState() => _TenantDuesScreenState();
}

class _TenantDuesScreenState extends ConsumerState<TenantDuesScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _dues;

  // Invoice id by invoice number. The dues payload identifies an invoice by
  // number, the rest of the portal navigates by id, so the two are matched
  // here. A missing id must not leave the card without a next step.
  Map<String, String> _idByInvoiceNumber = {};

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(tenantRepositoryProvider);
      final results = await Future.wait([
        repo.myDues(),
        repo.myInvoices().catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      final invoices = results[1] as List<Map<String, dynamic>>;
      final ids = <String, String>{};
      for (final invoice in invoices) {
        final number = invoice['invoiceNumber']?.toString();
        final id = invoice['_id']?.toString() ?? invoice['id']?.toString();
        if (number == null || number.isEmpty || id == null || id.isEmpty) {
          continue;
        }
        ids[number] = id;
      }
      setState(() {
        _dues = results[0] as Map<String, dynamic>?;
        _idByInvoiceNumber = ids;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _unpaidInvoices {
    final unpaid = _dues?['unpaidInvoices'];
    if (unpaid is! List) return const [];
    return unpaid
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final dues = _dues;
    final totalDue = (dues?['totalDue'] as num?)?.toDouble() ?? 0;
    final depositHeld = (dues?['depositHeld'] as num?)?.toDouble() ?? 0;
    final rows = _unpaidInvoices;

    return Scaffold(
      appBar: AppBar(title: const Text('Dues')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Padding(
                padding: EdgeInsets.all(16),
                child: SkeletonList(cardCount: 3, height: 120),
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!, onRetry: _load),
                    const SizedBox(height: 12),
                  ],
                  if (dues != null) ...[
                    _buildSummary(context, totalDue, depositHeld),
                    const SizedBox(height: 16),
                  ],
                  if (dues == null)
                    EmptyState(
                      message: 'Dues are not available right now',
                      hint: 'This server does not report a dues summary. '
                          'Your invoices still show the latest balance.',
                      icon: Icons.receipt_long_outlined,
                      actionLabel: 'View invoices',
                      onAction: () => context.go('/tenant/invoices'),
                    )
                  else if (rows.isEmpty)
                    EmptyState(
                      message: 'Nothing to pay',
                      hint: 'You have no open invoices. Your account is clear.',
                      icon: Icons.check_circle_outline,
                      actionLabel: 'View all invoices',
                      onAction: () => context.go('/tenant/invoices'),
                    )
                  else
                    ...rows.map((inv) => _buildInvoiceCard(context, inv)),
                ],
              ),
      ),
    );
  }

  Widget _buildSummary(
    BuildContext context,
    double totalDue,
    double depositHeld,
  ) {
    final cs = Theme.of(context).colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Total outstanding',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              formatMoney(totalDue),
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: totalDue > 0 ? AppTheme.dangerText : cs.primary,
                  ),
            ),
            if (depositHeld > 0) ...[
              const SizedBox(height: 4),
              Text(
                'Deposit held ${formatMoney(depositHeld)}',
                style: TextStyle(
                  color: cs.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
            if (totalDue > 0) ...[
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => context.go('/tenant/payments'),
                child: const Text('Pay the outstanding balance'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInvoiceCard(BuildContext context, Map<String, dynamic> inv) {
    final cs = Theme.of(context).colorScheme;
    final number = inv['invoiceNumber']?.toString() ?? 'Invoice';
    final id = (inv['_id'] ?? inv['id'])?.toString() ??
        _idByInvoiceNumber[number] ??
        '';
    final month = (inv['month'] ?? '').toString();
    final total = (inv['totalAmount'] as num?)?.toDouble() ?? 0;
    final remaining = (inv['remaining'] as num?)?.toDouble();
    final status = inv['status']?.toString() ?? '--';
    final dueDate = inv['dueDate'];

    final String money;
    if (remaining == null) {
      money = 'total ${formatMoney(total)} · balance unavailable';
    } else if (remaining <= 0.001) {
      money = 'settled';
    } else {
      money = 'due ${formatMoney(remaining)} of ${formatMoney(total)}';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    number,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                StatusChip(label: status),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              month.isEmpty ? money : '$month · $money',
              style: TextStyle(
                color: cs.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (dueDate != null) ...[
              const SizedBox(height: 2),
              Text(
                'Due ${formatDate(dueDate)}',
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 12),
              ),
            ],
            if (id.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => context.go('/tenant/invoices/$id'),
                      child: const Text('View bill'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.tonal(
                      onPressed: () => context.go(
                        '/tenant/payments?invoiceId=${Uri.encodeComponent(id)}',
                      ),
                      child: const Text('Pay'),
                    ),
                  ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => context.go('/tenant/invoices'),
                child: const Text('View all invoices'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
