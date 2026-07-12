import 'package:equatable/equatable.dart';

/// Mirrors backend User roles: admin | tenant | guardian.
/// Visitor is a portal surface (tenant-owned visitor management), not a JWT role.
enum AppRole {
  admin,
  tenant,
  guardian,
  unknown;

  static AppRole fromString(String? value) {
    switch (value) {
      case 'admin':
        return AppRole.admin;
      case 'tenant':
        return AppRole.tenant;
      case 'guardian':
        return AppRole.guardian;
      default:
        return AppRole.unknown;
    }
  }

  String get apiValue {
    switch (this) {
      case AppRole.admin:
        return 'admin';
      case AppRole.tenant:
        return 'tenant';
      case AppRole.guardian:
        return 'guardian';
      case AppRole.unknown:
        return 'unknown';
    }
  }
}

class AppUser extends Equatable {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.isActive,
    this.tenantId,
    this.guardianId,
    this.profilePhoto,
  });

  final String id;
  final String name;
  final String email;
  final String phone;
  final AppRole role;
  final bool isActive;
  final String? tenantId;
  final String? guardianId;
  final String? profilePhoto;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final rawId = json['id'] ?? json['_id'];
    return AppUser(
      id: rawId?.toString() ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      role: AppRole.fromString(json['role'] as String?),
      isActive: json['isActive'] as bool? ?? true,
      tenantId: json['tenantId']?.toString(),
      guardianId: json['guardianId']?.toString(),
      profilePhoto: json['profilePhoto'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'role': role.apiValue,
        'isActive': isActive,
        if (tenantId != null) 'tenantId': tenantId,
        if (guardianId != null) 'guardianId': guardianId,
        if (profilePhoto != null) 'profilePhoto': profilePhoto,
      };

  @override
  List<Object?> get props => [id, email, role, tenantId, guardianId];
}

class AuthTokens extends Equatable {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
  });

  final String accessToken;
  final String refreshToken;

  factory AuthTokens.fromJson(Map<String, dynamic> json) {
    return AuthTokens(
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
    );
  }

  @override
  List<Object?> get props => [accessToken, refreshToken];
}

class AuthSession extends Equatable {
  const AuthSession({
    required this.user,
    required this.tokens,
  });

  final AppUser user;
  final AuthTokens tokens;

  @override
  List<Object?> get props => [user, tokens];
}
