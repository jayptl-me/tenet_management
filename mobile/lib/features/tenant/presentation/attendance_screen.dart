import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantAttendanceScreen extends ConsumerStatefulWidget {
  const TenantAttendanceScreen({super.key});

  @override
  ConsumerState<TenantAttendanceScreen> createState() =>
      _TenantAttendanceScreenState();
}

class _TenantAttendanceScreenState
    extends ConsumerState<TenantAttendanceScreen> {
  List<Map<String, dynamic>> _records = [];
  bool _loading = true;
  String? _error;
  bool _featureDisabled = false;
  bool _actionLoading = false;
  String? _todayStatus;
  String? _statusFilter;

  static const List<String> _statusOptions = [
    'present',
    'absent',
    'on_leave',
    'not_returned',
  ];

  List<Map<String, dynamic>> get _filtered {
    if (_statusFilter == null || _statusFilter!.isEmpty) return _records;
    return _records.where((r) => r['status']?.toString() == _statusFilter).toList();
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
      final rows = await ref.read(tenantRepositoryProvider).myAttendance(limit: 100);
      if (!mounted) return;
      _updateTodayStatus(rows);
      setState(() {
        _records = rows;
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

  void _updateTodayStatus(List<Map<String, dynamic>> rows) {
    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    final todayRecord = rows.where((r) {
      final d = r['date']?.toString() ?? '';
      return d.startsWith(todayStr);
    }).toList();
    if (todayRecord.isEmpty) {
      _todayStatus = null;
    } else if (todayRecord[0]['checkOut'] != null) {
      _todayStatus = 'checked_out';
    } else if (todayRecord[0]['checkIn'] != null) {
      _todayStatus = 'checked_in';
    } else {
      _todayStatus = todayRecord[0]['status']?.toString();
    }
  }

  Future<String?> _resolveTenantId() async {
    final id = await ref.read(authProvider.notifier).ensureTenantId();
    if (id == null || id.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tenant profile not linked. Contact admin.'),
          ),
        );
      }
      return null;
    }
    return id;
  }

  Future<void> _doCheckIn() async {
    final tenantId = await _resolveTenantId();
    if (tenantId == null) return;
    setState(() => _actionLoading = true);
    try {
      await ref.read(tenantRepositoryProvider).checkIn(tenantId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked in successfully')),
      );
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.isFeatureDisabled) {
        setState(() => _featureDisabled = true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  Future<void> _doCheckOut() async {
    final tenantId = await _resolveTenantId();
    if (tenantId == null) return;
    setState(() => _actionLoading = true);
    try {
      await ref.read(tenantRepositoryProvider).checkOut(tenantId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked out successfully')),
      );
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.isFeatureDisabled) {
        setState(() => _featureDisabled = true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const SkeletonList(cardCount: 4, height: 80)
            : _featureDisabled
                ? const FeatureDisabledWidget()
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_error != null) ...[
                        ErrorBanner(message: _error!),
                        const SizedBox(height: 12),
                      ],
                      // Today's status card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            children: [
                              Text('Today',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(
                                          fontWeight: FontWeight.w800)),
                              const SizedBox(height: 8),
                              if (_todayStatus == null)
                                const Text('Not checked in yet')
                              else if (_todayStatus == 'checked_in')
                                Text('Checked in',
                                    style: TextStyle(
                                        color: cs.primary,
                                        fontWeight: FontWeight.w700))
                              else if (_todayStatus == 'checked_out')
                                Text('Checked out',
                                    style: TextStyle(
                                        color: cs.onSurfaceVariant,
                                        fontWeight: FontWeight.w700))
                              else
                                Text(_todayStatus ?? '--'),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: FilledButton(
                                      onPressed: _actionLoading ||
                                              _todayStatus != null
                                          ? null
                                          : _doCheckIn,
                                      child: const Text('Check In'),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: FilledButton.tonal(
                                      onPressed: _actionLoading ||
                                              _todayStatus != 'checked_in'
                                          ? null
                                          : _doCheckOut,
                                      child: const Text('Check Out'),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text('History',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
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
                      if (_filtered.isEmpty)
                        const EmptyState(message: 'No attendance records')
                      else
                        ..._groupedByMonth.entries.expand((entry) => [
                              Padding(
                                padding: const EdgeInsets.only(top: 12, bottom: 4),
                                child: Text(_monthLabel(entry.key),
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(fontWeight: FontWeight.w800)),
                              ),
                              ...entry.value.map((r) => ListCard(
                                    title: formatDate(r['date']),
                                    subtitle:
                                        'In: ${r['checkIn'] != null ? formatTime(r['checkIn']) : '--'} · Out: ${r['checkOut'] != null ? formatTime(r['checkOut']) : '--'}',
                                    trailing: StatusChip(
                                        label: r['status']?.toString() ?? '--'),
                                  )),
                            ]),
                    ],
                  ),
      ),
    );
  }
}
