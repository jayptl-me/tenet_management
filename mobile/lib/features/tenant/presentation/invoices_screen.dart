import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantInvoicesScreen extends ConsumerStatefulWidget {
  const TenantInvoicesScreen({super.key});

  @override
  ConsumerState<TenantInvoicesScreen> createState() => _TenantInvoicesScreenState();
}

class _TenantInvoicesScreenState extends ConsumerState<TenantInvoicesScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];
  String _statusFilter = '';

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
      final rows = await ref.read(tenantRepositoryProvider).myInvoices();
      if (!mounted) return;
      setState(() {
        _rows = rows;
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

  @override
  Widget build(BuildContext context) {
    final visible = _statusFilter.isEmpty
        ? _rows
        : _rows
            .where((inv) => inv['status']?.toString() == _statusFilter)
            .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) ...[
              ErrorBanner(message: _error!, onRetry: _load),
              const SizedBox(height: 12),
            ],
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final s in [
                    '',
                    'draft',
                    'sent',
                    'partial',
                    'paid',
                    'overdue',
                    'cancelled'
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(s.isEmpty ? 'All' : s.replaceAll('_', ' ')),
                        selected: _statusFilter == s,
                        onSelected: (_) =>
                            setState(() => _statusFilter = s),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (_loading)
              const SkeletonList(count: 5)
            else if (visible.isEmpty)
              EmptyState(
                message: 'No invoices found',
                hint: _statusFilter.isEmpty
                    ? 'Nothing is billed to you yet. Your outstanding bill and '
                        'balance are on the dues screen.'
                    : 'No invoice matches this filter.',
                actionLabel: _statusFilter.isEmpty
                    ? 'View the bill'
                    : 'Show all invoices',
                onAction: () {
                  if (_statusFilter.isNotEmpty) {
                    setState(() => _statusFilter = '');
                  } else {
                    context.go('/tenant/dues');
                  }
                },
              )
            else
              ...visible.map(
                (inv) {
                  final id = inv['_id']?.toString() ?? inv['id']?.toString() ?? '';
                  return ListCard(
                    title: inv['invoiceNumber']?.toString() ?? 'Invoice',
                    subtitle: invoiceMoneyLine(inv),
                    trailing: StatusChip(label: inv['status']?.toString() ?? '--'),
                    onTap: id.isNotEmpty
                        ? () => context.go('/tenant/invoices/$id')
                        : null,
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
