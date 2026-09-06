import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantServicesScreen extends ConsumerStatefulWidget {
  const TenantServicesScreen({super.key});

  @override
  ConsumerState<TenantServicesScreen> createState() =>
      _TenantServicesScreenState();
}

class _TenantServicesScreenState extends ConsumerState<TenantServicesScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _services = [];

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
      final me = await repo.myAuthProfile();
      final tenantId = me?['tenantId']?.toString();
      final floorId = await repo.myFloorId(tenantId);

      if (!mounted) return;

      if (floorId == null || floorId.isEmpty) {
        setState(() {
          _error = 'Floor information not found. Contact the PG manager.';
          _loading = false;
        });
        return;
      }

      final services = await repo.floorServices(floorId);
      if (!mounted) return;

      setState(() {
        _services = services;
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

  Color _statusColor(String status) {
    switch (status) {
      case 'operational':
        return AppTheme.success;
      case 'degraded':
        return Colors.amber.shade700;
      case 'down':
        return AppTheme.danger;
      default:
        return Colors.grey;
    }
  }

  IconData _serviceIcon(String serviceType) {
    final lower = serviceType.toLowerCase();
    if (lower.contains('wifi') || lower.contains('internet')) {
      return Icons.wifi;
    }
    if (lower.contains('lift') || lower.contains('elevator')) {
      return Icons.elevator;
    }
    if (lower.contains('water')) {
      return Icons.water_drop_outlined;
    }
    if (lower.contains('power') || lower.contains('generator') || lower.contains('electricity')) {
      return Icons.bolt;
    }
    if (lower.contains('clean') || lower.contains('housekeeping')) {
      return Icons.cleaning_services_outlined;
    }
    return Icons.build_outlined;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Facility & Services Health'),
        actions: [
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
            Text(
              'Floor Amenities & Services',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            const Text(
              'Real-time operational status of your PG services.',
              style: TextStyle(
                color: AppTheme.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 12),
            ],
            if (_loading)
              const SkeletonList(cardCount: 4, height: 80)
            else if (_services.isEmpty)
              const EmptyState(
                message: 'No service statuses recorded for your floor.',
              )
            else
              ..._services.map((svc) {
                final status = svc['status']?.toString() ?? 'operational';
                final serviceType = svc['serviceType']?.toString() ?? 'Service';
                final label = serviceType.replaceAll('_', ' ');
                final note = svc['note']?.toString();
                final complaints = (svc['openComplaintCount'] as num?) ?? 0;
                final color = _statusColor(status);

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                _serviceIcon(serviceType),
                                color: color,
                                size: 22,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    label[0].toUpperCase() + label.substring(1),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 16,
                                    ),
                                  ),
                                  if (svc['lastUpdatedAt'] != null)
                                    Text(
                                      'Updated: ${formatDate(svc['lastUpdatedAt'])}',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Theme.of(context)
                                            .colorScheme
                                            .onSurfaceVariant,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            StatusChip(label: status),
                          ],
                        ),
                        if (note != null && note.trim().isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest
                                  .withValues(alpha: 0.5),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              note,
                              style: const TextStyle(fontSize: 13, height: 1.3),
                            ),
                          ),
                        ],
                        if (complaints > 0) ...[
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Icon(
                                Icons.warning_amber_rounded,
                                size: 14,
                                color: Colors.orange.shade800,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '$complaints open complaint${complaints > 1 ? 's' : ''} on your floor',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.orange.shade800,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
