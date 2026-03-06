// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'index.dart'; // Imports other custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom action code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:gal/gal.dart';

Future<void> gptnixSaveImageToGallery(String url) async {
  if (kIsWeb) return;

  final u = url.trim();
  if (u.isEmpty) return;

  // 1) permissions
  final hasAccess = await Gal.hasAccess();
  if (!hasAccess) {
    await Gal.requestAccess();
  }

  // 2) download image
  final res = await http.get(Uri.parse(u));
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw Exception('Download failed (${res.statusCode})');
  }

  // 3) write to temp file
  final ext = _extFromUrl(u);
  final path =
      '${Directory.systemTemp.path}/gptnix_${DateTime.now().millisecondsSinceEpoch}.$ext';
  final f = File(path);
  await f.writeAsBytes(res.bodyBytes, flush: true);

  // 4) save to gallery
  await Gal.putImage(f.path);
}

String _extFromUrl(String url) {
  final clean = url.split('?').first.toLowerCase();
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.jpeg')) return 'jpeg';
  if (clean.endsWith('.jpg')) return 'jpg';
  if (clean.endsWith('.heic')) return 'heic';
  return 'jpg';
}
