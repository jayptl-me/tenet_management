import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:mocktail/mocktail.dart';
import 'package:tenet_pg_portal/core/network/api_client.dart';
import 'package:tenet_pg_portal/core/storage/token_storage.dart';

class MockTokenStorage extends Mock implements TokenStorage {}

void main() {
  late MockTokenStorage mockStorage;

  setUp(() {
    mockStorage = MockTokenStorage();
  });

  test('ApiClient attaches Bearer token from TokenStorage to outgoing requests', () async {
    when(() => mockStorage.readAccessToken()).thenAnswer((_) async => 'mock_token_123');

    final client = ApiClient(storage: mockStorage);
    final dioAdapter = DioAdapter(dio: client.dio);

    dioAdapter.onGet(
      '/test',
      (server) => server.reply(200, {'success': true, 'data': 'ok'}),
      headers: {'Authorization': 'Bearer mock_token_123'},
    );

    final result = await client.getJson<String>(
      '/test',
      parse: (data) => data as String,
    );

    expect(result, 'ok');
  });

  test('ApiClient triggers token refresh on 401 and retries original request', () async {
    when(() => mockStorage.readAccessToken()).thenAnswer((_) async => 'expired_token');

    var refreshCalled = false;
    Future<String?> mockRefresh() async {
      refreshCalled = true;
      when(() => mockStorage.readAccessToken()).thenAnswer((_) async => 'new_fresh_token');
      return 'new_fresh_token';
    }

    final client = ApiClient(
      storage: mockStorage,
      onRefresh: mockRefresh,
    );

    final dioAdapter = DioAdapter(dio: client.dio);

    // Initial call fails with 401
    dioAdapter.onGet(
      '/protected',
      (server) => server.reply(401, {'success': false, 'error': {'message': 'Unauthorized'}}),
    );

    // Retry with new token succeeds with 200
    dioAdapter.onGet(
      '/protected',
      (server) => server.reply(200, {'success': true, 'data': 'refreshed_data'}),
      headers: {'Authorization': 'Bearer new_fresh_token'},
    );

    final result = await client.getJson<String>(
      '/protected',
      parse: (data) => data as String,
    );

    expect(refreshCalled, true);
    expect(result, 'refreshed_data');
  });
}
