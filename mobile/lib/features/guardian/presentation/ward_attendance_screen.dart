import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'ward_screen.dart';

class GuardianAttendanceScreen extends ConsumerStatefulWidget {
  const GuardianAttendanceScreen({super.key});

  @override
  ConsumerState<GuardianAttendanceScreen> createState() =>
      _GuardianAttendanceScreenState();
}

class _GuardianAttendanceScreenState
    extends ConsumerState<GuardianAttendanceScreen> {
  bool _loading = true;
  String? _error;
  bool _featureDisabled = false;
  List<Map<String, dynamic>> _rows = [];
  String? _statusFilter;
  DateTime? _fromDate;
  DateTime? _toDate;

  String? _fmt(DateTime? d) => d == null
      ? null
      : '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static const List<String> _statusOptions = [
    'present',
    'absent',
    'on_leave',
    'not_returned',
  ];

  List<Map<String, dynamic>> get _filtered {
    if (_statusFilter == null || _statusFilter!.isEmpty) return _rows;
    return _rows.where((r) => r['status']?.toString() == _statusFilter).toList();
  }

  Map<String, List<Map<String, dynamic>>> get _groupedByMonth {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final r in _filtered) {
      final d = r['date']?.toString() ?? '';
      final key = d.length >= 7 ? d.substring(0, 7) : 'unknown';
      map.putIfAbsent(key, () => []).add(r);
    }
    final sortedKeys = map.keys.toList()..sort((a, b) => b.compareTo(a));
    return {for (final k in sortedKeys) k: map[k]!};
  }

  String _monthLabel(String key) {
    try {
      final parts = key.split('-');
      final dt = DateTime(int.parse(parts[0]), int.parse(parts[1]));
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return '${months[dt.month - 1]} ${dt.year}';
    } catch (_) {
      return key;
    }
  }

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
      final rows = await ref.read(guardianRepositoryProvider).wardAttendance(
            limit: 100,
            fromDate: _fmt(_fromDate),
            toDate: _fmt(_toDate),
          );
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _featureDisabled = e.isFeatureDisabled;
        _error = e.message;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ward attendance'),
        actions: [
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
        child: _loading
            ? const SkeletonList(cardCount: 5, height: 72)
            : _featureDisabled
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
                      if (_error != null) ErrorBanner(message: _error!),
                      Wrap(
                        spacing: 8,
                        children: [
                          ChoiceChip(
                            label: const Text('All'),
                            selected: _statusFilter == null,
                            onSelected: (_) => setState(() => _statusFilter = null),
                          ),
                          ..._statusOptions.map((s) => ChoiceChip(
                                label: Text(s.replaceAll('_', ' ')),
                                selected: _statusFilter == s,
                                onSelected: (_) => setState(
                                    () => _statusFilter = _statusFilter == s ? null : s),
                              )),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                final d = await showDatePicker(
                                  context: context,
                                  firstDate: DateTime(2020),
                                  lastDate: DateTime.now(),
                                  initialDate: _fromDate ?? DateTime.now(),
                                );
                                if (d == null) return;
                                setState(() => _fromDate = d);
                                _load();
                              },
                              icon: const Icon(Icons.date_range, size: 16),
                              label: Text(_fromDate == null
                                  ? 'From'
                                  : _fmt(_fromDate)!),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                final d = await showDatePicker(
                                  context: context,
                                  firstDate: _fromDate ?? DateTime(2020),
                                  lastDate: DateTime.now(),
                                  initialDate: _toDate ?? DateTime.now(),
                                );
                                if (d == null) return;
                                setState(() => _toDate = d);
                                _load();
                              },
                              icon: const Icon(Icons.date_range, size: 16),
                              label: Text(
                                  _toDate == null ? 'To' : _fmt(_toDate)!),
                            ),
                          ),
                          if (_fromDate != null || _toDate != null)
                            IconButton(
                              tooltip: 'Clear dates',
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                setState(() {
                                  _fromDate = null;
                                  _toDate = null;
                                });
                                _load();
                              },
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      if (_filtered.isEmpty)
                        const EmptyState(message: 'No attendance records')
                      else
                        ..._groupedByMonth.entries.expand((entry) => [
                              Padding(
                                padding: const EdgeInsets.only(top: 12, bottom: 4),
                                child: Text(_monthLabel(entry.key),
                                    style: const TextStyle(fontWeight: FontWeight.w800)),
                              ),
                              ...entry.value.map((r) {
                                return ListCard(
                                  title: formatDate(r['date']),
                                  subtitle:
                                      'In: ${formatTime(r['checkInTime'] ?? r['checkIn'])} · Out: ${formatTime(r['checkOutTime'] ?? r['checkOut'])}',
                                  trailing: StatusChip(
                                    label: r['status']?.toString() ?? '--',
                                  ),
                                );
                              }),
                            ]),
                    ],
                  ),
      ),
    );
  }
}
