import '../../../core/network/api_client.dart';

/// Visitor portal uses tenant-authenticated visitor APIs.
/// Standalone visitor desk reuses the same endpoints when a tenant is signed in.
class VisitorRepository {
  VisitorRepository(this._api);
  final ApiClient _api;

  Future<List<Map<String, dynamic>>> myVisitors() async {
    final data = await _api.getJson('visitors/my', parse: (d) => d);
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return const [];
  }

  Future<Map<String, dynamic>> createVisitor({
    required String tenantId,
    required String visitorName,
    required String visitorPhone,
    required String purpose,
    required String expectedArrival,
  }) async {
    final data = await _api.postJson(
      'visitors',
      body: {
        // Required by Zod; tenant JWT still forces own tenantId server-side.
        'tenantId': tenantId,
        'visitorName': visitorName,
        'visitorPhone': visitorPhone,
        'purpose': purpose,
        'expectedArrival': expectedArrival,
      },
      parse: (d) => d is Map ? Map<String, dynamic>.from(d) : <String, dynamic>{},
    );
    return data;
  }

  Future<Map<String, dynamic>> getById(String id) async {
    final data = await _api.getJson(
      'visitors/$id',
      parse: (d) => d is Map ? Map<String, dynamic>.from(d) : <String, dynamic>{},
    );
    return data;
  }

  Future<void> markArrive(String id) async {
    await _api.postJson('visitors/$id/arrive', body: {}, parse: (_) => null);
  }

  Future<void> markDepart(String id) async {
    await _api.postJson('visitors/$id/depart', body: {}, parse: (_) => null);
  }
}
