import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/payment_receipt.dart';
import '../../../core/network/open_bytes.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/widgets/payment_receipt_card.dart';
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
  List<Map<String, dynamic>> _payments = [];
  List<Map<String, dynamic>> _invoices = [];
  String? _invoiceId;
  final _utr = TextEditingController();
  final _screenshot = TextEditingController();
  bool _submitting = false;
  final _scrollController = ScrollController();

  /// The server's receipt for the payment the resident just submitted.
  ///
  /// The receipt is the artifact that replaces a local "submitted" claim.
  PaymentReceipt? _receipt;

  /// Why the receipt could not be shown, with a retry.
  String? _receiptError;

  /// The payment the server wrote for the last submission. Kept so the
  /// receipt can be fetched again without asking the resident to resubmit.
  Map<String, dynamic>? _submittedPayment;

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
    _scrollController.dispose();
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

  /// Server-computed balance of an open invoice.
  ///
  /// The server sends `balance` on every invoice row and the UPI QR is built
  /// from the same number, so the label and the QR can never disagree. The
  /// amount is never derived on the client.
  String _dueLabel(Map<String, dynamic> invoice) {
    final balance = (invoice['balance'] as num?)?.toDouble();
    if (balance == null) return 'balance unavailable';
    if (balance <= 0.001) return 'nothing due';
    return '${formatMoney(balance)} due';
  }

  /// The first open invoice that still has a server-reported balance.
  Map<String, dynamic>? _openInvoiceWithBalance() {
    for (final invoice in _invoices) {
      final balance = (invoice['balance'] as num?)?.toDouble();
      if (balance != null && balance > 0.001) return invoice;
    }
    return null;
  }

  /// Payments the resident has sent and the admin has not confirmed yet.
  ///
  /// A `pending` row is not enough: the API opens one automatically for every
  /// invoice it generates, and that is money the resident never sent. Only a
  /// row that carries a UTR is a payment waiting for a decision.
  List<Map<String, dynamic>> get _pendingPayments => _payments.where((p) {
        final status = (p['status']?.toString() ?? '').toLowerCase();
        if (status == 'pending_verification') return true;
        final utr = (p['utrNumber']?.toString() ?? '').trim();
        return status == 'pending' && utr.isNotEmpty;
      }).toList();

  void _scrollToTop() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  /// Next step for a resident with no payment history: pay what is due.
  Future<void> _payOutstanding() async {
    final target = _openInvoiceWithBalance();
    if (target == null) return;
    final id = target['_id']?.toString() ?? target['id']?.toString() ?? '';
    if (id.isEmpty) return;
    setState(() => _invoiceId = id);
    await _loadQr(id);
    _scrollToTop();
  }

  /// Whether the office's receipt for this payment can be shown.
  ///
  /// A settled payment always has one. A payment that carries a UTR has one
  /// too: the resident sent that money. A plain pending row the office opened
  /// for an invoice is not a payment the resident made, so it gets no receipt.
  bool _canViewReceipt(Map<String, dynamic> payment) {
    final status = (payment['status']?.toString() ?? '').toLowerCase();
    if (status == 'paid' || status == 'approved' || status == 'completed') {
      return true;
    }
    final utr = (payment['utrNumber']?.toString() ?? '').trim();
    return utr.isNotEmpty;
  }

  Future<void> _submitUtr() async {
    if (_invoiceId == null || _utr.text.trim().length < 6) {
      setState(() => _error = 'Select invoice and enter a valid UTR (min 6 chars).');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
      _receipt = null;
      _receiptError = null;
    });
    try {
      final payment = await ref.read(tenantRepositoryProvider).submitUtr(
            invoiceId: _invoiceId!,
            utrNumber: _utr.text,
            screenshotUrl:
                _screenshot.text.trim().isEmpty ? null : _screenshot.text.trim(),
          );
      if (!mounted) return;
      _utr.clear();
      _screenshot.clear();
      setState(() => _submittedPayment = payment);
      await _loadReceipt(payment);
      await _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// The server's receipt for the payment the resident just submitted.
  ///
  /// The receipt is the artifact: the id, the amount, the method, the date and
  /// the invoice it settles, all read from the server. When the server cannot
  /// produce one, the screen says so instead of claiming a success locally.
  Future<void> _loadReceipt(Map<String, dynamic>? payment) async {
    final id = payment?['_id']?.toString() ?? payment?['id']?.toString() ?? '';
    if (id.isEmpty) {
      if (!mounted) return;
      setState(
        () => _receiptError =
            'The office did not return a receipt for this payment. '
            'Pull to refresh to see it in the payment list.',
      );
      return;
    }
    try {
      final raw = await ref.read(tenantRepositoryProvider).paymentReceipt(id);
      if (!mounted) return;
      if (raw == null) {
        setState(
          () => _receiptError =
              'The receipt for this payment is not available yet. '
              'Pull to refresh to try again.',
        );
        return;
      }
      setState(() {
        _receipt = PaymentReceipt.fromServer(raw);
        _receiptError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(
        () => _receiptError = e.toString().replaceFirst('Exception: ', ''),
      );
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
    // The open invoice that still has a server-reported balance, if any.
    final outstanding = _openInvoiceWithBalance();

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
                controller: _scrollController,
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!, onRetry: _load),
                    const SizedBox(height: 12),
                  ],
                  if (_receiptError != null) ...[
                    ErrorBanner(
                      message: _receiptError!,
                      onRetry: _submittedPayment == null
                          ? null
                          : () => _loadReceipt(_submittedPayment),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (_receipt != null) ...[
                    Text(
                      'Latest receipt',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                    PaymentReceiptCard(receipt: _receipt!),
                    const SizedBox(height: 16),
                  ],
                  if (_pendingPayments.isNotEmpty) ...[
                    ..._pendingPayments.map(
                      (p) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _PendingPaymentCard(
                          payment: p,
                          onViewReceipt: _canViewReceipt(p)
                              ? () => _showReceipt(
                                    p['_id']?.toString() ??
                                        p['id']?.toString() ??
                                        '',
                                  )
                              : null,
                        ),
                      ),
                    ),
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
                              return DropdownMenuItem(
                                value: i['_id']?.toString(),
                                child: Text(
                                  '${i['invoiceNumber'] ?? i['_id']} · ${_dueLabel(i)}',
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
                      ErrorBanner(
                        message: _qrError!,
                        onRetry: _invoiceId == null
                            ? null
                            : () => _loadQr(_invoiceId!),
                      )
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
              EmptyState(
                message: 'No payments yet',
                hint: outstanding == null
                    ? 'Nothing is due right now. No action needed.'
                    : 'Pay the outstanding balance with the UPI QR above.',
                actionLabel:
                    outstanding == null ? null : 'Pay the outstanding balance',
                onAction: _payOutstanding,
              )
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

    final canViewReceipt = _canViewReceipt(p) && paymentId.isNotEmpty;

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

  /// The office's receipt for one payment, shown as the server sent it.
  ///
  /// Every value on the card comes from `GET /payments/:id/receipt`: the
  /// reference, the amount, the method, the date and the invoice it settles.
  Future<void> _showReceipt(String paymentId) async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );
    Map<String, dynamic>? raw;
    String? receiptError;
    try {
      raw = await ref.read(tenantRepositoryProvider).paymentReceipt(paymentId);
    } catch (e) {
      receiptError = e.toString().replaceFirst('Exception: ', '');
    } finally {
      if (mounted) Navigator.pop(context);
    }

    if (!mounted) return;
    if (receiptError != null || raw == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            receiptError ??
                'The receipt could not be loaded. Try again in a moment.',
          ),
        ),
      );
      return;
    }

    final receipt = PaymentReceipt.fromServer(raw);

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            child: PaymentReceiptCard(receipt: receipt),
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

/// A payment the office has not checked yet.
///
/// The resident must be able to see that the money is not lost: the amount
/// they sent, the day they sent it, and what happens next. The card says
/// what the office does and what the resident is told, and it promises only
/// the notifications the server actually sends.
class _PendingPaymentCard extends StatelessWidget {
  const _PendingPaymentCard({required this.payment, this.onViewReceipt});

  final Map<String, dynamic> payment;

  /// Opens the office's receipt for this payment, when there is one.
  final VoidCallback? onViewReceipt;

  @override
  Widget build(BuildContext context) {
    final amount = payment['amount'] as num?;
    // The server stamps the UTR submission on the row (updatedAt), and the
    // row is created by the submission when there was no pending row yet.
    final submittedOn = formatDate(
      payment['utrSubmittedAt'] ??
          payment['updatedAt'] ??
          payment['createdAt'] ??
          payment['paidAt'],
    );
    final status = payment['status']?.toString() ?? 'pending_verification';
    final utr = (payment['utrNumber']?.toString() ?? '').trim();

    return Material(
      color: AppTheme.warningSoft,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.hourglass_top, size: 18, color: AppTheme.warningText),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Awaiting verification',
                    style: const TextStyle(
                      color: AppTheme.warningText,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                StatusChip(label: status),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              formatMoney(amount),
              style: const TextStyle(
                color: AppTheme.warningText,
                fontWeight: FontWeight.w800,
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              utr.isEmpty
                  ? 'Submitted on $submittedOn'
                  : 'UTR $utr · submitted on $submittedOn',
              style: const TextStyle(
                color: AppTheme.warningText,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'The office will check this UTR against its records and verify '
              'or reject it. You will get a notification when it is verified, '
              'rejected or voided.',
              style: TextStyle(
                color: AppTheme.warningText.withValues(alpha: 0.9),
                fontSize: 12,
                height: 1.4,
              ),
            ),
            if (onViewReceipt != null) ...[
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: onViewReceipt,
                  icon: const Icon(Icons.receipt_long, size: 16),
                  label: const Text('View receipt'),
                  style: TextButton.styleFrom(
                    foregroundColor: AppTheme.warningText,
                    padding: EdgeInsets.zero,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
