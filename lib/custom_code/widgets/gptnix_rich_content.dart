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

import 'index.dart'; // Imports other custom widgets

import '/custom_code/widgets/index.dart';
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:markdown/markdown.dart' as md;
import 'package:url_launcher/url_launcher.dart';

class GptnixRichContent extends StatelessWidget {
  const GptnixRichContent({
    super.key,
    this.width,
    this.height,
    required this.text,
    this.isDark,
    this.surface,
    this.surface2,
    this.border,
    this.textColor,
    this.subtext,
    this.muted,
    this.selectable = true,

    // ✅ NOVO: stream-mode (FAST) vs final-mode (FULL)
    this.fastMode = false,
  });

  final double? width;
  final double? height;
  final String text;

  final bool? isDark;
  final Color? surface;
  final Color? surface2;
  final Color? border;
  final Color? textColor;
  final Color? subtext;
  final Color? muted;

  final bool selectable;
  final bool fastMode;

  static final Map<String, List<_Block>> _splitCache = {};
  static final Map<String, String> _linkifyCache = {};

  String _cacheKeyFor(String s) => '${s.hashCode}:${s.length}';

  @override
  Widget build(BuildContext context) {
    final raw = text;
    if (raw.trim().isEmpty) return const SizedBox.shrink();

    final dark = isDark ?? (Theme.of(context).brightness == Brightness.dark);

    final splitKey = _cacheKeyFor(raw);
    final blocks = _splitCache[splitKey] ??= _splitBlocksFailSafe(raw);

    if (blocks.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      width: width ?? double.infinity,
      height: height,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (int i = 0; i < blocks.length; i++) ...[
            if (blocks[i].kind == _BlockKind.md)
              _MarkdownChunk(
                text: _prepareMd(splitKey, blocks[i].content),
                selectable: selectable,
                isDark: dark,
                surface: surface,
                surface2: surface2,
                border: border,
                textColor: textColor,
                subtext: subtext,
                muted: muted,
              )
            else
              _CodeChunk(
                code: blocks[i].content,
                language: blocks[i].lang,
                isDark: dark,
                surface2: surface2,
                border: border,
                textColor: textColor,
                muted: muted,
              ),
            if (i != blocks.length - 1) const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  String _prepareMd(String splitKey, String mdText) {
    final pre =
        fastMode ? _preprocessFast(mdText) : _preprocessForChatGptLook(mdText);

    if (fastMode) {
      // FAST: bez linkify-a (jeftinije + bez re-layout trzanja)
      return pre;
    }

    // FULL: linkify cache
    final key = '$splitKey|${pre.hashCode}:${pre.length}';
    return _linkifyCache[key] ??= _autoLinkifyMdSafe(pre);
  }
}

enum _BlockKind { md, code }

class _Block {
  final _BlockKind kind;
  final String content;
  final String? lang;
  const _Block(this.kind, this.content, {this.lang});
}

List<_Block> _splitBlocksFailSafe(String input) {
  final text = input;
  if (text.trim().isEmpty) return const [];

  final firstFence = text.indexOf('```');
  if (firstFence != -1) {
    final secondFence = text.indexOf('```', firstFence + 3);
    if (secondFence == -1) {
      return [_Block(_BlockKind.md, text.trimRight())];
    }
  }

  final re = RegExp(r"```([A-Za-z0-9_+\-]*)\n([\s\S]*?)```", multiLine: true);
  final out = <_Block>[];

  int last = 0;
  for (final m in re.allMatches(text)) {
    final start = m.start;
    final end = m.end;

    if (start > last) {
      final mdChunk = text.substring(last, start);
      final trimmed = mdChunk.trimRight();
      if (trimmed.trim().isNotEmpty) out.add(_Block(_BlockKind.md, trimmed));
    }

    final lang = (m.group(1) ?? '').trim();
    final code = (m.group(2) ?? '').trimRight();
    if (code.trim().isNotEmpty) {
      out.add(_Block(_BlockKind.code, code, lang: lang.isEmpty ? null : lang));
    }

    last = end;
  }

  if (last < text.length) {
    final tail = text.substring(last).trimRight();
    if (tail.trim().isNotEmpty) out.add(_Block(_BlockKind.md, tail));
  }

  return out;
}

// ✅ FAST preprocess: minimalno, bez heading promjene + bez linkify
String _preprocessFast(String input) {
  var s = input.replaceAll('\r\n', '\n').trimRight();

  // normalize bullets
  s = s.replaceAll(RegExp(r'^[ \t]*[•·]\s+', multiLine: true), '- ');
  s = s.replaceAll(RegExp(r'^[ \t]*[–—]\s+', multiLine: true), '- ');
  s = s.replaceAll(RegExp(r'^[ \t]*(\d+)\)\s+', multiLine: true), r'$1. ');

  // basic spacing cleanup
  s = s.replaceAll(RegExp(r'\n{4,}'), '\n\n');
  s = s.replaceAll(RegExp(r'[ \t]+\n'), '\n');

  return s.trimRight();
}

// FULL preprocess
String _preprocessForChatGptLook(String input) {
  var s = input.replaceAll('\r\n', '\n').trimRight();

  s = s.replaceAll(RegExp(r'^[ \t]*[•·]\s+', multiLine: true), '- ');
  s = s.replaceAll(RegExp(r'^[ \t]*[–—]\s+', multiLine: true), '- ');
  s = s.replaceAll(RegExp(r'^[ \t]*(\d+)\)\s+', multiLine: true), r'$1. ');

  s = _autoPromoteHeadings(s);

  s = s.replaceAll(RegExp(r'\n{4,}'), '\n\n');
  s = s.replaceAll(RegExp(r'[ \t]+\n'), '\n');

  return s.trimRight();
}

String _autoPromoteHeadings(String input) {
  final lines = input.split('\n');
  final out = <String>[];

  bool isStructural(String line) {
    final t = line.trimLeft();
    if (t.isEmpty) return false;
    if (t.startsWith('#')) return true;
    if (t.startsWith('```')) return true;
    if (t.startsWith('- ') || t.startsWith('* ')) return true;
    if (RegExp(r'^\d+\.\s+').hasMatch(t)) return true;
    if (t.startsWith('>')) return true;
    if (t.startsWith('|')) return true;
    return false;
  }

  bool looksAllCaps(String line) {
    final t = line.trim();
    if (t.length < 4) return false;
    if (RegExp(r'[a-z]').hasMatch(t)) return false;
    final letters = t.replaceAll(RegExp(r'[^A-ZŠĐČĆŽ]'), '');
    return letters.length >= 4;
  }

  bool endsSentence(String t) =>
      t.endsWith('.') || t.endsWith('!') || t.endsWith('?');

  for (int i = 0; i < lines.length; i++) {
    final line = lines[i];
    final t = line.trimRight();
    final tl = t.trimLeft();

    if (t.trim().isEmpty) {
      out.add(t);
      continue;
    }

    if (isStructural(t)) {
      out.add(t);
      continue;
    }

    if (i + 1 < lines.length) {
      final next = lines[i + 1].trim();
      if (RegExp(r'^[-=]{3,}$').hasMatch(next)) {
        out.add(t);
        continue;
      }
    }

    final core = tl.trim();
    final shortEnough = core.length <= 60;
    final hasColonEnd = core.endsWith(':') && core.length <= 70;
    final caps = looksAllCaps(core);

    if (endsSentence(core)) {
      out.add(t);
      continue;
    }

    if (RegExp(r',').allMatches(core).length >= 2) {
      out.add(t);
      continue;
    }

    if (!shortEnough && !hasColonEnd) {
      out.add(t);
      continue;
    }

    if (hasColonEnd) {
      out.add('### ${core.substring(0, core.length - 1)}');
      continue;
    }

    if (caps && shortEnough) {
      out.add('## $core');
      continue;
    }

    final nextIsBlank =
        (i + 1 < lines.length) ? lines[i + 1].trim().isEmpty : true;
    if (shortEnough && nextIsBlank) {
      out.add('## $core');
      continue;
    }

    out.add(t);
  }

  return out.join('\n');
}

// --- linkify helpers (unchanged) ---
class _Range {
  _Range(this.start, this.end);
  final int start;
  final int end;
}

class _Hit {
  _Hit(this.start, this.end, this.kind);
  final int start;
  final int end;
  final String kind;
}

List<_Range> _findMarkdownLinkRanges(String s) {
  final re = RegExp(r'\[[^\]]+\]\([^)]+\)');
  return re.allMatches(s).map((m) => _Range(m.start, m.end)).toList();
}

List<_Range> _findInlineCodeRanges(String s) {
  final re = RegExp(r'`[^`]+`');
  return re.allMatches(s).map((m) => _Range(m.start, m.end)).toList();
}

String _autoLinkifyMdSafe(String input) {
  final s = input;
  if (s.trim().isEmpty) return s;

  final protected = <_Range>[];
  protected.addAll(_findMarkdownLinkRanges(s));
  protected.addAll(_findInlineCodeRanges(s));
  protected.sort((a, b) => a.start.compareTo(b.start));

  bool isProtected(int index) {
    for (final r in protected) {
      if (index >= r.start && index < r.end) return true;
      if (r.start > index) break;
    }
    return false;
  }

  final urlRe =
      RegExp(r'(?:(https?:\/\/)|www\.)[^\s<>()\[\]]+', caseSensitive: false);
  final emailRe = RegExp(
    r'\b[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}\b',
    caseSensitive: false,
  );
  final phoneRe = RegExp(r'(\+?\d[\d\s().\-]{7,}\d)');

  final matches = <_Hit>[];

  for (final m in urlRe.allMatches(s)) {
    if (!isProtected(m.start)) matches.add(_Hit(m.start, m.end, 'url'));
  }
  for (final m in emailRe.allMatches(s)) {
    if (!isProtected(m.start)) matches.add(_Hit(m.start, m.end, 'email'));
  }
  for (final m in phoneRe.allMatches(s)) {
    if (!isProtected(m.start)) matches.add(_Hit(m.start, m.end, 'phone'));
  }

  if (matches.isEmpty) return s;

  matches.sort((a, b) => a.start.compareTo(b.start));
  final filtered = <_Hit>[];
  int lastEnd = -1;
  for (final h in matches) {
    if (h.start < lastEnd) continue;
    filtered.add(h);
    lastEnd = h.end;
  }

  String stripTrailingPunct(String x) {
    var t = x.trim();
    while (t.isNotEmpty && '.,;:'.contains(t[t.length - 1])) {
      t = t.substring(0, t.length - 1);
    }
    return t;
  }

  bool looksAlreadyLinked(String text, int start) {
    final left = (start - 2 >= 0) ? text.substring(start - 2, start) : '';
    if (left == '](') return true;
    final left1 = (start - 1 >= 0) ? text.substring(start - 1, start) : '';
    if (left1 == '(') return true;
    return false;
  }

  final sb = StringBuffer();
  int cursor = 0;

  for (final h in filtered) {
    if (h.start < cursor) continue;

    sb.write(s.substring(cursor, h.start));

    final raw = s.substring(h.start, h.end);
    if (raw.trim().isEmpty || looksAlreadyLinked(s, h.start)) {
      sb.write(raw);
      cursor = h.end;
      continue;
    }

    if (h.kind == 'url') {
      final cleanedRaw = stripTrailingPunct(raw);
      if (cleanedRaw.isEmpty) {
        sb.write(raw);
        cursor = h.end;
        continue;
      }
      final tail = raw.substring(cleanedRaw.length);
      final href = cleanedRaw.toLowerCase().startsWith('http')
          ? cleanedRaw
          : 'https://$cleanedRaw';

      sb.write('[$cleanedRaw]($href)');
      sb.write(tail);
    } else if (h.kind == 'email') {
      final cleaned = stripTrailingPunct(raw);
      if (cleaned.isEmpty) {
        sb.write(raw);
      } else {
        sb.write('[$cleaned](mailto:$cleaned)');
        final tail = raw.substring(cleaned.length);
        sb.write(tail);
      }
    } else if (h.kind == 'phone') {
      final candidate = raw.trim();
      final digits = candidate.replaceAll(RegExp(r'\D'), '');
      if (digits.length < 9 || digits.length > 16) {
        sb.write(raw);
        cursor = h.end;
        continue;
      }

      final cleanedRaw = stripTrailingPunct(raw);
      final tail = raw.substring(cleanedRaw.length);

      var tel = cleanedRaw.replaceAll(RegExp(r'[^\d+]'), '');
      if (tel.startsWith('00')) tel = '+${tel.substring(2)}';

      sb.write('[$cleanedRaw](tel:$tel)');
      sb.write(tail);
    } else {
      sb.write(raw);
    }

    cursor = h.end;
  }

  sb.write(s.substring(cursor));
  return sb.toString();
}

// ---------- Markdown chunk ----------
class _MarkdownChunk extends StatelessWidget {
  const _MarkdownChunk({
    required this.text,
    required this.isDark,
    required this.selectable,
    this.surface,
    this.surface2,
    this.border,
    this.textColor,
    this.subtext,
    this.muted,
  });

  final String text;
  final bool isDark;
  final bool selectable;

  final Color? surface;
  final Color? surface2;
  final Color? border;
  final Color? textColor;
  final Color? subtext;
  final Color? muted;

  Color _cText() =>
      textColor ?? (isDark ? const Color(0xFFE5E7EB) : const Color(0xFF0F172A));
  Color _cSub() =>
      subtext ?? (isDark ? const Color(0xFF94A3B8) : const Color(0xFF6B7280));
  Color _cMuted() =>
      muted ?? (isDark ? const Color(0xFF64748B) : const Color(0xFF9CA3AF));
  Color _cBorder() =>
      border ?? (isDark ? const Color(0xFF233044) : const Color(0xFFE5E7EB));
  Color _cSurface2() =>
      surface2 ?? (isDark ? const Color(0xFF0B1224) : const Color(0xFFF8FAFC));

  MarkdownStyleSheet _style(BuildContext context) {
    final tc = _cText();
    final br = _cBorder();
    final s2 = _cSurface2();
    final base = MarkdownStyleSheet.fromTheme(Theme.of(context));

    return base.copyWith(
      p: TextStyle(
        fontSize: 16.0,
        height: 1.62,
        color: tc,
        fontWeight: FontWeight.w400,
        letterSpacing: -0.12,
      ),
      h1: TextStyle(
        fontSize: 28,
        height: 1.18,
        fontWeight: FontWeight.w900,
        color: tc,
        letterSpacing: -0.35,
      ),
      h2: TextStyle(
        fontSize: 22.5,
        height: 1.20,
        fontWeight: FontWeight.w900,
        color: tc,
        letterSpacing: -0.28,
      ),
      h3: TextStyle(
        fontSize: 19.0,
        height: 1.22,
        fontWeight: FontWeight.w900,
        color: tc,
        letterSpacing: -0.20,
      ),
      h4: TextStyle(
        fontSize: 17.0,
        height: 1.24,
        fontWeight: FontWeight.w900,
        color: tc,
        letterSpacing: -0.15,
      ),
      em: TextStyle(fontStyle: FontStyle.italic, color: tc),
      strong: TextStyle(fontWeight: FontWeight.w800, color: tc),
      a: TextStyle(
        color: isDark ? const Color(0xFF93C5FD) : const Color(0xFF2563EB),
        fontWeight: FontWeight.w800,
        decoration: TextDecoration.none,
      ),
      listBullet: TextStyle(
        color: tc.withOpacity(0.80),
        fontSize: 16.0,
        height: 1.40,
        fontWeight: FontWeight.w600,
      ),
      listIndent: 26,
      code: TextStyle(
        fontFamily: 'RobotoMono',
        fontSize: 13.7,
        height: 1.48,
        color: isDark ? const Color(0xFFE2E8F0) : const Color(0xFF111827),
        backgroundColor:
            isDark ? const Color(0xFF111C33) : const Color(0xFFF1F5F9),
      ),
      blockquoteDecoration: BoxDecoration(
        color: s2,
        borderRadius: BorderRadius.circular(14),
        border: Border(left: BorderSide(color: br, width: 4)),
      ),
      blockquotePadding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      horizontalRuleDecoration: BoxDecoration(
        border: Border(top: BorderSide(color: br.withOpacity(0.95), width: 1)),
      ),
      blockSpacing: 12,
    );
  }

  String _sanitizeHref(String href) {
    var h = href.trim();
    while (h.isNotEmpty && '.,;:'.contains(h[h.length - 1])) {
      h = h.substring(0, h.length - 1);
    }
    return h;
  }

  Future<void> _tapLink(BuildContext context, String href) async {
    final clean = _sanitizeHref(href);
    if (clean.isEmpty) return;

    Uri? uri = Uri.tryParse(clean);
    if (uri != null && !uri.hasScheme) uri = Uri.tryParse('https://$clean');
    if (uri == null) return;

    final scheme = uri.scheme.toLowerCase();
    final isWeb = scheme == 'http' || scheme == 'https';
    final mode =
        isWeb ? LaunchMode.externalApplication : LaunchMode.platformDefault;

    try {
      final ok = await launchUrl(uri, mode: mode, webOnlyWindowName: '_blank');
      if (!ok) {
        await Clipboard.setData(ClipboardData(text: uri.toString()));
      }
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: uri.toString()));
    }
  }

  void _openImage(BuildContext context, String url) {
    Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => GptnixFullscreenImageViewer(
          imageUrl: url,
          title: '',
          imageFile: null,
          isDark: isDark,
          surface: surface ?? Colors.transparent,
          surface2: surface2 ?? Colors.transparent,
          text: textColor ?? Colors.white,
          subtext: subtext ?? Colors.white70,
          muted: muted ?? Colors.white60,
          border: border ?? Colors.white24,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chunk = text.trimRight();
    if (chunk.trim().isEmpty) return const SizedBox.shrink();

    return SizedBox(
      width: double.infinity,
      child: MarkdownBody(
        data: chunk,
        selectable: selectable,
        softLineBreak: true,
        styleSheet: _style(context),
        extensionSet: md.ExtensionSet(
          md.ExtensionSet.gitHubFlavored.blockSyntaxes,
          md.ExtensionSet.gitHubFlavored.inlineSyntaxes,
        ),
        builders: const {},
        onTapLink: (_, href, __) async {
          if (href == null || href.trim().isEmpty) return;
          await _tapLink(context, href.trim());
        },
        imageBuilder: (uri, title, alt) {
          final url = uri.toString().trim();
          if (url.isEmpty) return const SizedBox.shrink();

          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: InkWell(
              onTap: () => _openImage(context, url),
              borderRadius: BorderRadius.circular(16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.network(
                    url,
                    fit: BoxFit.cover,
                    gaplessPlayback: true,
                    errorBuilder: (_, __, ___) => Container(
                      color: _cSurface2(),
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.broken_image_rounded,
                        color: _cMuted(),
                        size: 26,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ---------------- Code chunk (unchanged) ----------------
class _CodeChunk extends StatefulWidget {
  const _CodeChunk({
    required this.code,
    this.language,
    required this.isDark,
    this.surface2,
    this.border,
    this.textColor,
    this.muted,
  });

  final String code;
  final String? language;
  final bool isDark;

  final Color? surface2;
  final Color? border;
  final Color? textColor;
  final Color? muted;

  @override
  State<_CodeChunk> createState() => _CodeChunkState();
}

class _CodeChunkState extends State<_CodeChunk> {
  bool _expanded = true;

  Color _cText() =>
      widget.textColor ??
      (widget.isDark ? const Color(0xFFE5E7EB) : const Color(0xFF0F172A));
  Color _cMuted() =>
      widget.muted ??
      (widget.isDark ? const Color(0xFF64748B) : const Color(0xFF9CA3AF));
  Color _cBorder() =>
      widget.border ??
      (widget.isDark ? const Color(0xFF233044) : const Color(0xFFE5E7EB));
  Color _cSurface2() =>
      widget.surface2 ??
      (widget.isDark ? const Color(0xFF0B1224) : const Color(0xFFF8FAFC));

  @override
  Widget build(BuildContext context) {
    final lang = (widget.language ?? '').trim();
    final header = Row(
      children: [
        Text(
          lang.isEmpty ? 'code' : lang,
          style: TextStyle(
            fontSize: 12.5,
            color: _cMuted(),
            fontWeight: FontWeight.w700,
          ),
        ),
        const Spacer(),
        IconButton(
          visualDensity: VisualDensity.compact,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
          onPressed: () => setState(() => _expanded = !_expanded),
          icon: Icon(
            _expanded ? Icons.expand_less : Icons.expand_more,
            size: 18,
            color: _cMuted(),
          ),
        ),
        IconButton(
          visualDensity: VisualDensity.compact,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: widget.code));
            final m = ScaffoldMessenger.maybeOf(context);
            m?.clearSnackBars();
            m?.showSnackBar(
              const SnackBar(
                  content: Text('Kopirano'),
                  duration: Duration(milliseconds: 850)),
            );
          },
          icon: Icon(Icons.copy_rounded, size: 18, color: _cMuted()),
        ),
      ],
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        color: _cSurface2(),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _cBorder(), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          header,
          if (_expanded) ...[
            const SizedBox(height: 8),
            SelectableText(
              widget.code,
              style: TextStyle(
                fontFamily: 'RobotoMono',
                fontSize: 13.5,
                height: 1.45,
                color: _cText(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
