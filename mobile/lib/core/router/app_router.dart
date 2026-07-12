import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/guardian/presentation/guardian_shell.dart';
import '../../features/guardian/presentation/ward_attendance_screen.dart';
import '../../features/guardian/presentation/ward_screen.dart';
import '../../features/tenant/presentation/complaints_screen.dart';
import '../../features/tenant/presentation/home_screen.dart';
import '../../features/tenant/presentation/invoice_detail_screen.dart';
import '../../features/tenant/presentation/invoices_screen.dart';
import '../../features/tenant/presentation/laundry_screen.dart';
import '../../features/tenant/presentation/attendance_screen.dart';
import '../../features/tenant/presentation/leaves_screen.dart';
import '../../features/tenant/presentation/meals_screen.dart';
import '../../features/tenant/presentation/more_screen.dart';
import '../../features/tenant/presentation/notices_screen.dart';
import '../../features/tenant/presentation/notifications_screen.dart';
import '../../features/tenant/presentation/payments_screen.dart';
import '../../features/tenant/presentation/profile_screen.dart';
import '../../features/tenant/presentation/tenant_shell.dart';
import '../../features/tenant/presentation/visitors_tab_screen.dart';
import '../../features/visitor/presentation/visitor_home_screen.dart';
import '../../features/visitor/presentation/visitor_register_screen.dart';
import '../../features/visitor/presentation/visitor_shell.dart';
import '../../features/visitor/presentation/visitor_status_screen.dart';
import '../models/user.dart';

final _rootKey = GlobalKey<NavigatorState>();

class _AuthRefresh extends ChangeNotifier {
  void ping() => notifyListeners();
}

final goRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefresh();
  ref.listen(authProvider, (_, __) => refresh.ping());

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      final loggingIn = loc == '/login';
      final splashing = loc == '/';

      if (auth.isLoading) {
        return splashing ? null : '/';
      }

      final user = auth.user;
      final authed = user != null;

      if (!authed) {
        return loggingIn || splashing ? null : '/login';
      }

      // Admin not allowed in this app
      if (user.role == AppRole.admin || user.role == AppRole.unknown) {
        return loggingIn ? null : '/login';
      }

      if (loggingIn || splashing) {
        if (user.role == AppRole.tenant) return '/tenant';
        if (user.role == AppRole.guardian) return '/guardian';
      }

      // Role guards
      if (loc.startsWith('/tenant') && user.role != AppRole.tenant) {
        return user.role == AppRole.guardian ? '/guardian' : '/login';
      }
      if (loc.startsWith('/guardian') && user.role != AppRole.guardian) {
        return user.role == AppRole.tenant ? '/tenant' : '/login';
      }
      // Visitor portal is tenant-only (visitor management)
      if (loc.startsWith('/visitor') && user.role != AppRole.tenant) {
        return user.role == AppRole.guardian ? '/guardian' : '/login';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),

      // ── Tenant shell (StatefulShellRoute) ──────────────
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return TenantShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tenant',
                builder: (_, __) => const TenantHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tenant/invoices',
                builder: (_, __) => const TenantInvoicesScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tenant/payments',
                builder: (_, __) => const TenantPaymentsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tenant/visitors',
                builder: (_, __) => const TenantVisitorsTabScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/tenant/more',
                builder: (_, __) => const TenantMoreScreen(),
              ),
            ],
          ),
        ],
      ),

      // Tenant stacked routes (outside bottom nav shell index)
      GoRoute(
        path: '/tenant/complaints',
        builder: (_, __) => const TenantComplaintsScreen(),
      ),
      GoRoute(
        path: '/tenant/meals',
        builder: (_, __) => const TenantMealsScreen(),
      ),
      GoRoute(
        path: '/tenant/laundry',
        builder: (_, __) => const TenantLaundryScreen(),
      ),
      GoRoute(
        path: '/tenant/notices',
        builder: (_, __) => const TenantNoticesScreen(),
      ),
      GoRoute(
        path: '/tenant/profile',
        builder: (_, __) => const TenantProfileScreen(),
      ),
      GoRoute(
        path: '/tenant/leaves',
        builder: (_, __) => const TenantLeavesScreen(),
      ),
      GoRoute(
        path: '/tenant/attendance',
        builder: (_, __) => const TenantAttendanceScreen(),
      ),
      GoRoute(
        path: '/tenant/notifications',
        builder: (_, __) => const TenantNotificationsScreen(),
      ),
      GoRoute(
        path: '/tenant/invoices/:id',
        builder: (_, state) {
          final id = state.pathParameters['id'] ?? '';
          return TenantInvoiceDetailScreen(invoiceId: id);
        },
      ),

      // ── Guardian shell ─────────────────────────────────
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return GuardianShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/guardian',
                builder: (_, __) => const GuardianWardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/guardian/attendance',
                builder: (_, __) => const GuardianAttendanceScreen(),
              ),
            ],
          ),
        ],
      ),

      // ── Visitor portal (tenant-owned) ───────────────────
      ShellRoute(
        builder: (context, state, child) => VisitorShell(child: child),
        routes: [
          GoRoute(
            path: '/visitor',
            builder: (_, __) => const VisitorHomeScreen(),
          ),
          GoRoute(
            path: '/visitor/register',
            builder: (_, __) => const VisitorRegisterScreen(),
          ),
          GoRoute(
            path: '/visitor/status',
            builder: (context, state) {
              final id = state.uri.queryParameters['id'];
              return VisitorStatusScreen(visitorId: id);
            },
          ),
        ],
      ),
    ],
  );
});
