import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import '../data/guardian_repository.dart';

final guardianRepositoryProvider = Provider(
  (ref) => GuardianRepository(ref.watch(apiClientProvider)),
);

class GuardianWardScreen extends ConsumerStatefulWidget {
  const GuardianWardScreen({super.key});

  @override
  ConsumerState<GuardianWardScreen> createState() => _GuardianWardScreenState();
}

class _GuardianWardScreenState extends ConsumerState<GuardianWardScreen> {
  bool _loading = true;
  String? _error;
  bool _featureDisabled = false;
  Map<String, dynamic>? _ward;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _featureDisabled = false;
    });
    try {
      final ward = await ref.read(guardianRepositoryProvider).ward();
      if (!mounted) return;
      setState(() {
        _ward = ward;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _featureDisabled = e.isFeatureDisabled;
        _ward = e.statusCode == 404 ? null : _ward;
        _error = e.isFeatureDisabled || e.statusCode == 404 ? null : e.message;
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
    final tenant = _ward?['tenant'] as Map?;
    final tenantUser = tenant?['user'] as Map?;
    final room = tenant?['room'] as Map?;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ward overview'),
        actions: [
          IconButton(
            tooltip: 'My Profile',
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/guardian/profile'),
          ),
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
          ),
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => _confirmSignOut(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _featureDisabled && !_loading
            ? ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 80),
                  FeatureDisabledWidget(
                    message:
                        'Guardian portal is not enabled. Contact the PG manager.',
                  ),
                ],
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Signed in as ${user?.name ?? 'guardian'}',
                    style: const TextStyle(
                      color: AppTheme.muted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_error != null) ErrorBanner(message: _error!),
                  if (_loading)
                    const SkeletonList(cardCount: 3, height: 110)
                  else if (_ward == null)
                    const EmptyState(message: 'No ward linked to this account')
                  else ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Tenant',
                              style: TextStyle(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 8),
                            _row('Name', tenantUser?['name']?.toString() ?? 'N/A'),
                            _row(
                              'Phone',
                              tenantUser?['phone']?.toString() ?? 'N/A',
                            ),
                            _row(
                              'Room / bed',
                              '${room?['roomNumber'] ?? 'N/A'} / ${tenant?['bedId'] ?? '--'}',
                            ),
                            const SizedBox(height: 8),
                            StatusChip(
                              label: (tenant?['isActive'] == true)
                                   ? 'active'
                                  : 'inactive',
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Fee & Rent Status',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                  ),
                                ),
                                StatusChip(
                                  label: (_ward?['duesSummary']?['isClear'] == true)
                                      ? 'Paid'
                                      : 'Pending',
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            _row(
                              'Total outstanding',
                              formatMoney(
                                _ward?['duesSummary']?['totalDue'] as num?,
                              ),
                            ),
                            _row(
                              'Pending invoices',
                              '${_ward?['duesSummary']?['unpaidCount'] ?? 0} invoice${_ward?['duesSummary']?['unpaidCount'] == 1 ? '' : 's'}',
                            ),
                            if (_ward?['duesSummary']?['latestMonth'] != null)
                              _row(
                                'Billing cycle',
                                _ward!['duesSummary']['latestMonth'].toString(),
                              ),
                            if (_ward?['duesSummary']?['isClear'] != true) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppTheme.warningSoft,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(Icons.info_outline, size: 18, color: AppTheme.warning),
                                    SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Dues can be settled by the resident via UPI QR or at the PG reception.',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: AppTheme.warningText,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(Icons.calendar_month_outlined, color: AppTheme.brand),
                            title: const Text('Ward Attendance', style: TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: const Text('View ward attendance history grouped by month'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => context.go('/guardian/attendance'),
                          ),
                          const Divider(height: 1),
                          ListTile(
                            leading: const Icon(Icons.campaign_outlined, color: AppTheme.brand),
                            title: const Text('PG Notices', style: TextStyle(fontWeight: FontWeight.w700)),
                            subtitle: const Text('View updates and announcements from the PG'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => context.go('/guardian/notices'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Your link',
                              style: TextStyle(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 8),
                            _row(
                              'Relation',
                              _ward?['relation']?.toString() ?? '--',
                            ),
                            _row(
                              'Guardian phone',
                              _ward?['phone']?.toString() ??
                                  user?.phone ??
                                  '--',
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.logout, color: AppTheme.danger),
                        title: const Text(
                          'Sign out',
                          style: TextStyle(
                            color: AppTheme.danger,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        subtitle: const Text('Log out of the guardian portal'),
                        onTap: () => _confirmSignOut(context),
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text(
          'Are you sure you want to sign out of the guardian portal?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await ref.read(authProvider.notifier).logout();
      if (context.mounted) context.go('/login');
    }
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: AppTheme.muted,
              fontWeight: FontWeight.w600,
            ),
          ),
          Flexible(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
