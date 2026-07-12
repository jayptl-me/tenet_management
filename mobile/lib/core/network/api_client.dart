import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/env.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';

typedef TokenRefresher = Future<String?> Function();

class ApiClient {
  ApiClient({
    required TokenStorage storage,
    TokenRefresher? onRefresh,
  }) : _storage = storage {
    _dio = Dio(
      BaseOptions(
        baseUrl: Env.apiBaseUrl,
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.readAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401 && onRefresh != null) {
            try {
              final newToken = await onRefresh();
              if (newToken != null && newToken.isNotEmpty) {
                final req = error.requestOptions;
                req.headers['Authorization'] = 'Bearer $newToken';
                final clone = await _dio.fetch(req);
                return handler.resolve(clone);
              }
            } catch (_) {
              // fall through
            }
          }
          handler.next(error);
        },
      ),
    );

    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(requestBody: true, responseBody: false, error: true),
      );
    }
  }

  late final Dio _dio;
  final TokenStorage _storage;

  Dio get dio => _dio;

  Future<T> getJson<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic data) parse,
  }) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      return parse(_unwrap(res.data));
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<T> postJson<T>(
    String path, {
    Object? body,
    required T Function(dynamic data) parse,
  }) async {
    try {
      final res = await _dio.post(path, data: body);
      return parse(_unwrap(res.data));
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<T> putJson<T>(
    String path, {
    Object? body,
    required T Function(dynamic data) parse,
  }) async {
    try {
      final res = await _dio.put(path, data: body);
      return parse(_unwrap(res.data));
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<T> patchJson<T>(
    String path, {
    Object? body,
    required T Function(dynamic data) parse,
  }) async {
    try {
      final res = await _dio.patch(path, data: body);
      return parse(_unwrap(res.data));
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> delete(String path) async {
    try {
      await _dio.delete(path);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  dynamic _unwrap(dynamic body) {
    if (body is Map<String, dynamic>) {
      if (body['success'] == false) {
        final err = body['error'];
        if (err is Map) {
          throw ApiException(
            message: err['message']?.toString() ?? 'Request failed',
            code: err['code']?.toString(),
          );
        }
        throw ApiException(message: 'Request failed');
      }
      return body.containsKey('data') ? body['data'] : body;
    }
    return body;
  }

  ApiException _mapError(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      return ApiException(
        message: err['message']?.toString() ?? e.message ?? 'Network error',
        code: err['code']?.toString(),
        statusCode: e.response?.statusCode,
      );
    }
    return ApiException(
      message: e.message ?? 'Network error',
      statusCode: e.response?.statusCode,
    );
  }
}
