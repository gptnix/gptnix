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

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import '/custom_code/widgets/index.dart';

import 'dart:convert';

import 'gptnix_tool_status_bar.dart';

class GptnixAssistantMessageBody extends StatelessWidget {
  const GptnixAssistantMessageBody({
    super.key,
    this.width,
    this.height,
    required this.rawText,
    this.isTyping = false,
    this.sourcesJson,
    this.toolsJson,
    this.onRegenerate,
    this.onCopy,
    this.onSpeak,
    this.isDark = false,
    this.showAvatar = true,
    this.hideBubble = true,
    this.stableId,
    this.avatar,
    // UX
    this.showCopyButton = true,
    this.enableLongPressCopy = true,

    // Tool status context
    this.isStreaming = false,
    this.deepThink = false,
    this.onSkipTool,
  });

  final double? width;
  final double? height;
  final String rawText;
  final bool isTyping;

  final dynamic sourcesJson;
  final dynamic toolsJson;

  final VoidCallback? onRegenerate;
  final VoidCallback? onCopy;
  final VoidCallback? onSpeak;

  final bool isDark;
  final bool showAvatar;
  final bool hideBubble;
  final String? stableId;
  final Widget? avatar;

  final bool showCopyButton;
  final bool enableLongPressCopy;

  final bool isStreaming;
  final bool deepThink;
  final VoidCallback? onSkipTool;

  @override
  Widget build(BuildContext context) {
    final dark = isDark;
    final theme = FlutterFlowTheme.of(context);

    final text = rawText;

    final maxW = width ?? MediaQuery.of(context).size.width;
    final contentMax = math.min(740.0, maxW - 24);

    // P3-A: use FlutterFlowTheme tokens instead of hardcoded Colors
    final bubbleColor = theme.secondaryBackground;
    final borderColor = theme.alternate.withOpacity(0.3);

    // textColor kept for GptnixRichContent's own theming (passed as isDark)
    // but kept here for any remaining legacy references
    final textColor = theme.primaryText;

    Widget content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ChatGPT-style Tool status (EN ONLY)
        if (toolsJson != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: GptnixToolStatusBar(
              toolStatuses: _parseToolStatuses(toolsJson),
              isDark: dark,
              isStreaming: isStreaming,
              deepThink: deepThink,
              onSkip: onSkipTool ?? () {},
            ),
          )
        else if (isStreaming && deepThink)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: GptnixToolStatusBar(
              toolStatuses: const [],
              isDark: dark,
              isStreaming: true,
              deepThink: true,
              onSkip: onSkipTool ?? () {},
            ),
          ),

        if (isTyping && text.isEmpty)
          const _TypingDots()
        else
          // P1-A: render with full markdown support via GptnixRichContent.
          // fastMode=true during streaming (isTyping) skips expensive
          // linkify + heading-promotion to avoid layout jank per token.
          GptnixRichContent(
            text: text,
            isDark: dark,
            fastMode: isTyping,
            selectable: true,
          ),
      ],
    );

    if (!hideBubble) {
      content = Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bubbleColor,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: borderColor),
        ),
        child: content,
      );
    }

    final rowChildren = <Widget>[];

    if (showAvatar) {
      rowChildren.add(
        Padding(
          padding: const EdgeInsets.only(top: 6, right: 10),
          child: avatar ??
              CircleAvatar(
                radius: 14,
                backgroundColor: theme.alternate.withOpacity(0.4),
                child: Icon(
                  Icons.auto_awesome,
                  size: 16,
                  color: theme.secondaryText,
                ),
              ),
        ),
      );
    }

    rowChildren.add(
      ConstrainedBox(
        constraints: BoxConstraints(maxWidth: contentMax),
        child: content,
      ),
    );

    if (showCopyButton && onCopy != null) {
      rowChildren.add(
        const SizedBox(width: 8),
      );
      rowChildren.add(
        Tooltip(
          message: 'Kopiraj',
          child: InkWell(
            onTap: onCopy,
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Icon(
                Icons.copy_rounded,
                size: 18,
                color: theme.secondaryText,
              ),
            ),
          ),
        ),
      );
    }

    final body = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: rowChildren,
    );

    if (!enableLongPressCopy) {
      return body;
    }

    return GestureDetector(
      onLongPress: () async {
        if (text.trim().isEmpty) return;
        await Clipboard.setData(ClipboardData(text: text));
        HapticFeedback.selectionClick();
      },
      child: body,
    );
  }
}

List<Map<String, dynamic>> _parseToolStatuses(dynamic toolsJson) {
  if (toolsJson == null) return const <Map<String, dynamic>>[];

  dynamic decoded = toolsJson;

  if (decoded is String) {
    final s = decoded.trim();
    if (s.isEmpty) return const <Map<String, dynamic>>[];
    try {
      decoded = jsonDecode(s);
    } catch (_) {
      return const <Map<String, dynamic>>[];
    }
  }

  if (decoded is Map) {
    if (decoded['toolStatuses'] is List) {
      decoded = decoded['toolStatuses'];
    } else if (decoded['items'] is List) {
      decoded = decoded['items'];
    } else {
      return <Map<String, dynamic>>[Map<String, dynamic>.from(decoded as Map)];
    }
  }

  if (decoded is! List) return const <Map<String, dynamic>>[];

  final out = <Map<String, dynamic>>[];
  for (final it in decoded) {
    if (it is Map) {
      out.add(Map<String, dynamic>.from(it as Map));
    }
  }
  return out;
}

class _TypingDots extends StatefulWidget {
  const _TypingDots();

  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _a;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
    _a = CurvedAnimation(parent: _c, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _a,
      builder: (context, _) {
        final v = _a.value;
        final dots = (v < 0.33)
            ? '.'
            : (v < 0.66)
                ? '..'
                : '...';
        return Text(
          dots,
          style: TextStyle(
            fontSize: 16,
            height: 1.2,
            color: Theme.of(context).brightness == Brightness.dark
                ? Colors.white70
                : Colors.black54,
          ),
        );
      },
    );
  }
}
