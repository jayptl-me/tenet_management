import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:tenet_pg_portal/core/config/app_features.dart';
import 'package:tenet_pg_portal/core/models/user.dart';
import 'package:tenet_pg_portal/features/auth/providers/auth_provider.dart';
import 'package:tenet_pg_portal/features/tenant/presentation/tenant_shell.dart';

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

class AppFeaturesNotifierMock extends StateNotifier<AsyncValue<AppFeatures>> implements AppFeaturesNotifier {
  AppFeaturesNotifierMock(AppFeatures features) : super(AsyncValue.data(features));

  @override
  Future<void> load() async {}
}

GoRouter createTestRouter() {
  return GoRouter(
    initialLocation: '/home',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => TenantShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (c, s) => const Scaffold(body: Text('Home Screen'))),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/invoices', builder: (c, s) => const Scaffold(body: Text('Invoices Screen'))),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/pay', builder: (c, s) => const Scaffold(body: Text('Pay Screen'))),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/visitors', builder: (c, s) => const Scaffold(body: Text('Visitors Screen'))),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/more', builder: (c, s) => const Scaffold(body: Text('More Screen'))),
          ]),
        ],
      ),
    ],
  );
}

void main() {
  testWidgets('TenantShell renders all 5 bottom destinations when visitors enabled', (tester) async {
    final router = createTestRouter();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authProvider.overrideWith((ref) => AuthNotifierMock(
                const AuthState(
                  user: AppUser(
                    id: 't-1',
                    name: 'Rohan Sharma',
                    email: 'rohan@example.com',
                    phone: '+919876543210',
                    role: AppRole.tenant,
                    isActive: true,
                  ),
                  isLoading: false,
                ),
              )),
          appFeaturesProvider.overrideWith((ref) => AppFeaturesNotifierMock(
                const AppFeatures(
                  visitorManagementEnabled: true,
                  pgName: 'Sunrise PG',
                ),
              )),
        ],
        child: MaterialApp.router(
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Invoices'), findsOneWidget);
    expect(find.text('Pay'), findsOneWidget);
    expect(find.text('Visitors'), findsOneWidget);
    expect(find.text('More'), findsOneWidget);
  });

  testWidgets('TenantShell hides Visitors tab when visitorManagementEnabled is false', (tester) async {
    final router = createTestRouter();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authProvider.overrideWith((ref) => AuthNotifierMock(
                const AuthState(
                  user: AppUser(
                    id: 't-1',
                    name: 'Rohan Sharma',
                    email: 'rohan@example.com',
                    phone: '+919876543210',
                    role: AppRole.tenant,
                    isActive: true,
                  ),
                  isLoading: false,
                ),
              )),
          appFeaturesProvider.overrideWith((ref) => AppFeaturesNotifierMock(
                const AppFeatures(
                  visitorManagementEnabled: false,
                  pgName: 'Sunrise PG',
                ),
              )),
        ],
        child: MaterialApp.router(
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Invoices'), findsOneWidget);
    expect(find.text('Pay'), findsOneWidget);
    expect(find.text('Visitors'), findsNothing);
    expect(find.text('More'), findsOneWidget);
  });
}
