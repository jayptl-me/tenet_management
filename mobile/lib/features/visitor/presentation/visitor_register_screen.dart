import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'visitor_home_screen.dart';

class VisitorRegisterScreen extends ConsumerStatefulWidget {
  const VisitorRegisterScreen({super.key});

  @override
  ConsumerState<VisitorRegisterScreen> createState() => _VisitorRegisterScreenState();
}

class _VisitorRegisterScreenState extends ConsumerState<VisitorRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _purpose = TextEditingController(text: 'visit');
  DateTime _expected = DateTime.now().add(const Duration(hours: 2));
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _purpose.dispose();
    super.dispose();
  }

  String _normalizePhone(String input) {
    final digits = input.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 10 && RegExp(r'^[6-9]').hasMatch(digits)) {
      return '+91$digits';
    }
    if (digits.length == 12 && digits.startsWith('91')) return '+$digits';
    if (input.trim().startsWith('+91') && digits.length >= 12) {
      return '+91${digits.substring(digits.length - 10)}';
    }
    return input.trim();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final tenantId = await ref.read(authProvider.notifier).ensureTenantId();
    if (tenantId == null || tenantId.isEmpty) {
      setState(() => _error = 'Tenant profile not linked. Contact admin.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final created = await ref.read(visitorRepositoryProvider).createVisitor(
            tenantId: tenantId,
            visitorName: _name.text.trim(),
            visitorPhone: _normalizePhone(_phone.text),
            purpose: _purpose.text.trim().isEmpty ? 'visit' : _purpose.text.trim(),
            expectedArrival: _expected.toUtc().toIso8601String(),
          );
      final id = created['_id']?.toString();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Visitor registered')),
      );
      if (id != null) {
        context.go('/visitor/status?id=$id');
      } else {
        context.go('/visitor');
      }
    } on ApiException catch (e) {
      setState(() {
        _error = e.isFeatureDisabled
            ? 'Visitor management is not enabled. Contact your PG manager.'
            : e.message;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Register visitor',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 12),
        if (_error != null) ErrorBanner(message: _error!),
        Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Visitor name'),
                validator: (v) =>
                    v == null || v.trim().length < 2 ? 'Name required (min 2)' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                decoration: const InputDecoration(
                  labelText: 'Phone',
                  hintText: '10-digit Indian mobile',
                ),
                keyboardType: TextInputType.phone,
                validator: (v) {
                  if (v == null || v.trim().length < 10) return 'Valid phone required';
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _purpose,
                decoration: const InputDecoration(labelText: 'Purpose'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Purpose required' : null,
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('Expected arrival: ${formatDate(_expected)}'),
                trailing: const Icon(Icons.event),
                onTap: () async {
                  final d = await showDatePicker(
                    context: context,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 14)),
                    initialDate: _expected,
                  );
                  if (d == null) return;
                  if (!context.mounted) return;
                  final t = await showTimePicker(
                    context: context,
                    initialTime: TimeOfDay.fromDateTime(_expected),
                  );
                  if (t == null) return;
                  setState(() {
                    _expected = DateTime(d.year, d.month, d.day, t.hour, t.minute);
                  });
                },
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: Text(_submitting ? 'Saving…' : 'Register visitor'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
