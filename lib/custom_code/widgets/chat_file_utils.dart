// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'index.dart'; // Imports other custom widgets
import '/custom_code/actions/index.dart'; // Imports custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

/// Statičke file utility metode izvučene iz GptnixSseChat.
/// Nema state ovisnosti. FF importi su uključeni radi kompatibilnosti s build sustavom.
abstract class ChatFileUtils {
  /// Normalizira ekstenziju: uklanja vodeću točku, lowercase, fallback 'bin'.
  static String normalizeExt(String ext) {
    var e = ext.trim().toLowerCase();
    if (e.startsWith('.')) e = e.substring(1);
    return e.isEmpty ? 'bin' : e;
  }

  /// Vraća true ako je ekstenzija ili ime fajla slika (png/jpg/jpeg/webp).
  static bool isImageExt(String extOrName) {
    final s = extOrName.toLowerCase();
    return s.endsWith('.png') ||
        s.endsWith('.jpg') ||
        s.endsWith('.jpeg') ||
        s.endsWith('.webp') ||
        s == 'png' ||
        s == 'jpg' ||
        s == 'jpeg' ||
        s == 'webp';
  }

  /// Vraća MIME content-type za danu ekstenziju (bez točke, lowercase).
  static String contentTypeForExt(String ext) {
    switch (ext.toLowerCase()) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'txt':
        return 'text/plain';
      case 'csv':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }
}
