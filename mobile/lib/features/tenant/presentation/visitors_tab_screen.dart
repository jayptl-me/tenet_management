import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../visitor/presentation/visitor_home_screen.dart';

/// Tenant bottom-nav "Visitors" tab embeds visitor list and links to visitor portal.
class TenantVisitorsTabScreen extends StatelessWidget {
  const TenantVisitorsTabScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Visitors'),
        actions: [
          TextButton(
            onPressed: () => context.go('/visitor'),
            child: const Text('Open portal'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/visitor/register'),
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Register'),
      ),
      body: const VisitorHomeScreen(),
    );
  }
}
