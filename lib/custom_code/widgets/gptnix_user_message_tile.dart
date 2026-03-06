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

class GptnixUserMessageTile extends StatelessWidget {
  const GptnixUserMessageTile({
    super.key,
    this.width,
    this.height,
    required this.text,

    // legacy inputs
    this.fileNamesJson,
    this.imageFile,

    // ✅ NEW: Firestore attachments + urls (thumbnail u chatu nakon slanja)
    this.attachmentsJson,
    this.fileUrlsJson,
    this.stableId,

    /// Ako je null → prati sistem (Theme brightness)
    this.isDark,
    this.useSystemDark = true,
    this.userGradA,
    this.userGradB,
    this.surface,
    this.border,
    this.subtext,
    this.muted,
    this.onLongPress,
  });

  final double? width;
  final double? height;

  final String text;

  // legacy
  final dynamic fileNamesJson;
  final FFUploadedFile? imageFile;

  // new Firestore
  final dynamic attachmentsJson; // message.attachments (List<Map>)
  final dynamic fileUrlsJson; // message.file_urls (List<String>) ili map

  final String? stableId;

  final bool? isDark;
  final bool useSystemDark;

  final Color? userGradA;
  final Color? userGradB;
  final Color? surface;
  final Color? border;
  final Color? subtext;
  final Color? muted;
  final VoidCallback? onLongPress;

  // -----------------------------
  // Theme
  // -----------------------------
  bool _resolveDark(BuildContext context) {
    if (isDark != null) return isDark!;
    if (!useSystemDark) return Theme.of(context).brightness == Brightness.dark;
    return Theme.of(context).brightness == Brightness.dark;
  }

  // -----------------------------
  // Helpers (parsing)
  // -----------------------------
  List<String> _parseFiles(dynamic json) {
    if (json == null) return const [];
    if (json is List) {
      return json
          .map((e) => e.toString())
          .where((s) => s.trim().isNotEmpty)
          .toList();
    }
    if (json is Map) {
      final v = json['files'] ?? json['fileNames'] ?? json['file_names'];
      if (v is List) {
        return v
            .map((e) => e.toString())
            .where((s) => s.trim().isNotEmpty)
            .toList();
      }
    }
    return const [];
  }

  List<String> _parseUrls(dynamic json) {
    if (json == null) return const [];
    if (json is List) {
      return json
          .map((e) => e.toString())
          .where((s) => s.trim().isNotEmpty)
          .toList();
    }
    if (json is Map) {
      final v = json['urls'] ?? json['file_urls'] ?? json['fileUrls'];
      if (v is List) {
        return v
            .map((e) => e.toString())
            .where((s) => s.trim().isNotEmpty)
            .toList();
      }
    }
    return const [];
  }

  List<Map<String, dynamic>> _parseAttachments(dynamic json) {
    if (json == null) return const [];
    if (json is List) {
      return json
          .whereType<Map>()
          .map((m) => Map<String, dynamic>.from(m))
          .toList();
    }
    if (json is Map) {
      final v = json['attachments'] ?? json['files'];
      if (v is List) {
        return v
            .whereType<Map>()
            .map((m) => Map<String, dynamic>.from(m))
            .toList();
      }
    }
    return const [];
  }

  bool _isImageExt(String nameOrExt) {
    final n = nameOrExt.toLowerCase();
    return n.endsWith('.png') ||
        n.endsWith('.jpg') ||
        n.endsWith('.jpeg') ||
        n.endsWith('.webp') ||
        n.endsWith('.gif') ||
        n.endsWith('.heic') ||
        n == 'png' ||
        n == 'jpg' ||
        n == 'jpeg' ||
        n == 'webp' ||
        n == 'gif' ||
        n == 'heic';
  }

  String _extFromName(String name) {
    final t = name.trim();
    final i = t.lastIndexOf('.');
    if (i <= 0 || i >= t.length - 1) return '';
    return t.substring(i + 1).toLowerCase();
  }

  String _shortName(String s, {int max = 28}) {
    final t = s.trim();
    if (t.length <= max) return t;
    return '${t.substring(0, max - 1)}…';
  }

  String _prettyBytes(int bytes) {
    if (bytes <= 0) return '';
    const kb = 1024.0;
    const mb = 1024.0 * 1024.0;
    const gb = 1024.0 * 1024.0 * 1024.0;
    if (bytes >= gb) return '${(bytes / gb).toStringAsFixed(2)} GB';
    if (bytes >= mb) return '${(bytes / mb).toStringAsFixed(1)} MB';
    if (bytes >= kb) return '${(bytes / kb).toStringAsFixed(0)} KB';
    return '$bytes B';
  }

  // -----------------------------
  // Palette (ChatGPT-ish)
  // -----------------------------
  Color _surface2(bool dark) =>
      surface ?? (dark ? const Color(0xFF0B1224) : const Color(0xFFF8FAFC));

  Color _muted(bool dark) =>
      muted ?? (dark ? const Color(0xFF94A3B8) : const Color(0xFF6B7280));

  Color _userBubbleBgLight() => const Color(0xFFDCEEFF);
  Color _userBubbleTextLight() => const Color(0xFF0B2A4A);

  Color _userBubbleBgDark() => const Color(0xFF2F2F2F);
  Color _userBubbleTextDark() => const Color(0xFFECECEC);

  BorderRadius _bubbleRadius() => const BorderRadius.only(
        topLeft: Radius.circular(18),
        topRight: Radius.circular(18),
        bottomLeft: Radius.circular(18),
        bottomRight: Radius.circular(7),
      );

  double _maxBubbleWidth(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    final byScreen = w * 0.78;
    final cap = w >= 900 ? 620.0 : 560.0;
    return byScreen.clamp(240.0, cap);
  }

  IconData _iconForExt(String ext) {
    final e = ext.toLowerCase();
    if (_isImageExt(e)) return Icons.image_rounded;
    if (e == 'pdf') return Icons.picture_as_pdf_rounded;
    if (e == 'zip' || e == 'rar' || e == '7z') return Icons.folder_zip_rounded;
    if (e == 'doc' || e == 'docx') return Icons.description_rounded;
    if (e == 'xls' || e == 'xlsx' || e == 'csv') {
      return Icons.table_chart_rounded;
    }
    if (e == 'txt' || e == 'md' || e == 'json') return Icons.article_rounded;
    return Icons.attach_file_rounded;
  }

  // -----------------------------
  // Actions
  // -----------------------------
  Future<void> _openUrlSafe(BuildContext context, String url) async {
    final u = url.trim();
    if (u.isEmpty) return;
    try {
      // FlutterFlow util obično ima launchURL
      await launchURL(u);
    } catch (_) {
      // ne ruši app
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(content: Text('Ne mogu otvoriti link')),
      );
    }
  }

  // -----------------------------
  // Attachment UI
  // -----------------------------
  Widget _imageThumb({
    required BuildContext context,
    required bool dark,
    required String url,
  }) {
    final borderC =
        dark ? Colors.white.withOpacity(0.10) : Colors.black.withOpacity(0.08);

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            fullscreenDialog: true,
            builder: (_) => GptnixFullscreenImageViewer(
              imageUrl: url,
              imageFile: null,
              title: 'Slika',
              isDark: dark,
              surface: Colors.black,
              text: Colors.white,
              subtext: Colors.white70,
            ),
          ),
        );
      },
      child: Container(
        width: 96,
        height: 96,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderC, width: 0.6),
          color: dark
              ? Colors.white.withOpacity(0.06)
              : Colors.black.withOpacity(0.03),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Image.network(
            url,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Center(
              child: Icon(
                Icons.broken_image_rounded,
                color: dark ? Colors.white54 : Colors.black38,
                size: 26,
              ),
            ),
            loadingBuilder: (ctx, child, prog) {
              if (prog == null) return child;
              return Center(
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    value: prog.expectedTotalBytes == null
                        ? null
                        : prog.cumulativeBytesLoaded /
                            (prog.expectedTotalBytes ?? 1),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _fileCard({
    required BuildContext context,
    required bool dark,
    required String name,
    required String url,
    required String ext,
    required int size,
  }) {
    final bg = dark ? const Color(0xFF212121) : Colors.white;
    final borderC =
        dark ? Colors.white.withOpacity(0.10) : Colors.black.withOpacity(0.07);
    final titleC = dark ? Colors.white : const Color(0xFF0B2A4A);
    final subC = dark ? Colors.white70 : const Color(0xFF64748B);

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () async => _openUrlSafe(context, url),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderC, width: 0.6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              _iconForExt(ext),
              size: 18,
              color: dark ? Colors.white70 : const Color(0xFF64748B),
            ),
            const SizedBox(width: 10),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 220),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _shortName(name, max: 40),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12.8,
                      fontWeight: FontWeight.w700,
                      color: titleC,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (ext.trim().isNotEmpty) ext.toUpperCase(),
                      if (size > 0) _prettyBytes(size),
                    ].join(' • '),
                    style: TextStyle(
                      fontSize: 11.5,
                      color: subC,
                      height: 1.1,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -----------------------------
  // Build
  // -----------------------------
  @override
  Widget build(BuildContext context) {
    final dark = _resolveDark(context);

    final legacyNames = _parseFiles(fileNamesJson);
    final hasImgBytes =
        (imageFile?.bytes != null && imageFile!.bytes!.isNotEmpty);

    final attachments = _parseAttachments(attachmentsJson);
    final urls = _parseUrls(fileUrlsJson);

    // normalize: url/name/ext/size/isImage
    final normalized = <Map<String, dynamic>>[];
    for (final a in attachments) {
      final url = (a['downloadUrl'] ?? a['url'] ?? '').toString().trim();
      if (url.isEmpty) continue;

      final name = (a['name'] ?? 'file').toString();
      final ext = ((a['ext'] ?? '').toString().trim().isNotEmpty)
          ? (a['ext'] ?? '').toString()
          : _extFromName(name);

      final size = (a['size'] is int) ? a['size'] as int : 0;
      final isImg =
          (a['isImage'] == true) || _isImageExt(ext) || _isImageExt(name);

      normalized.add({
        'url': url,
        'name': name,
        'ext': ext,
        'size': size,
        'isImage': isImg,
      });
    }

    // fallback: ako nema attachments ali ima urls
    if (normalized.isEmpty && urls.isNotEmpty) {
      for (final u in urls) {
        final clean = u.trim();
        if (clean.isEmpty) continue;

        final nameGuess = clean.split('/').last.split('?').first;
        final ext = _extFromName(nameGuess);

        normalized.add({
          'url': clean,
          'name': nameGuess.isEmpty ? 'file' : nameGuess,
          'ext': ext,
          'size': 0,
          'isImage': _isImageExt(ext) || _isImageExt(nameGuess),
        });
      }
    }

    final imageAttachments =
        normalized.where((a) => a['isImage'] == true).toList();
    final fileAttachments =
        normalized.where((a) => a['isImage'] != true).toList();

    final bubbleBg = dark ? _userBubbleBgDark() : _userBubbleBgLight();
    final bubbleText = dark ? _userBubbleTextDark() : _userBubbleTextLight();

    final bubbleBorder =
        dark ? Colors.white.withOpacity(0.06) : Colors.black.withOpacity(0.05);

    final chipBg = dark ? const Color(0xFF212121) : const Color(0xFFFFFFFF);
    final chipText = dark ? bubbleText.withOpacity(0.92) : bubbleText;
    final chipIcon = dark ? const Color(0xFFB0B0B0) : const Color(0xFF64748B);
    final chipBorder =
        dark ? Colors.white.withOpacity(0.10) : Colors.black.withOpacity(0.07);

    final surf2 = _surface2(dark);
    final mut = _muted(dark);

    return SizedBox(
      width: width,
      height: height,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(56, 6, 16, 0),
        child: Align(
          alignment: Alignment.centerRight,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: _maxBubbleWidth(context)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // ✅ Firestore thumbnails (images)
                if (imageAttachments.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 8,
                      runSpacing: 8,
                      children: imageAttachments.take(6).map((a) {
                        final url = (a['url'] ?? '').toString();
                        return _imageThumb(
                            context: context, dark: dark, url: url);
                      }).toList(),
                    ),
                  ),

                // ✅ Firestore file cards
                if (fileAttachments.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 8,
                      runSpacing: 8,
                      children: fileAttachments.take(6).map((a) {
                        final url = (a['url'] ?? '').toString();
                        final name = (a['name'] ?? 'file').toString();
                        final ext = (a['ext'] ?? '').toString();
                        final size = (a['size'] is int) ? a['size'] as int : 0;
                        return _fileCard(
                          context: context,
                          dark: dark,
                          name: name,
                          url: url,
                          ext: ext,
                          size: size,
                        );
                      }).toList(),
                    ),
                  ),

                // legacy chips (imena)
                if (legacyNames.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 6,
                      runSpacing: 6,
                      children: legacyNames.take(6).map((f) {
                        final ext = _extFromName(f);
                        final isImg = _isImageExt(f);
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: chipBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: chipBorder, width: 0.6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isImg ? Icons.image_rounded : _iconForExt(ext),
                                size: 14,
                                color: chipIcon,
                              ),
                              const SizedBox(width: 8),
                              ConstrainedBox(
                                constraints:
                                    const BoxConstraints(maxWidth: 180),
                                child: Text(
                                  _shortName(f),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: chipText.withOpacity(0.90),
                                    height: 1.1,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),

                // inline preview (bytes)
                if (hasImgBytes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(18),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            fullscreenDialog: true,
                            builder: (_) => GptnixFullscreenImageViewer(
                              imageUrl: '',
                              imageFile: imageFile,
                              title: 'Slika',
                              isDark: dark,
                              surface: Colors.black,
                              text: Colors.white,
                              subtext: Colors.white70,
                            ),
                          ),
                        );
                      },
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: bubbleBorder, width: 0.6),
                          boxShadow: [
                            BoxShadow(
                              color:
                                  Colors.black.withOpacity(dark ? 0.12 : 0.04),
                              blurRadius: 10,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(18),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(
                              maxHeight: 280,
                              maxWidth: 260,
                            ),
                            child: Image.memory(
                              imageFile!.bytes!,
                              key: ValueKey<String>(
                                'uimg_${stableId ?? ''}_${imageFile.hashCode}',
                              ),
                              fit: BoxFit.cover,
                              gaplessPlayback: true,
                              errorBuilder: (_, __, ___) => Container(
                                color: surf2,
                                alignment: Alignment.center,
                                child: Icon(Icons.broken_image,
                                    color: mut, size: 30),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),

                // main user bubble
                GestureDetector(
                  onLongPress: onLongPress,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: bubbleBg,
                      borderRadius: _bubbleRadius(),
                      border: Border.all(color: bubbleBorder, width: 0.55),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(dark ? 0.10 : 0.035),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: SelectableText(
                      text,
                      style: TextStyle(
                        color: bubbleText,
                        fontSize: 15.6,
                        height: 1.38,
                        fontWeight: FontWeight.w500,
                        letterSpacing: -0.15,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
