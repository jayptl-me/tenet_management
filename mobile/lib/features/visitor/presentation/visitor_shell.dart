import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';

/// Dedicated Visitor portal shell (tenant-authenticated visitor management).
class VisitorShell extends ConsumerWidget {
  const VisitorShell({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final location = GoRouterState.of(context).uri.toString();

    int index = 0;
    if (location.contains('/visitor/register')) index = 1;
    if (location.contains('/visitor/status')) index = 2;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Visitor portal'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            final role = ref.read(authProvider).user?.role;
            if (role?.name == 'tenant') {
              context.go('/tenant');
            } else {
              context.go('/login');
            }
          },
        ),
      ),
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) {
          switch (i) {
            case 0:
              context.go('/visitor');
            case 1:
              context.go('/visitor/register');
            case 2:
              context.go('/visitor/status');
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.list_alt), label: 'My visitors'),
          NavigationDestination(icon: Icon(Icons.person_add_alt), label: 'Register'),
          NavigationDestination(icon: Icon(Icons.qr_code_2), label: 'Status'),
        ],
      ),
    );
  }
}
