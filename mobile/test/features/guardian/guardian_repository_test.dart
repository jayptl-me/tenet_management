import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tenet_pg_portal/core/network/api_client.dart';
import 'package:tenet_pg_portal/core/storage/token_storage.dart';
import 'package:tenet_pg_portal/features/guardian/data/guardian_repository.dart';

class MockTokenStorage extends Mock implements TokenStorage {}

void main() {
  late MockTokenStorage mockStorage;
  late ApiClient apiClient;
  late DioAdapter dioAdapter;
  late GuardianRepository repository;

  setUp(() {
    mockStorage = MockTokenStorage();
    when(() => mockStorage.readAccessToken()).thenAnswer((_) async => 'valid_guardian_token');
    apiClient = ApiClient(storage: mockStorage);
    dioAdapter = DioAdapter(dio: apiClient.dio);
    repository = GuardianRepository(apiClient);
  });

  group('GuardianRepository Ward and Attendance Flows', () {
    test('ward fetches ward details successfully', () async {
      dioAdapter.onGet(
        'guardians/me/ward',
        (server) => server.reply(200, {
          'success': true,
          'data': {
            'id': 'tenant-456',
            'name': 'Student Ward',
            'roomNumber': '102',
            'sharingType': 2,
            'bedId': 'B',
          },
        }),
      );

      final ward = await repository.ward();
      expect(ward, isNotNull);
      expect(ward!['name'], 'Student Ward');
      expect(ward['roomNumber'], '102');
    });

    test('wardAttendance fetches attendance history of ward', () async {
      dioAdapter.onGet(
        'guardians/me/ward/attendance',
        (server) => server.reply(200, {
          'success': true,
          'data': [
            {
              'id': 'att-1',
              'date': '2026-05-10',
              'status': 'present',
              'checkIn': '2026-05-10T08:30:00Z',
            },
            {
              'id': 'att-2',
              'date': '2026-05-09',
              'status': 'present',
              'checkIn': '2026-05-09T08:15:00Z',
            },
          ],
        }),
      );

      final attendance = await repository.wardAttendance();
      expect(attendance.length, 2);
      expect(attendance.first['status'], 'present');
      expect(attendance.first['date'], '2026-05-10');
    });

    test('notices fetches targeted notice feed for guardian', () async {
      dioAdapter.onGet(
        'notices',
        (server) => server.reply(200, {
          'success': true,
          'data': [
            {
              'id': 'notice-1',
              'title': 'PG Annual General Meeting',
              'content': 'Parents & guardians are invited to the meeting on Saturday',
              'priority': 'normal',
            }
          ],
        }),
      );

      final notices = await repository.notices();
      expect(notices.length, 1);
      expect(notices.first['title'], 'PG Annual General Meeting');
    });
  });
}
