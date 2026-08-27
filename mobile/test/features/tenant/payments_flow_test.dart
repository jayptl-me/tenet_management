import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tenet_pg_portal/core/models/user.dart';
import 'package:tenet_pg_portal/features/auth/providers/auth_provider.dart';
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

  testWidgets('TenantInvoicesScreen renders empty state when no invoices exist', (tester) async {
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => []);

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('No invoices found'), findsOneWidget);
  });

  testWidgets('TenantInvoicesScreen renders invoice item cards with amounts and status', (tester) async {
    when(() => mockRepo.myInvoices()).thenAnswer((_) async => [
          {
            '_id': 'inv-101',
            'invoiceNumber': 'INV-2026-001',
            'month': '2026-05',
            'totalAmount': 9500,
            'status': 'paid',
          },
        ]);

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('INV-2026-001'), findsOneWidget);
    expect(find.text('paid'), findsOneWidget);
  });
}
