import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
  List<Map<String, dynamic>> _slots = [];
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _time = const TimeOfDay(hour: 10, minute: 0);
  bool _booking = false;

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
      final slots = await ref.read(tenantRepositoryProvider).laundrySlots();
      if (!mounted) return;
      setState(() {
        _slots = slots;
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
    final user = ref.read(authProvider).user;
    final tenantId = user?.tenantId;
    if (tenantId == null || tenantId.isEmpty) {
      setState(() => _error = 'Tenant profile not linked to this account.');
      return;
    }
    setState(() => _booking = true);
    try {
      final date =
          '${_date.year.toString().padLeft(4, '0')}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';
      final time =
          '${_time.hour.toString().padLeft(2, '0')}:${_time.minute.toString().padLeft(2, '0')}';
      await ref.read(tenantRepositoryProvider).bookLaundry(
            tenantId: tenantId,
            slotDate: date,
            slotTime: time,
          );
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Laundry slot booked')),
        );
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _booking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Laundry')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) ErrorBanner(message: _error!),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text('Book a slot', style: TextStyle(fontWeight: FontWeight.w800)),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(formatDate(_date)),
                      trailing: const Icon(Icons.calendar_today),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 30)),
                          initialDate: _date,
                        );
                        if (picked != null) setState(() => _date = picked);
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
                        if (picked != null) setState(() => _time = picked);
                      },
                    ),
                    FilledButton(
                      onPressed: _booking ? null : _book,
                      child: Text(_booking ? 'Booking…' : 'Book laundry'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_slots.isEmpty)
              const EmptyState(message: 'No laundry slots')
            else
              ..._slots.map(
                (s) => ListCard(
                  title: '${s['slotDate'] ?? ''} · ${s['slotTime'] ?? ''}',
                  trailing: StatusChip(label: s['status']?.toString() ?? '—'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
