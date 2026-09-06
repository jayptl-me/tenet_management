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
        '/complaints/my',
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
        '/complaints',
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

    test('appendComplaintPhotos posts photos array to complaint photos endpoint', () async {
      dioAdapter.onPost(
        '/complaints/cmp-1/photos',
        (server) => server.reply(200, {'success': true, 'data': {'id': 'cmp-1'}}),
        data: {
          'photos': ['https://example.com/photo1.jpg'],
        },
      );

      await expectLater(
        repository.appendComplaintPhotos('cmp-1', ['https://example.com/photo1.jpg']),
        completes,
      );
    });
  });

  group('TenantRepository Leaves Lifecycle', () {
    test('myLeaves returns list of submitted leave applications', () async {
      dioAdapter.onGet(
        '/leaves/my',
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
        '/leaves/leave-1/cancel',
        (server) => server.reply(200, {'success': true, 'data': {'status': 'cancelled'}}),
        data: {},
      );

      await expectLater(repository.cancelLeave('leave-1'), completes);
    });
  });

  group('TenantRepository Payments and Invoices', () {
    test('submitUtr posts UTR reference for invoice settlement', () async {
      dioAdapter.onPost(
        '/payments/submit-utr',
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

    test('paymentReceipt queries payment receipt by id', () async {
      dioAdapter.onGet(
        '/payments/pay-100/receipt',
        (server) => server.reply(200, {
          'success': true,
          'data': {
            '_id': 'pay-100',
            'amount': 8500,
            'method': 'upi',
            'status': 'paid',
            'utrNumber': 'SBI123456789',
          },
        }),
      );

      final receipt = await repository.paymentReceipt('pay-100');
      expect(receipt, isNotNull);
      expect(receipt!['_id'], 'pay-100');
      expect(receipt['amount'], 8500);
      expect(receipt['method'], 'upi');
      expect(receipt['status'], 'paid');
    });
  });

  group('TenantRepository Electricity Readings', () {
    test('myElectricityReadings fetches and returns room readings', () async {
      dioAdapter.onGet(
        '/electricity/my',
        (server) => server.reply(200, {
          'success': true,
          'data': {
            'roomNumber': '101',
            'readings': [
              {
                'month': '2026-07',
                'previousReading': 1000,
                'currentReading': 1150,
                'unitsConsumed': 150,
                'ratePerUnit': 10,
                'roomTotalAmount': 1500,
                'occupantCount': 2,
                'tenantShare': 750,
                'status': 'finalized',
              }
            ],
          },
        }),
      );

      final data = await repository.myElectricityReadings();
      expect(data, isNotNull);
      expect(data!['roomNumber'], '101');
      final readings = data['readings'] as List;
      expect(readings.length, 1);
      expect(readings.first['tenantShare'], 750);
    });
  });

  group('TenantRepository Menus', () {
    test('weeklyMenus fetches and parses list of menu days', () async {
      dioAdapter.onGet(
        '/menus',
        (server) => server.reply(200, {
          'success': true,
          'data': [
            {
              'date': '2026-03-02',
              'dayOfWeek': 'Monday',
              'breakfast': {'items': ['Poha', 'Tea']},
              'lunch': {'items': ['Roti', 'Dal', 'Rice']},
              'dinner': {'items': ['Paneer', 'Roti']},
              'specialItem': 'Gulab Jamun',
              'isMessHoliday': false,
            }
          ],
        }),
        queryParameters: {'limit': 14},
      );

      final menus = await repository.weeklyMenus();
      expect(menus.length, 1);
      expect(menus.first['dayOfWeek'], 'Monday');
      expect(menus.first['specialItem'], 'Gulab Jamun');
    });
  });
}
