/// Stub for non-web platforms (conditional import counterpart of open_bytes_web).
void openBytesOnWeb({
  required List<int> bytes,
  required String fileName,
  String mimeType = 'application/pdf',
}) {
  throw UnsupportedError('openBytesOnWeb is only available on Flutter web');
}
