import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';
import 'package:tenet_pg_portal/core/models/payment_receipt.dart';
import 'package:tenet_pg_portal/features/shared/widgets/payment_receipt_card.dart';

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

Widget buildSubject(PaymentReceipt receipt) {
  return MaterialApp(
    home: Scaffold(body: PaymentReceiptCard(receipt: receipt)),
  );
}

void main() {
  setUpAll(() {
    // The receipt formats dates with intl. Pin the locale so the expected
    // date does not depend on the machine the test runs on.
    Intl.defaultLocale = 'en_US';
  });

  /// The receipt is a tall card. Give the test a viewport that holds it.
  void useTallViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(1200, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
  }

  testWidgets('the card shows the id, the amount, the method, the date and the invoice', (tester) async {
    useTallViewport(tester);
    final receipt = PaymentReceipt.fromServer(serverReceipt());

    await tester.pumpWidget(buildSubject(receipt));

    expect(find.text('Ref pay-501'), findsOneWidget);
    expect(find.textContaining('6,000'), findsOneWidget);
    expect(find.text('upi'), findsOneWidget);
    expect(find.text('INV-2026-005'), findsOneWidget);
    expect(find.text('04 May 2026'), findsOneWidget);
    expect(find.text('Rohan Sharma'), findsOneWidget);
    expect(find.text('A-204'), findsOneWidget);
    expect(find.text('UTR8899'), findsOneWidget);
    expect(find.text('Sunrise PG'), findsOneWidget);
  });

  testWidgets('the card shows the status the server sent, not a local claim', (tester) async {
    useTallViewport(tester);
    final receipt = PaymentReceipt.fromServer(serverReceipt());

    await tester.pumpWidget(buildSubject(receipt));

    expect(find.text('pending verification'), findsOneWidget);
    expect(find.text('Payment receipt'), findsOneWidget);
  });

  testWidgets('the card never invents an amount the server did not send', (tester) async {
    useTallViewport(tester);
    final receipt = PaymentReceipt.fromServer({
      '_id': 'pay-502',
      'status': 'paid',
    });

    await tester.pumpWidget(buildSubject(receipt));

    expect(find.text('Amount not reported by the server'), findsOneWidget);
    expect(find.text('not reported'), findsWidgets);
  });
}
