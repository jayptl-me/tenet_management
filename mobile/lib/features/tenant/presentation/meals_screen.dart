import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_exception.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

class TenantMealsScreen extends ConsumerStatefulWidget {
  const TenantMealsScreen({super.key});

  @override
  ConsumerState<TenantMealsScreen> createState() => _TenantMealsScreenState();
}

class _TenantMealsScreenState extends ConsumerState<TenantMealsScreen> {
  Map<String, dynamic>? _menu;
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

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _featureDisabled = false;
    });
    try {
      final menu = await ref.read(tenantRepositoryProvider).todayMenu();
      if (!mounted) return;
      setState(() {
        _menu = menu;
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

  Future<void> _loadFeedbackHistory() async {
    try {
      final rows =
          await ref.read(tenantRepositoryProvider).myMealFeedback();
      if (!mounted) return;
      setState(() => _feedbackHistory = rows);
    } on ApiException catch (e) {
      if (e.statusCode == 403 && mounted) {
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
      if (e.statusCode == 403) {
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
    final meals = _menu?['meals'] as Map?;
    return Scaffold(
      appBar: AppBar(title: const Text('Meals & menu')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null) ErrorBanner(message: _error!),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else ...[
            Text(
              'Today\'s menu',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            if (meals == null)
              const EmptyState(message: 'No menu published for today')
            else
              ...['breakfast', 'lunch', 'dinner'].map((slot) {
                final items = meals[slot];
                return ListCard(
                  title: slot[0].toUpperCase() + slot.substring(1),
                  subtitle: items is List
                      ? items.map((e) => e is Map ? e['name'] : e).join(', ')
                      : items?.toString() ?? '—',
                );
              }),
            const SizedBox(height: 16),
            if (_featureDisabled)
              const FeatureDisabledWidget(
                  message:
                      'Meal feedback is not enabled. Contact your PG manager.')
            else ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('Meal feedback',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _mealType,
                        decoration:
                            const InputDecoration(labelText: 'Meal'),
                        items: const ['breakfast', 'lunch', 'dinner']
                            .map((m) => DropdownMenuItem(
                                value: m, child: Text(m)))
                            .toList(),
                        onChanged: (v) =>
                            setState(() => _mealType = v ?? 'lunch'),
                      ),
                      const SizedBox(height: 12),
                      const Text('Categories',
                          style: TextStyle(fontWeight: FontWeight.w600)),
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
                            label: Text(
                                cat[0].toUpperCase() + cat.substring(1)),
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
                      Text('Rating: $_rating'),
                      Slider(
                        value: _rating.toDouble(),
                        min: 1,
                        max: 5,
                        divisions: 4,
                        label: '$_rating',
                        onChanged: (v) =>
                            setState(() => _rating = v.round()),
                      ),
                      TextField(
                        controller: _comment,
                        decoration: const InputDecoration(
                            labelText: 'Comment (optional)'),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _submitFeedback,
                        child: const Text('Submit feedback'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text('My feedback history',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              if (_feedbackHistory.isEmpty)
                const EmptyState(message: 'No feedback submitted yet')
              else
                ..._feedbackHistory.map((f) => ListCard(
                      title:
                          '${f['date']?.toString() ?? '--'} - ${f['mealType']?.toString() ?? '--'}',
                      subtitle:
                          'Rating: ${f['rating']}/5${f['comment'] != null && f['comment'].toString().isNotEmpty ? ' - ${f['comment']}' : ''}',
                      trailing: StatusChip(label: '${f['rating']}/5'),
                    )),
            ],
          ],
        ],
      ),
    );
  }
}
