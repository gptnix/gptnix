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

import 'package:flutter/services.dart';

class GptnixMessageActionRow extends StatelessWidget {
  const GptnixMessageActionRow({
    super.key,
    this.width,
    this.height,
    this.isDark,
    this.rawText,
    this.onCopy,
    this.onLike,
    this.onDislike,
    this.onVoice,
    this.onShare,
  });

  final double? width;
  final double? height;
  final bool? isDark;
  final String? rawText;

  // ✅ Async callbacks za haptic feedback
  final Future<void> Function()? onCopy;
  final Future<void> Function()? onLike;
  final Future<void> Function()? onDislike;
  final Future<void> Function()? onVoice;
  final Future<void> Function()? onShare;

  @override
  Widget build(BuildContext context) {
    final bright = Theme.of(context).brightness;
    final dark = isDark ?? (bright == Brightness.dark);

    final iconColor = dark ? const Color(0xFFB6C2D3) : const Color(0xFF64748B);
    final bgHover = dark ? const Color(0xFF0F1A2E) : const Color(0xFFF1F5F9);

    // ✅ Jači splash za bolji vizualni feedback
    final splashColor =
        dark ? Colors.white.withOpacity(0.25) : Colors.black.withOpacity(0.2);

    final highlightColor =
        dark ? Colors.white.withOpacity(0.12) : Colors.black.withOpacity(0.1);

    Widget btn(IconData icon, Future<void> Function()? onTap) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap == null
              ? null
              : () async {
                  // ✅ Haptic feedback PRIJE callback-a
                  HapticFeedback.lightImpact();
                  await onTap();
                },
          borderRadius: BorderRadius.circular(999),
          splashColor: splashColor, // ✅ Jači splash
          highlightColor: highlightColor,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Icon(icon, size: 18, color: iconColor),
          ),
        ),
      );
    }

    return SizedBox(
      width: width,
      height: height,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 2, 64, 10),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              btn(Icons.content_copy_rounded, onCopy),
              const SizedBox(width: 6),
              btn(Icons.thumb_up_alt_outlined, onLike),
              const SizedBox(width: 6),
              btn(Icons.thumb_down_alt_outlined, onDislike),
              const SizedBox(width: 6),
              btn(Icons.volume_up_rounded, onVoice),
              const SizedBox(width: 6),
              btn(Icons.ios_share_rounded, onShare),
            ],
          ),
        ),
      ),
    );
  }
}
