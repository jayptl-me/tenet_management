import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/providers/auth_provider.dart';
import '../network/api_client.dart';

/// Feature flags from public `GET /app-config` (features object).
/// Used to hide gated portal nav before the user hits a 403.
class AppFeatures {
  const AppFeatures({
    this.attendanceEnabled = false,
    this.laundryEnabled = true,
    this.messFeedbackEnabled = true,
    this.visitorManagementEnabled = true,
    this.guardianPortalEnabled = true,
    this.noticeBoardEnabled = true,
    this.emergencyAlertsEnabled = true,
    this.pgName,
  });

  final bool attendanceEnabled;
  final bool laundryEnabled;
  final bool messFeedbackEnabled;
  final bool visitorManagementEnabled;
  final bool guardianPortalEnabled;
  final bool noticeBoardEnabled;
  final bool emergencyAlertsEnabled;
  final String? pgName;

  /// Leaves are gated by the same API flag as attendance.
  bool get leavesEnabled => attendanceEnabled;

  static AppFeatures fromJson(Map<String, dynamic> data) {
    final features = data['features'];
    Map<String, dynamic> f = {};
    if (features is Map) {
      f = Map<String, dynamic>.from(features);
    }
    bool flag(String key, {bool defaultValue = true}) {
      final v = f[key];
      if (v is bool) return v;
      return defaultValue;
    }

    return AppFeatures(
      attendanceEnabled: flag('attendanceEnabled', defaultValue: false),
      laundryEnabled: flag('laundryEnabled'),
      messFeedbackEnabled: flag('messFeedbackEnabled'),
      visitorManagementEnabled: flag('visitorManagementEnabled'),
      guardianPortalEnabled: flag('guardianPortalEnabled'),
      noticeBoardEnabled: flag('noticeBoardEnabled'),
      emergencyAlertsEnabled: flag('emergencyAlertsEnabled'),
      pgName: data['pgName']?.toString(),
    );
  }
}

class AppFeaturesNotifier extends StateNotifier<AsyncValue<AppFeatures>> {
  AppFeaturesNotifier(this._api) : super(const AsyncValue.loading()) {
    load();
  }

  final ApiClient _api;

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final data = await _api.getJson('app-config', parse: (d) => d);
      if (data is Map) {
        state = AsyncValue.data(
          AppFeatures.fromJson(Map<String, dynamic>.from(data)),
        );
      } else {
        state = const AsyncValue.data(AppFeatures());
      }
    } catch (e, st) {
      // On failure keep permissive defaults so core nav still works;
      // individual screens still handle FEATURE_DISABLED 403.
      state = AsyncValue.data(const AppFeatures());
      // Preserve stack for debug without failing the portal shell.
      assert(() {
        // ignore: avoid_print
        print('app-config load failed: $e\n$st');
        return true;
      }());
    }
  }
}

final appFeaturesProvider =
    StateNotifierProvider<AppFeaturesNotifier, AsyncValue<AppFeatures>>((ref) {
  return AppFeaturesNotifier(ref.watch(apiClientProvider));
});
