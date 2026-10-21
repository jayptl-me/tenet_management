import 'package:flutter_test/flutter_test.dart';
import 'package:tenet_pg_portal/core/models/payment_receipt.dart';

/// The receipt exactly as `GET /payments/:id/receipt` sends it: the payment
/// row, the invoice it settles and the tenant it belongs to.
Map<String, dynamic> serverReceipt() {
  return {
    '_id': 'pay-501',
    'amount': 6000,
    'method': 'upi',
    'type': 'rent',
    'status': 'pending_verification',
    'utrNumber': 'UTR8899',
    'createdAt': '2026-05-04T10:15:00.000Z',
    'invoiceId': {
      '_id': 'inv-77',
      'invoiceNumber': 'INV-2026-005',
      'month': '2026-05',
      'totalAmount': 12000,
    },
    'tenantId': {
      '_id': 'tenant-1',
      'userId': {'name': 'Rohan Sharma'},
      'roomId': {'roomNumber': 'A-204'},
    },
    'pgBranding': {'pgName': 'Sunrise PG'},
  };
}

void main() {
  test('the receipt reads the id, amount, method, date and invoice from the server', () {
    final receipt = PaymentReceipt.fromServer(serverReceipt());

    expect(receipt.id, 'pay-501');
    expect(receipt.amount, 6000);
    expect(receipt.method, 'upi');
    expect(receipt.type, 'rent');
    expect(receipt.status, 'pending_verification');
    expect(receipt.invoiceNumber, 'INV-2026-005');
    expect(receipt.tenantName, 'Rohan Sharma');
    expect(receipt.roomNumber, 'A-204');
    expect(receipt.pgName, 'Sunrise PG');
    expect(receipt.utrNumber, 'UTR8899');
    expect(receipt.date, '2026-05-04T10:15:00.000Z');
    expect(receipt.isSettled, isFalse);
  });

  test('a receipt the server reports as paid is settled and dated by paidAt', () {
    final receipt = PaymentReceipt.fromServer({
      '_id': 'pay-502',
      'amount': 9500,
      'method': 'cash',
      'status': 'paid',
      'paidAt': '2026-06-01T09:00:00.000Z',
      'createdAt': '2026-05-30T09:00:00.000Z',
    });

    expect(receipt.isSettled, isTrue);
    expect(receipt.date, '2026-06-01T09:00:00.000Z');
  });

  test('a receipt with no amount reports no amount instead of zero', () {
    final receipt = PaymentReceipt.fromServer({
      '_id': 'pay-503',
      'status': 'paid',
    });

    expect(receipt.amount, isNull);
    expect(receipt.invoiceNumber, '');
    expect(receipt.method, '');
  });

  test('a receipt without a status is unknown, never an empty chip', () {
    final receipt = PaymentReceipt.fromServer({'_id': 'pay-504'});

    expect(receipt.status, 'unknown');
  });

  test('an invoice sent as a bare id still names the invoice it settles', () {
    final receipt = PaymentReceipt.fromServer({
      '_id': 'pay-505',
      'amount': 100,
      'invoiceId': 'inv-77',
    });

    expect(receipt.invoiceNumber, 'inv-77');
  });
}
