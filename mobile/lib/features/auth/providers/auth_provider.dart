import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/user.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/storage/token_storage.dart';
import '../data/auth_repository.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  return ApiClient(
    storage: storage,
    onRefresh: () async {
      final refresh = await storage.readRefreshToken();
      if (refresh == null || refresh.isEmpty) return null;
      // Lightweight refresh without circular repository dependency
      final client = DioRefreshHelper(storage);
      return client.refresh(refresh);
    },
  );
});

/// Small helper to avoid circular provider deps on refresh.
class DioRefreshHelper {
  DioRefreshHelper(this.storage);
  final TokenStorage storage;

  Future<String?> refresh(String refreshToken) async {
    try {
      final temp = ApiClient(storage: storage);
      final data = await temp.postJson<Map<String, dynamic>>(
        'auth/refresh',
        body: {'refreshToken': refreshToken},
        parse: (d) => Map<String, dynamic>.from(d as Map),
      );
      final access = data['accessToken'] as String? ?? '';
      final nextRefresh = data['refreshToken'] as String? ?? refreshToken;
      await storage.saveTokens(
        AuthTokens(accessToken: access, refreshToken: nextRefresh),
      );
      return access.isEmpty ? null : access;
    } catch (_) {
      return null;
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    api: ref.watch(apiClientProvider),
    storage: ref.watch(tokenStorageProvider),
  );
});

class AuthState {
  const AuthState({
    this.user,
    this.isLoading = true,
    this.error,
  });

  final AppUser? user;
  final bool isLoading;
  final String? error;

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    AppUser? user,
    bool? isLoading,
    String? error,
    bool clearUser = false,
    bool clearError = false,
  }) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._repo) : super(const AuthState()) {
    restore();
  }

  final AuthRepository _repo;

  Future<void> restore() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final session = await _repo.restoreSession();
      if (session == null) {
        state = const AuthState(isLoading: false);
        return;
      }
      try {
        final user = await _repo.me();
        state = AuthState(user: user, isLoading: false);
      } catch (_) {
        await _repo.logout();
        state = const AuthState(isLoading: false);
      }
    } catch (_) {
      state = const AuthState(isLoading: false);
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final session = await _repo.login(email: email, password: password);
      state = AuthState(user: session.user, isLoading: false);
    } on ApiException catch (e) {
      state = AuthState(isLoading: false, error: e.message);
      rethrow;
    } catch (e) {
      final msg = e.toString().replaceFirst('Exception: ', '');
      state = AuthState(isLoading: false, error: msg);
      rethrow;
    }
  }

  /// Refresh the current user from /auth/me.
  /// Used to self-heal stale user data (e.g. missing tenantId).
  Future<void> refreshUser() async {
    try {
      final user = await _repo.me();
      if (!mounted) return;
      state = state.copyWith(user: user, isLoading: false, clearError: true);
    } catch (_) {
      // Keep existing state on refresh failure
    }
  }

  /// Return linked tenantId, refreshing /auth/me once if missing (legacy JWT).
  Future<String?> ensureTenantId() async {
    final current = state.user?.tenantId;
    if (current != null && current.isNotEmpty) return current;
    await refreshUser();
    final healed = state.user?.tenantId;
    if (healed != null && healed.isNotEmpty) return healed;
    return null;
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AuthState(isLoading: false);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(authRepositoryProvider));
});
