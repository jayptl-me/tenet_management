import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantMealsScreen extends ConsumerStatefulWidget {
  const TenantMealsScreen({super.key});

  @override
  ConsumerState<TenantMealsScreen> createState() => _TenantMealsScreenState();
}

class _TenantMealsScreenState extends ConsumerState<TenantMealsScreen> {
  Map<String, dynamic>? _menu;
  List<Map<String, dynamic>> _weeklyMenus = [];
  int _selectedDayOffset = 0; // 0 = Today, 1 = Tomorrow, ..., 6
  bool _loading = true;
  String? _error;
  bool _featureDisabled = false;
  String _mealType = 'lunch';
  int _rating = 4;
  final _comment = TextEditingController();
  final Set<String> _selectedCategories = {'taste'};
  List<Map<String, dynamic>> _feedbackHistory = [];

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  DateTime get _selectedDate =>
      DateTime.now().add(Duration(days: _selectedDayOffset));

  String get _selectedDateStr =>
      DateFormat('yyyy-MM-dd').format(_selectedDate);

  Map<String, dynamic>? get _activeMenu {
    if (_selectedDayOffset == 0 && _menu != null) {
      return _menu;
    }
    final match = _weeklyMenus.firstWhere(
      (m) => m['date']?.toString().startsWith(_selectedDateStr) == true,
      orElse: () => const {},
    );
    if (match.isNotEmpty) return match;
    return _selectedDayOffset == 0 ? _menu : null;
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _featureDisabled = false;
    });
    try {
      final repo = ref.read(tenantRepositoryProvider);
      final results = await Future.wait([
        repo.todayMenu().catchError((_) => null),
        repo.weeklyMenus().catchError((_) => <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _menu = results[0] as Map<String, dynamic>?;
        _weeklyMenus = results[1] as List<Map<String, dynamic>>;
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
    _loadFeedbackHistory();
  }

  String _mealLabel(String mealType) {
    if (mealType.isEmpty) return mealType;
    return mealType[0].toUpperCase() + mealType.substring(1);
  }

  IconData _mealIcon(String slot) {
    switch (slot.toLowerCase()) {
      case 'breakfast':
        return Icons.free_breakfast_outlined;
      case 'lunch':
        return Icons.lunch_dining_outlined;
      case 'dinner':
        return Icons.dinner_dining_outlined;
      default:
        return Icons.restaurant_outlined;
    }
  }

  Future<void> _loadFeedbackHistory() async {
    try {
      final rows =
          await ref.read(tenantRepositoryProvider).myMealFeedback();
      if (!mounted) return;
      setState(() => _feedbackHistory = rows);
    } on ApiException catch (e) {
      if (e.isFeatureDisabled && mounted) {
        setState(() => _featureDisabled = true);
      }
    } catch (_) {
      // best-effort
    }
  }

  Future<void> _submitFeedback() async {
    final date = DateFormat('yyyy-MM-dd').format(DateTime.now());
    try {
      await ref.read(tenantRepositoryProvider).submitMealFeedback(
            date: date,
            mealType: _mealType,
            rating: _rating,
            comment: _comment.text.trim().isEmpty ? null : _comment.text.trim(),
            categories: _selectedCategories.toList(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Feedback submitted')),
      );
      _comment.clear();
      _loadFeedbackHistory();
    } on ApiException catch (e) {
      if (e.isFeatureDisabled) {
        setState(() => _featureDisabled = true);
      } else {
        setState(() => _error = e.message);
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeMenu = _activeMenu;
    final meals = activeMenu?['meals'] as Map?;
    final isHoliday = activeMenu?['isHoliday'] == true;
    final menuNotes = activeMenu?['notes']?.toString();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Meals & Weekly Menu'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _load,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_error != null) ...[
              ErrorBanner(message: _error!),
              const SizedBox(height: 12),
            ],
            // 7-day date selector bar
            SizedBox(
              height: 48,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: 7,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final d = DateTime.now().add(Duration(days: i));
                  final isSelected = _selectedDayOffset == i;
                  final isToday = i == 0;
                  final label = isToday ? 'Today' : DateFormat('E, d').format(d);
                  return ChoiceChip(
                    avatar: isToday
                        ? const Icon(Icons.today, size: 16)
                        : null,
                    label: Text(
                      label,
                      style: TextStyle(
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      ),
                    ),
                    selected: isSelected,
                    onSelected: (_) => setState(() => _selectedDayOffset = i),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _selectedDayOffset == 0
                          ? "Today's Menu"
                          : DateFormat('EEEE, d MMMM').format(_selectedDate),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _selectedDayOffset == 0
                          ? DateFormat('EEEE, d MMMM yyyy').format(DateTime.now())
                          : 'Weekly rotating menu schedule',
                      style: const TextStyle(
                        color: AppTheme.muted,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                if (isHoliday)
                  const StatusChip(label: 'Mess Holiday'),
              ],
            ),
            if (menuNotes != null && menuNotes.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, size: 16, color: AppTheme.muted),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        menuNotes,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (_loading)
              const SkeletonList(cardCount: 3, height: 95)
            else if (meals == null)
              EmptyState(
                message: _selectedDayOffset == 0
                    ? 'No menu published for today'
                    : 'No menu published for ${DateFormat('EEEE, d MMM').format(_selectedDate)}',
                icon: Icons.restaurant_menu_outlined,
              )
            else
              ...['breakfast', 'lunch', 'dinner'].map((slot) {
                final slotData = meals[slot];
                List<String> itemsList = [];
                String? specialItem;

                if (slotData is Map) {
                  final rawItems = slotData['items'];
                  if (rawItems is List) {
                    itemsList = rawItems.map((e) => e is Map ? e['name'].toString() : e.toString()).toList();
                  }
                  specialItem = slotData['special']?.toString();
                } else if (slotData is List) {
                  itemsList = slotData.map((e) => e is Map ? e['name'].toString() : e.toString()).toList();
                }

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                _mealIcon(slot),
                                size: 20,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _mealLabel(slot),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                            if (specialItem != null && specialItem.trim().isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: AppTheme.warningSoft,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.star, size: 12, color: AppTheme.warningText),
                                    const SizedBox(width: 4),
                                    Text(
                                      specialItem,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: AppTheme.warningText,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        if (itemsList.isEmpty)
                          const Text(
                            'Menu items to be announced',
                            style: TextStyle(
                              color: AppTheme.muted,
                              fontSize: 13,
                              fontStyle: FontStyle.italic,
                            ),
                          )
                        else
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: itemsList.map((item) {
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  item,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                      ],
                    ),
                  ),
                );
              }),
            const SizedBox(height: 16),
            if (_selectedDayOffset == 0) ...[
              if (_featureDisabled)
                const FeatureDisabledWidget(
                  message: 'Meal feedback is not enabled. Contact your PG manager.',
                )
              else ...[
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Submit today\'s feedback',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _mealType,
                          decoration: const InputDecoration(labelText: 'Meal'),
                          items: const ['breakfast', 'lunch', 'dinner']
                              .map(
                                (m) => DropdownMenuItem(
                                  value: m,
                                  child: Text(
                                    m[0].toUpperCase() + m.substring(1),
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _mealType = v ?? 'lunch'),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Categories',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: [
                            'taste',
                            'variety',
                            'quantity',
                            'cleanliness',
                            'service'
                          ].map((cat) {
                            return FilterChip(
                              label: Text(cat[0].toUpperCase() + cat.substring(1)),
                              selected: _selectedCategories.contains(cat),
                              onSelected: (selected) {
                                setState(() {
                                  if (selected) {
                                    _selectedCategories.add(cat);
                                  } else if (_selectedCategories.length > 1) {
                                    _selectedCategories.remove(cat);
                                  }
                                });
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Rating:', style: TextStyle(fontWeight: FontWeight.w600)),
                            Text('$_rating / 5 stars', style: const TextStyle(fontWeight: FontWeight.w800)),
                          ],
                        ),
                        Slider(
                          value: _rating.toDouble(),
                          min: 1,
                          max: 5,
                          divisions: 4,
                          label: '$_rating',
                          onChanged: (v) => setState(() => _rating = v.round()),
                        ),
                        TextField(
                          controller: _comment,
                          decoration: const InputDecoration(
                            labelText: 'Comment (optional)',
                            hintText: 'Share any details about quality or taste...',
                          ),
                        ),
                        const SizedBox(height: 14),
                        FilledButton(
                          onPressed: _submitFeedback,
                          child: const Text('Submit feedback'),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'My feedback history',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                if (_feedbackHistory.isEmpty)
                  const EmptyState(message: 'No feedback submitted yet')
                else
                  ..._feedbackHistory.map((f) {
                    final mealType = f['mealType']?.toString() ?? '--';
                    final mealTitle =
                        mealType == '--' ? mealType : _mealLabel(mealType);
                    return ListCard(
                      title: '${f['date']?.toString() ?? '--'} - $mealTitle',
                      subtitle:
                          'Rating: ${f['rating']}/5${f['comment'] != null && f['comment'].toString().isNotEmpty ? ' - ${f['comment']}' : ''}',
                      trailing: StatusChip(label: '${f['rating']}/5'),
                    );
                  }),
              ],
            ] else ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Icon(Icons.schedule, color: AppTheme.muted, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Feedback opens on ${DateFormat('EEEE').format(_selectedDate)}. Switch back to "Today" to rate today\'s meals.',
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppTheme.muted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

