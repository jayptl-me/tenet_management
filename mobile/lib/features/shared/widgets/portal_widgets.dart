import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';

class PortalScaffold extends StatelessWidget {
  const PortalScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions,
    this.floatingActionButton,
  });

  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? floatingActionButton;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      floatingActionButton: floatingActionButton,
      body: SafeArea(
        child: body,
      ),
    );
  }
}

/// Empty state panel.
///
/// An empty state must never be a dead end:
/// - [hint] says in words what happens next, or that nothing is needed.
/// - [actionLabel] + [onAction] render a real button wired to a real route or
///   handler. When there is no next step, leave the action out and say so in
///   the hint instead of showing a panel that leads nowhere.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.message,
    this.icon,
    this.hint,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final IconData? icon;
  final String? hint;
  final String? actionLabel;
  final VoidCallback? onAction;

  bool get _hasAction => actionLabel != null && onAction != null;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon ?? Icons.inbox_outlined, size: 48, color: colorScheme.outline),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            if (hint != null) ...[
              const SizedBox(height: 6),
              Text(
                hint!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
            if (_hasAction) ...[
              const SizedBox(height: 16),
              SizedBox(
                width: 240,
                child: FilledButton.tonal(
                  onPressed: onAction,
                  child: Text(actionLabel!),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Shown when a feature is disabled by a feature flag (API returns 403).
class FeatureDisabledWidget extends StatelessWidget {
  const FeatureDisabledWidget({
    super.key,
    this.message = 'This feature is not enabled. Contact your PG manager.',
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline, size: 48, color: colorScheme.outline),
            const SizedBox(height: 12),
            Text(
              'Feature unavailable',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: colorScheme.onSurface,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({
    super.key,
    required this.message,
    this.onRetry,
    this.retryLabel = 'Retry',
  });

  final String message;

  /// When set, the banner offers a retry so a failed request is recoverable
  /// without leaving the screen.
  final VoidCallback? onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: colorScheme.errorContainer,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(Icons.error_outline, color: colorScheme.error),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                style: TextStyle(
                  color: colorScheme.onErrorContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(width: 8),
              TextButton(
                onPressed: onRetry,
                style: TextButton.styleFrom(
                  foregroundColor: colorScheme.onErrorContainer,
                ),
                child: Text(retryLabel),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.label});

  final String label;

  /// Every status the API can return must land on a deliberate colour.
  /// Anything not listed here falls back to the neutral tone, so new
  /// statuses stay visible as "unknown" instead of pretending to be fine.
  ({Color bg, Color text}) _resolveColors(BuildContext context) {
    final lower = label.trim().toLowerCase().replaceAll('-', '_');

    // Settled, approved or finished work.
    if (lower == 'paid' ||
        lower == 'resolved' ||
        lower == 'approved' ||
        lower == 'operational' ||
        lower == 'active' ||
        lower == 'available' ||
        lower == 'arrived' ||
        lower == 'converted' ||
        lower == 'completed' ||
        lower == 'present') {
      return (bg: AppTheme.successSoft, text: AppTheme.success);
    }

    // Closed and nothing pending: the visitor has already left. The three
    // visitor states are a progression, so they must not share one tone.
    if (lower == 'departed') {
      return (bg: AppTheme.infoSoft, text: AppTheme.info);
    }

    // Refused, failed or lost work.
    if (lower == 'overdue' ||
        lower == 'rejected' ||
        lower == 'down' ||
        lower == 'cancelled' ||
        lower == 'inactive' ||
        lower == 'urgent' ||
        lower == 'dismissed' ||
        lower == 'lost' ||
        lower == 'not_returned') {
      return (bg: AppTheme.dangerSoft, text: AppTheme.danger);
    }

    // Waiting on someone else.
    if (lower == 'pending' ||
        lower == 'partial' ||
        lower == 'pending_verification' ||
        lower == 'in_progress' ||
        lower == 'degraded' ||
        lower == 'high' ||
        lower == 'sent' ||
        lower == 'expected' ||
        lower == 'open' ||
        lower == 'new' ||
        lower == 'contacted' ||
        lower == 'booked' ||
        lower == 'confirmed' ||
        lower == 'on_leave') {
      return (bg: AppTheme.warningSoft, text: AppTheme.warningText);
    }

    // Everything else (draft, unknown) stays neutral on purpose.
    return (
      bg: Theme.of(context).colorScheme.surfaceContainerHighest,
      text: Theme.of(context).colorScheme.onSurfaceVariant,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _resolveColors(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: colors.bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.replaceAll('_', ' '),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: colors.text,
        ),
      ),
    );
  }
}

class ListCard extends StatelessWidget {
  const ListCard({
    super.key,
    required this.title,
    this.subtitle,
    this.subtitleWidget,
    this.trailing,
    this.onTap,
  });

  final String title;
  final String? subtitle;

  /// Richer content under the title, for rows that need more than one line
  /// (for example the admin's decision note on a leave application).
  final Widget? subtitleWidget;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        onTap: onTap,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: subtitleWidget ??
            (subtitle == null ? null : Text(subtitle!)),
        trailing: trailing,
      ),
    );
  }
}

/// A pulsing shimmer block for skeleton loading states.
class SkeletonBlock extends StatefulWidget {
  const SkeletonBlock({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = 8,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  State<SkeletonBlock> createState() => _SkeletonBlockState();
}

class _SkeletonBlockState extends State<SkeletonBlock>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.35, end: 0.85).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = Theme.of(context).colorScheme.surfaceContainerHighest;
    return FadeTransition(
      opacity: _animation,
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: baseColor,
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
      ),
    );
  }
}

/// A list of skeleton cards mimicking ListCard loading.
class SkeletonList extends StatelessWidget {
  const SkeletonList({
    super.key,
    int? count,
    int? cardCount,
    this.height,
  }) : count = cardCount ?? count ?? 4;

  final int count;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        count,
        (index) => Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: height != null
                ? SkeletonBlock(height: height!)
                : const Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SkeletonBlock(width: 140, height: 16),
                            SizedBox(height: 8),
                            SkeletonBlock(width: 200, height: 12),
                          ],
                        ),
                      ),
                      SizedBox(width: 12),
                      SkeletonBlock(width: 60, height: 24, borderRadius: 999),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

String formatMoney(num? amount) {
  final v = amount ?? 0;
  return NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0)
      .format(v);
}

/// Money line for an invoice row.
///
/// `balance` is computed by the server (total minus settled payments) and is
/// the same number the UPI QR is built from, so it is never derived on the
/// client. When the server does not report a balance the line says so
/// instead of asserting a wrong amount.
String invoiceMoneyLine(Map<String, dynamic> invoice) {
  final month = (invoice['month'] ?? '').toString();
  final total = formatMoney(invoice['totalAmount'] as num?);
  final balance = (invoice['balance'] as num?)?.toDouble();
  final status = (invoice['status']?.toString() ?? '').toLowerCase();

  final String money;
  if (balance == null) {
    if (status == 'paid' || status == 'cancelled') {
      money = 'settled';
    } else {
      money = 'total $total · balance unavailable';
    }
  } else if (balance <= 0.001) {
    money = 'settled';
  } else {
    money = 'due ${formatMoney(balance)} of $total';
  }

  return month.isEmpty ? money : '$month · $money';
}

String formatDate(dynamic value) {
  if (value == null) return '—';
  try {
    final d = value is DateTime ? value : DateTime.parse(value.toString());
    return DateFormat('dd MMM yyyy').format(d);
  } catch (_) {
    return value.toString();
  }
}

String formatTime(dynamic value) {
  if (value == null) return '—';
  try {
    final str = value.toString().trim();
    if (str.isEmpty || str == '--') return '—';
    final hhmm = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(str);
    if (!str.contains('T') && hhmm != null) {
      final h = int.parse(hhmm.group(1)!);
      final m = int.parse(hhmm.group(2)!);
      final now = DateTime.now();
      final dt = DateTime(now.year, now.month, now.day, h, m);
      return DateFormat('hh:mm a').format(dt);
    }
    final d = value is DateTime ? value : DateTime.parse(str).toLocal();
    return DateFormat('hh:mm a').format(d);
  } catch (_) {
    return value.toString();
  }
}

