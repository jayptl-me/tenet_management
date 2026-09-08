import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantNoticesScreen extends ConsumerStatefulWidget {
  const TenantNoticesScreen({super.key});

  @override
  ConsumerState<TenantNoticesScreen> createState() => _TenantNoticesScreenState();
}

class _TenantNoticesScreenState extends ConsumerState<TenantNoticesScreen> {
  bool _loading = true;
  String? _error;
  bool _featureDisabled = false;
  List<Map<String, dynamic>> _rows = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _featureDisabled = false;
    });
    try {
      final rows = await ref.read(tenantRepositoryProvider).notices();
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _featureDisabled = e.isFeatureDisabled;
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

  void _showNoticeDetail(BuildContext context, Map<String, dynamic> notice) {
    final title = notice['title']?.toString() ?? 'Notice';
    final body = notice['content']?.toString() ??
        notice['body']?.toString() ??
        'No content provided.';
    final date = notice['createdAt'] != null
        ? formatDate(notice['createdAt'])
        : null;

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (date != null) ...[
                Text(
                  'Posted: $date',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppTheme.muted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
              ],
              Text(
                body,
                style: const TextStyle(fontSize: 14, height: 1.4),
              ),
            ],
          ),
        ),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.copy, size: 16),
            label: const Text('Copy'),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: '$title\n\n$body'));
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Notice copied to clipboard')),
              );
            },
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notices')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const SkeletonList(cardCount: 4, height: 80)
            : _featureDisabled
                ? ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: const [
                      SizedBox(height: 80),
                      FeatureDisabledWidget(
                        message:
                            'Notice board is not enabled. Contact your PG manager.',
                      ),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_error != null) ErrorBanner(message: _error!),
                      if (_rows.isEmpty)
                        const EmptyState(message: 'No notices')
                      else
                        ..._rows.map(
                          (n) => ListCard(
                            title: n['title']?.toString() ?? 'Notice',
                            subtitle: n['content']?.toString() ??
                                n['body']?.toString(),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (n['pinned'] == true)
                                  const Padding(
                                    padding: EdgeInsets.only(right: 4),
                                    child: StatusChip(label: 'Pinned'),
                                  ),
                                const Icon(Icons.chevron_right, size: 20),
                              ],
                            ),
                            onTap: () => _showNoticeDetail(context, n),
                          ),
                        ),
                    ],
                  ),
      ),
    );
  }
}
