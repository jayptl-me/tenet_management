/// Runtime configuration for the Tenet PG portal (mobile + Flutter web).
///
/// Override at run time:
///   flutter run --dart-define=API_BASE_URL=https://api.example.com/api/v1
class Env {
  Env._();

  /// Backend API prefix (Hono mounts routes under /api/v1).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:8000/api/v1',
  );

  static const String appName = 'Tenet PG Portal';
}
