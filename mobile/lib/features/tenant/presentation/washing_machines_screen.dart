import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../data/tenant_repository.dart';
import '../../shared/widgets/portal_widgets.dart';

class TenantWashingMachinesScreen extends ConsumerStatefulWidget {
  const TenantWashingMachinesScreen({super.key});

  @override
  ConsumerState<TenantWashingMachinesScreen> createState() =>
      _TenantWashingMachinesScreenState();
}

class _TenantWashingMachinesScreenState
    extends ConsumerState<TenantWashingMachinesScreen> {
  bool _loading = true;
  String? _error;
  bool _featureDisabled = false;
  List<Map<String, dynamic>> _machines = [];
  Map<String, dynamic>? _floorInfo;
  Timer? _countdownTimer;
  String? _myTenantId;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _featureDisabled = false;
    });

    try {
      final repo = ref.read(tenantRepositoryProvider);

      // 1. Store tenantId for ownership comparison
      final me = await repo.myAuthProfile();
      if (me != null) {
        _myTenantId = me['tenantId']?.toString();
      }

      // 2. Resolve floor ID
      final floorId = _myTenantId != null
          ? await repo.myFloorId(_myTenantId!)
          : null;
      if (!mounted) return;
      if (floorId == null || floorId.isEmpty) {
        setState(() {
          _error = 'Could not determine your floor. Contact the PG manager.';
          _loading = false;
        });
        return;
      }

      // 3. Fetch machines for this floor
      final data = await repo.floorWashingMachines(floorId);
      if (!mounted) return;

      setState(() {
        _floorInfo = data?['floor'] as Map<String, dynamic>?;
        final rawMachines = data?['machines'];
        if (rawMachines is List) {
          _machines = rawMachines
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        }
        _loading = false;
      });

      _startCountdown();
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

  void _startCountdown() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {});
      if (_machines.any((m) {
        final endsAt = m['timerEndsAt']?.toString();
        if (endsAt == null || endsAt.isEmpty) return false;
        final endTime = DateTime.tryParse(endsAt);
        return endTime != null && endTime.isBefore(DateTime.now());
      })) {
        _load();
      }
    });
  }

  Future<void> _claim(String machineId) async {
    setState(() => _error = null);
    try {
      await ref
          .read(tenantRepositoryProvider)
          .claimWashingMachine(machineId);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Machine claimed')),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _release(String machineId) async {
    setState(() => _error = null);
    try {
      await ref.read(tenantRepositoryProvider).releaseWashingMachine(machineId);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Machine released')),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  String _remainingTime(String? timerEndsAt) {
    if (timerEndsAt == null || timerEndsAt.isEmpty) return '';
    final end = DateTime.tryParse(timerEndsAt);
    if (end == null) return '';
    final remaining = end.difference(DateTime.now());
    if (remaining.isNegative) return 'Time up';
    final hours = remaining.inHours;
    final minutes = remaining.inMinutes.remainder(60);
    final seconds = remaining.inSeconds.remainder(60);
    if (hours > 0) {
      return '${hours}h ${minutes.toString().padLeft(2, '0')}m';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  bool _isClaimedByCurrentTenant(Map<String, dynamic>? currentUser) {
    if (currentUser == null || _myTenantId == null) return false;
    final claimedUserId = currentUser['id']?.toString();
    return claimedUserId == _myTenantId;
  }

  Color _statusDotColor(String status) {
    switch (status) {
      case 'available':
        return Colors.green;
      case 'in_use':
        return Colors.orange;
      case 'under_maintenance':
        return Colors.amber;
      case 'down':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  Color _statusLabelColor(String status) {
    switch (status) {
      case 'available':
        return Colors.green.shade700;
      case 'in_use':
        return Colors.orange.shade800;
      case 'under_maintenance':
        return Colors.amber.shade800;
      case 'down':
        return Colors.red.shade700;
      default:
        return Colors.grey.shade700;
    }
  }

  Color _statusBgColor(String status) {
    switch (status) {
      case 'available':
        return Colors.green.shade50;
      case 'in_use':
        return Colors.orange.shade50;
      case 'under_maintenance':
        return Colors.amber.shade50;
      case 'down':
        return Colors.red.shade50;
      default:
        return Colors.grey.shade50;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final floorName = _floorInfo?['label']?.toString() ??
        'Floor ${_floorInfo?['floorNumber'] ?? ''}';

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _floorInfo != null
              ? 'Washing Machines · $floorName'
              : 'Washing Machines',
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _featureDisabled
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      FeatureDisabledWidget(
                        message:
                            'Washing machines are not enabled. Contact your PG manager.',
                      ),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_error != null) ErrorBanner(message: _error!),
                      if (_machines.isEmpty)
                        const EmptyState(
                            message:
                                'No washing machines on your floor')
                      else
                        ..._machines.map(
                          (m) => _buildMachineCard(context, theme, m),
                        ),
                    ],
                  ),
      ),
    );
  }

  Widget _buildMachineCard(
    BuildContext context,
    ThemeData theme,
    Map<String, dynamic> machine,
  ) {
    final status = machine['status']?.toString() ?? 'available';
    final label = machine['label']?.toString() ??
        'Machine ${machine['machineNumber'] ?? ''}';
    final machineNumber = machine['machineNumber'];
    final currentUser = machine['currentUser'] as Map<String, dynamic>?;
    final timerEndsAt = machine['timerEndsAt']?.toString();
    final remaining = _remainingTime(timerEndsAt);
    final isTimerActive = remaining.isNotEmpty && remaining != 'Time up';
    final isClaimedByMe = _isClaimedByCurrentTenant(currentUser);
    final dotColor = _statusDotColor(status);
    final bgColor = _statusBgColor(status);
    final labelColor = _statusLabelColor(status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Container(
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: dotColor, width: 4)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header row
              Row(children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: dotColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.local_laundry_service_outlined,
                    color: dotColor,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700)),
                      if (machineNumber != null)
                        Text('Machine #$machineNumber',
                            style: theme.textTheme.bodySmall?.copyWith(
                                color:
                                    theme.colorScheme.onSurfaceVariant)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: bgColor,
                    borderRadius: BorderRadius.circular(20),
                    border:
                        Border.all(color: dotColor.withValues(alpha: 0.3)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                            color: dotColor, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Text(
                      status.replaceAll('_', ' '),
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: labelColor),
                    ),
                  ]),
                ),
              ]),

              // Timer + claimed section
              if (isTimerActive || currentUser != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerHighest
                        .withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(children: [
                    if (isTimerActive)
                      Row(children: [
                        const Icon(Icons.timer_outlined,
                            size: 16, color: Colors.orange),
                        const SizedBox(width: 6),
                        Text(
                          remaining,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: remaining == 'Time up'
                                ? Colors.red
                                : Colors.orange.shade800,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ]),
                    if (currentUser != null) ...[
                      if (isTimerActive) const SizedBox(height: 6),
                      Row(children: [
                        const Icon(Icons.person_outline,
                            size: 16, color: Colors.grey),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '${currentUser['name'] ?? 'Someone'} (Room ${currentUser['room'] ?? '?'})',
                            style: theme.textTheme.bodySmall,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ]),
                    ],
                  ]),
                ),
              ],

              // Action buttons
              const SizedBox(height: 12),
              if (status == 'available')
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () =>
                        _claim(machine['_id']?.toString() ?? ''),
                    icon: const Icon(Icons.play_arrow, size: 18),
                    label: const Text('Claim'),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.green.shade600,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              if (isClaimedByMe && status == 'in_use')
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        _release(machine['_id']?.toString() ?? ''),
                    icon: const Icon(Icons.stop, size: 18),
                    label: const Text('Release'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.orange.shade800,
                      side:
                          BorderSide(color: Colors.orange.shade300),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
