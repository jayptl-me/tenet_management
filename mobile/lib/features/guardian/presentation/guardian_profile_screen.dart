import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'ward_screen.dart';

class GuardianProfileScreen extends ConsumerStatefulWidget {
  const GuardianProfileScreen({super.key});

  @override
  ConsumerState<GuardianProfileScreen> createState() =>
      _GuardianProfileScreenState();
}

class _GuardianProfileScreenState extends ConsumerState<GuardianProfileScreen> {
  Map<String, dynamic>? _wardData;
  bool _loading = true;
  String? _error;

  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  final _passwordFormKey = GlobalKey<FormState>();
  bool _changingPassword = false;
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  String? _passwordError;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(guardianRepositoryProvider).ward();
      if (!mounted) return;
      setState(() {
        _wardData = data;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _changePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    setState(() {
      _changingPassword = true;
      _passwordError = null;
    });
    try {
      await ref.read(authRepositoryProvider).changePassword(
            currentPassword: _currentPassword.text,
            newPassword: _newPassword.text,
          );
      if (!mounted) return;
      _currentPassword.clear();
      _newPassword.clear();
      _confirmPassword.clear();
      await ref.read(authProvider.notifier).logout();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Password changed. Please sign in again with your new password.',
          ),
        ),
      );
      context.go('/login');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _changingPassword = false;
        _passwordError = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _changingPassword = false;
        _passwordError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _confirmSignOut(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: const Text(
          'Are you sure you want to sign out of the guardian portal?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await ref.read(authProvider.notifier).logout();
      if (context.mounted) context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authUser = ref.watch(authProvider).user;
    final guardianName = _wardData?['name']?.toString() ?? authUser?.name ?? 'Guardian';
    final guardianEmail = _wardData?['email']?.toString() ?? authUser?.email ?? '';
    final guardianPhone = _wardData?['phone']?.toString() ?? '';
    final relation = _wardData?['relation']?.toString() ?? '';
    final isEmergency = _wardData?['isEmergencyContact'] == true;

    final tenant = _wardData?['tenant'] as Map?;
    final tenantUser = tenant?['user'] as Map?;
    final tenantName = tenantUser?['name']?.toString() ?? 'Ward';
    final room = tenant?['room'] as Map?;
    final roomNumber = room?['roomNumber']?.toString() ?? '--';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Guardian Profile'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _load,
          ),
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => _confirmSignOut(context),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const SkeletonList(cardCount: 3, height: 110)
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 12),
                  ],

                  // Guardian Account Card
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              CircleAvatar(
                                radius: 24,
                                backgroundColor:
                                    AppTheme.brand.withValues(alpha: 0.12),
                                child: Text(
                                  guardianName.isNotEmpty
                                      ? guardianName[0].toUpperCase()
                                      : 'G',
                                  style: const TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                    color: AppTheme.brand,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      guardianName,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 17,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      guardianEmail,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        color: AppTheme.muted,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (isEmergency)
                                const StatusChip(label: 'Emergency contact'),
                            ],
                          ),
                          const Divider(height: 24),
                          _infoRow(
                            'Relationship',
                            relation.isNotEmpty
                                ? relation[0].toUpperCase() + relation.substring(1)
                                : 'Guardian',
                          ),
                          if (guardianPhone.isNotEmpty)
                            _infoRow('Phone', guardianPhone),
                          _infoRow('Linked ward', '$tenantName (Room $roomNumber)'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Change Password Section
                  _sectionTitle(context, 'Change password'),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Form(
                        key: _passwordFormKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (_passwordError != null) ...[
                              ErrorBanner(message: _passwordError!),
                              const SizedBox(height: 12),
                            ],
                            TextFormField(
                              controller: _currentPassword,
                              obscureText: _obscureCurrent,
                              decoration: InputDecoration(
                                labelText: 'Current password',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                  tooltip: _obscureCurrent
                                      ? 'Show password'
                                      : 'Hide password',
                                  onPressed: () => setState(
                                    () => _obscureCurrent = !_obscureCurrent,
                                  ),
                                  icon: Icon(
                                    _obscureCurrent
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) {
                                  return 'Current password is required';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _newPassword,
                              obscureText: _obscureNew,
                              decoration: InputDecoration(
                                labelText: 'New password',
                                prefixIcon:
                                    const Icon(Icons.lock_reset_outlined),
                                suffixIcon: IconButton(
                                  tooltip: _obscureNew
                                      ? 'Show password'
                                      : 'Hide password',
                                  onPressed: () => setState(
                                    () => _obscureNew = !_obscureNew,
                                  ),
                                  icon: Icon(
                                    _obscureNew
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                              validator: (v) {
                                if (v == null || v.length < 8) {
                                  return 'New password must be at least 8 characters';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _confirmPassword,
                              obscureText: _obscureConfirm,
                              decoration: InputDecoration(
                                labelText: 'Confirm new password',
                                prefixIcon:
                                    const Icon(Icons.lock_reset_outlined),
                                suffixIcon: IconButton(
                                  tooltip: _obscureConfirm
                                      ? 'Show password'
                                      : 'Hide password',
                                  onPressed: () => setState(
                                    () => _obscureConfirm = !_obscureConfirm,
                                  ),
                                  icon: Icon(
                                    _obscureConfirm
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                              validator: (v) {
                                if (v != _newPassword.text) {
                                  return 'Passwords do not match';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed:
                                  _changingPassword ? null : _changePassword,
                              child: _changingPassword
                                  ? const SizedBox(
                                      height: 18,
                                      width: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Text('Update password'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Sign out button
                  OutlinedButton.icon(
                    onPressed: () => _confirmSignOut(context),
                    icon: const Icon(Icons.logout, color: AppTheme.danger),
                    label: const Text(
                      'Sign out',
                      style: TextStyle(color: AppTheme.danger),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppTheme.muted,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}
