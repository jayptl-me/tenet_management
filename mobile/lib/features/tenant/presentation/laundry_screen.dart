import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantLaundryScreen extends ConsumerStatefulWidget {
  const TenantLaundryScreen({super.key});

  @override
  ConsumerState<TenantLaundryScreen> createState() => _TenantLaundryScreenState();
}

class _TenantLaundryScreenState extends ConsumerState<TenantLaundryScreen> {
  bool _loading = true;
  String? _error;
  bool _featureDisabled = false;
  List<Map<String, dynamic>> _slots = [];
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _time = const TimeOfDay(hour: 10, minute: 0);
  int _items = 5;
  final _notesController = TextEditingController();
  bool _booking = false;
  String? _cancellingId;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _featureDisabled = false;
    });
    try {
      final slots = await ref.read(tenantRepositoryProvider).laundrySlots();
      if (!mounted) return;
      setState(() {
        _slots = slots;
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

  Future<void> _book() async {
    final tenantId = await ref.read(authProvider.notifier).ensureTenantId();
    if (tenantId == null || tenantId.isEmpty) {
      setState(() => _error = 'Tenant profile not linked to this account.');
      return;
    }
    setState(() {
      _booking = true;
      _error = null;
    });
    try {
      final date =
          '${_date.year.toString().padLeft(4, '0')}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';
      final time =
          '${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}';
      await ref.read(tenantRepositoryProvider).bookLaundry(
            tenantId: tenantId,
            slotDate: date,
            slotTime: time,
            items: _items,
            notes: _notesController.text.trim(),
          );
      _notesController.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Laundry slot booked')),
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.isFeatureDisabled) {
        setState(() => _featureDisabled = true);
      } else {
        setState(() => _error = e.message);
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _booking = false);
    }
  }

  Future<void> _cancelSlot(String slotId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel laundry slot?'),
        content: const Text('Are you sure you want to cancel this booking?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep slot'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.danger),
            child: const Text('Cancel slot'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _cancellingId = slotId);
    try {
      await ref.read(tenantRepositoryProvider).cancelLaundrySlot(slotId);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Laundry slot cancelled')),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    } finally {
      if (mounted) setState(() => _cancellingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Laundry')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const SkeletonList(cardCount: 4, height: 85)
            : _featureDisabled
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      FeatureDisabledWidget(
                        message:
                            'Laundry booking is not enabled. Contact your PG manager.',
                      ),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_error != null) ErrorBanner(message: _error!),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const Text('Book a slot',
                                  style: TextStyle(fontWeight: FontWeight.w800)),
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(formatDate(_date)),
                                trailing: const Icon(Icons.calendar_today),
                                onTap: () async {
                                  final picked = await showDatePicker(
                                    context: context,
                                    firstDate: DateTime.now(),
                                    lastDate: DateTime.now()
                                        .add(const Duration(days: 30)),
                                    initialDate: _date,
                                  );
                                  if (picked != null) {
                                    setState(() => _date = picked);
                                  }
                                },
                              ),
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(_time.format(context)),
                                trailing: const Icon(Icons.schedule),
                                onTap: () async {
                                  final picked = await showTimePicker(
                                    context: context,
                                    initialTime: _time,
                                  );
                                  if (picked != null) {
                                    setState(() => _time = picked);
                                  }
                                },
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Estimated garments:'),
                                    Row(
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.remove_circle_outline),
                                          onPressed: _items > 1
                                              ? () => setState(() => _items--)
                                              : null,
                                        ),
                                        Text('$_items',
                                            style: const TextStyle(fontWeight: FontWeight.bold)),
                                        IconButton(
                                          icon: const Icon(Icons.add_circle_outline),
                                          onPressed: _items < 30
                                              ? () => setState(() => _items++)
                                              : null,
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              TextField(
                                controller: _notesController,
                                decoration: const InputDecoration(
                                  labelText: 'Special instructions (optional)',
                                  hintText: 'e.g. Ironing required, delicate wash',
                                  isDense: true,
                                ),
                                maxLength: 300,
                              ),
                              const SizedBox(height: 8),
                              FilledButton(
                                onPressed: _booking ? null : _book,
                                child: Text(_booking ? 'Booking...' : 'Book laundry'),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (_slots.isEmpty)
                        const EmptyState(message: 'No laundry slots')
                      else
                        ..._slots.map((s) {
                          final status = s['status']?.toString() ?? '--';
                          final canCancel =
                              status == 'booked' || status == 'confirmed';
                          final slotId = s['_id']?.toString() ??
                              s['id']?.toString() ??
                              '';
                          final isCancelling = _cancellingId == slotId;

                          return ListCard(
                            title:
                                '${s['slotDate'] ?? ''} · ${s['slotTime'] ?? ''}',
                            subtitle: [
                              if (s['items'] != null)
                                '${s['items']} item${s['items'] == 1 ? '' : 's'}',
                              if ((s['notes']?.toString() ?? '').isNotEmpty)
                                s['notes'].toString(),
                            ].join(' · '),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                StatusChip(label: status),
                                if (canCancel) ...[
                                  const SizedBox(width: 8),
                                  IconButton(
                                    tooltip: 'Cancel slot',
                                    iconSize: 20,
                                    visualDensity: VisualDensity.compact,
                                    onPressed: isCancelling
                                        ? null
                                        : () => _cancelSlot(slotId),
                                    icon: isCancelling
                                        ? const SizedBox(
                                            width: 16,
                                            height: 16,
                                            child: CircularProgressIndicator(
                                                strokeWidth: 2),
                                          )
                                        : const Icon(Icons.close,
                                            color: AppTheme.danger),
                                  ),
                                ],
                              ],
                            ),
                          );
                        }),
                    ],
                  ),
      ),
    );
  }
}
