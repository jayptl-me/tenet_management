import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows =
          await ref.read(tenantRepositoryProvider).myNotifications();
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
    try {
      await ref.read(tenantRepositoryProvider).markNotificationRead(id);
      _load();
    } catch (_) {
      // best-effort
    }
  }

  Future<void> _markAllRead() async {
    try {
      await ref.read(tenantRepositoryProvider).markAllNotificationsRead();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All notifications marked as read')),
      );
      _load();
    } catch (_) {
      // best-effort
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final hasUnread =
        _notifications.any((n) => n['isRead'] != true);

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
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  if (_notifications.isEmpty)
                    const EmptyState(
                        message: 'No notifications', icon: Icons.notifications_none)
                  else
                    ..._notifications.map((n) {
                      final isRead = n['isRead'] == true;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: ListTile(
                          onTap: isRead
                              ? null
                              : () => _markRead(n['_id']?.toString() ?? ''),
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
                                formatDate(n['createdAt']),
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
