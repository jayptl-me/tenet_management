import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_features.dart';
import '../../auth/providers/auth_provider.dart';

class TenantShell extends ConsumerWidget {
  const TenantShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final features =
        ref.watch(appFeaturesProvider).valueOrNull ?? const AppFeatures();

    // Branch order matches app_router shell branches (0..4).
    // When visitors flag is off, hide branch 3 destination but keep branch indices
    // stable for go_router; user can still reach More for other modules.
    final destinations = <NavigationDestination>[
      const NavigationDestination(
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home),
        label: 'Home',
      ),
      const NavigationDestination(
        icon: Icon(Icons.receipt_long_outlined),
        selectedIcon: Icon(Icons.receipt_long),
        label: 'Invoices',
      ),
      const NavigationDestination(
        icon: Icon(Icons.payments_outlined),
        selectedIcon: Icon(Icons.payments),
        label: 'Pay',
      ),
      if (features.visitorManagementEnabled)
        const NavigationDestination(
          icon: Icon(Icons.people_outline),
          selectedIcon: Icon(Icons.people),
          label: 'Visitors',
        ),
      const NavigationDestination(
        icon: Icon(Icons.more_horiz),
        selectedIcon: Icon(Icons.more_horiz),
        label: 'More',
      ),
    ];

    // Map visible bar index -> shell branch index when visitors tab is omitted.
    List<int> branchMap;
    if (features.visitorManagementEnabled) {
      branchMap = const [0, 1, 2, 3, 4];
    } else {
      branchMap = const [0, 1, 2, 4];
    }

    final currentBranch = navigationShell.currentIndex;
    var selectedBarIndex = branchMap.indexOf(currentBranch);
    if (selectedBarIndex < 0) {
      // Landed on hidden visitors branch — bounce to More
      selectedBarIndex = branchMap.length - 1;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        navigationShell.goBranch(4);
      });
    }

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedBarIndex.clamp(0, destinations.length - 1),
        onDestinationSelected: (i) {
          final branch = branchMap[i];
          navigationShell.goBranch(branch);
        },
        destinations: destinations,
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DrawerHeader(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      features.pgName?.isNotEmpty == true
                          ? features.pgName!
                          : 'Tenant portal',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                    const SizedBox(height: 8),
                    Text(user?.name ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(
                      user?.email ?? '',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('My Profile'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/tenant/profile');
                },
              ),
              ListTile(
                leading: const Icon(Icons.report_problem_outlined),
                title: const Text('Complaints'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/tenant/complaints');
                },
              ),
              ListTile(
                leading: const Icon(Icons.restaurant_outlined),
                title: const Text('Meals & menu'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/tenant/meals');
                },
              ),
              if (features.laundryEnabled)
                ListTile(
                  leading: const Icon(Icons.local_laundry_service_outlined),
                  title: const Text('Laundry'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/tenant/laundry');
                  },
                ),
              if (features.noticeBoardEnabled)
                ListTile(
                  leading: const Icon(Icons.campaign_outlined),
                  title: const Text('Notices'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/tenant/notices');
                  },
                ),
              if (features.leavesEnabled)
                ListTile(
                  leading: const Icon(Icons.event_busy_outlined),
                  title: const Text('Leave Applications'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/tenant/leaves');
                  },
                ),
              if (features.attendanceEnabled)
                ListTile(
                  leading: const Icon(Icons.how_to_reg_outlined),
                  title: const Text('Attendance'),
                  onTap: () {
                    Navigator.pop(context);
                    context.go('/tenant/attendance');
                  },
                ),
              ListTile(
                leading: const Icon(Icons.notifications_outlined),
                title: const Text('Notifications'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/tenant/notifications');
                },
              ),
              const Spacer(),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Sign out'),
                onTap: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/login');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
