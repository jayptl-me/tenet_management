import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantMyRoomScreen extends ConsumerStatefulWidget {
  const TenantMyRoomScreen({super.key});

  @override
  ConsumerState<TenantMyRoomScreen> createState() => _TenantMyRoomScreenState();
}

class _TenantMyRoomScreenState extends ConsumerState<TenantMyRoomScreen> {
  Map<String, dynamic>? _room;
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
      final repo = ref.read(tenantRepositoryProvider);
      final data = await repo.myRoomDetails();
      if (!mounted) return;
      if (data == null) {
        setState(() {
          _error = 'Room details not found or not assigned yet.';
          _loading = false;
        });
      } else {
        setState(() {
          _room = data;
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  IconData _amenityIcon(String key) {
    switch (key.toLowerCase()) {
      case 'ac':
      case 'air_conditioner':
        return Icons.ac_unit_rounded;
      case 'geyser':
      case 'water_heater':
        return Icons.water_drop_rounded;
      case 'wifi':
        return Icons.wifi_rounded;
      case 'fan':
        return Icons.mode_fan_off_rounded;
      case 'lights':
      case 'light':
        return Icons.lightbulb_rounded;
      case 'washroom':
      case 'bathroom':
        return Icons.bathtub_rounded;
      case 'cupboard':
      case 'wardrobe':
        return Icons.door_sliding_rounded;
      default:
        return Icons.check_circle_outline_rounded;
    }
  }

  void _openReportIssueModal(BuildContext context, {String? category}) {
    final roomId = _room?['_id']?.toString() ?? _room?['id']?.toString();
    final messenger = ScaffoldMessenger.of(context);
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RaiseComplaintModalWrapper(
        roomId: roomId,
        initialCategory: category ?? 'other',
      ),
    ).then((submitted) {
      if (submitted == true && mounted) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Issue reported successfully.'),
            backgroundColor: AppTheme.brand,
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Room & Roommates'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _load,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Padding(
                padding: EdgeInsets.all(16),
                child: SkeletonList(count: 3),
              )
            : _error != null
                ? ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      ErrorBanner(message: _error!),
                      const SizedBox(height: 24),
                      Center(
                        child: OutlinedButton.icon(
                          onPressed: _load,
                          icon: const Icon(Icons.refresh, size: 16),
                          label: const Text('Retry'),
                        ),
                      ),
                    ],
                  )
                : _room == null
                    ? const Center(child: Text('No room details available'))
                    : _buildContent(context, _room!),
      ),
    );
  }

  Widget _buildContent(BuildContext context, Map<String, dynamic> room) {
    final colorScheme = Theme.of(context).colorScheme;
    final roomNumber = room['roomNumber']?.toString() ?? '--';
    final sharingType = room['sharingType'] ?? 2;
    final floor = room['floor'] as Map?;
    final floorLabel = floor?['label']?.toString() ?? 'Floor';
    final myBedId = room['myBedId']?.toString() ?? 'A';
    final beds = (room['beds'] as List?)?.whereType<Map>().toList() ?? [];
    final amenities = (room['roomAmenities'] as List?)?.whereType<Map>().toList() ?? [];
    final photos = (room['photos'] as List?)?.whereType<String>().toList() ?? [];
    final occupiedCount = beds.where((b) => b['isOccupied'] == true).length;
    final myRent = room['myMonthlyRent'] as num?;
    final myDeposit = room['myDepositPaid'] as num?;
    final myMoveIn = room['myMoveInDate'];

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [
        // ── Room Hero Banner ──
        Card(
          elevation: 0,
          color: AppTheme.brand.withValues(alpha: 0.06),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: AppTheme.brand.withValues(alpha: 0.2)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ROOM $roomNumber',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.5,
                                color: AppTheme.brandDark,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$floorLabel · $sharingType Sharing Room',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppTheme.brand,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.bed, color: Colors.white, size: 14),
                          const SizedBox(width: 4),
                          Text(
                            'Bed $myBedId',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: colorScheme.outlineVariant.withValues(alpha: 0.5)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _heroStat('Occupancy', '$occupiedCount / $sharingType Beds'),
                      Container(width: 1, height: 28, color: colorScheme.outlineVariant),
                      _heroStat('Rent', myRent != null ? formatMoney(myRent) : '--'),
                      Container(width: 1, height: 28, color: colorScheme.outlineVariant),
                      _heroStat('Deposit', myDeposit != null ? formatMoney(myDeposit) : '--'),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),

        // ── Visual Bed Blueprint ──
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'ROOM BED BLUEPRINT',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
                color: colorScheme.outline,
              ),
            ),
            Text(
              '$sharingType Sharing',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.45,
          ),
          itemCount: beds.length,
          itemBuilder: (context, index) {
            final b = beds[index];
            final bedId = b['bedId']?.toString() ?? '${index + 1}';
            final isOccupied = b['isOccupied'] == true;
            final isMyBed = bedId == myBedId;
            final tenantName = b['tenantName']?.toString();

            return Container(
              decoration: BoxDecoration(
                color: isMyBed
                    ? AppTheme.brand.withValues(alpha: 0.09)
                    : isOccupied
                        ? colorScheme.surfaceContainerLowest
                        : colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isMyBed
                      ? AppTheme.brand
                      : isOccupied
                          ? colorScheme.outlineVariant
                          : colorScheme.outlineVariant.withValues(alpha: 0.4),
                  width: isMyBed ? 2 : 1,
                ),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.single_bed_rounded,
                            size: 20,
                            color: isMyBed ? AppTheme.brand : colorScheme.onSurfaceVariant,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Bed $bedId',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: isMyBed ? AppTheme.brandDark : colorScheme.onSurface,
                            ),
                          ),
                        ],
                      ),
                      if (isMyBed)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.brand,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'YOU',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        )
                      else if (isOccupied)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: AppTheme.success,
                            shape: BoxShape.circle,
                          ),
                        )
                      else
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: colorScheme.outlineVariant,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (isMyBed) ...[
                        const Text(
                          'Your Assigned Bed',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.brand,
                          ),
                        ),
                        if (myMoveIn != null)
                          Text(
                            'Since ${formatDate(myMoveIn)}',
                            style: TextStyle(
                              fontSize: 10,
                              color: colorScheme.onSurfaceVariant,
                            ),
                          ),
                      ] else if (isOccupied) ...[
                        Text(
                          tenantName ?? 'Roommate',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          'Co-occupant',
                          style: TextStyle(
                            fontSize: 10,
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ] else ...[
                        Text(
                          'Vacant Bed',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.outline,
                          ),
                        ),
                        Text(
                          'Available for booking',
                          style: TextStyle(
                            fontSize: 10,
                            color: colorScheme.outline,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 20),

        // ── Roommates Directory ──
        Text(
          'ROOMMATES DIRECTORY',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.8,
            color: colorScheme.outline,
          ),
        ),
        const SizedBox(height: 10),

        Card(
          child: Column(
            children: beds.map((b) {
              final bedId = b['bedId']?.toString() ?? '--';
              final isOccupied = b['isOccupied'] == true;
              final isMyBed = bedId == myBedId;
              final tenantName = b['tenantName']?.toString();

              return ListTile(
                leading: CircleAvatar(
                  radius: 18,
                  backgroundColor: isMyBed
                      ? AppTheme.brand.withValues(alpha: 0.15)
                      : isOccupied
                          ? colorScheme.surfaceContainerHighest
                          : colorScheme.surface,
                  child: Text(
                    isMyBed
                        ? 'Me'
                        : isOccupied
                            ? (tenantName != null && tenantName.isNotEmpty
                                ? tenantName[0].toUpperCase()
                                : 'R')
                            : '-',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                      color: isMyBed ? AppTheme.brand : colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
                title: Text(
                  isMyBed
                      ? 'You (Bed $bedId)'
                      : isOccupied
                          ? (tenantName ?? 'Roommate')
                          : 'Bed $bedId (Vacant)',
                  style: TextStyle(
                    fontWeight: isMyBed ? FontWeight.w800 : FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                subtitle: Text(
                  isMyBed
                      ? 'Assigned occupant'
                      : isOccupied
                          ? 'Co-resident · Bed $bedId'
                          : 'Open bed position',
                  style: const TextStyle(fontSize: 12),
                ),
                trailing: StatusChip(
                  label: isMyBed
                      ? 'Your Bed'
                      : isOccupied
                          ? 'Active'
                          : 'Vacant',
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 20),

        // ── In-Room Amenities & Appliance Health ──
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'IN-ROOM AMENITIES & APPLIANCES',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.8,
                color: colorScheme.outline,
              ),
            ),
            TextButton.icon(
              onPressed: () => _openReportIssueModal(context),
              icon: const Icon(Icons.build_outlined, size: 14),
              label: const Text('Report Issue', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
        const SizedBox(height: 6),

        if (amenities.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: colorScheme.outline, size: 20),
                  const SizedBox(width: 10),
                  Text(
                    'Standard room furnishings and appliances assigned.',
                    style: TextStyle(fontSize: 12, color: colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          )
        else
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: amenities.map((a) {
                  final key = a['amenityKey']?.toString() ?? 'other';
                  final status = a['status']?.toString() ?? 'operational';
                  final icon = _amenityIcon(key);

                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                    child: Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(icon, size: 18, color: colorScheme.onSurfaceVariant),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            key.replaceAll('_', ' ').toUpperCase(),
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                        StatusChip(label: status),
                        const SizedBox(width: 4),
                        IconButton(
                          icon: const Icon(Icons.chevron_right, size: 18),
                          tooltip: 'Report issue for $key',
                          onPressed: () => _openReportIssueModal(context, category: key),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
        const SizedBox(height: 20),

        // ── Room Photos ──
        if (photos.isNotEmpty) ...[
          Text(
            'ROOM PHOTOS (${photos.length})',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: colorScheme.outline,
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 120,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: photos.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, idx) {
                return ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    photos[idx],
                    width: 160,
                    height: 120,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 160,
                      height: 120,
                      color: colorScheme.surfaceContainerHighest,
                      alignment: Alignment.center,
                      child: const Icon(Icons.broken_image_outlined),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 20),
        ],

        // ── Action: Quick Report Issue Button ──
        FilledButton.icon(
          onPressed: () => _openReportIssueModal(context),
          icon: const Icon(Icons.report_problem_outlined, size: 18),
          label: const Text('Report Issue in Room'),
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _heroStat(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppTheme.muted, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
        ),
      ],
    );
  }
}

// ── Wrapper to launch the complaint sheet with preselected roomId and category ──

class _RaiseComplaintModalWrapper extends StatelessWidget {
  const _RaiseComplaintModalWrapper({
    required this.roomId,
    required this.initialCategory,
  });

  final String? roomId;
  final String initialCategory;

  @override
  Widget build(BuildContext context) {
    // Navigates into the complaints flow or displays modal
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Report Room Issue',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(false),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Report a problem directly linked to your room and assigned bed.',
            style: TextStyle(
              fontSize: 13,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: () {
              Navigator.of(context).pop(false);
              context.go('/tenant/complaints?category=$initialCategory');
            },
            icon: const Icon(Icons.add_task),
            label: const Text('Open Complaint Form'),
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }
}
