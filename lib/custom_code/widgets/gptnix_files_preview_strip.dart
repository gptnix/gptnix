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

import 'dart:convert';
import 'dart:typed_data';

class GptnixFilesPreviewStrip extends StatelessWidget {
  const GptnixFilesPreviewStrip({
    super.key,
    this.width,
    this.height,

    /// ✅ FlutterFlow: JSON + IsList ✅
    required this.files,

    /// ✅ obavezno: pozadina kartice
    required this.surface,

    /// ✅ NEW standard params
    this.border,
    this.subtext,

    /// ✅ OLD params (backward compatible)
    this.borderColor,
    this.subtextColor,

    /// ✅ remove callback (staro/novo)
    /// FlutterFlow zna puknut na Future Function tipove -> zato su dynamic
    this.onRemoveAt,
    this.onRemove,

    /// ✅ dark handling
    /// - ako je isDark != null -> koristi to
    /// - inače ako useSystemDark=true -> prati Theme brightness
    this.isDark,
    this.useSystemDark = true,

    /// ✅ polish
    this.tileSize = 72,
    this.radius = 14,
    this.compact = false,
  });

  final double? width;
  final double? height;

  /// ✅ JSON list: [{name, ext, bytesB64/bytes/isImage...}]
  final List<dynamic> files;

  final Color surface;

  /// ✅ new names
  final Color? border;
  final Color? subtext;

  /// ✅ old names
  final Color? borderColor;
  final Color? subtextColor;

  /// ✅ remove callback (staro/novo) – FF safe
  /// expected: (int) => void OR (int) => Future<void>
  final dynamic onRemoveAt;
  final dynamic onRemove;

  /// ✅ dark
  final bool? isDark;
  final bool useSystemDark;

  /// ✅ UI polish
  final double tileSize;
  final double radius;
  final bool compact;

  bool _resolveDark(BuildContext context) {
    if (isDark != null) return isDark!;
    if (!useSystemDark) return Theme.of(context).brightness == Brightness.dark;
    return Theme.of(context).brightness == Brightness.dark;
  }

  Color _borderResolved(BuildContext context, bool dark) {
    final provided = border ?? borderColor; // ako user proslijedi, poštuj to
    if (provided != null) return provided;

    // default: ChatGPT ultra-suptilno
    return dark
        ? Colors.white.withOpacity(0.10)
        : Colors.black.withOpacity(0.08);
  }

  Color _subtextResolved(BuildContext context) =>
      subtext ?? subtextColor ?? FlutterFlowTheme.of(context).secondaryText;

  Color _shadowColor(bool dark) => Colors.black.withOpacity(dark ? 0.22 : 0.08);

  Future<void> _callRemove(int index) async {
    try {
      if (onRemoveAt != null) {
        final res = onRemoveAt(index);
        if (res is Future) await res.catchError((_) {});
        return;
      }
      if (onRemove != null) {
        final res = onRemove(index);
        if (res is Future) await res.catchError((_) {});
        return;
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (files.isEmpty) return const SizedBox.shrink();

    final dark = _resolveDark(context);

    final b = _borderResolved(context, dark);
    final s = _subtextResolved(context);

    final double size = compact ? (tileSize - 6) : tileSize;
    final r = BorderRadius.circular(radius);

    return Container(
      width: width,
      height: height,
      margin: const EdgeInsets.only(bottom: 10),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: files.asMap().entries.map((entry) {
          final idx = entry.key;
          final raw = entry.value;

          final parsed = _parseFile(raw);
          final ext = parsed.ext.trim().isNotEmpty
              ? parsed.ext.toLowerCase()
              : _extFromName(parsed.name);

          final isImage = _isImageFlagOrExt(raw, ext, parsed.name);
          final bytes = parsed.bytes;

          return _PreviewTile(
            size: size,
            radius: r,
            surface: surface,
            border: b,
            shadowColor: _shadowColor(dark),
            subtext: s,
            name: parsed.name,
            ext: ext,
            isImage: isImage,
            bytes: bytes,
            onRemove: () => _callRemove(idx),
          );
        }).toList(),
      ),
    );
  }

  _ParsedFile _parseFile(dynamic raw) {
    if (raw is Map) {
      final name = (raw['name'] ?? '').toString();
      final ext = (raw['ext'] ?? '').toString();

      Uint8List? bytes;

      // ✅ bytes list
      final bList = raw['bytes'];
      if (bList is List) {
        try {
          bytes = Uint8List.fromList(List<int>.from(bList));
        } catch (_) {}
      }

      // ✅ bytesB64
      final b64 = raw['bytesB64'];
      if ((bytes == null || bytes.isEmpty) &&
          b64 is String &&
          b64.trim().isNotEmpty) {
        try {
          bytes = base64Decode(b64.trim());
        } catch (_) {}
      }

      // ✅ fallback: "bytes" base64 string
      final bStr = raw['bytes'];
      if ((bytes == null || bytes.isEmpty) &&
          bStr is String &&
          bStr.trim().isNotEmpty) {
        try {
          bytes = base64Decode(bStr.trim());
        } catch (_) {}
      }

      return _ParsedFile(name: name, ext: ext, bytes: bytes);
    }

    return const _ParsedFile(name: '', ext: '', bytes: null);
  }

  bool _isImageFlagOrExt(dynamic raw, String ext, String name) {
    // 1) ako json eksplicitno kaže isImage
    if (raw is Map && raw['isImage'] == true) return true;

    // 2) po ext ili imenu
    final e = ext.toLowerCase();
    if (_isImageExt(e)) return true;

    final n = name.toLowerCase();
    return n.endsWith('.png') ||
        n.endsWith('.jpg') ||
        n.endsWith('.jpeg') ||
        n.endsWith('.webp') ||
        n.endsWith('.gif') ||
        n.endsWith('.heic');
  }

  bool _isImageExt(String ext) =>
      ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].contains(ext.toLowerCase());

  String _extFromName(String name) {
    final t = name.trim();
    final i = t.lastIndexOf('.');
    if (i <= 0 || i >= t.length - 1) return '';
    return t.substring(i + 1).toLowerCase();
  }
}

class _PreviewTile extends StatefulWidget {
  const _PreviewTile({
    required this.size,
    required this.radius,
    required this.surface,
    required this.border,
    required this.shadowColor,
    required this.subtext,
    required this.name,
    required this.ext,
    required this.isImage,
    required this.bytes,
    required this.onRemove,
  });

  final double size;
  final BorderRadius radius;
  final Color surface;
  final Color border;
  final Color shadowColor;
  final Color subtext;

  final String name;
  final String ext;
  final bool isImage;
  final Uint8List? bytes;

  final Future<void> Function() onRemove;

  @override
  State<_PreviewTile> createState() => _PreviewTileState();
}

class _PreviewTileState extends State<_PreviewTile> {
  bool _hover = false;
  bool _pressed = false;

  double get _scale {
    if (_pressed) return 0.97;
    if (_hover) return 1.02;
    return 1.0;
  }

  List<BoxShadow> get _shadow {
    final blur = _hover ? 18.0 : 14.0;
    final y = _hover ? 8.0 : 6.0;
    return [
      BoxShadow(
        color: widget.shadowColor,
        blurRadius: blur,
        offset: Offset(0, y),
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final hasThumb =
        widget.isImage && widget.bytes != null && widget.bytes!.isNotEmpty;

    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() {
        _hover = false;
        _pressed = false;
      }),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedScale(
          scale: _scale,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 140),
                curve: Curves.easeOut,
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  color: widget.surface,
                  borderRadius: widget.radius,
                  border: Border.all(color: widget.border, width: 1),
                  boxShadow: _shadow,
                ),
                child: ClipRRect(
                  borderRadius: widget.radius,
                  child: hasThumb
                      ? Image.memory(
                          widget.bytes!,
                          fit: BoxFit.cover,
                          gaplessPlayback: true,
                          filterQuality: FilterQuality.low,
                        )
                      : _FileBadge(
                          ext: widget.ext,
                          subtext: widget.subtext,
                        ),
                ),
              ),

              // ✅ Remove button (ChatGPT-style floating pill)
              Positioned(
                right: -6,
                top: -6,
                child: _RemovePill(
                  onTap: widget.onRemove,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RemovePill extends StatelessWidget {
  const _RemovePill({required this.onTap});

  final Future<void> Function() onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    final bg =
        dark ? Colors.black.withOpacity(0.55) : Colors.white.withOpacity(0.92);
    final border =
        dark ? Colors.white.withOpacity(0.12) : Colors.black.withOpacity(0.08);
    final icon = dark ? Colors.white : Colors.black87;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () async => await onTap(),
        borderRadius: BorderRadius.circular(999),
        child: Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: border, width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(dark ? 0.22 : 0.10),
                blurRadius: 10,
                offset: const Offset(0, 3),
              )
            ],
          ),
          alignment: Alignment.center,
          child: Icon(Icons.close_rounded, size: 14, color: icon),
        ),
      ),
    );
  }
}

class _FileBadge extends StatelessWidget {
  const _FileBadge({
    required this.ext,
    required this.subtext,
  });

  final String ext;
  final Color subtext;

  IconData _getFileIcon(String ext) {
    switch (ext.toLowerCase()) {
      case 'pdf':
        return Icons.picture_as_pdf_outlined;
      case 'doc':
      case 'docx':
        return Icons.description_outlined;
      case 'xls':
      case 'xlsx':
      case 'csv':
        return Icons.grid_on_outlined;
      case 'json':
        return Icons.data_object_outlined;
      case 'zip':
      case 'rar':
      case '7z':
        return Icons.archive_outlined;
      default:
        return Icons.insert_drive_file_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final e = ext.trim().isEmpty ? 'FILE' : ext.toUpperCase();
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_getFileIcon(ext), size: 22, color: subtext.withOpacity(0.95)),
          const SizedBox(height: 5),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: subtext.withOpacity(0.10),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              e,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                color: subtext.withOpacity(0.95),
                height: 1.0,
                letterSpacing: -0.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ParsedFile {
  final String name;
  final String ext;
  final Uint8List? bytes;

  const _ParsedFile({
    required this.name,
    required this.ext,
    required this.bytes,
  });
}
