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

class GptnixScrollToBottomButton extends StatelessWidget {
  const GptnixScrollToBottomButton({
    super.key,
    this.width,
    this.height,
    this.isDark,
    this.surface,
    this.border,
    this.iconColor,
    this.onTap,
  });

  final double? width;
  final double? height;
  final bool? isDark;

  final Color? surface;
  final Color? border;
  final Color? iconColor;

  final Future Function()? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final bool dark =
        isDark ?? (Theme.of(context).brightness == Brightness.dark);

    // ✅ ChatGPT-ish floating pill
    final Color bg =
        surface ?? (dark ? const Color(0xFF1A1A1A) : const Color(0xFFFFFFFF));
    final Color bColor =
        border ?? (dark ? const Color(0xFF2A2A2A) : const Color(0xFFE6E6E6));
    final Color iColor = iconColor ?? (dark ? Colors.white70 : Colors.black54);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () async => await onTap?.call(),
        borderRadius: BorderRadius.circular(999),
        child: Container(
          width: width ?? 42,
          height: height ?? 42,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: bColor, width: 1),
            boxShadow: [
              BoxShadow(
                blurRadius: 18,
                offset: const Offset(0, 8),
                color: Colors.black.withOpacity(dark ? 0.25 : 0.10),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Icon(
            Icons.keyboard_arrow_down_rounded,
            size: 26,
            color: iColor,
          ),
        ),
      ),
    );
  }
}
