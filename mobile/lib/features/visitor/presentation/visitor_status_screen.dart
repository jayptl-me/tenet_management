import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../shared/widgets/portal_widgets.dart';
import 'visitor_home_screen.dart';

class VisitorStatusScreen extends ConsumerStatefulWidget {
  const VisitorStatusScreen({super.key, this.visitorId});

  final String? visitorId;

  @override
  ConsumerState<VisitorStatusScreen> createState() => _VisitorStatusScreenState();
}

class _VisitorStatusScreenState extends ConsumerState<VisitorStatusScreen> {
  final _idController = TextEditingController();
  Map<String, dynamic>? _visitor;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final id = widget.visitorId;
    if (id != null && id.isNotEmpty) {
      _idController.text = id;
      Future.microtask(() => _load(id));
    }
  }

  @override
  void dispose() {
    _idController.dispose();
    super.dispose();
  }

  Future<void> _load(String id) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(visitorRepositoryProvider).getById(id);
      if (!mounted) return;
      setState(() {
        _visitor = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
        _visitor = null;
      });
    }
  }

  Future<void> _action(String action) async {
    final id = _visitor?['_id']?.toString();
    if (id == null) return;
    try {
      final repo = ref.read(visitorRepositoryProvider);
      if (action == 'arrive') {
        await repo.markArrive(id);
      } else if (action == 'depart') {
        await repo.markDepart(id);
      } else if (action == 'cancel') {
        await repo.cancel(id);
      }
      await _load(id);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _visitor?['status']?.toString() ?? '';
    final name = _visitor?['visitorName']?.toString() ??
        _visitor?['name']?.toString() ??
        'Visitor';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Visitor status',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _idController,
          decoration: const InputDecoration(
            labelText: 'Visitor ID',
            hintText: 'Paste visitor record id',
          ),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _loading
              ? null
              : () {
                  final id = _idController.text.trim();
                  if (id.isEmpty) return;
                  context.go('/visitor/status?id=$id');
                  _load(id);
                },
          child: const Text('Load'),
        ),
        const SizedBox(height: 16),
        if (_error != null) ErrorBanner(message: _error!),
        if (_loading) const Center(child: CircularProgressIndicator()),
        if (!_loading && _visitor != null) ...[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  const SizedBox(height: 8),
                  StatusChip(label: status),
                  const SizedBox(height: 8),
                  Text('Phone: ${_visitor?['visitorPhone'] ?? _visitor?['phone'] ?? '—'}'),
                  Text('Purpose: ${_visitor?['purpose'] ?? '—'}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (status == 'expected') ...[
            FilledButton.icon(
              onPressed: () => _action('arrive'),
              icon: const Icon(Icons.login),
              label: const Text('Mark arrived'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => _action('cancel'),
              icon: const Icon(Icons.cancel_outlined),
              label: const Text('Cancel visit'),
            ),
          ],
          if (status == 'arrived')
            FilledButton.icon(
              onPressed: () => _action('depart'),
              icon: const Icon(Icons.logout),
              label: const Text('Mark departed'),
            ),
        ],
      ],
    );
  }
}
