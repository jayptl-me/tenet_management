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
    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ErrorBanner(message: _error!),
                  if (_rows.isEmpty)
                    const EmptyState(message: 'No invoices found')
                  else
                    ..._rows.map(
                      (inv) {
                        final id = inv['_id']?.toString() ?? inv['id']?.toString() ?? '';
                        return ListCard(
                          title: inv['invoiceNumber']?.toString() ?? 'Invoice',
                          subtitle:
                              '${inv['month'] ?? ''} · ${formatMoney(inv['totalAmount'] as num?)}',
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
