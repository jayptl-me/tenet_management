import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/portal_widgets.dart';
import 'ward_screen.dart';

class GuardianAttendanceScreen extends ConsumerStatefulWidget {
  const GuardianAttendanceScreen({super.key});

  @override
  ConsumerState<GuardianAttendanceScreen> createState() =>
      _GuardianAttendanceScreenState();
}

class _GuardianAttendanceScreenState extends ConsumerState<GuardianAttendanceScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];

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
      final rows = await ref.read(guardianRepositoryProvider).wardAttendance();
      if (!mounted) return;
      setState(() {
        _rows = rows;
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
    return Scaffold(
      appBar: AppBar(title: const Text('Ward attendance')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ErrorBanner(message: _error!),
                  if (_rows.isEmpty)
                    const EmptyState(message: 'No attendance records')
                  else
                    ..._rows.map((r) {
                      return ListCard(
                        title: r['date']?.toString() ?? '—',
                        subtitle: 'In: ${r['checkInTime'] ?? r['checkIn'] ?? '—'} · Out: ${r['checkOutTime'] ?? r['checkOut'] ?? '—'}',
                        trailing: StatusChip(label: r['status']?.toString() ?? '—'),
                      );
                    }),
                ],
              ),
      ),
    );
  }
}
