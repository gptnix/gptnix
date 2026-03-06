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

/// ─────────────────────────────────────────────────────────────────────────
/// GptnixToolStatusBar — ChatGPT-like tool status (EN ONLY)
///
/// - Headline (bold) + 1–6 detail lines
/// - Skip button (calls onSkip)
/// - Dedup + limit 12 events
/// - AnimatedSize + AnimatedSwitcher to avoid layout jumps
///
/// IMPORTANT RULE:
/// UI text in this widget MUST ALWAYS be English.
/// ─────────────────────────────────────────────────────────────────────────
class GptnixToolStatusBar extends StatelessWidget {
  const GptnixToolStatusBar({
    super.key,
    required this.toolStatuses,
    required this.isDark,
    required this.isStreaming,
    required this.deepThink,
    required this.onSkip,
  });

  final List<Map<String, dynamic>> toolStatuses;
  final bool isDark;
  final bool isStreaming;
  final bool deepThink;
  final VoidCallback onSkip;

  static const int _maxEvents = 12;
  static const int _maxDetailLines = 6;

  @override
  Widget build(BuildContext context) {
    final visible = isStreaming && (toolStatuses.isNotEmpty || deepThink);

    final resolved = _resolveModel(toolStatuses, deepThink);

    // If we're streaming but we have absolutely nothing to show, hide.
    if (isStreaming && toolStatuses.isEmpty && !deepThink) {
      return const SizedBox.shrink();
    }

    final card = _StatusCard(
      isDark: isDark,
      headline: resolved.headline,
      icon: resolved.icon,
      details: resolved.details,
      onSkip: onSkip,
    );

    return AnimatedSize(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 180),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeOutCubic,
        transitionBuilder: (child, anim) {
          return FadeTransition(
            opacity: anim,
            child: SizeTransition(sizeFactor: anim, child: child),
          );
        },
        child: visible
            ? Padding(
                key: const ValueKey<String>('tool_status_visible'),
                padding: const EdgeInsets.only(bottom: 10),
                child: card,
              )
            : const SizedBox(
                key: ValueKey<String>('tool_status_hidden'),
              ),
      ),
    );
  }

  _ResolvedStatus _resolveModel(
    List<Map<String, dynamic>> raw,
    bool deepThink,
  ) {
    final items = _normalize(raw);

    // Pick "current" tool: last event (most recent)
    final current = items.isNotEmpty ? items.last : null;
    final tool = (current?['tool'] ?? '').toString().toLowerCase();
    final headline = _headlineFor(tool: tool, deepThink: deepThink);
    final icon = _iconFor(tool: tool, deepThink: deepThink);

    final details = _buildDetailLines(items);

    // If deepThink is enabled and no details, we still show a single line.
    if (details.isEmpty && deepThink) {
      return _ResolvedStatus(
        headline: 'Thinking…',
        icon: Icons.psychology_rounded,
        details: const <String>[],
      );
    }

    return _ResolvedStatus(headline: headline, icon: icon, details: details);
  }

  List<Map<String, dynamic>> _normalize(List<Map<String, dynamic>> raw) {
    // Keep last N, de-dup consecutive duplicates (tool+title+message)
    final tail =
        raw.length <= _maxEvents ? raw : raw.sublist(raw.length - _maxEvents);

    final out = <Map<String, dynamic>>[];
    String lastSig = '';
    for (final r in tail) {
      final tool = (r['tool'] ?? r['name'] ?? '').toString();
      final title = (r['title'] ?? '').toString();
      final msg = (r['message'] ?? '').toString();
      final sig = '$tool|$title|$msg';
      if (sig == lastSig) continue;
      lastSig = sig;
      out.add(r);
    }
    return out;
  }

  List<String> _buildDetailLines(List<Map<String, dynamic>> items) {
    final out = <String>[];
    final seen = <String>{};

    // Use newest-first for details, then reverse to keep stable ordering.
    for (int i = items.length - 1; i >= 0; i--) {
      final it = items[i];
      final tool = (it['tool'] ?? it['name'] ?? '').toString().toLowerCase();
      final title = (it['title'] ?? '').toString();
      final msg = (it['message'] ?? '').toString();

      final candidateLines = <String>[];
      // Prefer parsing URLs/domains from message/title.
      candidateLines.addAll(_extractDomains(msg));
      candidateLines.addAll(_extractDomains(title));

      // Fallback to trimmed message/title.
      final cleanedMsg = _cleanDetailText(msg);
      if (cleanedMsg.isNotEmpty) candidateLines.add(cleanedMsg);
      final cleanedTitle = _cleanDetailText(title);
      if (cleanedTitle.isNotEmpty) candidateLines.add(cleanedTitle);

      for (final line in candidateLines) {
        final normalized = line.trim();
        if (normalized.isEmpty) continue;
        final key = '$tool::$normalized';
        if (seen.contains(key)) continue;
        seen.add(key);
        out.add(_truncate(normalized, 80));
        if (out.length >= _maxDetailLines) break;
      }
      if (out.length >= _maxDetailLines) break;
    }

    return out.reversed.toList(growable: false);
  }

  String _headlineFor({required String tool, required bool deepThink}) {
    if (deepThink && tool.isEmpty) return 'Thinking…';

    final t = tool.trim();
    if (t.contains('image')) return 'Generating image…';
    if (t.contains('web') || t.contains('search')) return 'Searching the web…';
    if (t.contains('file') || t.contains('attach')) return 'Reading files…';
    if (t.contains('reason') || t.contains('think')) return 'Thinking…';
    return 'Processing…';
  }

  IconData _iconFor({required String tool, required bool deepThink}) {
    if (deepThink && tool.isEmpty) return Icons.psychology_rounded;

    final t = tool.trim();
    if (t.contains('image')) return Icons.image_outlined;
    if (t.contains('web') || t.contains('search')) return Icons.public_rounded;
    if (t.contains('file') || t.contains('attach')) {
      return Icons.insert_drive_file_outlined;
    }
    if (t.contains('reason') || t.contains('think')) {
      return Icons.psychology_rounded;
    }
    return Icons.tune_rounded;
  }

  List<String> _extractDomains(String text) {
    final s = text.trim();
    if (s.isEmpty) return const [];

    final re = RegExp(r'(https?:\/\/[^\s\)\]\}]+)', caseSensitive: false);
    final matches = re.allMatches(s);
    if (matches.isEmpty) return const [];

    final out = <String>[];
    for (final m in matches) {
      final url = m.group(1) ?? '';
      final pretty = _formatUrl(url);
      if (pretty.isNotEmpty) out.add(pretty);
    }
    return out;
  }

  String _formatUrl(String url) {
    try {
      final u = Uri.parse(url);
      final host = u.host.isNotEmpty ? u.host : url;
      final path = u.path;
      if (path.isEmpty || path == '/') return host;

      final p = path.length > 24 ? '${path.substring(0, 24)}…' : path;
      return '$host$p';
    } catch (_) {
      // If it's not a valid Uri, keep a safe shortened string.
      return _truncate(url, 40);
    }
  }

  String _cleanDetailText(String s) {
    var t = s.replaceAll('\n', ' ').replaceAll('\t', ' ').trim();
    while (t.contains('  ')) {
      t = t.replaceAll('  ', ' ');
    }
    // Avoid showing headline-like strings twice.
    if (t.toLowerCase() == 'processing…') return '';
    if (t.toLowerCase() == 'thinking…') return '';
    if (t.toLowerCase() == 'searching the web…') return '';
    if (t.toLowerCase() == 'generating image…') return '';
    if (t.toLowerCase() == 'reading files…') return '';
    return t;
  }

  String _truncate(String s, int max) {
    final t = s.trim();
    if (t.length <= max) return t;
    return '${t.substring(0, max - 1)}…';
  }
}

class _ResolvedStatus {
  const _ResolvedStatus({
    required this.headline,
    required this.icon,
    required this.details,
  });

  final String headline;
  final IconData icon;
  final List<String> details;
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.isDark,
    required this.headline,
    required this.icon,
    required this.details,
    required this.onSkip,
  });

  final bool isDark;
  final String headline;
  final IconData icon;
  final List<String> details;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? const Color(0xFF141414) : Colors.white;
    final border = isDark
        ? Colors.white.withOpacity(0.10)
        : Colors.black.withOpacity(0.08);
    final headlineColor = isDark ? Colors.white : const Color(0xFF0D0D0D);
    final detailColor = isDark
        ? Colors.white.withOpacity(0.60)
        : Colors.black.withOpacity(0.55);
    final iconColor = isDark
        ? Colors.white.withOpacity(0.82)
        : Colors.black.withOpacity(0.70);
    final skipColor = isDark
        ? Colors.white.withOpacity(0.70)
        : Colors.black.withOpacity(0.60);

    return Material(
      color: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: border, width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.32 : 0.06),
              blurRadius: 18,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Icon(icon, size: 18, color: iconColor),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          headline,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.15,
                            height: 1.15,
                            color: headlineColor,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      InkWell(
                        onTap: onSkip,
                        borderRadius: BorderRadius.circular(10),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 4),
                          child: Text(
                            'Skip',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: skipColor,
                              letterSpacing: -0.1,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (details.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    ...details.map(
                      (d) => Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text(
                          d,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12.6,
                            fontWeight: FontWeight.w500,
                            height: 1.2,
                            letterSpacing: -0.05,
                            color: detailColor,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
