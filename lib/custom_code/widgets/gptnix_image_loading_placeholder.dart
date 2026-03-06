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

import '/custom_code/actions/index.dart'; // Imports other custom actions

import 'dart:async';

class GptnixImageLoadingPlaceholder extends StatefulWidget {
  const GptnixImageLoadingPlaceholder({
    super.key,
    this.width,
    this.height,
    required this.prompt,
    required this.isDark,
    required this.border,
    required this.surface2,
    required this.text,
    required this.subtext,
  });

  final double? width;
  final double? height;

  /// Prompt koji želiš prikazati ispod statusa (može biti prazan string).
  final String prompt;

  final bool isDark;
  final Color border;
  final Color surface2;
  final Color text;
  final Color subtext;

  @override
  State<GptnixImageLoadingPlaceholder> createState() =>
      _GptnixImageLoadingPlaceholderState();
}

class _GptnixImageLoadingPlaceholderState
    extends State<GptnixImageLoadingPlaceholder>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _s;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1700),
    )..repeat();

    _s = Tween<double>(begin: -1.0, end: 2.0).animate(
      CurvedAnimation(parent: _c, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.height ?? 280;

    return AnimatedBuilder(
      animation: _s,
      builder: (_, __) {
        return Container(
          width: widget.width,
          height: h,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: widget.border),
            gradient: LinearGradient(
              colors: widget.isDark
                  ? const [
                      Color(0xFF0F172A),
                      Color(0xFF111827),
                      Color(0xFF0F172A),
                    ]
                  : const [
                      Color(0xFFEFF2F7),
                      Color(0xFFF7F8FA),
                      Color(0xFFEFF2F7),
                    ],
              stops: [
                (_s.value - 0.3).clamp(0.0, 1.0),
                _s.value.clamp(0.0, 1.0),
                (_s.value + 0.3).clamp(0.0, 1.0),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 62,
                height: 62,
                decoration: BoxDecoration(
                  color: widget.surface2.withOpacity(0.9),
                  shape: BoxShape.circle,
                  border: Border.all(color: widget.border),
                ),
                child: Icon(
                  Icons.auto_awesome,
                  size: 30,
                  color: widget.isDark
                      ? Colors.blue.shade300
                      : Colors.blue.shade700,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Generiram sliku… ✨',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: widget.text.withOpacity(0.92),
                ),
              ),
              if (widget.prompt.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  child: Text(
                    widget.prompt.trim(),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      color: widget.subtext,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
