import '../../../core/network/api_client.dart';

class GuardianRepository {
  GuardianRepository(this._api);
  final ApiClient _api;

  Future<Map<String, dynamic>?> ward() async {
    try {
      final data = await _api.getJson('guardians/me/ward', parse: (d) => d);
      if (data is Map) return Map<String, dynamic>.from(data);
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> wardAttendance() async {
    final data = await _api.getJson(
      'guardians/me/ward/attendance',
      parse: (d) => d,
    );
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    if (data is Map && data['data'] is List) {
      return (data['data'] as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return const [];
  }
}
