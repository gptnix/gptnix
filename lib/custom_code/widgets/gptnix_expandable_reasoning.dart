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

class GptnixExpandableReasoning extends StatefulWidget {
  const GptnixExpandableReasoning({
    super.key,
    this.width,
    this.height,
    required this.text,
    this.title,
    this.isDark,
    this.surface2,
    this.border,
    this.textColor,
    this.subtext,
    this.muted,
    this.collapsedLines = 3,
  });

  final double? width;
  final double? height;

  final String text;
  final String? title;

  // theme overrides (optional)
  final bool? isDark;
  final Color? surface2;
  final Color? border;
  final Color? textColor;
  final Color? subtext;
  final Color? muted;

  final int collapsedLines;

  @override
  State<GptnixExpandableReasoning> createState() =>
      _GptnixExpandableReasoningState();
}

class _GptnixExpandableReasoningState extends State<GptnixExpandableReasoning> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.text.trim();
    if (t.isEmpty) return const SizedBox.shrink();

    final bright = Theme.of(context).brightness;
    final dark = widget.isDark ?? (bright == Brightness.dark);

    final br = widget.border ??
        (dark ? const Color(0xFF243041) : const Color(0xFFE5E7EB));
    final bg = widget.surface2 ??
        (dark ? const Color(0xFF0B1224) : const Color(0xFFF8FAFC));
    final fg = widget.textColor ??
        (dark ? const Color(0xFFE5E7EB) : const Color(0xFF111827));
    final sub = widget.subtext ??
        (dark ? const Color(0xFF94A3B8) : const Color(0xFF6B7280));
    final mut = widget.muted ??
        (dark ? const Color(0xFF64748B) : const Color(0xFF9CA3AF));

    final title = (widget.title ?? 'Razmišljanje').trim();

    return SizedBox(
      width: widget.width,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => setState(() => _expanded = !_expanded),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: br),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: sub,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 20,
                    color: mut,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              AnimatedSize(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOut,
                child: Text(
                  t,
                  maxLines: _expanded ? null : widget.collapsedLines,
                  overflow:
                      _expanded ? TextOverflow.visible : TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 12.5,
                    height: 1.35,
                    fontStyle: FontStyle.italic,
                    color: fg.withOpacity(dark ? 0.88 : 0.86),
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
