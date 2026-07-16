import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_features.dart';
import '../../auth/providers/auth_provider.dart';

class TenantMoreScreen extends ConsumerWidget {
  const TenantMoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final features =
        ref.watch(appFeaturesProvider).valueOrNull ?? const AppFeatures();

    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.person_outline),
            title: const Text('My Profile'),
            subtitle: const Text('Room, rent, emergency contact'),
            onTap: () => context.go('/tenant/profile'),
          ),
          ListTile(
            leading: const Icon(Icons.report_problem_outlined),
            title: const Text('Complaints'),
            onTap: () => context.go('/tenant/complaints'),
          ),
          // Menus always-on; meal feedback flag only gates feedback API
          ListTile(
            leading: const Icon(Icons.restaurant_outlined),
            title: const Text('Meals & menu'),
            onTap: () => context.go('/tenant/meals'),
          ),
          if (features.laundryEnabled)
            ListTile(
              leading: const Icon(Icons.local_laundry_service_outlined),
              title: const Text('Laundry'),
              onTap: () => context.go('/tenant/laundry'),
            ),
          if (features.noticeBoardEnabled)
            ListTile(
              leading: const Icon(Icons.campaign_outlined),
              title: const Text('Notices'),
              onTap: () => context.go('/tenant/notices'),
            ),
          if (features.leavesEnabled)
            ListTile(
              leading: const Icon(Icons.event_busy_outlined),
              title: const Text('Leave Applications'),
              subtitle: const Text('Apply for leave'),
              onTap: () => context.go('/tenant/leaves'),
            ),
          if (features.attendanceEnabled)
            ListTile(
              leading: const Icon(Icons.how_to_reg_outlined),
              title: const Text('Attendance'),
              subtitle: const Text('Check in / check out'),
              onTap: () => context.go('/tenant/attendance'),
            ),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Notifications'),
            onTap: () => context.go('/tenant/notifications'),
          ),
          if (features.visitorManagementEnabled) ...[
            const Divider(),
            ListTile(
              leading: const Icon(Icons.people_outline),
              title: const Text('Visitor portal'),
              subtitle: const Text('Manage pre-registered guests'),
              onTap: () => context.go('/visitor'),
            ),
          ],
          const Divider(),
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
    );
  }
}
