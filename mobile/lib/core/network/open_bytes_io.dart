import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

Future<String> saveAndOpenBytesIo({
  required List<int> bytes,
  required String fileName,
}) async {
  final dir = await getTemporaryDirectory();
  final path = '${dir.path}/$fileName';
  final file = File(path);
  await file.writeAsBytes(bytes, flush: true);
  final uri = Uri.file(path);
  await launchUrl(uri, mode: LaunchMode.externalApplication);
  return path;
}
