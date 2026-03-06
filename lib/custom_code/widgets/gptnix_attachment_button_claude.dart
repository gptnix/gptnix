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

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/services.dart';

class GptnixAttachmentButtonClaude extends StatefulWidget {
  const GptnixAttachmentButtonClaude({
    super.key,
    this.width,
    this.height,
    required this.isOpen,
    required this.disabled,
    required this.isDark,
    this.onTap,
  });

  final double? width;
  final double? height;

  /// true => meni otvoren (rotacija s delay + overshoot)
  final bool isOpen;

  final bool disabled;
  final bool isDark;

  /// FlutterFlow callback
  final dynamic onTap;

  @override
  State<GptnixAttachmentButtonClaude> createState() =>
      _GptnixAttachmentButtonClaudeState();
}

class _GptnixAttachmentButtonClaudeState
    extends State<GptnixAttachmentButtonClaude> with TickerProviderStateMixin {
  // press anim
  late final AnimationController _pressC;

  // rotate anim (0.0..1.0 -> pretvaramo u radijane)
  late final AnimationController _rotC;

  bool _hover = false;
  Timer? _rotateDelayTimer;

  static const _rotateDelay = Duration(milliseconds: 80);

  // target degrees
  static const double _degClosed = 0.0;
  static const double _degOpen = 45.0;
  static const double _degOvershoot = 52.0; // malo preko pa nazad

  @override
  void initState() {
    super.initState();

    _pressC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 140),
      value: 0.0,
    );

    _rotC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 160),
      value: widget.isOpen ? 1.0 : 0.0, // 0=+, 1=X
    );
  }

  @override
  void didUpdateWidget(covariant GptnixAttachmentButtonClaude oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.disabled && _pressC.value != 0.0) {
      _pressC.animateTo(0.0, curve: Curves.easeOutCubic);
    }

    if (oldWidget.isOpen != widget.isOpen) {
      _rotateDelayTimer?.cancel();

      if (widget.isOpen) {
        // ✅ otvara se: delay 80ms pa overshoot -> settle
        _rotateDelayTimer = Timer(_rotateDelay, () async {
          if (!mounted) return;

          // faza 1: overshoot
          await _animateRotationToDeg(_degOvershoot,
              duration: const Duration(milliseconds: 140),
              curve: Curves.easeOutCubic);

          if (!mounted) return;

          // faza 2: settle na 45°
          await _animateRotationToDeg(_degOpen,
              duration: const Duration(milliseconds: 110),
              curve: Curves.easeOut);
        });
      } else {
        // ✅ zatvara se: odmah na 0°
        _rotC.stop();
        _rotC.value = 0.0;
      }
    }
  }

  @override
  void dispose() {
    _rotateDelayTimer?.cancel();
    _pressC.dispose();
    _rotC.dispose();
    super.dispose();
  }

  Future<void> _handleTap() async {
    if (widget.disabled) return;

    HapticFeedback.lightImpact();

    if (widget.onTap == null) return;
    try {
      final res = widget.onTap();
      if (res is Future) await res.catchError((_) {});
    } catch (_) {}
  }

  void _pressIn() {
    if (widget.disabled) return;
    _pressC.animateTo(1.0, curve: Curves.easeOutCubic);
  }

  void _pressOut() {
    if (widget.disabled) return;
    _pressC.animateTo(0.0, curve: Curves.easeOutCubic);
  }

  // Pretvori stupnjeve u controller value (0..1) gdje 1 ~= 45°,
  // ali mi želimo podržati i 52°, pa koristimo “value = deg / 52”.
  // (konzistentno dok god maxDeg = _degOvershoot)
  double _degToValue(double deg) {
    final maxDeg = _degOvershoot;
    if (maxDeg <= 0) return 0.0;
    return (deg / maxDeg).clamp(0.0, 1.0);
  }

  double _valueToDeg(double v) {
    return v.clamp(0.0, 1.0) * _degOvershoot;
  }

  Future<void> _animateRotationToDeg(
    double deg, {
    required Duration duration,
    required Curve curve,
  }) async {
    final target = _degToValue(deg);
    _rotC.duration = duration;
    try {
      await _rotC.animateTo(target, curve: curve);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final w = widget.width ?? 36.0;
    final h = widget.height ?? 36.0;
    final size = w < h ? w : h;

    final Color iconColor = widget.isDark ? Colors.white : Colors.black;
    final double iconOpacity = widget.disabled ? 0.26 : 0.92;

    final Color inkBase = widget.isDark ? Colors.white : Colors.black;
    final Color splash = inkBase.withOpacity(widget.isDark ? 0.10 : 0.08);
    final Color highlight = inkBase.withOpacity(widget.isDark ? 0.06 : 0.05);
    final Color hover = inkBase.withOpacity(widget.isDark ? 0.06 : 0.04);
    final Color ring = inkBase.withOpacity(widget.isDark ? 0.10 : 0.08);

    return MouseRegion(
      onEnter: (_) {
        if (widget.disabled) return;
        setState(() => _hover = true);
      },
      onExit: (_) {
        if (widget.disabled) return;
        setState(() => _hover = false);
      },
      child: SizedBox(
        width: size,
        height: size,
        child: Material(
          color: Colors.transparent,
          child: InkResponse(
            onTap: widget.disabled ? null : () async => await _handleTap(),
            onTapDown: widget.disabled ? null : (_) => _pressIn(),
            onTapCancel: widget.disabled ? null : _pressOut,
            onTapUp: widget.disabled ? null : (_) => _pressOut(),
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
                border: _hover && !widget.disabled
                    ? Border.all(color: ring, width: 1)
                    : null,
              ),
              child: Center(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_pressC, _rotC]),
                  builder: (context, _) {
                    final t = _pressC.value;
                    final scale = 1.0 - (t * 0.07);
                    final pressOpacity = 1.0 - (t * 0.06);

                    // rotacija u radijanima
                    final deg = _valueToDeg(_rotC.value);
                    final rad = deg * (math.pi / 180.0);

                    return Opacity(
                      opacity: iconOpacity * pressOpacity,
                      child: Transform.scale(
                        scale: scale,
                        child: Transform.rotate(
                          angle: rad,
                          child: Icon(
                            Icons.add_rounded,
                            size: size * 0.74,
                            color: iconColor,
                          ),
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
