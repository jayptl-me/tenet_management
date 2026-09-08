import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/network/open_bytes.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantElectricityScreen extends ConsumerStatefulWidget {
  const TenantElectricityScreen({super.key});

  @override
  ConsumerState<TenantElectricityScreen> createState() =>
      _TenantElectricityScreenState();
}

class _TenantElectricityScreenState
    extends ConsumerState<TenantElectricityScreen> {
  bool _loading = true;
  String? _error;
  String? _roomNumber;
  List<Map<String, dynamic>> _readings = [];
  int _selectedIndex = 0;

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
      final data = await repo.myElectricityReadings();
      if (!mounted) return;

      if (data == null) {
        setState(() {
          _error = 'Electricity readings unavailable.';
          _loading = false;
        });
        return;
      }

      final rawReadings = data['readings'];
      final parsed = <Map<String, dynamic>>[];
      if (rawReadings is List) {
        for (final r in rawReadings) {
          if (r is Map) parsed.add(Map<String, dynamic>.from(r));
        }
      }

      setState(() {
        _roomNumber = data['roomNumber']?.toString();
        _readings = parsed;
        _selectedIndex = 0;
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
    final cs = Theme.of(context).colorScheme;
    final selectedReading =
        _readings.isNotEmpty && _selectedIndex < _readings.length
            ? _readings[_selectedIndex]
            : null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Electricity & Submeter'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _load,
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
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _roomNumber != null && _roomNumber!.isNotEmpty
                          ? 'Room $_roomNumber Submeter'
                          : 'Room Submeter',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Monthly electricity units and share breakdown.',
                      style: TextStyle(
                        color: AppTheme.muted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: cs.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.bolt, color: cs.primary, size: 24),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 12),
            ],
            if (_loading)
              const SkeletonList(cardCount: 3, height: 120)
            else if (_readings.isEmpty)
              const EmptyState(
                message: 'No electricity readings found for your room.',
                icon: Icons.electric_meter_outlined,
              )
            else ...[
              // Month selector if multiple months available
              if (_readings.length > 1) ...[
                SizedBox(
                  height: 38,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _readings.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      final item = _readings[i];
                      final month = item['month']?.toString() ?? '--';
                      final isSelected = i == _selectedIndex;
                      return ChoiceChip(
                        label: Text(month),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) setState(() => _selectedIndex = i);
                        },
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Hero card for selected reading
              if (selectedReading != null) ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              selectedReading['month']?.toString() ?? 'Bill',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            StatusChip(
                              label: selectedReading['status']?.toString() ??
                                  'finalized',
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: cs.primary.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: cs.primary.withValues(alpha: 0.2),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'YOUR SHARE',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.8,
                                  color: AppTheme.muted,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                formatMoney(
                                    selectedReading['tenantShare'] as num?),
                                style: TextStyle(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w900,
                                  color: cs.primary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${selectedReading['occupantCount'] ?? 1} occupant(s) sharing ${formatMoney(selectedReading['roomTotalAmount'] as num?)} total',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: cs.onSurfaceVariant,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        // 2x2 Grid of submeter details
                        Row(
                          children: [
                            Expanded(
                              child: _metricTile(
                                context,
                                'Previous reading',
                                '${selectedReading['previousReading'] ?? '--'} kWh',
                                Icons.history,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _metricTile(
                                context,
                                'Current reading',
                                '${selectedReading['currentReading'] ?? '--'} kWh',
                                Icons.speed,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _metricTile(
                                context,
                                'Units consumed',
                                '${selectedReading['unitsConsumed'] ?? '--'} units',
                                Icons.energy_savings_leaf_outlined,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _metricTile(
                                context,
                                'Rate per unit',
                                formatMoney(
                                    selectedReading['ratePerUnit'] as num?),
                                Icons.currency_rupee,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          onPressed: () => context.go('/tenant/invoices'),
                          icon: const Icon(Icons.receipt_long_outlined),
                          label: const Text('View monthly invoices'),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                if ((((selectedReading['variance'] as num?)?.abs()) ?? 0) >
                    0.5) ...[
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.info_outline,
                                  size: 16, color: AppTheme.muted),
                              SizedBox(width: 6),
                              Text(
                                'Bill reconciliation note',
                                style: TextStyle(fontWeight: FontWeight.w800),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Room readings total ${formatMoney(selectedReading['computedRoomTotal'] as num? ?? selectedReading['roomTotalAmount'] as num?)} vs bill total. Variance: ${formatMoney(selectedReading['variance'] as num?)}.',
                            style: const TextStyle(fontSize: 13, height: 1.4),
                          ),
                          if ('${selectedReading['varianceReason'] ?? ''}'
                              .isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              selectedReading['varianceReason'].toString(),
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppTheme.muted,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                if ('${selectedReading['billImageUrl'] ?? ''}'
                    .isNotEmpty) ...[
                  Builder(builder: (context) {
                    final proofUrl =
                        selectedReading['billImageUrl'].toString();
                    final isPdf =
                        proofUrl.toLowerCase().contains('.pdf');
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.receipt_long_outlined,
                                    size: 16, color: AppTheme.muted),
                                SizedBox(width: 6),
                                Text(
                                  'Bill proof',
                                  style: TextStyle(fontWeight: FontWeight.w800),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            if (!isPdf)
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  proofUrl,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, __, ___) =>
                                      const Text(
                                    'Preview unavailable — open the proof externally.',
                                    style: TextStyle(
                                        fontSize: 12, height: 1.4),
                                  ),
                                ),
                              ),
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: () =>
                                  launchExternalUri(proofUrl),
                              icon: const Icon(
                                  Icons.open_in_new,
                                  size: 16),
                              label: Text(isPdf
                                  ? 'Open bill PDF'
                                  : 'Open full image'),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 12),
                ],
              ],

              // History list
              if (_readings.length > 1) ...[
                Text(
                  'Reading History',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                ..._readings.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final r = entry.value;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      onTap: () => setState(() => _selectedIndex = idx),
                      leading: const Icon(Icons.calendar_today_outlined),
                      title: Text(
                        r['month']?.toString() ?? '--',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        '${r['unitsConsumed'] ?? '--'} units · Rate: ${formatMoney(r['ratePerUnit'] as num?)}',
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            formatMoney(r['tenantShare'] as num?),
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: cs.primary,
                            ),
                          ),
                          Text(
                            r['status']?.toString() ?? '',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppTheme.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _metricTile(
    BuildContext context,
    String label,
    String value,
    IconData icon,
  ) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: AppTheme.muted),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.muted,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          ),
        ],
      ),
    );
  }
}
