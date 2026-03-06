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

import '/custom_code/widgets/index.dart';
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

import 'index.dart';

import 'package:flutter/services.dart';

class GptnixImageMessage extends StatelessWidget {
  const GptnixImageMessage({
    super.key,
    this.width,
    this.height,
    required this.dataJson,
    this.isDark,
    this.cardBg,
    this.cardBorder,
    this.surface,
    this.surface2,
    this.text,
    this.subtext,
    this.muted,
  });

  final double? width;
  final double? height;

  /// Expected format:
  /// { "prompt": "...", "urls": ["https://..."], "imageUrl":"https://..." }
  /// NOTE: imageUrl may be "" while pending -> we show placeholder.
  final dynamic dataJson;

  final bool? isDark;
  final Color? cardBg;
  final Color? cardBorder;
  final Color? surface;
  final Color? surface2;
  final Color? text;
  final Color? subtext;
  final Color? muted;

  @override
  Widget build(BuildContext context) {
    final parsed = _parse(dataJson);
    if (parsed == null) return const SizedBox.shrink();

    final bright = Theme.of(context).brightness;
    final dark = isDark ?? (bright == Brightness.dark);

    final bg = cardBg ?? (dark ? const Color(0xFF0F172A) : Colors.white);
    final border = cardBorder ??
        (dark ? const Color(0xFF243041) : const Color(0xFFE5E7EB));
    final surf =
        surface ?? (dark ? const Color(0xFF111827) : const Color(0xFFF7F8FA));
    final surf2 =
        surface2 ?? (dark ? const Color(0xFF0B1220) : const Color(0xFFF3F4F6));
    final fg =
        text ?? (dark ? const Color(0xFFE5E7EB) : const Color(0xFF111827));
    final sub =
        subtext ?? (dark ? const Color(0xFF94A3B8) : const Color(0xFF6B7280));
    final mut =
        muted ?? (dark ? const Color(0xFF64748B) : const Color(0xFF9CA3AF));

    final url = parsed.mainUrl.trim(); // may be ""
    final prompt = parsed.prompt;

    final hasUrl = url.startsWith('http');

    return SizedBox(
      width: width,
      child: Container(
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(dark ? 0.22 : 0.06),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (prompt.isNotEmpty) ...[
              Text(
                prompt,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: fg,
                ),
              ),
              const SizedBox(height: 8),
            ],

            // ✅ IMAGE or PLACEHOLDER
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AspectRatio(
                aspectRatio: 1.0,
                child: hasUrl
                    ? InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              fullscreenDialog: true,
                              builder: (_) => GptnixFullscreenImageViewer(
                                imageUrl: url,
                                title: prompt.isEmpty ? 'Slika' : prompt,
                                isDark: dark,
                                surface: Colors.black,
                                text: Colors.white,
                                subtext: Colors.white70,
                              ),
                            ),
                          );
                        },
                        child: Image.network(
                          url,
                          fit: BoxFit.cover,
                          gaplessPlayback: true,
                          errorBuilder: (_, __, ___) => Container(
                            color: surf,
                            alignment: Alignment.center,
                            child:
                                Icon(Icons.broken_image, color: mut, size: 28),
                          ),
                          loadingBuilder: (_, w, p) {
                            if (p == null) return w;
                            return Container(
                              color: surf,
                              alignment: Alignment.center,
                              child: const SizedBox(
                                width: 20,
                                height: 20,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                            );
                          },
                        ),
                      )
                    : GptnixImageLoadingPlaceholder(
                        prompt: prompt,
                        isDark: dark,
                        border: border,
                        surface2: surf2,
                        text: fg,
                        subtext: sub,
                      ),
              ),
            ),

            const SizedBox(height: 8),

            // Actions
            Row(
              children: [
                _MiniBtn(
                  icon: Icons.open_in_new_rounded,
                  label: 'Otvori',
                  onTap: () async {
                    if (!hasUrl) return;
                    await launchURL(url);
                  },
                  fg: fg,
                  border: border,
                  bg: surf,
                  disabled: !hasUrl,
                ),
                const SizedBox(width: 8),
                _MiniBtn(
                  icon: Icons.copy_rounded,
                  label: 'Kopiraj link',
                  onTap: () async {
                    if (!hasUrl) return;
                    await Clipboard.setData(ClipboardData(text: url));
                    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
                      const SnackBar(content: Text('Link kopiran')),
                    );
                  },
                  fg: fg,
                  border: border,
                  bg: surf,
                  disabled: !hasUrl,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  _ParsedImageMessage? _parse(dynamic json) {
    if (json == null) return null;
    if (json is! Map) return null;

    final m = Map<String, dynamic>.from(json as Map);

    final prompt = (m['prompt'] ?? '').toString().trim();

    String mainUrl = (m['imageUrl'] ?? '').toString().trim();
    final urls = m['urls'];
    if (mainUrl.isEmpty && urls is List && urls.isNotEmpty) {
      final u0 = urls.first;
      if (u0 != null) mainUrl = u0.toString().trim();
    }

    // ✅ VAŽNO: NE odbacuj poruku ako url nije http (pending placeholder)
    // Ako je url prazan -> placeholder će radit.
    return _ParsedImageMessage(prompt: prompt, mainUrl: mainUrl);
  }
}

class _ParsedImageMessage {
  final String prompt;
  final String mainUrl;
  const _ParsedImageMessage({required this.prompt, required this.mainUrl});
}

class _MiniBtn extends StatelessWidget {
  const _MiniBtn({
    required this.icon,
    required this.label,
    required this.onTap,
    required this.fg,
    required this.border,
    required this.bg,
    required this.disabled,
  });

  final IconData icon;
  final String label;
  final Future<void> Function() onTap;
  final Color fg;
  final Color border;
  final Color bg;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final cFg = disabled ? fg.withOpacity(0.35) : fg;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: disabled ? null : () => onTap(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: cFg),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: cFg,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
