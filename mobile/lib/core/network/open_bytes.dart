import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

import 'open_bytes_io.dart' if (dart.library.html) 'open_bytes_io_stub.dart';

/// Save [bytes] under [fileName] and open/download where the platform allows.
///
/// - Web: not supported here (call site should use openBytesOnWeb).
/// - iOS/Android/desktop: write temp file and launch with url_launcher.
Future<String> openOrSaveBytes({
  required List<int> bytes,
  required String fileName,
}) async {
  if (kIsWeb) {
    throw UnsupportedError('Use openBytesOnWeb for Flutter web');
  }
  return saveAndOpenBytesIo(bytes: bytes, fileName: fileName);
}

/// Launch an external URI (UPI deep link, https, etc.).
Future<bool> launchExternalUri(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return false;
  if (await canLaunchUrl(uri)) {
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }
  return false;
}
