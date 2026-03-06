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

import 'dart:typed_data';

class GptnixFilesPreviewGrid extends StatelessWidget {
  const GptnixFilesPreviewGrid({
    super.key,
    this.width,
    this.height,
    required this.files,
    this.exts,
    this.onRemove,
    required this.surface,
    required this.border,
    required this.subtext,
    required this.muted,
  });

  final double? width;
  final double? height;

  /// List of files (bytes)
  final List<FFUploadedFile>? files;

  /// Optional extension list (same length as files)
  final List<String>? exts;

  /// Remove callback (index)
  final Future Function(int index)? onRemove;

  /// Styling
  final Color surface;
  final Color border;
  final Color subtext;
  final Color muted;

  bool _isImageExt(String ext) {
    final e = ext.toLowerCase().trim();
    return e == 'png' || e == 'jpg' || e == 'jpeg' || e == 'webp' || e == 'gif';
  }

  String _extFromName(String name) {
    final parts = name.split('.');
    if (parts.length < 2) return '';
    return parts.last.toLowerCase().trim();
  }

  IconData _getFileIcon(String ext) {
    switch (ext.toLowerCase()) {
      case 'pdf':
        return Icons.picture_as_pdf;
      case 'doc':
      case 'docx':
        return Icons.description;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return Icons.grid_on;
      case 'json':
        return Icons.data_object;
      case 'zip':
      case 'rar':
        return Icons.archive;
      default:
        return Icons.insert_drive_file;
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = files ?? [];
    if (list.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      width: width,
      height: height,
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: List.generate(list.length, (i) {
          final f = list[i];
          final name = (f.name ?? '').trim();
          final ext = (exts != null && i < exts!.length && exts![i].isNotEmpty)
              ? exts![i].toLowerCase().trim()
              : _extFromName(name);

          final bytes = f.bytes ?? Uint8List(0);
          final isImage = bytes.isNotEmpty && _isImageExt(ext);

          return Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 70,
                height: 70,
                decoration: BoxDecoration(
                  color: surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: border),
                ),
                child: isImage
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(11),
                        child: Image.memory(
                          bytes,
                          fit: BoxFit.cover,
                          gaplessPlayback: true,
                          filterQuality: FilterQuality.low,
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(_getFileIcon(ext), size: 24, color: subtext),
                          const SizedBox(height: 4),
                          Text(
                            (ext.isEmpty ? 'FILE' : ext.toUpperCase()),
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              color: subtext,
                            ),
                          ),
                        ],
                      ),
              ),

              // ❌ remove
              Positioned(
                right: -4,
                top: -4,
                child: GestureDetector(
                  onTap: onRemove == null ? null : () => onRemove!(i),
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.6),
                      shape: BoxShape.circle,
                    ),
                    child:
                        const Icon(Icons.close, size: 14, color: Colors.white),
                  ),
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}
