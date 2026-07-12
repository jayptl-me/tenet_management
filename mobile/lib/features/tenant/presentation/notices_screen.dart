import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantNoticesScreen extends ConsumerStatefulWidget {
  const TenantNoticesScreen({super.key});

  @override
  ConsumerState<TenantNoticesScreen> createState() => _TenantNoticesScreenState();
}

class _TenantNoticesScreenState extends ConsumerState<TenantNoticesScreen> {
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
      final rows = await ref.read(tenantRepositoryProvider).notices();
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
      appBar: AppBar(title: const Text('Notices')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ErrorBanner(message: _error!),
                  if (_rows.isEmpty)
                    const EmptyState(message: 'No notices')
                  else
                    ..._rows.map(
                      (n) => ListCard(
                        title: n['title']?.toString() ?? 'Notice',
                        subtitle: n['content']?.toString() ?? n['body']?.toString(),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}
