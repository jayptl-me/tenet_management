import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantProfileScreen extends ConsumerStatefulWidget {
  const TenantProfileScreen({super.key});

  @override
  ConsumerState<TenantProfileScreen> createState() =>
      _TenantProfileScreenState();
}

class _TenantProfileScreenState extends ConsumerState<TenantProfileScreen> {
  Map<String, dynamic>? _profile;
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
    final tenantId = await ref.read(authProvider.notifier).ensureTenantId();
    if (tenantId == null || tenantId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _error = 'Tenant profile not linked. Contact admin.';
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data =
          await ref.read(tenantRepositoryProvider).tenantProfile(tenantId);
      if (!mounted) return;
      setState(() {
        _profile = data;
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
      // Server revokes all sessions after password change.
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  if (_profile != null)
                    _buildProfileContent(context, _profile!),
                  const SizedBox(height: 16),
                  _buildChangePasswordSection(context),
                ],
              ),
      ),
    );
  }

  Widget _buildChangePasswordSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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
                      prefixIcon: const Icon(Icons.lock_reset_outlined),
                      suffixIcon: IconButton(
                        onPressed: () =>
                            setState(() => _obscureNew = !_obscureNew),
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
                      prefixIcon: const Icon(Icons.lock_reset_outlined),
                      suffixIcon: IconButton(
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
                    onPressed: _changingPassword ? null : _changePassword,
                    child: _changingPassword
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Update password'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileContent(BuildContext context, Map<String, dynamic> p) {
    final user = p['user'] as Map?;
    final room = p['room'] as Map?;
    final emergency = p['emergencyContact'] as Map?;
    final docs = p['documents'] as Map?;
    final cs = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _sectionTitle(context, 'Personal Information'),
        Card(
          child: Column(
            children: [
              _infoRow(context, 'Name', user?['name']?.toString() ?? '--'),
              _infoRow(context, 'Email', user?['email']?.toString() ?? '--'),
              _infoRow(context, 'Phone', user?['phone']?.toString() ?? '--'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _sectionTitle(context, 'Room & Rent'),
        Card(
          child: Column(
            children: [
              _infoRow(
                  context, 'Room', room?['roomNumber']?.toString() ?? '--'),
              _infoRow(context, 'Bed', p['bedId']?.toString() ?? '--'),
              _infoRow(context, 'Monthly rent',
                  formatMoney(p['monthlyRent'] as num?)),
              _infoRow(context, 'Deposit paid',
                  formatMoney(p['depositPaid'] as num?)),
              _infoRow(context, 'Move-in date', formatDate(p['moveInDate'])),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _sectionTitle(context, 'Emergency Contact'),
        Card(
          child: Column(
            children: [
              _infoRow(
                  context, 'Name', emergency?['name']?.toString() ?? '--'),
              _infoRow(
                  context, 'Phone', emergency?['phone']?.toString() ?? '--'),
              _infoRow(context, 'Relation',
                  emergency?['relation']?.toString() ?? '--'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _sectionTitle(context, 'Status'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Icon(
                  p['isActive'] == true ? Icons.check_circle : Icons.cancel,
                  color: p['isActive'] == true ? cs.primary : cs.error,
                ),
                const SizedBox(width: 8),
                Text(p['isActive'] == true ? 'Active' : 'Inactive'),
              ],
            ),
          ),
        ),
        if (docs != null) ...[
          const SizedBox(height: 16),
          _sectionTitle(context, 'Documents'),
          Card(
            child: Column(
              children: [
                _infoRow(context, 'Aadhaar',
                    docs['aadhaarUrl'] != null ? 'Uploaded' : 'Not uploaded'),
                _infoRow(context, 'Photo',
                    docs['photoUrl'] != null ? 'Uploaded' : 'Not uploaded'),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w800),
      ),
    );
  }

  Widget _infoRow(BuildContext context, String label, String value) {
    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      title: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
      trailing:
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }
}
