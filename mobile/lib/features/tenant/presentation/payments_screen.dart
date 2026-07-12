import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantPaymentsScreen extends ConsumerStatefulWidget {
  const TenantPaymentsScreen({super.key});

  @override
  ConsumerState<TenantPaymentsScreen> createState() => _TenantPaymentsScreenState();
}

class _TenantPaymentsScreenState extends ConsumerState<TenantPaymentsScreen> {
  bool _loading = true;
  String? _error;
  String? _success;
  List<Map<String, dynamic>> _payments = [];
  List<Map<String, dynamic>> _invoices = [];
  String? _invoiceId;
  final _utr = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _utr.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(tenantRepositoryProvider);
      final results = await Future.wait([
        repo.myPayments(),
        repo.myInvoices(),
      ]);
      if (!mounted) return;
      final open = results[1]
          .where((i) => i['status'] != 'paid' && i['status'] != 'cancelled')
          .toList();
      setState(() {
        _payments = results[0];
        _invoices = open;
        _invoiceId ??= open.isNotEmpty ? open.first['_id']?.toString() : null;
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

  Future<void> _submitUtr() async {
    if (_invoiceId == null || _utr.text.trim().length < 6) {
      setState(() => _error = 'Select invoice and enter a valid UTR (min 6 chars).');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });
    try {
      await ref.read(tenantRepositoryProvider).submitUtr(
            invoiceId: _invoiceId!,
            utrNumber: _utr.text,
          );
      _utr.clear();
      setState(() => _success = 'UTR submitted for verification.');
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
      appBar: AppBar(title: const Text('Payments')),
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
              Material(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    _success!,
                    style: const TextStyle(
                      color: Color(0xFF065F46),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Submit UPI UTR',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _invoiceId,
                      decoration: const InputDecoration(labelText: 'Invoice'),
                      items: _invoices
                          .map(
                            (i) => DropdownMenuItem(
                              value: i['_id']?.toString(),
                              child: Text(
                                '${i['invoiceNumber'] ?? i['_id']} · ${formatMoney(i['totalAmount'] as num?)}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (v) => setState(() => _invoiceId = v),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _utr,
                      decoration: const InputDecoration(labelText: 'UTR / reference'),
                      textCapitalization: TextCapitalization.characters,
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _submitting ? null : _submitUtr,
                      child: _submitting
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Submit for verification'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_payments.isEmpty)
              const EmptyState(message: 'No payments yet')
            else
              ..._payments.map(
                (p) => ListCard(
                  title: formatMoney(p['amount'] as num?),
                  subtitle: (p['method']?.toString() ?? '—').replaceAll('_', ' '),
                  trailing: StatusChip(label: p['status']?.toString() ?? '—'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
