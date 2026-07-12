import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import '../data/visitor_repository.dart';

final visitorRepositoryProvider = Provider(
  (ref) => VisitorRepository(ref.watch(apiClientProvider)),
);

class VisitorHomeScreen extends ConsumerStatefulWidget {
  const VisitorHomeScreen({super.key});

  @override
  ConsumerState<VisitorHomeScreen> createState() => _VisitorHomeScreenState();
}

class _VisitorHomeScreenState extends ConsumerState<VisitorHomeScreen> {
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
      final rows = await ref.read(visitorRepositoryProvider).myVisitors();
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

  String _name(Map<String, dynamic> v) {
    return v['visitorName']?.toString() ??
        v['name']?.toString() ??
        'Visitor';
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'My visitors',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          const Text(
            'Pre-register guests and track arrival / departure.',
            style: TextStyle(color: Colors.black54, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 12),
          if (_error != null) ErrorBanner(message: _error!),
          if (_loading)
            const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
          else if (_rows.isEmpty)
            const EmptyState(message: 'No visitors yet. Register one from the next tab.')
          else
            ..._rows.map((v) {
              final id = v['_id']?.toString() ?? '';
              return ListCard(
                title: _name(v),
                subtitle: v['purpose']?.toString() ?? v['visitorPhone']?.toString(),
                trailing: StatusChip(label: v['status']?.toString() ?? '—'),
                onTap: id.isEmpty
                    ? null
                    : () => context.go('/visitor/status?id=$id'),
              );
            }),
        ],
      ),
    );
  }
}
