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

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  String get _tenantId => ref.read(authProvider).user?.tenantId ?? '';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _featureDisabled = false;
    });
    try {
      final rows = await ref.read(tenantRepositoryProvider).myAttendance();
      if (!mounted) return;
      _updateTodayStatus(rows);
      setState(() {
        _records = rows;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _featureDisabled = e.statusCode == 403;
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

  Future<void> _doCheckIn() async {
    if (_tenantId.isEmpty) return;
    setState(() => _actionLoading = true);
    try {
      await ref.read(tenantRepositoryProvider).checkIn(_tenantId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked in successfully')),
      );
      _load();
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
    if (_tenantId.isEmpty) return;
    setState(() => _actionLoading = true);
    try {
      await ref.read(tenantRepositoryProvider).checkOut(_tenantId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Checked out successfully')),
      );
      _load();
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
            ? const Center(child: CircularProgressIndicator())
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
                      Text('Recent History',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      if (_records.isEmpty)
                        const EmptyState(message: 'No attendance records')
                      else
                        ..._records.take(20).map((r) => ListCard(
                              title: formatDate(r['date']),
                              subtitle:
                                  'In: ${r['checkIn'] != null ? formatDate(r['checkIn']) : '--'} - Out: ${r['checkOut'] != null ? formatDate(r['checkOut']) : '--'}',
                              trailing: StatusChip(
                                  label: r['status']?.toString() ?? '--'),
                            )),
                    ],
                  ),
      ),
    );
  }
}
