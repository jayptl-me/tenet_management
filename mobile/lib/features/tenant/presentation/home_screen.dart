import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_features.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import '../data/tenant_repository.dart';

export '../data/tenant_repository.dart' show tenantRepositoryProvider;

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
  Map<String, dynamic>? _profile;

  // Outstanding dues come from their own endpoint and are loaded separately,
  // so a dues failure never blanks the rest of the home screen.
  Map<String, dynamic>? _dues;
  String? _duesError;
  bool _duesLoading = true;

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
      final tenantId = await ref.read(authProvider.notifier).ensureTenantId();
      Future<Map<String, dynamic>?> profileFuture;
      if (tenantId != null && tenantId.isNotEmpty) {
        profileFuture = repo.tenantProfile(tenantId).catchError((_) => null);
      } else {
        profileFuture = Future.value(null);
      }

      final results = await Future.wait([
        repo.myInvoices(),
        repo.myComplaints(),
        repo.unreadNotificationCount().catchError((_) => 0),
        profileFuture,
      ]);
      if (!mounted) return;
      setState(() {
        _invoices = (results[0] as List<Map<String, dynamic>>).take(5).toList();
        _complaints =
            (results[1] as List<Map<String, dynamic>>).take(5).toList();
        _unreadCount = results[2] as int;
        _profile = results[3] as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
    await _loadDues();
  }

  /// Outstanding balance for this tenant. Every number is computed by the
  /// server (`GET tenants/me/dues`); the portal never derives one.
  Future<void> _loadDues() async {
    setState(() {
      _duesLoading = true;
      _duesError = null;
    });
    try {
      final dues = await ref.read(tenantRepositoryProvider).myDues();
      if (!mounted) return;
      setState(() {
        _dues = dues;
        _duesLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _duesError = e.toString().replaceFirst('Exception: ', '');
        _duesLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final features =
        ref.watch(appFeaturesProvider).valueOrNull ?? const AppFeatures();

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
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome${user != null ? ', ${user.name}' : ''}',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Invoices, payments, visitors, and more.',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                if (_profile != null && _profile!['room'] != null) ...[
                  const SizedBox(width: 8),
                  InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: () => context.go('/tenant/room'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: Theme.of(context)
                              .colorScheme
                              .primary
                              .withValues(alpha: 0.2),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.bed_outlined,
                            size: 16,
                            color: Theme.of(context).colorScheme.onPrimaryContainer,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'Room ${(_profile!['room'] as Map?)?['roomNumber'] ?? '--'} · Bed ${_profile!['bedId'] ?? '--'}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Theme.of(context).colorScheme.onPrimaryContainer,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              ErrorBanner(message: _error!, onRetry: _load),
              const SizedBox(height: 12),
            ],
            _buildDuesCard(context),
            const SizedBox(height: 16),
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
                ActionChip(
                  avatar: const Icon(Icons.room_service_outlined, size: 16),
                  label: const Text('Services',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  onPressed: () => context.go('/tenant/services'),
                ),
                ActionChip(
                  avatar: const Icon(Icons.bolt, size: 16),
                  label: const Text('Electricity',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  onPressed: () => context.go('/tenant/electricity'),
                ),
                if (features.attendanceEnabled)
                  ActionChip(
                    avatar: const Icon(Icons.how_to_reg_outlined, size: 16),
                    label: const Text('Attendance',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    onPressed: () => context.go('/tenant/attendance'),
                  ),
                ActionChip(
                  avatar: const Icon(Icons.restaurant_outlined, size: 16),
                  label: const Text('Meals',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  onPressed: () => context.go('/tenant/meals'),
                ),
                if (features.noticeBoardEnabled)
                  ActionChip(
                    avatar: const Icon(Icons.campaign_outlined, size: 16),
                    label: const Text('Notices',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    onPressed: () => context.go('/tenant/notices'),
                  ),
                if (features.laundryEnabled)
                  ActionChip(
                    avatar: const Icon(Icons.local_laundry_service_outlined, size: 16),
                    label: const Text('Laundry',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    onPressed: () => context.go('/tenant/laundry'),
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
              const SkeletonList(count: 3)
            else if (_invoices.isEmpty)
              EmptyState(
                message: 'No invoices yet',
                hint: 'Your outstanding balance and every open bill are on '
                    'the dues screen.',
                actionLabel: 'Open the dues view',
                onAction: () => context.go('/tenant/dues'),
              )
            else
              ..._invoices.map((inv) {
                final id =
                    inv['_id']?.toString() ?? inv['id']?.toString() ?? '';
                return ListCard(
                  title: inv['invoiceNumber']?.toString() ??
                      inv['_id']?.toString() ??
                      'Invoice',
                  subtitle: invoiceMoneyLine(inv),
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
            if (_loading)
              const SkeletonList(count: 2)
            else if (_complaints.isEmpty)
              EmptyState(
                message: 'No complaints',
                hint: 'Nothing to report right now. Raise an issue from the '
                    'complaints screen if something breaks.',
                actionLabel: 'Raise an issue',
                onAction: () => context.go('/tenant/complaints'),
              )
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

  /// The outstanding balance card. This is the number the resident came for,
  /// and it comes from the server (`GET tenants/me/dues`), never from a local
  /// sum of invoice totals.
  Widget _buildDuesCard(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    if (_duesLoading) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: SkeletonBlock(height: 72),
        ),
      );
    }

    if (_duesError != null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Outstanding balance',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              ErrorBanner(message: _duesError!, onRetry: _loadDues),
            ],
          ),
        ),
      );
    }

    final dues = _dues;
    if (dues == null) {
      // The dues endpoint is not served by this API build yet. Say so and
      // point at the screen that still works.
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Outstanding balance',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              Text(
                'The dues summary is not available right now. Your invoices '
                'show the latest balance.',
                style: TextStyle(color: cs.onSurfaceVariant),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => context.go('/tenant/invoices'),
                child: const Text('View invoices'),
              ),
            ],
          ),
        ),
      );
    }

    final totalDue = (dues['totalDue'] as num?)?.toDouble() ?? 0;
    final depositHeld = (dues['depositHeld'] as num?)?.toDouble() ?? 0;
    final unpaid = dues['unpaidInvoices'];
    final openCount = unpaid is List ? unpaid.length : 0;
    final checkedOut = dues['checkedOut'] == true;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Outstanding balance',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                if (checkedOut)
                  const Text(
                    'Stay closed',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.muted,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              formatMoney(totalDue),
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: totalDue > 0 ? AppTheme.dangerText : cs.primary,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              openCount == 0
                  ? 'No open invoices. Nothing to pay.'
                  : '$openCount open invoice${openCount == 1 ? '' : 's'}',
              style: TextStyle(
                color: cs.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (depositHeld > 0)
              Text(
                'Deposit held ${formatMoney(depositHeld)}',
                style: TextStyle(
                  color: cs.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: () => context.go('/tenant/dues'),
                    child: const Text('View dues'),
                  ),
                ),
                if (totalDue > 0) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => context.go('/tenant/payments'),
                      child: const Text('Pay now'),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
