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

import 'package:flutter/services.dart';

class GptnixDeepThinkButton extends StatefulWidget {
  const GptnixDeepThinkButton({
    super.key,
    required this.enabled, // think mode ON/OFF
    required this.disabled, // npr streaming -> true
    required this.isDark,
    required this.onTap,
    this.width,
    this.height,
  });

  final bool enabled;
  final bool disabled;
  final bool isDark;

  /// ✅ FF-safe: može biti () => void ili () => Future<void>
  final dynamic onTap;

  final double? width;
  final double? height;

  @override
  State<GptnixDeepThinkButton> createState() => _GptnixDeepThinkButtonState();
}

class _GptnixDeepThinkButtonState extends State<GptnixDeepThinkButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pressC;
  bool _hover = false;

  bool get _disabled => widget.disabled;

  @override
  void initState() {
    super.initState();
    _pressC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 140),
      value: 0.0,
    );
  }

  @override
  void dispose() {
    _pressC.dispose();
    super.dispose();
  }

  Future<void> _safeCall(dynamic cb) async {
    if (cb == null) return;
    try {
      final res = cb();
      if (res is Future) await res.catchError((_) {});
    } catch (_) {}
  }

  Future<void> _handleTap() async {
    if (_disabled) return;
    HapticFeedback.lightImpact();
    await _safeCall(widget.onTap);
  }

  void _pressIn() {
    if (_disabled) return;
    _pressC.animateTo(1.0, curve: Curves.easeOutCubic);
  }

  void _pressOut() {
    if (_disabled) return;
    _pressC.animateTo(0.0, curve: Curves.easeOutCubic);
  }

  @override
  Widget build(BuildContext context) {
    final double w = widget.width ?? 36;
    final double h = widget.height ?? 36;
    final double size = w < h ? w : h;

    // ✅ “ChatGPT-ish”: ikona bez pozadine, ali vidljiva u oba moda
    final Color iconColor = widget.isDark ? Colors.white : Colors.black;
    final double iconOpacity =
        _disabled ? 0.26 : (widget.enabled ? 0.92 : 0.78);

    // ripple/hover boje (bez pozadine)
    final Color inkBase = widget.isDark ? Colors.white : Colors.black;
    final Color splash = inkBase.withOpacity(widget.isDark ? 0.10 : 0.08);
    final Color highlight = inkBase.withOpacity(widget.isDark ? 0.06 : 0.05);
    final Color hover = inkBase.withOpacity(widget.isDark ? 0.06 : 0.04);
    final Color ring = inkBase.withOpacity(widget.isDark ? 0.10 : 0.08);

    return MouseRegion(
      onEnter: (_) {
        if (_disabled) return;
        setState(() => _hover = true);
      },
      onExit: (_) {
        if (_disabled) return;
        setState(() => _hover = false);
      },
      child: SizedBox(
        width: size,
        height: size,
        child: Material(
          color: Colors.transparent,
          child: InkResponse(
            onTap: _disabled ? null : () async => await _handleTap(),
            onTapDown: _disabled ? null : (_) => _pressIn(),
            onTapCancel: _disabled ? null : _pressOut,
            onTapUp: _disabled ? null : (_) => _pressOut(),
            containedInkWell: true,
            highlightShape: BoxShape.circle,
            radius: size * 0.62,
            splashColor: splash,
            highlightColor: highlight,
            hoverColor: hover,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 140),
              curve: Curves.easeOutCubic,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                border: _hover && !_disabled
                    ? Border.all(color: ring, width: 1)
                    : null,
              ),
              child: Center(
                child: AnimatedBuilder(
                  animation: _pressC,
                  builder: (context, _) {
                    final t = _pressC.value;
                    final scale = 1.0 - (t * 0.07);
                    final pressOpacity = 1.0 - (t * 0.06);

                    return Opacity(
                      opacity: iconOpacity * pressOpacity,
                      child: Transform.scale(
                        scale: scale,
                        child: Icon(
                          // ✅ SATIĆ (ne glava/gear)
                          Icons.access_time_rounded,
                          size: size * 0.70,
                          color: iconColor,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
