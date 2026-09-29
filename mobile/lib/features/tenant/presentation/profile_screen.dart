import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_exception.dart';
import '../../auth/providers/auth_provider.dart';
import '../../shared/widgets/portal_widgets.dart';
import 'home_screen.dart';

enum _DocSource { gallery, camera, pdfFile }

class _IdConfigResult {
  final String docType;
  final String? maskedId;
  final bool consent;

  const _IdConfigResult({
    required this.docType,
    this.maskedId,
    required this.consent,
  });
}

class TenantProfileScreen extends ConsumerStatefulWidget {
  const TenantProfileScreen({super.key});

  @override
  ConsumerState<TenantProfileScreen> createState() =>
      _TenantProfileScreenState();
}

class _TenantProfileScreenState extends ConsumerState<TenantProfileScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  String? _error;

  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  final _passwordFormKey = GlobalKey<FormState>();
  bool _changingPassword = false;
  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  String? _passwordError;

  final ImagePicker _picker = ImagePicker();
  String? _uploadingDoc; // 'aadhaar' | 'photo' while an upload is in flight

  @override
  void initState() {
    super.initState();
    Future.microtask(_load);
  }

  @override
  void dispose() {
    _currentPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final tenantId = await ref.read(authProvider.notifier).ensureTenantId();
    if (tenantId == null || tenantId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _error = 'Tenant profile not linked. Contact admin.';
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data =
          await ref.read(tenantRepositoryProvider).tenantProfile(tenantId);
      if (!mounted) return;
      setState(() {
        _profile = data;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  // ── Self-service saves ───────────────────────────────────

  Future<void> _savePhone(String phone) async {
    try {
      final updated = await ref
          .read(tenantRepositoryProvider)
          .updateMyProfile(phone: phone);
      if (!mounted) return;
      setState(() => _profile = updated ?? _profile);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mobile number updated')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _saveEmergency({
    required String name,
    required String phone,
    required String relation,
  }) async {
    try {
      final updated = await ref
          .read(tenantRepositoryProvider)
          .updateMyProfile(
            emergencyContact: {
              'name': name,
              'phone': phone,
              'relation': relation,
            },
          );
      if (!mounted) return;
      setState(() => _profile = updated ?? _profile);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Emergency contact updated')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showPhoneEditor(String currentPhone) {
    showModalBottomSheet<Object?>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PhoneSheet(currentPhone: currentPhone),
    ).then((result) {
      if (result is String && result.isNotEmpty) {
        _savePhone(result);
      }
    });
  }

  void _showEmergencyEditor({
    String? name,
    String? phone,
    String? relation,
  }) {
    showModalBottomSheet<Object?>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _EmergencySheet(
        initialName: name,
        initialPhone: phone,
        initialRelation: relation,
      ),
    ).then((result) {
      if (result is Map) {
        _saveEmergency(
          name: result['name'] as String,
          phone: result['phone'] as String,
          relation: result['relation'] as String,
        );
      }
    });
  }

  Future<void> _callNumber(String phone) async {
    final uri = Uri(scheme: 'tel', path: phone);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      }
    } catch (_) {
      // Silent: tel links unsupported on this platform (e.g. desktop web).
    }
  }

  // ── KYC document upload ──────────────────────────────────

  Future<_IdConfigResult?> _chooseIdDetails(String currentDocType) async {
    String selectedType = currentDocType == 'photo' ? 'aadhaar' : currentDocType;
    final idController = TextEditingController();
    bool consent = true;

    return showModalBottomSheet<_IdConfigResult>(
      context: context,
      isScrollControlled: true,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Government Photo ID',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(sheetCtx),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
                ),
                child: const Text(
                  'UIDAI Advisory: Please upload a Masked Aadhaar (first 8 digits hidden, only last 4 visible: XXXX-XXXX-1234) or other Officially Valid Documents (Passport, Voter ID, Driving License).',
                  style: TextStyle(fontSize: 12, color: Colors.brown),
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Document Type',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: selectedType,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: const [
                  DropdownMenuItem(
                    value: 'aadhaar',
                    child: Text('Masked Aadhaar Card'),
                  ),
                  DropdownMenuItem(
                    value: 'passport',
                    child: Text('Passport'),
                  ),
                  DropdownMenuItem(
                    value: 'voter_id',
                    child: Text('Voter ID (EPIC)'),
                  ),
                  DropdownMenuItem(
                    value: 'driving_license',
                    child: Text('Driving License'),
                  ),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setModalState(() => selectedType = val);
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: idController,
                decoration: InputDecoration(
                  labelText: selectedType == 'aadhaar'
                      ? 'Masked Aadhaar Number (XXXX-XXXX-1234)'
                      : 'Document / Registration Number',
                  hintText: selectedType == 'aadhaar'
                      ? 'XXXX-XXXX-1234'
                      : 'Enter ID number',
                  border: const OutlineInputBorder(),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Checkbox(
                    value: consent,
                    onChanged: (val) {
                      setModalState(() => consent = val ?? true);
                    },
                  ),
                  const Expanded(
                    child: Text(
                      'I give statutory consent to store this document for police tenant verification under Section 223 BNS.',
                      style: TextStyle(fontSize: 11),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(
                      sheetCtx,
                      _IdConfigResult(
                        docType: selectedType,
                        maskedId: idController.text.trim().isNotEmpty
                            ? idController.text.trim()
                            : null,
                        consent: consent,
                      ),
                    );
                  },
                  child: const Text('Continue to Select File'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<_DocSource?> _chooseSource({required bool allowPdf}) async {
    return showModalBottomSheet<_DocSource>(
      context: context,
      builder: (sheetCtx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(sheetCtx, _DocSource.gallery),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(sheetCtx, _DocSource.camera),
            ),
            if (allowPdf)
              ListTile(
                leading: const Icon(Icons.picture_as_pdf_outlined),
                title: const Text('Upload PDF file'),
                onTap: () => Navigator.pop(sheetCtx, _DocSource.pdfFile),
              ),
          ],
        ),
      ),
    );
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : null,
      ),
    );
  }

  Future<void> _uploadDocument(String docType) async {
    String finalDocType = docType;
    String? maskedId;
    bool consent = true;

    if (docType != 'photo') {
      final config = await _chooseIdDetails(docType);
      if (config == null || !mounted) return;
      finalDocType = config.docType;
      maskedId = config.maskedId;
      consent = config.consent;
    }

    final allowPdf = finalDocType != 'photo';
    final source = await _chooseSource(allowPdf: allowPdf);
    if (source == null || !mounted) return;

    String? filePath;
    try {
      if (source == _DocSource.pdfFile) {
        final result = await FilePicker.pickFile(
          type: FileType.custom,
          allowedExtensions: const ['pdf'],
        );
        filePath = result?.path;
      } else {
        final picked = await _picker.pickImage(
          source: source == _DocSource.camera
              ? ImageSource.camera
              : ImageSource.gallery,
          imageQuality: 80,
          maxWidth: 2048,
        );
        filePath = picked?.path;
      }
    } catch (_) {
      _showSnack('Could not access the camera, gallery, or files.',
          isError: true);
      return;
    }
    if (filePath == null || !mounted) return;

    try {
      if (File(filePath).lengthSync() > 5 * 1024 * 1024) {
        _showSnack('File is too large. Maximum size is 5 MB.', isError: true);
        return;
      }
    } catch (_) {
      _showSnack('Could not read the selected file.', isError: true);
      return;
    }

    setState(() => _uploadingDoc = finalDocType);
    try {
      final url = await ref
          .read(tenantRepositoryProvider)
          .uploadKycDocument(
            filePath,
            finalDocType,
            idNumberMasked: maskedId,
            consentGiven: consent,
          );
      if (!mounted) return;
      setState(() {
        _uploadingDoc = null;
        if (_profile != null && url != null) {
          final docs = Map<String, dynamic>.from(
              (_profile!['documents'] as Map?) ?? const {});
          if (finalDocType == 'photo') {
            docs['photoUrl'] = url;
          } else {
            docs['idUrl'] = url;
            docs['idType'] = finalDocType;
            if (maskedId != null && maskedId.isNotEmpty) {
              docs['idNumberMasked'] = maskedId;
            }
            if (finalDocType == 'aadhaar') {
              docs['aadhaarUrl'] = url;
            }
          }
          // Fresh upload requires admin re-verification.
          docs['isVerified'] = false;
          _profile = {..._profile!, 'documents': docs};
        }
      });
      _showSnack(
        url != null
            ? 'Uploaded. Pending verification by the PG office.'
            : 'Upload completed.',
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _uploadingDoc = null);
      _showSnack(e.message, isError: true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploadingDoc = null);
      _showSnack(
        e.toString().replaceFirst('Exception: ', ''),
        isError: true,
      );
    }
  }

  Future<void> _changePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    setState(() {
      _changingPassword = true;
      _passwordError = null;
    });
    try {
      await ref.read(authRepositoryProvider).changePassword(
            currentPassword: _currentPassword.text,
            newPassword: _newPassword.text,
          );
      if (!mounted) return;
      _currentPassword.clear();
      _newPassword.clear();
      _confirmPassword.clear();
      // Server revokes all sessions after password change.
      await ref.read(authProvider.notifier).logout();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Password changed. Please sign in again with your new password.',
          ),
        ),
      );
      context.go('/login');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _changingPassword = false;
        _passwordError = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _changingPassword = false;
        _passwordError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Profile')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const SkeletonList(cardCount: 4, height: 110)
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) ...[
                    ErrorBanner(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  if (_profile != null)
                    _buildProfileContent(context, _profile!),
                  const SizedBox(height: 16),
                  _buildChangePasswordSection(context),
                ],
              ),
      ),
    );
  }

  Widget _buildChangePasswordSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _sectionTitle(context, 'Change password'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _passwordFormKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_passwordError != null) ...[
                    ErrorBanner(message: _passwordError!),
                    const SizedBox(height: 12),
                  ],
                  TextFormField(
                    controller: _currentPassword,
                    obscureText: _obscureCurrent,
                    decoration: InputDecoration(
                      labelText: 'Current password',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        tooltip:
                            _obscureCurrent ? 'Show password' : 'Hide password',
                        onPressed: () => setState(
                          () => _obscureCurrent = !_obscureCurrent,
                        ),
                        icon: Icon(
                          _obscureCurrent
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) {
                        return 'Current password is required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _newPassword,
                    obscureText: _obscureNew,
                    decoration: InputDecoration(
                      labelText: 'New password',
                      prefixIcon: const Icon(Icons.lock_reset_outlined),
                      suffixIcon: IconButton(
                        tooltip:
                            _obscureNew ? 'Show password' : 'Hide password',
                        onPressed: () => setState(
                          () => _obscureNew = !_obscureNew,
                        ),
                        icon: Icon(
                          _obscureNew
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.length < 8) {
                        return 'New password must be at least 8 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _confirmPassword,
                    obscureText: _obscureConfirm,
                    decoration: InputDecoration(
                      labelText: 'Confirm new password',
                      prefixIcon: const Icon(Icons.lock_reset_outlined),
                      suffixIcon: IconButton(
                        tooltip:
                            _obscureConfirm ? 'Show password' : 'Hide password',
                        onPressed: () => setState(
                          () => _obscureConfirm = !_obscureConfirm,
                        ),
                        icon: Icon(
                          _obscureConfirm
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                    validator: (v) {
                      if (v != _newPassword.text) {
                        return 'Passwords do not match';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _changingPassword ? null : _changePassword,
                    child: _changingPassword
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Update password'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileContent(BuildContext context, Map<String, dynamic> p) {
    final user = p['user'] as Map?;
    final room = p['room'] as Map?;
    final floor = room?['floor'] as Map?;
    final emergency = p['emergencyContact'] as Map?;
    final docs = p['documents'] as Map?;
    final cs = Theme.of(context).colorScheme;

    final name = user?['name']?.toString() ?? 'Resident';
    final phone = user?['phone']?.toString() ?? '';
    final email = user?['email']?.toString() ?? '';
    final photoUrl = docs?['photoUrl']?.toString();
    final hasEmergency =
        (emergency?['name']?.toString() ?? '').isNotEmpty ||
            (emergency?['phone']?.toString() ?? '').isNotEmpty;
    final emergencyPhone = emergency?['phone']?.toString() ?? '';

    final docType = docs?['idType']?.toString() ?? 'aadhaar';
    final idOnFile = docs?['idUrl'] != null || docs?['aadhaarUrl'] != null;
    final photoOnFile = docs?['photoUrl'] != null;
    final kycVerified = docs?['isVerified'] == true;
    final maskedId = docs?['idNumberMasked']?.toString();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Hero header ────────────────────────────────────
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: cs.primary.withValues(alpha: 0.12),
                  backgroundImage:
                      photoUrl != null && photoUrl.isNotEmpty
                          ? NetworkImage(photoUrl)
                          : null,
                  onBackgroundImageError: photoUrl != null && photoUrl.isNotEmpty
                      ? (_, __) {}
                      : null,
                  child: photoUrl == null || photoUrl.isEmpty
                      ? Text(
                          name.isNotEmpty ? name[0].toUpperCase() : 'R',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: cs.primary,
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        room != null
                            ? 'Room ${room['roomNumber'] ?? '--'} · Bed ${p['bedId'] ?? '--'}'
                            : 'Room not assigned',
                        style: TextStyle(
                          fontSize: 13,
                          color: cs.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      StatusChip(
                        label: p['isActive'] == true ? 'Active' : 'Inactive',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // ── Contact ────────────────────────────────────────
        _sectionTitle(context, 'Contact information'),
        Card(
          child: Column(
            children: [
              ListTile(
                dense: true,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16),
                leading: const Icon(Icons.alternate_email_outlined, size: 20),
                title: _label(context, 'Email'),
                subtitle: Text(
                  email.isEmpty ? '--' : email,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              ListTile(
                dense: true,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16),
                leading: const Icon(Icons.phone_outlined, size: 20),
                title: _label(context, 'Mobile number'),
                subtitle: Text(
                  phone.isEmpty ? '--' : phone,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                trailing: IconButton(
                  tooltip: 'Edit mobile number',
                  icon: const Icon(Icons.edit_outlined, size: 20),
                  onPressed: () => _showPhoneEditor(phone),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Text(
            'Name and email can only be changed by the PG admin.',
            style: TextStyle(
              fontSize: 12,
              color: cs.onSurfaceVariant,
            ),
          ),
        ),
        const SizedBox(height: 16),

        // ── Room & Rent ────────────────────────────────────
        _sectionTitle(context, 'Room & Rent'),
        Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _infoRow(context, 'Room',
                  room?['roomNumber']?.toString() ?? '--'),
              if (floor != null && floor['label'] != null)
                _infoRow(context, 'Floor', floor['label'].toString()),
              _infoRow(context, 'Bed', p['bedId']?.toString() ?? '--'),
              _infoRow(context, 'Monthly rent',
                  formatMoney(p['monthlyRent'] as num?)),
              _infoRow(context, 'Deposit paid',
                  formatMoney(p['depositPaid'] as num?)),
              _infoRow(context, 'Move-in date', formatDate(p['moveInDate'])),
              if (p['moveOutDate'] != null)
                _infoRow(context, 'Move-out date',
                    formatDate(p['moveOutDate'])),
              if (room != null) ...[
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  child: OutlinedButton.icon(
                    onPressed: () => context.go('/tenant/room'),
                    icon: const Icon(Icons.meeting_room_outlined, size: 18),
                    label: const Text('View Room & Roommates Hub'),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── Emergency contact ──────────────────────────────
        _sectionTitle(context, 'Emergency contact'),
        Card(
          child: Column(
            children: [
              if (!hasEmergency)
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(
                        'No emergency contact added yet. Add a family member or guardian the PG can reach.',
                        style: TextStyle(
                          fontSize: 13,
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: () =>
                            _showEmergencyEditor(name: '', phone: ''),
                        icon: const Icon(Icons.person_add_alt_outlined,
                            size: 18),
                        label: const Text('Add contact'),
                      ),
                    ],
                  ),
                )
              else ...[
                ListTile(
                  dense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16),
                  leading:
                      const Icon(Icons.emergency_outlined, size: 20),
                  title: _label(context, 'Name'),
                  subtitle: Text(
                    emergency?['name']?.toString() ?? '--',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  dense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16),
                  leading: const Icon(Icons.phone_callback_outlined,
                      size: 20),
                  title: _label(context, 'Phone'),
                  subtitle: Text(
                    emergencyPhone,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: 'Call',
                        icon: const Icon(Icons.call_outlined, size: 20),
                        onPressed: emergencyPhone.isNotEmpty
                            ? () => _callNumber(emergencyPhone)
                            : null,
                      ),
                      IconButton(
                        tooltip: 'Edit contact',
                        icon:
                            const Icon(Icons.edit_outlined, size: 20),
                        onPressed: () => _showEmergencyEditor(
                          name: emergency?['name']?.toString() ?? '',
                          phone: emergencyPhone,
                          relation:
                              emergency?['relation']?.toString() ?? '',
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  dense: true,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16),
                  leading: const Icon(Icons.family_restroom_outlined,
                      size: 20),
                  title: _label(context, 'Relation'),
                  trailing: Text(
                    (emergency?['relation']?.toString() ?? '--')
                        .replaceAll('_', ' '),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // ── KYC & verification ─────────────────────────────
        _sectionTitle(context, 'KYC & Verification'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Document Status',
                      style: TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15),
                    ),
                    StatusChip(
                      label: kycVerified
                          ? 'Verified'
                          : (idOnFile || photoOnFile)
                              ? 'Pending review'
                              : 'Missing',
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _uploadableDocument(
                  context,
                  docType: docType,
                  title: docType == 'passport'
                      ? 'Passport'
                      : docType == 'voter_id'
                          ? 'Voter ID (EPIC)'
                          : docType == 'driving_license'
                              ? 'Driving License'
                              : 'Masked Aadhaar Card',
                  subtitle: idOnFile
                      ? (maskedId != null && maskedId.isNotEmpty
                          ? 'ID on file: $maskedId (Tap to replace)'
                          : 'Tap the pencil to replace your document')
                      : 'Upload officially valid photo ID (Masked Aadhaar, Passport, Voter ID, DL)',
                  isUploaded: idOnFile,
                  icon: Icons.badge_outlined,
                ),
                const Divider(height: 20),
                _uploadableDocument(
                  context,
                  docType: 'photo',
                  title: 'Passport Size Photo',
                  subtitle: photoOnFile
                      ? 'Tap the pencil to replace your photo'
                      : 'Upload a recent photograph (JPEG or PNG, max 5 MB)',
                  isUploaded: photoOnFile,
                  icon: Icons.account_box_outlined,
                ),
                const Divider(height: 20),
                Text(
                  'Uploads are reviewed by the PG admin. Replacing a document '
                  'resets verification until the office re-checks it.',
                  style: TextStyle(
                    fontSize: 12,
                    color: cs.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: cs.surfaceContainerHighest.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: cs.outlineVariant.withValues(alpha: 0.5),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.gavel_outlined, size: 18, color: cs.primary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Indian Legal Compliance: Tenant verification is required under Section 223 of Bharatiya Nyaya Sanhita, 2023. Documents are securely stored with private authenticated access.',
                          style: TextStyle(
                            fontSize: 11,
                            color: cs.onSurfaceVariant,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _uploadableDocument(
    BuildContext context, {
    required String docType,
    required String title,
    required String subtitle,
    required bool isUploaded,
    required IconData icon,
  }) {
    final isUploading = _uploadingDoc == docType;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Theme.of(context)
                .colorScheme
                .surfaceContainerHighest
                .withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: isUploading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Icon(icon,
                  size: 20, color: Theme.of(context).colorScheme.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        StatusChip(label: isUploaded ? 'On file' : 'Missing'),
        const SizedBox(width: 4),
        IconButton(
          tooltip: isUploaded ? 'Replace $title' : 'Upload $title',
          icon: Icon(
            isUploaded ? Icons.edit_outlined : Icons.upload_outlined,
            size: 20,
          ),
          onPressed: isUploading ? null : () => _uploadDocument(docType),
        ),
      ],
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title,
        style: Theme.of(context)
            .textTheme
            .titleMedium
            ?.copyWith(fontWeight: FontWeight.w800),
      ),
    );
  }

  Widget _label(BuildContext context, String label) {
    return Text(
      label,
      style: TextStyle(
        fontSize: 12,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }

  Widget _infoRow(BuildContext context, String label, String value) {
    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
      title: Text(
        label,
        style: TextStyle(
          fontSize: 13,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
      trailing: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }
}

// ═══════════════════════════════════════════════════════════
// Bottom sheets for self-service edits
// ═══════════════════════════════════════════════════════════

class _SheetScaffold extends StatelessWidget {
  const _SheetScaffold({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                color: Theme.of(context)
                    .colorScheme
                    .outlineVariant,
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          Text(
            title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _PhoneSheet extends StatefulWidget {
  const _PhoneSheet({required this.currentPhone});

  final String currentPhone;

  @override
  State<_PhoneSheet> createState() => _PhoneSheetState();
}

class _PhoneSheetState extends State<_PhoneSheet> {
  late final TextEditingController _controller;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    final digits = widget.currentPhone.replaceAll(RegExp(r'[^0-9]'), '');
    final ten = digits.length >= 10 ? digits.substring(digits.length - 10) : '';
    _controller = TextEditingController(text: ten);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final digits = _controller.text.replaceAll(RegExp(r'[^0-9]'), '');
    Navigator.of(context).pop('+91$digits');
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Edit mobile number',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _controller,
              keyboardType: TextInputType.phone,
              autofocus: true,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              decoration: const InputDecoration(
                labelText: 'Mobile number (10 digits)',
                prefixText: '+91 ',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
              validator: (v) {
                final digits = (v ?? '').replaceAll(RegExp(r'[^0-9]'), '');
                if (digits.length != 10) {
                  return 'Enter a 10-digit mobile number';
                }
                if (!RegExp(r'^[6-9]').hasMatch(digits)) {
                  return 'Indian mobile numbers start with 6-9';
                }
                return null;
              },
              onFieldSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _submit,
              child: const Text('Save number'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmergencySheet extends StatefulWidget {
  const _EmergencySheet({
    this.initialName,
    this.initialPhone,
    this.initialRelation,
  });

  final String? initialName;
  final String? initialPhone;
  final String? initialRelation;

  @override
  State<_EmergencySheet> createState() => _EmergencySheetState();
}

class _EmergencySheetState extends State<_EmergencySheet> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late String _relation;
  final _formKey = GlobalKey<FormState>();

  static const List<(String, String)> _relations = [
    ('father', 'Father'),
    ('mother', 'Mother'),
    ('guardian', 'Guardian'),
    ('relative', 'Relative'),
    ('friend', 'Friend'),
  ];

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.initialName ?? '');
    final digits =
        (widget.initialPhone ?? '').replaceAll(RegExp(r'[^0-9]'), '');
    final ten = digits.length >= 10 ? digits.substring(digits.length - 10) : '';
    _phoneController = TextEditingController(text: ten);
    _relation = widget.initialRelation ?? 'father';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final digits = _phoneController.text.replaceAll(RegExp(r'[^0-9]'), '');
    Navigator.of(context).pop(<String, String>{
      'name': _nameController.text.trim(),
      'phone': '+91$digits',
      'relation': _relation,
    });
  }

  @override
  Widget build(BuildContext context) {
    return _SheetScaffold(
      title: 'Emergency contact',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _nameController,
              autofocus: true,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(
                labelText: 'Full name',
                prefixIcon: Icon(Icons.person_outline),
              ),
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Name is required';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              decoration: const InputDecoration(
                labelText: 'Mobile number (10 digits)',
                prefixText: '+91 ',
                prefixIcon: Icon(Icons.phone_outlined),
              ),
              validator: (v) {
                final digits = (v ?? '').replaceAll(RegExp(r'[^0-9]'), '');
                if (digits.length != 10) {
                  return 'Enter a 10-digit mobile number';
                }
                if (!RegExp(r'^[6-9]').hasMatch(digits)) {
                  return 'Indian mobile numbers start with 6-9';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _relation,
              decoration: const InputDecoration(
                labelText: 'Relation',
                prefixIcon: Icon(Icons.family_restroom_outlined),
              ),
              items: _relations
                  .map(
                    (r) => DropdownMenuItem<String>(
                      value: r.$1,
                      child: Text(r.$2),
                    ),
                  )
                  .toList(),
              onChanged: (v) {
                if (v != null) setState(() => _relation = v);
              },
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _submit,
              child: const Text('Save contact'),
            ),
          ],
        ),
      ),
    );
  }
}
