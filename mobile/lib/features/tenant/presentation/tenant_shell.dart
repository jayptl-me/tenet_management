import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';

class TenantShell extends ConsumerWidget {
  const TenantShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  static const _destinations = [
    NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
    NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'Invoices'),
    NavigationDestination(icon: Icon(Icons.payments_outlined), selectedIcon: Icon(Icons.payments), label: 'Pay'),
    NavigationDestination(icon: Icon(Icons.people_outline), selectedIcon: Icon(Icons.people), label: 'Visitors'),
    NavigationDestination(icon: Icon(Icons.more_horiz), selectedIcon: Icon(Icons.more_horiz), label: 'More'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: navigationShell.goBranch,
        destinations: _destinations,
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
                    const Text('Tenant portal', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                    const SizedBox(height: 8),
                    Text(user?.name ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(user?.email ?? '', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 12)),
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
              ListTile(
                leading: const Icon(Icons.local_laundry_service_outlined),
                title: const Text('Laundry'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/tenant/laundry');
                },
              ),
              ListTile(
                leading: const Icon(Icons.campaign_outlined),
                title: const Text('Notices'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/tenant/notices');
                },
              ),
              ListTile(
                leading: const Icon(Icons.event_busy_outlined),
                title: const Text('Leave Applications'),
                onTap: () {
                  Navigator.pop(context);
                  context.go('/tenant/leaves');
                },
              ),
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
