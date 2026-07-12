import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user.dart';

/// Persists auth tokens + cached user.
/// Uses secure storage on mobile; SharedPreferences on web.
class TokenStorage {
  TokenStorage();

  static const _kAccess = 'tenet_access_token';
  static const _kRefresh = 'tenet_refresh_token';
  static const _kUser = 'tenet_user_json';

  final FlutterSecureStorage _secure = const FlutterSecureStorage();

  Future<void> saveSession(AuthSession session) async {
    await _write(_kAccess, session.tokens.accessToken);
    await _write(_kRefresh, session.tokens.refreshToken);
    await _write(_kUser, jsonEncode(session.user.toJson()));
  }

  Future<void> saveTokens(AuthTokens tokens) async {
    await _write(_kAccess, tokens.accessToken);
    await _write(_kRefresh, tokens.refreshToken);
  }

  Future<String?> readAccessToken() => _read(_kAccess);

  Future<String?> readRefreshToken() => _read(_kRefresh);

  Future<AppUser?> readUser() async {
    final raw = await _read(_kUser);
    if (raw == null || raw.isEmpty) return null;
    try {
      return AppUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kAccess);
      await prefs.remove(_kRefresh);
      await prefs.remove(_kUser);
    } else {
      await _secure.delete(key: _kAccess);
      await _secure.delete(key: _kRefresh);
      await _secure.delete(key: _kUser);
    }
  }

  Future<void> _write(String key, String value) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    } else {
      await _secure.write(key: key, value: value);
    }
  }

  Future<String?> _read(String key) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(key);
    }
    return _secure.read(key: key);
  }
}
