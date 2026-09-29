import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantComplaintsScreen extends ConsumerStatefulWidget {
  const TenantComplaintsScreen({super.key, this.initialCategory});

  final String? initialCategory;

  @override
  ConsumerState<TenantComplaintsScreen> createState() => _TenantComplaintsScreenState();
}

class _TenantComplaintsScreenState extends ConsumerState<TenantComplaintsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];
  String? _roomId;
  String _activeFilter = 'all';

  @override
  void initState() {
    super.initState();
    Future.microtask(_bootstrap);
  }

  Future<void> _bootstrap() async {
    final tenantId = await ref.read(authProvider.notifier).ensureTenantId();
    final repo = ref.read(tenantRepositoryProvider);
    if (tenantId != null && tenantId.isNotEmpty) {
      try {
        final profile = await repo.tenantProfile(tenantId);
        final room = profile?['room'];
        if (room is Map && room['_id'] != null) {
          _roomId = room['_id'].toString();
        } else if (profile?['roomId'] != null) {
          _roomId = profile!['roomId'].toString();
        }
      } catch (_) {
        // Best-effort room lookup
      }
    }
    await _load();

    // Auto-open sheet if navigated with an initial category
    if (widget.initialCategory != null && mounted) {
      _openRaiseComplaintSheet(initialCategory: widget.initialCategory);
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await ref.read(tenantRepositoryProvider).myComplaints();
      if (!mounted) return;
      setState(() {
        _rows = rows;
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

  void _openRaiseComplaintSheet({String? initialCategory}) {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RaiseComplaintBottomSheet(
        roomId: _roomId,
        initialCategory: initialCategory,
      ),
    ).then((submitted) {
      if (submitted == true && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Complaint submitted successfully.'),
            backgroundColor: AppTheme.brand,
          ),
        );
        _load();
      }
    });
  }

  List<Map<String, dynamic>> get _filteredRows {
    if (_activeFilter == 'all') return _rows;
    if (_activeFilter == 'open') {
      return _rows.where((c) {
        final s = c['status']?.toString();
        return s == 'open' || s == 'in_progress';
      }).toList();
    }
    if (_activeFilter == 'resolved') {
      return _rows.where((c) => c['status']?.toString() == 'resolved').toList();
    }
    if (_activeFilter == 'dismissed') {
      return _rows.where((c) => c['status']?.toString() == 'dismissed').toList();
    }
    return _rows;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredRows;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Complaints & Issues'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _load,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openRaiseComplaintSheet(),
        icon: const Icon(Icons.add_task),
        label: const Text('Raise Issue'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          children: [
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 12),
            ],

            // ── Status Filter Chips ──
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterChip('all', 'All (${_rows.length})'),
                  const SizedBox(width: 8),
                  _buildFilterChip(
                    'open',
                    'Active (${_rows.where((c) => c['status'] == 'open' || c['status'] == 'in_progress').length})',
                  ),
                  const SizedBox(width: 8),
                  _buildFilterChip(
                    'resolved',
                    'Resolved (${_rows.where((c) => c['status'] == 'resolved').length})',
                  ),
                  const SizedBox(width: 8),
                  _buildFilterChip(
                    'dismissed',
                    'Dismissed (${_rows.where((c) => c['status'] == 'dismissed').length})',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            if (_loading)
              const SkeletonList(count: 3)
            else if (filtered.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 48),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.check_circle_outline,
                        size: 48,
                        color: Theme.of(context).colorScheme.outline,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _activeFilter == 'all'
                            ? 'No complaints filed yet'
                            : 'No $_activeFilter complaints',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Report any maintenance or room issues quickly.',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton.icon(
                        onPressed: () => _openRaiseComplaintSheet(),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Raise an Issue'),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...filtered.map((c) {
                final id = c['_id']?.toString() ?? c['id']?.toString() ?? '';
                final cat = c['category']?.toString() ?? 'other';
                final priority = c['priority']?.toString() ?? 'medium';
                final status = c['status']?.toString() ?? 'open';
                final createdAt = c['createdAt'];

                return _ComplaintCard(
                  id: id,
                  title: c['title']?.toString() ?? 'Complaint',
                  category: cat,
                  priority: priority,
                  status: status,
                  createdAt: createdAt,
                  onTap: id.isEmpty ? null : () => context.go('/tenant/complaints/$id'),
                );
              }),
            const SizedBox(height: 72), // Padding for FAB
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final active = _activeFilter == key;
    return ChoiceChip(
      label: Text(label),
      selected: active,
      onSelected: (_) => setState(() => _activeFilter = key),
      labelStyle: TextStyle(
        fontSize: 12,
        fontWeight: active ? FontWeight.w700 : FontWeight.w500,
        color: active ? Colors.white : null,
      ),
      selectedColor: AppTheme.brand,
    );
  }
}

// ── Complaint Item Card ──────────────────────────────────────

class _ComplaintCard extends StatelessWidget {
  const _ComplaintCard({
    required this.id,
    required this.title,
    required this.category,
    required this.priority,
    required this.status,
    required this.createdAt,
    this.onTap,
  });

  final String id;
  final String title;
  final String category;
  final String priority;
  final String status;
  final dynamic createdAt;
  final VoidCallback? onTap;

  IconData _iconForCategory(String cat) {
    switch (cat.toLowerCase()) {
      case 'wifi':
        return Icons.wifi_rounded;
      case 'water':
        return Icons.water_drop_rounded;
      case 'electricity':
        return Icons.bolt_rounded;
      case 'food_quality':
        return Icons.restaurant_rounded;
      case 'cleaning_room':
        return Icons.cleaning_services_rounded;
      case 'cleaning_washroom':
        return Icons.bathtub_rounded;
      case 'washing_machine':
        return Icons.local_laundry_service_rounded;
      case 'fridge':
        return Icons.kitchen_rounded;
      case 'lights':
        return Icons.lightbulb_rounded;
      case 'noise':
        return Icons.volume_up_rounded;
      default:
        return Icons.handyman_outlined;
    }
  }

  Color _priorityColor(String prio) {
    switch (prio.toLowerCase()) {
      case 'urgent':
        return AppTheme.danger;
      case 'high':
        return AppTheme.warning;
      case 'medium':
        return const Color(0xFF2563EB);
      default:
        return AppTheme.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final catIcon = _iconForCategory(category);
    final pColor = _priorityColor(priority);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppTheme.brand.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Icon(catIcon, color: AppTheme.brand, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: pColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          priority.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: pColor,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '·',
                          style: TextStyle(color: colorScheme.outline, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          category.replaceAll('_', ' '),
                          style: TextStyle(
                            fontSize: 11,
                            color: colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '·',
                          style: TextStyle(color: colorScheme.outline, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          formatDate(createdAt),
                          style: TextStyle(
                            fontSize: 11,
                            color: colorScheme.outline,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusChip(label: status),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Modal Bottom Sheet for Raising a Complaint ──────────────

class _RaiseComplaintBottomSheet extends ConsumerStatefulWidget {
  const _RaiseComplaintBottomSheet({
    required this.roomId,
    this.initialCategory,
  });

  final String? roomId;
  final String? initialCategory;

  @override
  ConsumerState<_RaiseComplaintBottomSheet> createState() =>
      _RaiseComplaintBottomSheetState();
}

class _RaiseComplaintBottomSheetState
    extends ConsumerState<_RaiseComplaintBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _photoInputController = TextEditingController();

  String _category = 'wifi';
  String _priority = 'medium';
  final List<String> _photos = [];
  bool _submitting = false;
  String? _sheetError;

  static const _categories = [
    ('wifi', 'Wi-Fi', Icons.wifi_rounded),
    ('water', 'Water', Icons.water_drop_rounded),
    ('electricity', 'Electricity', Icons.bolt_rounded),
    ('cleaning_room', 'Room Clean', Icons.cleaning_services_rounded),
    ('cleaning_washroom', 'Washroom', Icons.bathtub_rounded),
    ('washing_machine', 'Laundry', Icons.local_laundry_service_rounded),
    ('food_quality', 'Food', Icons.restaurant_rounded),
    ('fridge', 'Fridge', Icons.kitchen_rounded),
    ('lights', 'Lights', Icons.lightbulb_rounded),
    ('noise', 'Noise', Icons.volume_up_rounded),
    ('other', 'Other', Icons.help_outline_rounded),
  ];

  static const _priorities = ['low', 'medium', 'high', 'urgent'];

  @override
  void initState() {
    super.initState();
    final init = widget.initialCategory?.trim().toLowerCase();
    if (init != null && _categories.any((c) => c.$1 == init)) {
      _category = init;
      _titleController.text = 'Issue with ${init.replaceAll('_', ' ')}';
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _photoInputController.dispose();
    super.dispose();
  }

  void _addPhotoUrl() {
    final text = _photoInputController.text.trim();
    if (text.isEmpty) return;
    if (_photos.length >= 5) {
      setState(() => _sheetError = 'Maximum 5 photos allowed.');
      return;
    }
    final uri = Uri.tryParse(text);
    if (uri == null || (uri.scheme != 'https' && uri.scheme != 'http')) {
      setState(() => _sheetError = 'Enter a valid http(s) URL.');
      return;
    }
    setState(() {
      _photos.add(text);
      _photoInputController.clear();
      _sheetError = null;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (widget.roomId == null || widget.roomId!.isEmpty) {
      setState(() {
        _sheetError = 'Room is not linked to your tenant profile. Please contact PG admin.';
      });
      return;
    }

    setState(() {
      _submitting = true;
      _sheetError = null;
    });

    try {
      await ref.read(tenantRepositoryProvider).createComplaint(
            roomId: widget.roomId!,
            title: _titleController.text.trim(),
            description: _descController.text.trim(),
            category: _category,
            priority: _priority,
            photos: _photos.isEmpty ? null : _photos,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _sheetError = e.toString().replaceFirst('Exception: ', '');
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Drag Handle ──
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              decoration: BoxDecoration(
                color: colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // ── Sheet Header ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Raise an Issue',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Staff will review and resolve this based on PG SLA.',
                        style: TextStyle(
                          fontSize: 12,
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  icon: const Icon(Icons.close),
                  tooltip: 'Cancel',
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // ── Form Body (Scrollable) ──
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_sheetError != null) ...[
                      ErrorBanner(message: _sheetError!),
                      const SizedBox(height: 14),
                    ],

                    // ── Category Selection Grid ──
                    Text(
                      'SELECT CATEGORY',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        color: colorScheme.outline,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _categories.map((cat) {
                        final isSelected = _category == cat.$1;
                        return InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () {
                            setState(() {
                              _category = cat.$1;
                              if (_titleController.text.isEmpty ||
                                  _titleController.text.startsWith('Issue with ')) {
                                _titleController.text = 'Issue with ${cat.$2}';
                              }
                            });
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppTheme.brand.withValues(alpha: 0.1)
                                  : colorScheme.surfaceContainerLowest,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected
                                    ? AppTheme.brand
                                    : colorScheme.outlineVariant.withValues(alpha: 0.5),
                                width: isSelected ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  cat.$3,
                                  size: 16,
                                  color: isSelected ? AppTheme.brand : colorScheme.onSurfaceVariant,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  cat.$2,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                    color: isSelected ? AppTheme.brand : colorScheme.onSurface,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),

                    // ── Priority Selector ──
                    Text(
                      'URGENCY / PRIORITY',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        color: colorScheme.outline,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: _priorities.map((prio) {
                        final isSelected = _priority == prio;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 3),
                            child: ChoiceChip(
                              label: Center(
                                child: Text(
                                  prio.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected ? Colors.white : null,
                                  ),
                                ),
                              ),
                              selected: isSelected,
                              showCheckmark: false,
                              selectedColor: prio == 'urgent'
                                  ? AppTheme.danger
                                  : prio == 'high'
                                      ? AppTheme.warning
                                      : AppTheme.brand,
                              onSelected: (_) => setState(() => _priority = prio),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),

                    // ── Title Input ──
                    TextFormField(
                      controller: _titleController,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Issue Title',
                        hintText: 'Brief summary (e.g. WiFi connection drops)',
                        prefixIcon: Icon(Icons.title, size: 18),
                      ),
                      validator: (v) {
                        if (v == null || v.trim().length < 5) {
                          return 'Title must be at least 5 characters';
                        }
                        if (v.trim().length > 200) {
                          return 'Title cannot exceed 200 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // ── Description Input ──
                    TextFormField(
                      controller: _descController,
                      maxLines: 3,
                      textInputAction: TextInputAction.newline,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                        hintText: 'Provide details, symptoms, and exact location...',
                        alignLabelWithHint: true,
                      ),
                      validator: (v) {
                        if (v == null || v.trim().length < 10) {
                          return 'Description must be at least 10 characters';
                        }
                        if (v.trim().length > 2000) {
                          return 'Description cannot exceed 2000 characters';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // ── Photo Evidence URLs ──
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'PHOTO EVIDENCE (${_photos.length}/5)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                            color: colorScheme.outline,
                          ),
                        ),
                        if (_photos.length < 5)
                          Text(
                            'HTTPS links',
                            style: TextStyle(fontSize: 11, color: colorScheme.outline),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    if (_photos.isNotEmpty) ...[
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _photos.asMap().entries.map((entry) {
                          final idx = entry.key;
                          final url = entry.value;
                          return Tooltip(
                            message: url,
                            child: Chip(
                              avatar: const Icon(Icons.image, size: 16),
                              label: Text(
                                'Photo ${idx + 1}',
                                style: const TextStyle(fontSize: 12),
                              ),
                              onDeleted: () {
                                setState(() => _photos.removeAt(idx));
                              },
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 8),
                    ],

                    if (_photos.length < 5)
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _photoInputController,
                              decoration: const InputDecoration(
                                hintText: 'https://...',
                                prefixIcon: Icon(Icons.link, size: 18),
                                isDense: true,
                              ),
                              onSubmitted: (_) => _addPhotoUrl(),
                            ),
                          ),
                          const SizedBox(width: 8),
                          OutlinedButton(
                            onPressed: _addPhotoUrl,
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text('Add'),
                          ),
                        ],
                      ),
                    const SizedBox(height: 24),

                    // ── Action Buttons ──
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _submitting ? null : () => Navigator.of(context).pop(false),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(48),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: FilledButton(
                            onPressed: _submitting ? null : _submit,
                            child: _submitting
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Submit Complaint'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
