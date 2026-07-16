class ApiException implements Exception {
  ApiException({
    required this.message,
    this.code,
    this.statusCode,
  });

  final String message;
  final String? code;
  final int? statusCode;

  /// True when API returned feature-flag gate (403 FEATURE_DISABLED only).
  /// Do not treat generic ownership/role 403 as feature-off.
  bool get isFeatureDisabled => code == 'FEATURE_DISABLED';

  @override
  String toString() => message;
}
