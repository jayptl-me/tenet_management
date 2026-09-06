import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantNotificationsScreen extends ConsumerStatefulWidget {
  const TenantNotificationsScreen({super.key});

  @override
  ConsumerState<TenantNotificationsScreen> createState() =>
      _TenantNotificationsScreenState();
}

class _TenantNotificationsScreenState
    extends ConsumerState<TenantNotificationsScreen> {
  List<Map<String, dynamic>> _notifications = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  String? _notificationId(Map<String, dynamic> n) {
    final raw = n['id'] ?? n['_id'];
    final id = raw?.toString() ?? '';
    return id.isEmpty ? null : id;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final userId = ref.read(authProvider).user?.id;
      final rows = await ref
          .read(tenantRepositoryProvider)
          .myNotifications(userId: userId);
      if (!mounted) return;
      setState(() {
        _notifications = rows;
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

  Future<void> _markRead(String id) async {
    if (id.isEmpty) return;
    try {
      await ref.read(tenantRepositoryProvider).markNotificationRead(id);
      // Optimistic: keep history row, mark read locally (F1/F2)
      if (!mounted) return;
      setState(() {
        _notifications = _notifications.map((n) {
          if (_notificationId(n) == id) {
            return {...n, 'isRead': true};
          }
          return n;
        }).toList();
      });
    } catch (_) {
      // best-effort
    }
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(tenantRepositoryProvider).markAllNotificationsRead();
      if (!mounted) return;
      setState(() {
        _notifications =
            _notifications.map((n) => {...n, 'isRead': true}).toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All notifications marked as read')),
      );
    } catch (_) {
      // best-effort
    }
  }

  Future<void> _handleTap(Map<String, dynamic> n) async {
    final id = _notificationId(n);
    if (id != null && n['isRead'] != true) {
      await _markRead(id);
    }

    if (!mounted) return;

    final type = n['type']?.toString();
    final rawData = n['data'];
    final data = rawData is Map ? Map<String, dynamic>.from(rawData) : null;

    final invoiceId = data?['invoiceId']?.toString();
    final complaintId = data?['complaintId']?.toString();

    if (type == 'payment_reminder' && invoiceId != null && invoiceId.isNotEmpty) {
      context.go('/tenant/invoices/$invoiceId');
    } else if (type == 'payment_verified') {
      context.go('/tenant/payments');
    } else if (type == 'complaint_update' &&
        complaintId != null &&
        complaintId.isNotEmpty) {
      context.go('/tenant/complaints/$complaintId');
    } else if (type == 'electricity_bill') {
      context.go('/tenant/electricity');
    } else if (type == 'announcement') {
      context.go('/tenant/notices');
    } else if (type == 'service_update') {
      context.go('/tenant/services');
    } else if (type == 'meal_feedback') {
      context.go('/tenant/meals');
    } else if (type == 'welcome') {
      context.go('/tenant/profile');
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final hasUnread = _notifications.any((n) => n['isRead'] != true);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const SkeletonList(cardCount: 5, height: 72)
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  if (_notifications.isEmpty)
                    const EmptyState(
                        message: 'No notifications',
                        icon: Icons.notifications_none)
                  else
                    ..._notifications.map((n) {
                      final isRead = n['isRead'] == true;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: ListTile(
                          onTap: () => _handleTap(n),
                          trailing: const Icon(
                            Icons.chevron_right,
                            size: 18,
                            color: AppTheme.muted,
                          ),
                          title: Row(
                            children: [
                              if (!isRead)
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: cs.primary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              if (!isRead) const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  n['title']?.toString() ?? '--',
                                  style: TextStyle(
                                    fontWeight: isRead
                                        ? FontWeight.w600
                                        : FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (n['body'] != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(n['body'].toString()),
                                ),
                              const SizedBox(height: 4),
                              Text(
                                formatDate(n['createdAt'] ?? n['sentAt']),
                                style: TextStyle(
                                  fontSize: 12,
                                  color: cs.onSurfaceVariant,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
      ),
    );
  }
}
