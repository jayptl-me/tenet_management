import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/open_bytes.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantPaymentsScreen extends ConsumerStatefulWidget {
  const TenantPaymentsScreen({super.key, this.invoiceId});

  /// Optional invoice to preselect (from `/tenant/payments?invoiceId=`).
  final String? invoiceId;

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
  final _screenshot = TextEditingController();
  bool _submitting = false;

  Map<String, dynamic>? _qr;
  bool _qrLoading = false;
  String? _qrError;

  @override
  void initState() {
    super.initState();
    final fromQuery = widget.invoiceId?.trim();
    if (fromQuery != null && fromQuery.isNotEmpty) {
      _invoiceId = fromQuery;
    }
    Future.microtask(_load);
  }

  @override
  void didUpdateWidget(covariant TenantPaymentsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = widget.invoiceId?.trim();
    final prev = oldWidget.invoiceId?.trim();
    if (next != null && next.isNotEmpty && next != prev && next != _invoiceId) {
      _invoiceId = next;
      Future.microtask(() async {
        if (!mounted) return;
        if (_invoices.any((i) => i['_id']?.toString() == next)) {
          await _onInvoiceChanged(next);
        } else {
          await _load();
        }
      });
    }
  }

  @override
  void dispose() {
    _utr.dispose();
    _screenshot.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(tenantRepositoryProvider);
      final results = await Future.wait<List<Map<String, dynamic>>>([
        repo.myPayments(),
        repo.myInvoices(),
      ]);
      if (!mounted) return;
      final open = results[1]
          .where((i) => i['status'] != 'paid' && i['status'] != 'cancelled')
          .toList();
      final preferred = _invoiceId;
      final preferredExists = preferred != null &&
          preferred.isNotEmpty &&
          open.any((i) => i['_id']?.toString() == preferred);
      final nextInvoiceId = preferredExists
          ? preferred
          : (open.isNotEmpty ? open.first['_id']?.toString() : null);
      setState(() {
        _payments = results[0];
        _invoices = open;
        _invoiceId = nextInvoiceId;
        _loading = false;
      });
      if (nextInvoiceId != null) {
        await _loadQr(nextInvoiceId);
      } else {
        setState(() {
          _qr = null;
          _qrError = null;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _loadQr(String invoiceId) async {
    setState(() {
      _qrLoading = true;
      _qrError = null;
      _qr = null;
    });
    try {
      final data =
          await ref.read(tenantRepositoryProvider).paymentQrCode(invoiceId);
      if (!mounted) return;
      setState(() {
        _qr = data;
        _qrLoading = false;
        if (data == null) {
          _qrError = 'UPI QR unavailable for this invoice.';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _qrError = e.toString().replaceFirst('Exception: ', '');
        _qrLoading = false;
      });
    }
  }

  Future<void> _onInvoiceChanged(String? id) async {
    setState(() => _invoiceId = id);
    if (id != null && id.isNotEmpty) {
      await _loadQr(id);
    } else {
      setState(() {
        _qr = null;
        _qrError = null;
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
            screenshotUrl:
                _screenshot.text.trim().isEmpty ? null : _screenshot.text.trim(),
          );
      _utr.clear();
      _screenshot.clear();
      setState(() => _success = 'UTR submitted for verification.');
      await _load();
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Uint8List? _decodeQrImage(String? dataUrl) {
    if (dataUrl == null || dataUrl.isEmpty) return null;
    try {
      final comma = dataUrl.indexOf(',');
      final b64 = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
      return base64Decode(b64);
    } catch (_) {
      return null;
    }
  }

  Future<void> _openUpiDeepLink() async {
    final link = _qr?['upiDeepLink']?.toString();
    if (link == null || link.isEmpty) return;
    final ok = await launchExternalUri(link);
    if (!mounted) return;
    if (!ok) {
      await Clipboard.setData(ClipboardData(text: link));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open UPI app. Link copied.')),
      );
    }
  }

  Future<void> _copyUpiId() async {
    final upi = _qr?['upiId']?.toString();
    if (upi == null || upi.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: upi));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('UPI ID copied: $upi')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final qrBytes = _decodeQrImage(_qr?['qrDataUrl']?.toString());

    return Scaffold(
      appBar: AppBar(title: const Text('Payments')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading && _invoices.isEmpty && _payments.isEmpty
            ? const Padding(
                padding: EdgeInsets.all(16),
                child: SkeletonList(cardCount: 3, height: 120),
              )
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 12),
                  ],
            if (_success != null) ...[
              Material(
                color: AppTheme.successSoft,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(
                    _success!,
                    style: const TextStyle(
                      color: AppTheme.success,
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
                      'Pay via UPI',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      key: ValueKey(
                        'pay-invoice-$_invoiceId-${_invoices.length}',
                      ),
                      initialValue: _invoiceId != null &&
                              _invoices.any(
                                (i) => i['_id']?.toString() == _invoiceId,
                              )
                          ? _invoiceId
                          : null,
                      decoration: const InputDecoration(labelText: 'Invoice'),
                      items: _invoices
                          .map(
                            (i) {
                              final total =
                                  (i['totalAmount'] as num?)?.toDouble() ?? 0;
                              final paid =
                                  (i['paidAmount'] as num?)?.toDouble() ?? 0;
                              final due = total - paid;
                              return DropdownMenuItem(
                                value: i['_id']?.toString(),
                                child: Text(
                                  '${i['invoiceNumber'] ?? i['_id']} · ${formatMoney(due > 0 ? due : 0)} due',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            },
                          )
                          .toList(),
                      onChanged: (v) => _onInvoiceChanged(v),
                    ),
                    const SizedBox(height: 16),
                    if (_invoiceId == null)
                      const Text(
                        'Select an open invoice to show the UPI QR.',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      )
                    else if (_qrLoading)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    else if (_qrError != null)
                      ErrorBanner(message: _qrError!)
                    else if (_qr != null) ...[
                      if (qrBytes != null)
                        Center(
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Theme.of(context)
                                    .colorScheme
                                    .outlineVariant,
                              ),
                            ),
                            child: Image.memory(
                              qrBytes,
                              width: 200,
                              height: 200,
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                      const SizedBox(height: 12),
                      _kv('Amount', formatMoney(_qr!['amount'] as num?)),
                      _kv('Payee', _qr!['payeeName']?.toString() ?? '--'),
                      _kv('UPI ID', _qr!['upiId']?.toString() ?? '--'),
                      _kv(
                        'Invoice',
                        _qr!['invoiceNumber']?.toString() ?? '--',
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton.tonal(
                              onPressed: _openUpiDeepLink,
                              child: const Text('Open UPI app'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _copyUpiId,
                              child: const Text('Copy UPI ID'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
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
                    TextField(
                      controller: _utr,
                      decoration: const InputDecoration(labelText: 'UTR / reference'),
                      textCapitalization: TextCapitalization.characters,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _screenshot,
                      decoration: const InputDecoration(
                        labelText: 'Screenshot URL (optional)',
                        hintText: 'https://...',
                        prefixIcon: Icon(Icons.link, size: 18),
                      ),
                      keyboardType: TextInputType.url,
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
              const SkeletonList(cardCount: 2, height: 72)
            else if (_payments.isEmpty)
              const EmptyState(message: 'No payments yet')
            else
              ..._payments.map(
                (p) => ListCard(
                  title: formatMoney(p['amount'] as num?),
                  subtitle: (p['method']?.toString() ?? '--').replaceAll('_', ' '),
                  trailing: StatusChip(label: p['status']?.toString() ?? '--'),
                  onTap: () => _showPaymentDetails(p),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _showPaymentDetails(Map<String, dynamic> p) async {
    final paymentId = p['_id']?.toString() ?? p['id']?.toString() ?? '';
    final amount = p['amount'] as num?;
    final method = (p['method']?.toString() ?? '--').replaceAll('_', ' ');
    final type = (p['type']?.toString() ?? '--').replaceAll('_', ' ');
    final status = p['status']?.toString() ?? '--';
    final utr = p['utrNumber']?.toString();
    final date = formatDate(p['paidAt'] ?? p['createdAt']);
    final notes = p['notes']?.toString();
    final invoiceId = p['invoiceId'] is Map
        ? (p['invoiceId'] as Map)['invoiceNumber']?.toString() ??
            (p['invoiceId'] as Map)['_id']?.toString()
        : p['invoiceNumber']?.toString() ?? p['invoiceId']?.toString();

    final canViewReceipt =
        status == 'paid' || status == 'approved' || status == 'completed';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Payment details',
                      style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    StatusChip(label: status),
                  ],
                ),
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    formatMoney(amount),
                    style: Theme.of(ctx).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: Theme.of(ctx).colorScheme.primary,
                        ),
                  ),
                ),
                const SizedBox(height: 20),
                _sheetKv(ctx, 'Method', method),
                _sheetKv(ctx, 'Category', type),
                _sheetKv(ctx, 'Date', date),
                if (invoiceId != null && invoiceId.isNotEmpty)
                  _sheetKv(ctx, 'Invoice', invoiceId),
                if (utr != null && utr.isNotEmpty) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'UTR / Ref',
                          style: TextStyle(
                            color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              utr,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontFamily: 'monospace',
                              ),
                            ),
                            const SizedBox(width: 4),
                            IconButton(
                              icon: const Icon(Icons.copy, size: 16),
                              tooltip: 'Copy UTR',
                              onPressed: () async {
                                await Clipboard.setData(ClipboardData(text: utr));
                                if (!ctx.mounted) return;
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                  SnackBar(content: Text('UTR copied: $utr')),
                                );
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                if (notes != null && notes.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Notes: $notes',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
                if (canViewReceipt && paymentId.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      await _showReceipt(paymentId);
                    },
                    icon: const Icon(Icons.receipt_long),
                    label: const Text('View receipt'),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showReceipt(String paymentId) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );
    Map<String, dynamic>? receipt;
    String? receiptError;
    try {
      receipt =
          await ref.read(tenantRepositoryProvider).paymentReceipt(paymentId);
    } catch (e) {
      receiptError = e.toString().replaceFirst('Exception: ', '');
    } finally {
      if (mounted) Navigator.pop(context);
    }

    if (!mounted) return;
    if (receiptError != null || receipt == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(receiptError ?? 'Failed to load receipt')),
      );
      return;
    }

    final amount = receipt['amount'] as num?;
    final method =
        (receipt['method']?.toString() ?? '--').replaceAll('_', ' ');
    final date = formatDate(receipt['paidAt'] ?? receipt['createdAt']);
    final utr = receipt['utrNumber']?.toString();
    final tenant =
        receipt['tenantId'] is Map ? receipt['tenantId'] as Map : null;
    final tenantUser =
        tenant?['userId'] is Map ? tenant!['userId'] as Map : null;
    final tenantName = tenantUser?['name']?.toString() ?? 'Tenant';
    final room = tenant?['roomId'] is Map ? tenant!['roomId'] as Map : null;
    final roomNumber = room?['roomNumber']?.toString();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(ctx)
                          .colorScheme
                          .primaryContainer
                          .withValues(alpha: 0.4),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.check_circle_rounded,
                      size: 40,
                      color: Theme.of(ctx).colorScheme.primary,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Payment Receipt',
                  textAlign: TextAlign.center,
                  style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                Text(
                  'Receipt ID: $paymentId',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 8),
                _sheetKv(ctx, 'Tenant', tenantName),
                if (roomNumber != null) _sheetKv(ctx, 'Room', roomNumber),
                _sheetKv(ctx, 'Amount Paid', formatMoney(amount)),
                _sheetKv(ctx, 'Payment Method', method),
                _sheetKv(ctx, 'Date', date),
                if (utr != null && utr.isNotEmpty)
                  _sheetKv(ctx, 'UTR / Ref', utr),
                const SizedBox(height: 8),
                const Divider(),
                const SizedBox(height: 16),
                OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _sheetKv(BuildContext ctx, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Theme.of(ctx).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _kv(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w600,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
