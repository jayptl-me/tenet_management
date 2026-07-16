import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantLeavesScreen extends ConsumerStatefulWidget {
  const TenantLeavesScreen({super.key});

  @override
  ConsumerState<TenantLeavesScreen> createState() =>
      _TenantLeavesScreenState();
}

class _TenantLeavesScreenState extends ConsumerState<TenantLeavesScreen> {
  List<Map<String, dynamic>> _leaves = [];
  bool _loading = true;
  String? _error;
  bool _featureDisabled = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _featureDisabled = false;
    });
    try {
      final rows = await ref.read(tenantRepositoryProvider).myLeaves();
      if (!mounted) return;
      setState(() {
        _leaves = rows;
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

  Future<void> _cancelLeave(String leaveId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel leave?'),
        content: const Text(
          'Withdraw this pending leave application? You can apply again later.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel leave'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await ref.read(tenantRepositoryProvider).cancelLeave(leaveId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Leave cancelled')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _showCreateDialog() async {
    final tenantId = await ref.read(authProvider.notifier).ensureTenantId();
    if (!mounted) return;
    if (tenantId == null || tenantId.isEmpty) {
      setState(() => _error = 'Tenant profile not linked. Contact admin.');
      return;
    }
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _LeaveCreateSheet(
        tenantId: tenantId,
        onCreated: () {
          Navigator.pop(ctx);
          _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave Applications')),
      floatingActionButton: FloatingActionButton(
        onPressed: _featureDisabled ? null : _showCreateDialog,
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _featureDisabled
                ? const FeatureDisabledWidget()
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_error != null) ErrorBanner(message: _error!),
                      if (_leaves.isEmpty)
                        const EmptyState(message: 'No leave applications')
                      else
                        ..._leaves.map((l) {
                          final status = l['status']?.toString() ?? '--';
                          final id = (l['_id'] ?? l['id'])?.toString() ?? '';
                          final pending = status == 'pending';
                          return ListCard(
                            title:
                                '${formatDate(l['fromDate'] ?? l['startDate'])} - ${formatDate(l['toDate'] ?? l['endDate'])}',
                            subtitle: l['reason']?.toString() ?? '',
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                StatusChip(label: status),
                                if (pending && id.isNotEmpty) ...[
                                  const SizedBox(width: 4),
                                  TextButton(
                                    onPressed: () => _cancelLeave(id),
                                    child: const Text('Cancel'),
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

class _LeaveCreateSheet extends ConsumerStatefulWidget {
  const _LeaveCreateSheet({required this.tenantId, required this.onCreated});

  final String tenantId;
  final VoidCallback onCreated;

  @override
  ConsumerState<_LeaveCreateSheet> createState() =>
      _LeaveCreateSheetState();
}

class _LeaveCreateSheetState extends ConsumerState<_LeaveCreateSheet> {
  final _formKey = GlobalKey<FormState>();
  final _reason = TextEditingController();
  DateTime _from = DateTime.now();
  DateTime _to = DateTime.now().add(const Duration(days: 1));
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    var tenantId = widget.tenantId;
    if (tenantId.isEmpty) {
      final healed = await ref.read(authProvider.notifier).ensureTenantId();
      if (healed == null || healed.isEmpty) {
        setState(() => _error = 'Tenant profile not linked. Contact admin.');
        return;
      }
      tenantId = healed;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(tenantRepositoryProvider).createLeave(
            tenantId: tenantId,
            fromDate: _fmt(_from),
            toDate: _fmt(_to),
            reason: _reason.text.trim(),
          );
      widget.onCreated();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('New Leave Application',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              if (_error != null) ...[
                ErrorBanner(message: _error!),
                const SizedBox(height: 12),
              ],
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('From: ${formatDate(_from)}'),
                trailing: const Icon(Icons.calendar_today),
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 90)),
                    initialDate: _from,
                  );
                  if (d != null) setState(() => _from = d);
                },
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('To: ${formatDate(_to)}'),
                trailing: const Icon(Icons.calendar_today),
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    firstDate: _from,
                    lastDate: DateTime.now().add(const Duration(days: 90)),
                    initialDate: _to,
                  );
                  if (d != null) setState(() => _to = d);
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _reason,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Reason'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Reason required' : null,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'Submitting...' : 'Submit'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
