import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/user.dart';
import '../providers/auth_provider.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    ref.listen(authProvider, (prev, next) {
      if (next.isLoading) return;
      if (!next.isAuthenticated) {
        context.go('/login');
        return;
      }
      switch (next.user!.role) {
        case AppRole.tenant:
          context.go('/tenant');
        case AppRole.guardian:
          context.go('/guardian');
        default:
          context.go('/login');
      }
    });

    if (!auth.isLoading && auth.isAuthenticated) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final role = auth.user!.role;
        if (role == AppRole.tenant) {
          context.go('/tenant');
        } else if (role == AppRole.guardian) {
          context.go('/guardian');
        } else {
          context.go('/login');
        }
      });
    } else if (!auth.isLoading && !auth.isAuthenticated) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/login');
      });
    }

    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
