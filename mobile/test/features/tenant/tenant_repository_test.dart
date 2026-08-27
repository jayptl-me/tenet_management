import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tenet_pg_portal/core/network/api_client.dart';
import 'package:tenet_pg_portal/core/storage/token_storage.dart';
import 'package:tenet_pg_portal/features/tenant/data/tenant_repository.dart';

class MockTokenStorage extends Mock implements TokenStorage {}

void main() {
  late MockTokenStorage mockStorage;
  late ApiClient apiClient;
  late DioAdapter dioAdapter;
  late TenantRepository repository;

  setUp(() {
    mockStorage = MockTokenStorage();
    when(() => mockStorage.readAccessToken()).thenAnswer((_) async => 'valid_tenant_token');
    apiClient = ApiClient(storage: mockStorage);
    dioAdapter = DioAdapter(dio: apiClient.dio);
    repository = TenantRepository(apiClient);
  });

  group('TenantRepository Complaints Flow', () {
    test('myComplaints fetches and parses list of complaints', () async {
      dioAdapter.onGet(
        'complaints/my',
        (server) => server.reply(200, {
          'success': true,
          'data': [
            {
              'id': 'cmp-1',
              'title': 'Leaky faucet',
              'category': 'plumbing',
              'status': 'in_progress',
              'priority': 'medium',
            }
          ],
        }),
      );

      final complaints = await repository.myComplaints();
      expect(complaints.length, 1);
      expect(complaints.first['title'], 'Leaky faucet');
      expect(complaints.first['category'], 'plumbing');
    });

    test('createComplaint posts valid complaint payload', () async {
      dioAdapter.onPost(
        'complaints',
        (server) => server.reply(201, {'success': true, 'data': {'id': 'cmp-2'}}),
        data: {
          'roomId': 'room-101',
          'title': 'WiFi dropped',
          'description': 'Speed is below 1 Mbps in room 101',
          'category': 'wifi',
          'priority': 'high',
        },
      );

      await expectLater(
        repository.createComplaint(
          roomId: 'room-101',
          title: 'WiFi dropped',
          description: 'Speed is below 1 Mbps in room 101',
          category: 'wifi',
          priority: 'high',
        ),
        completes,
      );
    });
  });

  group('TenantRepository Leaves Lifecycle', () {
    test('myLeaves returns list of submitted leave applications', () async {
      dioAdapter.onGet(
        'leaves/my',
        (server) => server.reply(200, {
          'success': true,
          'data': [
            {
              'id': 'leave-1',
              'fromDate': '2026-03-01',
              'toDate': '2026-03-05',
              'reason': 'Visiting hometown for festival',
              'status': 'approved',
            }
          ],
        }),
      );

      final leaves = await repository.myLeaves();
      expect(leaves.length, 1);
      expect(leaves.first['status'], 'approved');
      expect(leaves.first['reason'], 'Visiting hometown for festival');
    });

    test('cancelLeave posts cancellation request for pending leave', () async {
      dioAdapter.onPost(
        'leaves/leave-1/cancel',
        (server) => server.reply(200, {'success': true, 'data': {'status': 'cancelled'}}),
        data: {},
      );

      await expectLater(repository.cancelLeave('leave-1'), completes);
    });
  });

  group('TenantRepository Payments and Invoices', () {
    test('submitUtr posts UTR reference for invoice settlement', () async {
      dioAdapter.onPost(
        'payments/submit-utr',
        (server) => server.reply(200, {'success': true, 'data': {'status': 'pending_verification'}}),
        data: {
          'invoiceId': 'inv-100',
          'utrNumber': 'SBI123456789',
        },
      );

      await expectLater(
        repository.submitUtr(invoiceId: 'inv-100', utrNumber: 'sbi123456789'),
        completes,
      );
    });
  });
}
