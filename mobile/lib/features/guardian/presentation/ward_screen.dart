import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

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

  Future<void> _callNumber(String phone) async {
    if (phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      }
    } catch (_) {
      // Silent: tel links unsupported on this platform (e.g. desktop web).
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final cs = Theme.of(context).colorScheme;
    final tenant = _ward?['tenant'] as Map?;
    final tenantUser = tenant?['user'] as Map?;
    final room = tenant?['room'] as Map?;
    final floor = room?['floor'] as Map?;

    final wardName = tenantUser?['name']?.toString() ?? 'Ward';
    final wardPhone = tenantUser?['phone']?.toString() ?? '';
    final roomNumber = room?['roomNumber']?.toString() ?? 'N/A';
    final bedId = tenant?['bedId']?.toString() ?? '--';
    final floorLabel = floor?['label']?.toString();
    final moveIn = tenant?['moveInDate'];

    final dues = _ward?['duesSummary'] as Map?;
    final isClear = dues?['isClear'] == true;
    final totalDue = (dues?['totalDue'] as num?) ?? 0;
    final unpaidCount = (dues?['unpaidCount'] as num?) ?? 0;

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
                    style: TextStyle(
                      color: cs.onSurfaceVariant,
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
                    // ── Ward card ──────────────────────────────
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 22,
                                  backgroundColor:
                                      cs.primary.withValues(alpha: 0.12),
                                  child: Text(
                                    wardName.isNotEmpty
                                        ? wardName[0].toUpperCase()
                                        : 'W',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w900,
                                      color: cs.primary,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        wardName,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Room $roomNumber · Bed $bedId',
                                        style: TextStyle(
                                          fontSize: 13,
                                          color: cs.onSurfaceVariant,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                StatusChip(
                                  label: (tenant?['isActive'] == true)
                                      ? 'active'
                                      : 'inactive',
                                ),
                              ],
                            ),
                            const Divider(height: 24),
                            _row('Floor', floorLabel ?? '--'),
                            _row('Move-in', formatDate(moveIn)),
                            if (wardPhone.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 10),
                                child: OutlinedButton.icon(
                                  onPressed: () => _callNumber(wardPhone),
                                  icon: const Icon(Icons.call_outlined,
                                      size: 18),
                                  label: const Text('Call ward'),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // ── Fee & rent status ──────────────────────
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  'Fee & Rent Status',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                  ),
                                ),
                                StatusChip(
                                  label: isClear ? 'Paid' : 'Pending',
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            _row('Outstanding balance',
                                formatMoney(isClear ? 0 : totalDue)),
                            _row(
                              'Open invoices',
                              '$unpaidCount invoice${unpaidCount == 1 ? '' : 's'}',
                            ),
                            if (dues?['latestMonth'] != null)
                              _row(
                                'Oldest open cycle',
                                dues!['latestMonth'].toString(),
                              ),
                            if (!isClear) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: AppTheme.warningSoft,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(Icons.info_outline,
                                        size: 18, color: AppTheme.warning),
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

                    // ── Navigation ─────────────────────────────
                    Card(
                      child: Column(
                        children: [
                          ListTile(
                            leading: const Icon(
                                Icons.calendar_month_outlined,
                                color: AppTheme.brand),
                            title: const Text('Ward Attendance',
                                style: TextStyle(
                                    fontWeight: FontWeight.w700)),
                            subtitle: const Text(
                                'View ward attendance history grouped by month'),
                            trailing:
                                const Icon(Icons.chevron_right),
                            onTap: () => context.go('/guardian/attendance'),
                          ),
                          const Divider(height: 1),
                          ListTile(
                            leading: const Icon(Icons.campaign_outlined,
                                color: AppTheme.brand),
                            title: const Text('PG Notices',
                                style: TextStyle(
                                    fontWeight: FontWeight.w700)),
                            subtitle: const Text(
                                'View updates and announcements from the PG'),
                            trailing:
                                const Icon(Icons.chevron_right),
                            onTap: () => context.go('/guardian/notices'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // ── Guardian link ──────────────────────────
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Your link',
                              style:
                                  TextStyle(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 8),
                            _row(
                              'Relation',
                              (_ward?['relation']?.toString() ?? '--')
                                  .replaceAll('_', ' '),
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
                        leading: const Icon(Icons.logout,
                            color: AppTheme.danger),
                        title: const Text(
                          'Sign out',
                          style: TextStyle(
                            color: AppTheme.danger,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        subtitle:
                            const Text('Log out of the guardian portal'),
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
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
