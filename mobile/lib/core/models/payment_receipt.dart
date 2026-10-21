import 'package:equatable/equatable.dart';

/// The server-issued receipt for one payment.
///
/// Source: `GET /payments/:id/receipt` - the same artifact the office renders
/// in `apps/web/src/components/admin/ReceiptDocument.tsx`. Every value here
/// is read from the server response and nothing is derived on the client, so
/// a number the resident sees is the office's number.
///
/// The server sends the payment row itself: the id, the amount, the method,
/// the status, the dates, the invoice it settles and the tenant it belongs
/// to. A missing value stays missing here, so the screen can say "not
/// reported" instead of inventing a number.
class PaymentReceipt extends Equatable {
  const PaymentReceipt({
    required this.id,
    required this.amount,
    required this.method,
    required this.type,
    required this.status,
    required this.invoiceNumber,
    required this.tenantName,
    required this.roomNumber,
    required this.pgName,
    this.utrNumber,
    this.notes,
    this.paidAt,
    this.createdAt,
  });

  /// The server's payment id. This is the receipt's reference.
  final String id;

  /// The amount the server recorded. Null when the server sent none.
  final num? amount;

  /// The method the server recorded (upi, cash, bank transfer...).
  final String method;

  /// The category the server recorded (rent, electricity, deposit...).
  final String type;

  /// The status the server recorded. The office owns it, not the portal.
  final String status;

  /// The invoice this payment settles, as the server spells it.
  final String invoiceNumber;

  /// The resident the server stamped on the payment.
  final String tenantName;

  /// The room the server stamped on the payment.
  final String roomNumber;

  /// The PG name the server put in the receipt branding.
  final String pgName;

  /// The UTR the server stored with the payment, when there is one.
  final String? utrNumber;

  /// The office's note on the payment.
  final String? notes;

  /// When the server says the payment was paid.
  final String? paidAt;

  /// When the server created the payment row.
  final String? createdAt;

  /// True when the server has settled this payment.
  bool get isSettled => status == 'paid';

  /// The server's own date for the payment: when it was paid, else when the
  /// row was created.
  String? get date => paidAt ?? createdAt;

  factory PaymentReceipt.fromServer(Map<String, dynamic> json) {
    return PaymentReceipt(
      id: _text(json['_id'] ?? json['id']),
      amount: _number(json['amount']),
      method: _text(json['method']).replaceAll('_', ' '),
      type: _text(json['type']),
      status: _text(json['status'], fallback: 'unknown'),
      invoiceNumber: _invoiceNumber(json['invoiceId']),
      tenantName: _tenantName(json['tenantId']),
      roomNumber: _roomNumber(json['tenantId']),
      pgName: _brandingName(json['pgBranding']),
      utrNumber: _optional(json['utrNumber']),
      notes: _optional(json['notes']),
      paidAt: _optional(json['paidAt']),
      createdAt: _optional(json['createdAt']),
    );
  }

  static String _text(dynamic value, {String fallback = ''}) {
    final text = value?.toString() ?? '';
    return text.isEmpty ? fallback : text;
  }

  static String? _optional(dynamic value) {
    final text = value?.toString() ?? '';
    return text.isEmpty ? null : text;
  }

  static num? _number(dynamic value) {
    if (value is num) return value;
    if (value is String) return num.tryParse(value);
    return null;
  }

  static Map<String, dynamic>? _map(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return null;
  }

  /// The invoice the payment settles. The server populates it, so it arrives
  /// as an object; a bare id is still shown when it does not.
  static String _invoiceNumber(dynamic invoice) {
    final map = _map(invoice);
    if (map == null) return _text(invoice);
    return _text(map['invoiceNumber'] ?? map['_id']);
  }

  static String _tenantName(dynamic tenant) {
    final map = _map(tenant);
    if (map == null) return '';
    final user = _map(map['userId']);
    return _text(user?['name']);
  }

  static String _roomNumber(dynamic tenant) {
    final map = _map(tenant);
    if (map == null) return '';
    final room = _map(map['roomId']);
    return _text(room?['roomNumber']);
  }

  static String _brandingName(dynamic branding) {
    final map = _map(branding);
    if (map == null) return '';
    return _text(map['pgName']);
  }

  @override
  List<Object?> get props => [
        id,
        amount,
        method,
        type,
        status,
        invoiceNumber,
        tenantName,
        roomNumber,
        pgName,
        utrNumber,
        notes,
        paidAt,
        createdAt,
      ];
}
