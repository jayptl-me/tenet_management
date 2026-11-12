import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tenet_pg_portal/core/models/user.dart';
import 'package:tenet_pg_portal/features/auth/providers/auth_provider.dart';
import 'package:tenet_pg_portal/features/shared/widgets/portal_widgets.dart';
import 'package:tenet_pg_portal/features/tenant/data/tenant_repository.dart';
import 'package:tenet_pg_portal/features/tenant/presentation/invoices_screen.dart';

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

void main() {
  late MockTenantRepository mockRepo;

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
        home: TenantInvoicesScreen(),
      ),
    );
  }

  test('the money line shows the server balance as the amount due', () {
    final line = invoiceMoneyLine({
      'month': '2026-05',
      'totalAmount': 12000,
      'balance': 6000,
      'status': 'partial',
    });

    expect(line, startsWith('2026-05'));
    expect(line, contains('due'));
    expect(line, contains('6,000'));
    // The remaining amount comes first: the total is only the reference.
    expect(line.indexOf('6,000'), lessThan(line.indexOf('12,000')));
  });

  test('the money line says so when the server reports no balance', () {
    final line = invoiceMoneyLine({
      'month': '2026-05',
      'totalAmount': 12000,
      'status': 'sent',
    });

    expect(line, contains('balance unavailable'));
  });

  testWidgets('a half paid invoice row shows the remaining amount, not the total', (tester) async {
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => [
          {
            '_id': 'inv-1',
            'invoiceNumber': 'INV-2026-002',
            'month': '2026-05',
            'totalAmount': 12000,
            'balance': 6000,
            'status': 'partial',
          },
        ]);

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('INV-2026-002'), findsOneWidget);
    // The status filter row also carries a 'partial' chip; scope to the row.
    expect(
      find.descendant(
        of: find.byType(StatusChip),
        matching: find.text('partial'),
      ),
      findsOneWidget,
    );

    final line = tester.widget<Text>(find.textContaining('6,000')).data!;
    expect(line, contains('due'));
    expect(line.indexOf('6,000'), lessThan(line.indexOf('12,000')));
  });

  testWidgets('the empty state sends the resident to a real next step', (tester) async {
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => []);

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('No invoices found'), findsOneWidget);
    expect(find.textContaining('outstanding bill'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'View the bill'), findsOneWidget);
  });
}
