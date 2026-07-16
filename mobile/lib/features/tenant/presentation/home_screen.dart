import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import '../data/tenant_repository.dart';

final tenantRepositoryProvider = Provider(
  (ref) => TenantRepository(ref.watch(apiClientProvider)),
);

class TenantHomeScreen extends ConsumerStatefulWidget {
  const TenantHomeScreen({super.key});

  @override
  ConsumerState<TenantHomeScreen> createState() => _TenantHomeScreenState();
}

class _TenantHomeScreenState extends ConsumerState<TenantHomeScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _invoices = [];
  List<Map<String, dynamic>> _complaints = [];
  int _unreadCount = 0;

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
        repo.myInvoices(),
        repo.myComplaints(),
        repo.unreadNotificationCount().catchError((_) => 0),
      ]);
      if (!mounted) return;
      setState(() {
        _invoices = (results[0] as List<Map<String, dynamic>>).take(5).toList();
        _complaints =
            (results[1] as List<Map<String, dynamic>>).take(5).toList();
        _unreadCount = results[2] as int;
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
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => context.go('/tenant/notifications'),
            icon: Badge(
              isLabelVisible: _unreadCount > 0,
              label: Text(
                _unreadCount > 99 ? '99+' : '$_unreadCount',
                style: const TextStyle(fontSize: 10),
              ),
              child: const Icon(Icons.notifications_outlined),
            ),
          ),
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Welcome${user != null ? ', ${user.name}' : ''}',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              'Invoices, payments, visitors, and more.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 12),
            ],
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ActionChip(
                  label: const Text('Invoices',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  onPressed: () => context.go('/tenant/invoices'),
                ),
                ActionChip(
                  label: const Text('Pay / UTR',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  onPressed: () => context.go('/tenant/payments'),
                ),
                ActionChip(
                  label: const Text('Visitors',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  onPressed: () => context.go('/tenant/visitors'),
                ),
                ActionChip(
                  label: const Text('Complaints',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  onPressed: () => context.go('/tenant/complaints'),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Recent invoices',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                TextButton(
                  onPressed: () => context.go('/tenant/invoices'),
                  child: const Text('See all'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_invoices.isEmpty)
              const EmptyState(message: 'No invoices yet')
            else
              ..._invoices.map((inv) {
                final id =
                    inv['_id']?.toString() ?? inv['id']?.toString() ?? '';
                return ListCard(
                  title: inv['invoiceNumber']?.toString() ??
                      inv['_id']?.toString() ??
                      'Invoice',
                  subtitle:
                      '${inv['month'] ?? ''} · ${formatMoney(inv['totalAmount'] as num?)}',
                  trailing:
                      StatusChip(label: inv['status']?.toString() ?? '--'),
                  onTap: id.isEmpty
                      ? () => context.go('/tenant/invoices')
                      : () => context.go('/tenant/invoices/$id'),
                );
              }),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Complaints',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                TextButton(
                  onPressed: () => context.go('/tenant/complaints'),
                  child: const Text('See all'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (!_loading && _complaints.isEmpty)
              const EmptyState(message: 'No complaints')
            else
              ..._complaints.map((c) {
                final id = c['_id']?.toString() ?? c['id']?.toString() ?? '';
                return ListCard(
                  title: c['title']?.toString() ?? 'Complaint',
                  trailing:
                      StatusChip(label: c['status']?.toString() ?? '--'),
                  onTap: id.isEmpty
                      ? () => context.go('/tenant/complaints')
                      : () => context.go('/tenant/complaints/$id'),
                );
              }),
          ],
        ),
      ),
    );
  }
}
