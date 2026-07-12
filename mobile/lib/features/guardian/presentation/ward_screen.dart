import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import '../data/guardian_repository.dart';

final guardianRepositoryProvider = Provider(
  (ref) => GuardianRepository(ref.watch(apiClientProvider)),
);

class GuardianWardScreen extends ConsumerStatefulWidget {
  const GuardianWardScreen({super.key});

  @override
  ConsumerState<GuardianWardScreen> createState() => _GuardianWardScreenState();
}

class _GuardianWardScreenState extends ConsumerState<GuardianWardScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _ward;

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
      final ward = await ref.read(guardianRepositoryProvider).ward();
      if (!mounted) return;
      setState(() {
        _ward = ward;
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
    final user = ref.watch(authProvider).user;
    final tenant = _ward?['tenant'] as Map?;
    final tenantUser = tenant?['user'] as Map?;
    final room = tenant?['room'] as Map?;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ward overview'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Signed in as ${user?.name ?? 'guardian'}',
              style: const TextStyle(color: Colors.black54, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            if (_error != null) ErrorBanner(message: _error!),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_ward == null)
              const EmptyState(message: 'No ward linked to this account')
            else ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Tenant', style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      _row('Name', tenantUser?['name']?.toString() ?? 'N/A'),
                      _row('Phone', tenantUser?['phone']?.toString() ?? 'N/A'),
                      _row(
                        'Room / bed',
                        '${room?['roomNumber'] ?? 'N/A'} / ${tenant?['bedId'] ?? '—'}',
                      ),
                      const SizedBox(height: 8),
                      StatusChip(
                        label: (tenant?['isActive'] == true) ? 'active' : 'inactive',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Your link', style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      _row('Relation', _ward?['relation']?.toString() ?? '—'),
                      _row('Guardian phone', _ward?['phone']?.toString() ?? user?.phone ?? '—'),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.black54, fontWeight: FontWeight.w600)),
          Flexible(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
