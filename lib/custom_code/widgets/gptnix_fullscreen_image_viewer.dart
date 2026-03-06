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

import 'index.dart';

import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:gal/gal.dart';

import '/custom_code/widgets/index.dart';
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

class GptnixFullscreenImageViewer extends StatefulWidget {
  const GptnixFullscreenImageViewer({
    super.key,
    this.width,
    this.height,
    required this.imageUrl,
    this.title,
    this.imageFile,
    this.isDark,
    this.surface,
    this.surface2,
    this.text,
    this.subtext,
    this.muted,
    this.border,
  });

  final double? width;
  final double? height;

  /// Can be empty if using imageFile.
  final String imageUrl;

  final String? title;

  final FFUploadedFile? imageFile;

  final bool? isDark;
  final Color? surface;
  final Color? surface2;
  final Color? text;
  final Color? subtext;
  final Color? muted;
  final Color? border;

  @override
  State<GptnixFullscreenImageViewer> createState() =>
      _GptnixFullscreenImageViewerState();
}

class _GptnixFullscreenImageViewerState
    extends State<GptnixFullscreenImageViewer> {
  bool _saving = false;

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(msg),
        duration: const Duration(milliseconds: 900),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _saveToGallery() async {
    if (_saving) return;
    if (kIsWeb) return;

    setState(() => _saving = true);

    try {
      final bytes = widget.imageFile?.bytes;
      final url = widget.imageUrl.trim();

      // 1) Ako ima bytes (upload preview / lokalno) -> spremi bytes
      if (bytes != null && bytes.isNotEmpty) {
        final hasAccess = await Gal.hasAccess();
        if (!hasAccess) {
          await Gal.requestAccess();
        }

        final ext = _extFromNameOrUrl(widget.imageFile?.name ?? url);
        final path =
            '${Directory.systemTemp.path}/gptnix_${DateTime.now().millisecondsSinceEpoch}.$ext';
        final f = File(path);
        await f.writeAsBytes(bytes, flush: true);

        await Gal.putImage(f.path);
        _toast('Spremljeno u galeriju');
        return;
      }

      // 2) Inače -> preko URL-a (custom action s http downloadom)
      if (url.isNotEmpty) {
        await gptnixSaveImageToGallery(url);
        _toast('Spremljeno u galeriju');
        return;
      }

      _toast('Nema slike za spremiti');
    } catch (e) {
      _toast('Spremanje nije uspjelo');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _extFromNameOrUrl(String s) {
    final clean = s.split('?').first.toLowerCase().trim();
    if (clean.endsWith('.png')) return 'png';
    if (clean.endsWith('.webp')) return 'webp';
    if (clean.endsWith('.jpeg')) return 'jpeg';
    if (clean.endsWith('.jpg')) return 'jpg';
    if (clean.endsWith('.heic')) return 'heic';
    return 'jpg';
  }

  @override
  Widget build(BuildContext context) {
    final bright = Theme.of(context).brightness;
    final dark = widget.isDark ?? (bright == Brightness.dark);

    final Color bg =
        (widget.surface ?? (dark ? const Color(0xFF0B1020) : Colors.black));
    final Color fg =
        (widget.text ?? (dark ? const Color(0xFFE5E7EB) : Colors.white));
    final Color sub =
        (widget.subtext ?? (dark ? const Color(0xFF94A3B8) : Colors.white70));

    final bytes = widget.imageFile?.bytes;
    final hasBytes = bytes != null && bytes.isNotEmpty;
    final hasUrl = widget.imageUrl.trim().isNotEmpty;

    final title =
        (widget.title ?? '').trim().isEmpty ? 'Slika' : widget.title!.trim();

    return Scaffold(
      backgroundColor: bg,
      body: GestureDetector(
        onTap: () => Navigator.of(context).maybePop(),
        child: SafeArea(
          child: Stack(
            children: [
              Positioned.fill(
                child: GestureDetector(
                  onTap: () {}, // blokira propagaciju tapa na sliku
                  child: InteractiveViewer(
                    minScale: 0.8,
                    maxScale: 4.0,
                    child: Center(
                      child: hasBytes
                          ? Image.memory(bytes!, fit: BoxFit.contain)
                          : Image.network(
                              widget.imageUrl,
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => Icon(
                                  Icons.broken_image,
                                  color: sub,
                                  size: 40),
                              loadingBuilder: (_, w, p) {
                                if (p == null) return w;
                                return const Center(
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                );
                              },
                            ),
                    ),
                  ),
                ),
              ),

              // Top bar
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        bg.withOpacity(0.95),
                        bg.withOpacity(0.65),
                        bg.withOpacity(0.0),
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: Icon(Icons.close_rounded, color: fg),
                        tooltip: 'Zatvori',
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: fg,
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),

                      // ✅ Save to gallery
                      IconButton(
                        onPressed: (kIsWeb || _saving || (!hasBytes && !hasUrl))
                            ? null
                            : () async => await _saveToGallery(),
                        icon: _saving
                            ? SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(fg),
                                ),
                              )
                            : Icon(Icons.download_rounded, color: fg),
                        tooltip: kIsWeb
                            ? 'Spremi radi samo na mobitelu'
                            : 'Spremi u galeriju',
                      ),

                      // Open in browser
                      IconButton(
                        onPressed: () async {
                          final url = widget.imageUrl.trim();
                          if (url.isEmpty) return;
                          await launchURL(url);
                        },
                        icon: Icon(Icons.open_in_new_rounded, color: fg),
                        tooltip: 'Otvori u pregledniku',
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
