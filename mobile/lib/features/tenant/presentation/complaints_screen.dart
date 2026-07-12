import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantComplaintsScreen extends ConsumerStatefulWidget {
  const TenantComplaintsScreen({super.key});

  @override
  ConsumerState<TenantComplaintsScreen> createState() => _TenantComplaintsScreenState();
}

class _TenantComplaintsScreenState extends ConsumerState<TenantComplaintsScreen> {
  bool _loading = true;
  String? _error;
  String? _success;
  List<Map<String, dynamic>> _rows = [];
  String? _roomId;

  final _title = TextEditingController();
  final _description = TextEditingController();
  String _category = 'other';
  String _priority = 'medium';
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(_bootstrap);
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final user = ref.read(authProvider).user;
    final repo = ref.read(tenantRepositoryProvider);
    if (user?.tenantId != null) {
      final profile = await repo.tenantProfile(user!.tenantId!);
      final room = profile?['room'];
      if (room is Map && room['_id'] != null) {
        _roomId = room['_id'].toString();
      } else if (profile?['roomId'] != null) {
        _roomId = profile!['roomId'].toString();
      }
    }
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await ref.read(tenantRepositoryProvider).myComplaints();
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

  Future<void> _submit() async {
    if (_roomId == null || _roomId!.isEmpty) {
      setState(() => _error = 'Room not linked to profile. Contact admin.');
      return;
    }
    if (_title.text.trim().length < 5 || _description.text.trim().length < 10) {
      setState(() => _error = 'Title (5+) and description (10+) are required.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      await ref.read(tenantRepositoryProvider).createComplaint(
            roomId: _roomId!,
            title: _title.text.trim(),
            description: _description.text.trim(),
            category: _category,
            priority: _priority,
          );
      _title.clear();
      _description.clear();
      setState(() => _success = 'Complaint submitted.');
      await _load();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Complaints')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 12),
            ],
            if (_success != null) ...[
              Text(_success!, style: const TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Raise a complaint',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _category,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: const [
                        'wifi',
                        'water',
                        'electricity',
                        'food_quality',
                        'cleaning_room',
                        'noise',
                        'other',
                      ]
                          .map(
                            (c) => DropdownMenuItem(
                              value: c,
                              child: Text(c.replaceAll('_', ' ')),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setState(() => _category = v ?? 'other'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _priority,
                      decoration: const InputDecoration(labelText: 'Priority'),
                      items: const ['low', 'medium', 'high', 'urgent']
                          .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                          .toList(),
                      onChanged: (v) => setState(() => _priority = v ?? 'medium'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _title,
                      decoration: const InputDecoration(labelText: 'Title'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _description,
                      maxLines: 3,
                      decoration: const InputDecoration(labelText: 'Description'),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child: Text(_submitting ? 'Submitting…' : 'Submit'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_rows.isEmpty)
              const EmptyState(message: 'No complaints yet')
            else
              ..._rows.map(
                (c) => ListCard(
                  title: c['title']?.toString() ?? 'Complaint',
                  subtitle: (c['category']?.toString() ?? '').replaceAll('_', ' '),
                  trailing: StatusChip(label: c['status']?.toString() ?? '—'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
