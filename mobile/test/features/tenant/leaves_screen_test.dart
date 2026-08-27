import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tenet_pg_portal/core/models/user.dart';
import 'package:tenet_pg_portal/features/auth/providers/auth_provider.dart';
import 'package:tenet_pg_portal/features/tenant/data/tenant_repository.dart';
import 'package:tenet_pg_portal/features/tenant/presentation/leaves_screen.dart';

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
        home: TenantLeavesScreen(),
      ),
    );
  }

  testWidgets('Renders empty state when no leave applications exist', (tester) async {
    when(() => mockRepo.myLeaves()).thenAnswer((_) async => []);

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('No leave applications'), findsOneWidget);
  });

  testWidgets('Renders leave list items with status chips and reason', (tester) async {
    when(() => mockRepo.myLeaves()).thenAnswer((_) async => [
          {
            '_id': 'leave-1',
            'fromDate': '2026-04-10T00:00:00.000Z',
            'toDate': '2026-04-15T00:00:00.000Z',
            'reason': 'Family vacation to Goa',
            'status': 'approved',
          },
        ]);

    await tester.pumpWidget(buildSubject());
    await tester.pumpAndSettle();

    expect(find.text('Family vacation to Goa'), findsOneWidget);
    expect(find.text('approved'), findsOneWidget);
  });
}
