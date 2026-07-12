import '../../../core/models/user.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_storage.dart';

class AuthRepository {
  AuthRepository({
    required ApiClient api,
    required TokenStorage storage,
  })  : _api = api,
        _storage = storage;

  final ApiClient _api;
  final TokenStorage _storage;

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final data = await _api.postJson<Map<String, dynamic>>(
      'auth/login',
      body: {'email': email.trim().toLowerCase(), 'password': password},
      parse: (d) => Map<String, dynamic>.from(d as Map),
    );

    final user = AppUser.fromJson(Map<String, dynamic>.from(data['user'] as Map));
    final tokens = AuthTokens(
      accessToken: data['accessToken'] as String? ?? '',
      refreshToken: data['refreshToken'] as String? ?? '',
    );

    if (user.role == AppRole.admin) {
      throw Exception(
        'Admin accounts use the web admin panel, not this portal.',
      );
    }
    if (user.role != AppRole.tenant && user.role != AppRole.guardian) {
      throw Exception('Unsupported account role for this portal.');
    }

    final session = AuthSession(user: user, tokens: tokens);
    await _storage.saveSession(session);
    return session;
  }

  Future<AppUser> me() async {
    final data = await _api.getJson<Map<String, dynamic>>(
      'auth/me',
      parse: (d) => Map<String, dynamic>.from(d as Map),
    );
    final user = AppUser.fromJson(data);
    final access = await _storage.readAccessToken();
    final refresh = await _storage.readRefreshToken();
    if (access != null && refresh != null) {
      await _storage.saveSession(
        AuthSession(
          user: user,
          tokens: AuthTokens(accessToken: access, refreshToken: refresh),
        ),
      );
    }
    return user;
  }

  Future<String?> refreshAccessToken() async {
    final refresh = await _storage.readRefreshToken();
    if (refresh == null || refresh.isEmpty) return null;
    final data = await _api.postJson<Map<String, dynamic>>(
      'auth/refresh',
      body: {'refreshToken': refresh},
      parse: (d) => Map<String, dynamic>.from(d as Map),
    );
    final tokens = AuthTokens(
      accessToken: data['accessToken'] as String? ?? '',
      refreshToken: data['refreshToken'] as String? ?? refresh,
    );
    await _storage.saveTokens(tokens);
    return tokens.accessToken;
  }

  Future<void> logout() async {
    try {
      await _api.postJson('auth/logout', body: {}, parse: (_) => null);
    } catch (_) {
      // best-effort
    }
    await _storage.clear();
  }

  Future<AuthSession?> restoreSession() async {
    final access = await _storage.readAccessToken();
    final refresh = await _storage.readRefreshToken();
    final user = await _storage.readUser();
    if (access == null || access.isEmpty || user == null) return null;
    return AuthSession(
      user: user,
      tokens: AuthTokens(
        accessToken: access,
        refreshToken: refresh ?? '',
      ),
    );
  }
}
