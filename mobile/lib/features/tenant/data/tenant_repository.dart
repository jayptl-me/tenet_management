import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';

class TenantRepository {
  TenantRepository(this._api);
  final ApiClient _api;

  Future<List<Map<String, dynamic>>> myInvoices() async {
    final data = await _api.getJson('invoices/my', parse: (d) => d);
    return _asMapList(data);
  }

  Future<List<Map<String, dynamic>>> myPayments() async {
    final data = await _api.getJson('payments/my', parse: (d) => d);
    return _asMapList(data);
  }

  Future<List<Map<String, dynamic>>> myComplaints() async {
    final data = await _api.getJson('complaints/my', parse: (d) => d);
    return _asMapList(data);
  }

  Future<void> createComplaint({
    required String roomId,
    required String title,
    required String description,
    required String category,
    required String priority,
  }) async {
    await _api.postJson(
      'complaints',
      body: {
        'roomId': roomId,
        'title': title,
        'description': description,
        'category': category,
        'priority': priority,
      },
      parse: (_) => null,
    );
  }

  Future<void> submitUtr({
    required String invoiceId,
    required String utrNumber,
  }) async {
    await _api.postJson(
      'payments/submit-utr',
      body: {
        'invoiceId': invoiceId,
        'utrNumber': utrNumber.trim().toUpperCase(),
      },
      parse: (_) => null,
    );
  }

  /// UPI QR payload for an invoice (`GET payments/qr-code?invoiceId=`).
  Future<Map<String, dynamic>?> paymentQrCode(String invoiceId) async {
    try {
      final data = await _api.getJson(
        'payments/qr-code',
        query: {'invoiceId': invoiceId},
        parse: (d) => d,
      );
      if (data is Map) return Map<String, dynamic>.from(data);
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Raw PDF bytes for an invoice (`GET invoices/:id/pdf`).
  Future<List<int>> invoicePdfBytes(String invoiceId) {
    return _api.getBytes('invoices/$invoiceId/pdf');
  }

  Future<Map<String, dynamic>?> complaintDetail(String complaintId) async {
    try {
      final data =
          await _api.getJson('complaints/$complaintId', parse: (d) => d);
      if (data is Map) return Map<String, dynamic>.from(data);
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> myVisitors() async {
    final data = await _api.getJson('visitors/my', parse: (d) => d);
    return _asMapList(data);
  }

  Future<void> createVisitor({
    required String tenantId,
    required String visitorName,
    required String visitorPhone,
    required String purpose,
    required String expectedArrival,
  }) async {
    await _api.postJson(
      'visitors',
      body: {
        'tenantId': tenantId,
        'visitorName': visitorName,
        'visitorPhone': visitorPhone,
        'purpose': purpose,
        'expectedArrival': expectedArrival,
      },
      parse: (_) => null,
    );
  }

  Future<List<Map<String, dynamic>>> laundrySlots() async {
    final data = await _api.getJson('laundry-slots', parse: (d) => d);
    return _asMapList(data);
  }

  Future<void> bookLaundry({
    required String tenantId,
    required String slotDate,
    required String slotTime,
    int? items,
  }) async {
    await _api.postJson(
      'laundry-slots',
      body: {
        'tenantId': tenantId,
        'slotDate': slotDate,
        'slotTime': slotTime,
        if (items != null) 'items': items,
      },
      parse: (_) => null,
    );
  }

  /// Today's menu. Returns null when none is published (404). Other errors rethrow.
  Future<Map<String, dynamic>?> todayMenu() async {
    try {
      final data = await _api.getJson('menus/today', parse: (d) => d);
      if (data is Map) return Map<String, dynamic>.from(data);
      return null;
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<void> submitMealFeedback({
    required String date,
    required String mealType,
    required int rating,
    String? comment,
    List<String>? categories,
  }) async {
    await _api.postJson(
      'meals/feedback',
      body: {
        'date': date,
        'mealType': mealType,
        'rating': rating,
        if (comment != null) 'comment': comment,
        if (categories != null) 'categories': categories,
      },
      parse: (_) => null,
    );
  }

  Future<List<Map<String, dynamic>>> notices() async {
    final data = await _api.getJson('notices', parse: (d) => d);
    return _asMapList(data);
  }

  Future<Map<String, dynamic>?> tenantProfile(String tenantId) async {
    try {
      final data = await _api.getJson('tenants/$tenantId', parse: (d) => d);
      if (data is Map) return Map<String, dynamic>.from(data);
      return null;
    } catch (_) {
      return null;
    }
  }

  // ── Invoice detail ──────────────────────────────────────
  Future<Map<String, dynamic>?> invoiceDetail(String invoiceId) async {
    try {
      final data = await _api.getJson('invoices/$invoiceId', parse: (d) => d);
      if (data is Map) return Map<String, dynamic>.from(data);
      return null;
    } catch (_) {
      return null;
    }
  }

  // ── Meal feedback history ───────────────────────────────
  Future<List<Map<String, dynamic>>> myMealFeedback() async {
    final data = await _api.getJson('meals/feedback/my', parse: (d) => d);
    return _asMapList(data);
  }

  // ── Leaves ──────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> myLeaves() async {
    final data = await _api.getJson('leaves/my', parse: (d) => d);
    return _asMapList(data);
  }

  Future<void> createLeave({
    required String tenantId,
    required String fromDate,
    required String toDate,
    required String reason,
  }) async {
    await _api.postJson(
      'leaves',
      body: {
        'tenantId': tenantId,
        'fromDate': fromDate,
        'toDate': toDate,
        'reason': reason,
      },
      parse: (_) => null,
    );
  }

  /// Withdraw a pending leave (`POST leaves/:id/cancel`).
  Future<void> cancelLeave(String leaveId) async {
    await _api.postJson(
      'leaves/$leaveId/cancel',
      body: {},
      parse: (_) => null,
    );
  }

  // ── Attendance ──────────────────────────────────────────
  Future<List<Map<String, dynamic>>> myAttendance() async {
    final data = await _api.getJson('attendance/my', parse: (d) => d);
    return _asMapList(data);
  }

  Future<Map<String, dynamic>?> checkIn(String tenantId) async {
    final data = await _api.postJson(
      'attendance/check-in',
      body: {'tenantId': tenantId, 'method': 'app'},
      parse: (d) => d,
    );
    if (data is Map) return Map<String, dynamic>.from(data);
    return null;
  }

  Future<Map<String, dynamic>?> checkOut(String tenantId) async {
    final data = await _api.postJson(
      'attendance/check-out',
      body: {'tenantId': tenantId},
      parse: (d) => d,
    );
    if (data is Map) return Map<String, dynamic>.from(data);
    return null;
  }

  // ── Notifications ───────────────────────────────────────
  /// Unread count from `GET notifications/unread-count`.
  Future<int> unreadNotificationCount() async {
    final data = await _api.getJson('notifications/unread-count', parse: (d) => d);
    if (data is Map) {
      final count = data['count'];
      if (count is int) return count;
      if (count is num) return count.toInt();
    }
    return 0;
  }

  /// Portal history (includes read). API derives [isRead] from unreadBy.
  Future<List<Map<String, dynamic>>> myNotifications({String? userId}) async {
    final data = await _api.getJson('notifications', parse: (d) => d);
    return _asMapList(data)
        .map((n) => _withNotificationReadState(n, userId))
        .toList();
  }

  Future<void> markNotificationRead(String notificationId) async {
    await _api.patchJson(
      'notifications/$notificationId/read',
      body: {},
      parse: (_) => null,
    );
  }

  Future<void> markAllNotificationsRead() async {
    await _api.patchJson(
      'notifications/read-all',
      body: {},
      parse: (_) => null,
    );
  }

  /// F2: derive isRead from unreadBy membership when API omits the field.
  Map<String, dynamic> _withNotificationReadState(
    Map<String, dynamic> n,
    String? userId,
  ) {
    final out = Map<String, dynamic>.from(n);
    if (out['isRead'] is bool) return out;
    if (userId == null || userId.isEmpty) {
      out['isRead'] = false;
      return out;
    }
    final unreadBy = out['unreadBy'];
    final unreadIds = <String>[];
    if (unreadBy is List) {
      for (final id in unreadBy) {
        unreadIds.add(id.toString());
      }
    }
    out['isRead'] = !unreadIds.contains(userId);
    return out;
  }

  List<Map<String, dynamic>> _asMapList(dynamic data) {
    if (data is List) {
      return data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return const [];
  }
}
