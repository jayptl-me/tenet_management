import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tenet_pg_portal/core/models/user.dart';
import 'package:tenet_pg_portal/features/auth/providers/auth_provider.dart';
import 'package:tenet_pg_portal/features/shared/widgets/payment_receipt_card.dart';
import 'package:tenet_pg_portal/features/tenant/data/tenant_repository.dart';
import 'package:tenet_pg_portal/features/tenant/presentation/payments_screen.dart';

class MockTenantRepository extends Mock implements TenantRepository {}

class AuthNotifierMock extends StateNotifier<AuthState> implements AuthNotifier {
  AuthNotifierMock(super.initialState);

  @override
  Future<void> restore() async {}

  @override
  Future<void> login(String email, String password) async {}

  @override
  Future<void> refreshUser() async {}

  @override
  Future<String?> ensureTenantId() async => state.user?.tenantId;

  @override
  Future<void> logout() async {}
}

/// One open invoice with a server-reported balance.
Map<String, dynamic> openInvoice({
  String id = 'inv-1',
  String number = 'INV-2026-005',
  num total = 12000,
  num? balance = 6000,
  String status = 'partial',
}) {
  return {
    '_id': id,
    'invoiceNumber': number,
    'month': '2026-05',
    'totalAmount': total,
    'balance': balance,
    'status': status,
  };
}

/// The UPI QR the server builds for an invoice.
Map<String, dynamic> qrPayload({num amount = 6000}) {
  return {
    'amount': amount,
    'payeeName': 'Sunrise PG',
    'upiId': 'sunrise@upi',
    'invoiceNumber': 'INV-2026-005',
  };
}

void main() {
  late MockTenantRepository mockRepo;

  setUpAll(() {
    // The receipt formats dates with intl. Pin the locale so the expected
    // date does not depend on the machine the test runs on.
    Intl.defaultLocale = 'en_US';
  });

  setUp(() {
    mockRepo = MockTenantRepository();
  });

  Widget buildSubject() {
    return ProviderScope(
      overrides: [
        tenantRepositoryProvider.overrideWithValue(mockRepo),
        authProvider.overrideWith((ref) => AuthNotifierMock(
              const AuthState(
                user: AppUser(
                  id: 'u-1',
                  name: 'Test Tenant',
                  email: 'tenant@pg.com',
                  phone: '+919876543210',
                  role: AppRole.tenant,
                  isActive: true,
                  tenantId: 'tenant-100',
                ),
                isLoading: false,
              ),
            )),
      ],
      child: const MaterialApp(
        home: TenantPaymentsScreen(),
      ),
    );
  }

  /// The payments screen is tall. Give the test a viewport that holds the
  /// whole page, so a button can be tapped without scrolling.
  void useTallViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(1200, 2600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
  }

  testWidgets('the pending card says what the office does and what the resident is told', (tester) async {
    useTallViewport(tester);
    when(() => mockRepo.myPayments()).thenAnswer((_) async => [
          {
            '_id': 'pay-1',
            'amount': 6000,
            'method': 'upi',
            'status': 'pending_verification',
            'utrNumber': 'UTR8899',
            'createdAt': '2026-05-04T10:15:00.000Z',
          },
        ]);
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => [openInvoice()]);
    when(() => mockRepo.paymentQrCode(any()))
        .thenAnswer((_) async => qrPayload());

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('Awaiting verification'), findsOneWidget);
    expect(find.textContaining('UTR UTR8899'), findsOneWidget);

    // What the office will do, and what the resident will be told.
    expect(
      find.textContaining('The office will check this UTR'),
      findsOneWidget,
    );
    expect(
      find.textContaining('notification when it is verified, rejected or voided'),
      findsOneWidget,
    );

    // The old copy promised a confirmation the office does not give.
    expect(find.textContaining('The admin will confirm'), findsNothing);
  });

  testWidgets('the pending card offers the office receipt for the money the resident sent', (tester) async {
    useTallViewport(tester);
    when(() => mockRepo.myPayments()).thenAnswer((_) async => [
          {
            '_id': 'pay-1',
            'amount': 6000,
            'method': 'upi',
            'status': 'pending_verification',
            'utrNumber': 'UTR8899',
            'createdAt': '2026-05-04T10:15:00.000Z',
          },
        ]);
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => [openInvoice()]);
    when(() => mockRepo.paymentQrCode(any()))
        .thenAnswer((_) async => qrPayload());

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('View receipt'), findsOneWidget);
  });

  testWidgets('the empty state offers the outstanding balance as the next step', (tester) async {
    useTallViewport(tester);
    when(() => mockRepo.myPayments()).thenAnswer((_) async => []);
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => [openInvoice()]);
    when(() => mockRepo.paymentQrCode(any()))
        .thenAnswer((_) async => qrPayload());

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('No payments yet'), findsOneWidget);
    expect(
      find.widgetWithText(FilledButton, 'Pay the outstanding balance'),
      findsOneWidget,
    );
  });

  testWidgets('the empty state next step pays the invoice that still has a balance', (tester) async {
    useTallViewport(tester);
    when(() => mockRepo.myPayments()).thenAnswer((_) async => []);
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => [
          openInvoice(id: 'inv-1', number: 'INV-2026-001', balance: 0, status: 'sent'),
          openInvoice(id: 'inv-2', number: 'INV-2026-002', balance: 6000, status: 'sent'),
        ]);
    when(() => mockRepo.paymentQrCode(any())).thenAnswer((invocation) async {
      final id = invocation.positionalArguments.first as String;
      return qrPayload(amount: id == 'inv-2' ? 6000 : 0);
    });

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    await tester.tap(
      find.widgetWithText(FilledButton, 'Pay the outstanding balance'),
    );
    await tester.pumpAndSettle();

    // The button moved the resident to the invoice that still owes money.
    verify(() => mockRepo.paymentQrCode('inv-2')).called(1);
  });

  testWidgets('the empty state says in words that no action is needed when nothing is due', (tester) async {
    useTallViewport(tester);
    when(() => mockRepo.myPayments()).thenAnswer((_) async => []);
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => []);
    when(() => mockRepo.paymentQrCode(any()))
        .thenAnswer((_) async => qrPayload());

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('No payments yet'), findsOneWidget);
    expect(find.textContaining('No action needed'), findsOneWidget);
    expect(
      find.widgetWithText(FilledButton, 'Pay the outstanding balance'),
      findsNothing,
    );
  });

  testWidgets('after a UTR is submitted the portal shows the receipt the server issued', (tester) async {
    useTallViewport(tester);
    when(() => mockRepo.myPayments()).thenAnswer((_) async => []);
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => [openInvoice()]);
    when(() => mockRepo.paymentQrCode(any()))
        .thenAnswer((_) async => qrPayload());
    when(() => mockRepo.submitUtr(
          invoiceId: any(named: 'invoiceId'),
          utrNumber: any(named: 'utrNumber'),
          screenshotUrl: any(named: 'screenshotUrl'),
        )).thenAnswer((_) async => {
              '_id': 'pay-77',
              'amount': 6000,
              'method': 'upi',
              'status': 'pending_verification',
            });
    when(() => mockRepo.paymentReceipt('pay-77')).thenAnswer((_) async => {
          '_id': 'pay-77',
          'amount': 6000,
          'method': 'upi',
          'type': 'rent',
          'status': 'pending_verification',
          'utrNumber': 'UTR123456',
          'createdAt': '2026-05-04T10:15:00.000Z',
          'invoiceId': {
            '_id': 'inv-1',
            'invoiceNumber': 'INV-2026-005',
          },
          'tenantId': {
            'userId': {'name': 'Test Tenant'},
            'roomId': {'roomNumber': 'A-204'},
          },
        });

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    final utrField = find.byWidgetPredicate(
      (w) => w is TextField && w.decoration?.labelText == 'UTR / reference',
    );
    await tester.enterText(utrField, 'UTR123456');
    await tester.tap(find.text('Submit for verification'));
    await tester.pumpAndSettle();

    // The receipt is the server's, fetched for the payment the server wrote.
    verify(() => mockRepo.paymentReceipt('pay-77')).called(1);

    final receipt = find.byType(PaymentReceiptCard);
    expect(receipt, findsOneWidget);
    expect(
      find.descendant(of: receipt, matching: find.text('Ref pay-77')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: receipt, matching: find.text('INV-2026-005')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: receipt, matching: find.text('upi')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: receipt, matching: find.text('04 May 2026')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: receipt, matching: find.textContaining('6,000')),
      findsOneWidget,
    );

    // The artifact replaced the local claim.
    expect(find.textContaining('UTR submitted'), findsNothing);
  });
}
