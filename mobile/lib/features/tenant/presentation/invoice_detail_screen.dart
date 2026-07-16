import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/open_bytes.dart';
import '../../../core/network/open_bytes_web.dart'
    if (dart.library.io) '../../../core/network/open_bytes_web_stub.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantInvoiceDetailScreen extends ConsumerStatefulWidget {
  const TenantInvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  ConsumerState<TenantInvoiceDetailScreen> createState() =>
      _TenantInvoiceDetailScreenState();
}

class _TenantInvoiceDetailScreenState
    extends ConsumerState<TenantInvoiceDetailScreen> {
  Map<String, dynamic>? _invoice;
  bool _loading = true;
  String? _error;
  bool _pdfLoading = false;

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
      final data = await ref
          .read(tenantRepositoryProvider)
          .invoiceDetail(widget.invoiceId);
      if (!mounted) return;
      setState(() {
        _invoice = data;
        _loading = false;
        if (data == null) {
          _error = 'Invoice not found.';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _openPdf() async {
    setState(() => _pdfLoading = true);
    try {
      final bytes = await ref
          .read(tenantRepositoryProvider)
          .invoicePdfBytes(widget.invoiceId);
      final number =
          _invoice?['invoiceNumber']?.toString() ?? widget.invoiceId;
      final fileName = 'invoice-$number.pdf';
      if (kIsWeb) {
        openBytesOnWeb(bytes: bytes, fileName: fileName);
      } else {
        final path = await openOrSaveBytes(bytes: bytes, fileName: fileName);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('PDF saved: $path')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst('Exception: ', ''),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _pdfLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoice'),
        actions: [
          IconButton(
            tooltip: 'Download PDF',
            onPressed: _loading || _pdfLoading ? null : _openPdf,
            icon: _pdfLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf_outlined),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  if (_invoice != null) ...[
                    _buildContent(context, _invoice!),
                    if (_needsPayment(_invoice!)) ...[
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: () => context.go(
                          '/tenant/payments?invoiceId=${Uri.encodeComponent(widget.invoiceId)}',
                        ),
                        icon: const Icon(Icons.payments_outlined),
                        label: const Text('Pay / Submit UTR'),
                      ),
                    ],
                    const SizedBox(height: 12),
                    FilledButton.tonalIcon(
                      onPressed: _pdfLoading ? null : _openPdf,
                      icon: _pdfLoading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.download_outlined),
                      label: Text(
                        _pdfLoading ? 'Preparing PDF...' : 'Download PDF',
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }

  bool _needsPayment(Map<String, dynamic> inv) {
    final balance = (inv['balance'] as num?) ?? 0;
    final status = (inv['status']?.toString() ?? '').toLowerCase();
    if (status == 'paid' || status == 'cancelled') return false;
    return balance > 0 || status == 'unpaid' || status == 'partial' || status == 'overdue';
  }

  Widget _buildContent(BuildContext context, Map<String, dynamic> inv) {
    final lineItems = inv['lineItems'] as List?;
    final payments = inv['payments'] as List?;
    final cs = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        inv['invoiceNumber']?.toString() ?? 'Invoice',
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    StatusChip(label: inv['status']?.toString() ?? '--'),
                  ],
                ),
                const SizedBox(height: 8),
                _kv(context, 'Month', inv['month']?.toString() ?? '--'),
                _kv(context, 'Due date', formatDate(inv['dueDate'])),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _sectionTitle(context, 'Line Items'),
        Card(
          child: Column(
            children: [
              if (lineItems == null || lineItems.isEmpty)
                const ListTile(title: Text('No line items'))
              else
                ...lineItems.map((item) {
                  final m = item is Map ? Map<String, dynamic>.from(item) : {};
                  return ListTile(
                    dense: true,
                    title: Text(m['description']?.toString() ?? '--'),
                    trailing: Text(formatMoney(m['amount'] as num?),
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  );
                }),
              const Divider(height: 1),
              ListTile(
                dense: true,
                title: const Text('Rent',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                trailing: Text(formatMoney(inv['rentAmount'] as num?)),
              ),
              ListTile(
                dense: true,
                title: const Text('Electricity',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                trailing: Text(formatMoney(inv['electricityAmount'] as num?)),
              ),
              ListTile(
                dense: true,
                title: const Text('Other charges',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                trailing: Text(formatMoney(inv['otherCharges'] as num?)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Card(
          color: cs.primaryContainer,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _kv(context, 'Total amount',
                    formatMoney(inv['totalAmount'] as num?)),
                _kv(context, 'Paid amount',
                    formatMoney(inv['paidAmount'] as num?)),
                _kv(context, 'Balance', formatMoney(inv['balance'] as num?)),
              ],
            ),
          ),
        ),
        if (payments != null && payments.isNotEmpty) ...[
          const SizedBox(height: 16),
          _sectionTitle(context, 'Payment History'),
          ...payments.map((p) {
            final m = p is Map ? Map<String, dynamic>.from(p) : {};
            return ListCard(
              title: formatMoney(m['amount'] as num?),
              subtitle:
                  '${formatDate(m['createdAt'])} - ${m['status']?.toString() ?? '--'}',
              trailing: StatusChip(label: m['status']?.toString() ?? '--'),
            );
          }),
        ],
      ],
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w800),
      ),
    );
  }

  Widget _kv(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 14,
              )),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
