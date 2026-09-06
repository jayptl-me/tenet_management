import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'visitor_home_screen.dart';

class VisitorStatusScreen extends ConsumerStatefulWidget {
  const VisitorStatusScreen({super.key, this.visitorId});

  final String? visitorId;

  @override
  ConsumerState<VisitorStatusScreen> createState() =>
      _VisitorStatusScreenState();
}

class _VisitorStatusScreenState extends ConsumerState<VisitorStatusScreen> {
  final _idController = TextEditingController();
  Map<String, dynamic>? _visitor;
  bool _loading = false;
  String? _error;
  bool _actionLoading = false;

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
  void didUpdateWidget(covariant VisitorStatusScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.visitorId != null &&
        widget.visitorId!.isNotEmpty &&
        widget.visitorId != oldWidget.visitorId) {
      _idController.text = widget.visitorId!;
      _load(widget.visitorId!);
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
        if (data.isEmpty) {
          _error = 'Visitor not found.';
        }
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
    final id = _visitor?['_id']?.toString() ?? _idController.text.trim();
    if (id.isEmpty) return;
    setState(() {
      _actionLoading = true;
      _error = null;
    });
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
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'arrive'
                  ? 'Visitor marked as arrived'
                  : action == 'depart'
                      ? 'Visitor marked as departed'
                      : 'Visitor pass cancelled',
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _actionLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final status = _visitor?['status']?.toString() ?? '';
    final name = _visitor?['visitorName']?.toString() ??
        _visitor?['name']?.toString() ??
        'Visitor';
    final id = _visitor?['_id']?.toString() ?? widget.visitorId ?? '';
    final passCode = id.length > 6 ? id.substring(id.length - 6).toUpperCase() : id.toUpperCase();
    final tenant = _visitor?['tenantId'] is Map ? _visitor!['tenantId'] as Map : null;
    final hostName = tenant?['user'] is Map ? tenant!['user']['name']?.toString() : null;
    final hostRoom = tenant?['room'] is Map ? tenant!['room']['roomNumber']?.toString() : null;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Visitor Pass & Status',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            OutlinedButton.icon(
              onPressed: () => context.go('/tenant/visitors'),
              icon: const Icon(Icons.people_outline, size: 16),
              label: const Text('All visitors'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _idController,
                decoration: const InputDecoration(
                  labelText: 'Visitor ID',
                  hintText: 'Paste visitor record ID',
                  prefixIcon: Icon(Icons.tag, size: 18),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _loading
                  ? null
                  : () {
                      final inputId = _idController.text.trim();
                      if (inputId.isEmpty) return;
                      context.go('/visitor/status?id=$inputId');
                      _load(inputId);
                    },
              child: const Text('Load'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_error != null) ...[
          ErrorBanner(message: _error!),
          const SizedBox(height: 12),
        ],
        if (_loading) const SkeletonBlock(height: 240),
        if (!_loading && _visitor != null && _visitor!.isNotEmpty) ...[
          // Digital Gate Pass Card
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(
                color: cs.primary.withValues(alpha: 0.3),
                width: 1.5,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Pass Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.badge_outlined,
                              color: cs.primary, size: 20),
                          const SizedBox(width: 6),
                          const Text(
                            'DIGITAL VISITOR PASS',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.1,
                              color: AppTheme.muted,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (passCode.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: cs.surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                '#$passCode',
                                style: const TextStyle(
                                  fontFamily: 'monospace',
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          const SizedBox(width: 6),
                          IconButton(
                            icon: const Icon(Icons.copy, size: 16),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            tooltip: 'Copy pass details',
                            onPressed: () {
                              final text =
                                  'TENET VISITOR PASS\nPass Code: #$passCode\nVisitor: $name\nPhone: ${_visitor?['visitorPhone'] ?? _visitor?['phone'] ?? '--'}\nPurpose: ${_visitor?['purpose'] ?? 'Visit'}\nHost: ${hostName ?? 'Tenant'}${hostRoom != null ? ' (Room $hostRoom)' : ''}\nStatus: ${status.toUpperCase()}';
                              Clipboard.setData(ClipboardData(text: text));
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content:
                                      Text('Visitor pass copied to clipboard'),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: cs.primary.withValues(alpha: 0.12),
                        child: Text(
                          name.isNotEmpty ? name[0].toUpperCase() : 'V',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: cs.primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _visitor?['visitorPhone']?.toString() ??
                                  _visitor?['phone']?.toString() ??
                                  '—',
                              style: TextStyle(
                                color: cs.onSurfaceVariant,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      StatusChip(label: status),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: cs.surfaceContainerHighest.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      children: [
                        _passRow('Purpose', _visitor?['purpose']?.toString() ?? 'Visit'),
                        _passRow('Expected Arrival', formatDate(_visitor?['expectedArrival'])),
                        if (_visitor?['actualArrival'] != null)
                          _passRow('Checked In', formatDate(_visitor?['actualArrival'])),
                        if (_visitor?['actualDeparture'] != null)
                          _passRow('Checked Out', formatDate(_visitor?['actualDeparture'])),
                        if (hostName != null || hostRoom != null)
                          _passRow(
                            'Host Resident',
                            '${hostName ?? 'Tenant'}${hostRoom != null ? ' (Room $hostRoom)' : ''}',
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Lifecycle actions
                  if (status == 'expected') ...[
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            onPressed: _actionLoading ? null : () => _action('arrive'),
                            icon: const Icon(Icons.login),
                            label: Text(_actionLoading ? 'Updating...' : 'Mark arrived'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton.icon(
                          onPressed: _actionLoading ? null : () => _action('cancel'),
                          icon: const Icon(Icons.cancel_outlined),
                          label: const Text('Cancel pass'),
                        ),
                      ],
                    ),
                  ],
                  if (status == 'arrived')
                    FilledButton.icon(
                      onPressed: _actionLoading ? null : () => _action('depart'),
                      icon: const Icon(Icons.logout),
                      label: Text(_actionLoading ? 'Updating...' : 'Mark departed'),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: TextButton.icon(
              onPressed: () => context.go('/visitor/register'),
              icon: const Icon(Icons.person_add_alt_1_outlined),
              label: const Text('Register another visitor'),
            ),
          ),
        ],
      ],
    );
  }

  Widget _passRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppTheme.muted,
              fontWeight: FontWeight.w600,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
