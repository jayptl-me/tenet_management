import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantComplaintDetailScreen extends ConsumerStatefulWidget {
  const TenantComplaintDetailScreen({super.key, required this.complaintId});

  final String complaintId;

  @override
  ConsumerState<TenantComplaintDetailScreen> createState() =>
      _TenantComplaintDetailScreenState();
}

class _TenantComplaintDetailScreenState
    extends ConsumerState<TenantComplaintDetailScreen> {
  Map<String, dynamic>? _complaint;
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
      final data = await ref
          .read(tenantRepositoryProvider)
          .complaintDetail(widget.complaintId);
      if (!mounted) return;
      setState(() {
        _complaint = data;
        _loading = false;
        if (data == null) {
          _error = 'Complaint not found.';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Complaint')),
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
                  if (_complaint != null) _buildContent(context, _complaint!),
                ],
              ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, Map<String, dynamic> c) {
    final room = c['room'];
    final tenant = c['tenant'];
    String? roomNumber;
    if (room is Map) {
      roomNumber = room['roomNumber']?.toString();
    } else if (tenant is Map) {
      final tr = tenant['room'];
      if (tr is Map) roomNumber = tr['roomNumber']?.toString();
    }
    final photos = <String>[];
    final rawPhotos = c['photos'];
    if (rawPhotos is List) {
      for (final p in rawPhotos) {
        final s = p?.toString() ?? '';
        if (s.isNotEmpty) photos.add(s);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        c['title']?.toString() ?? 'Complaint',
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    StatusChip(label: c['status']?.toString() ?? '--'),
                  ],
                ),
                const SizedBox(height: 12),
                _kv(context, 'Category',
                    (c['category']?.toString() ?? '--').replaceAll('_', ' ')),
                _kv(context, 'Priority', c['priority']?.toString() ?? '--'),
                if (roomNumber != null) _kv(context, 'Room', roomNumber),
                _kv(context, 'Created', formatDate(c['createdAt'])),
                if (c['updatedAt'] != null)
                  _kv(context, 'Updated', formatDate(c['updatedAt'])),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Description',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              c['description']?.toString() ?? '--',
              style: const TextStyle(height: 1.4),
            ),
          ),
        ),
        if (photos.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            'Photos',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: photos.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                return ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    photos[i],
                    width: 96,
                    height: 96,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 96,
                      height: 96,
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      alignment: Alignment.center,
                      child: const Icon(Icons.broken_image_outlined),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
        if (c['adminNotes'] != null &&
            c['adminNotes'].toString().trim().isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            'Admin notes',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(c['adminNotes'].toString()),
            ),
          ),
        ],
        if (c['resolvedAt'] != null) ...[
          const SizedBox(height: 16),
          _kv(context, 'Resolved', formatDate(c['resolvedAt'])),
        ],
      ],
    );
  }

  Widget _kv(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontSize: 14,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
