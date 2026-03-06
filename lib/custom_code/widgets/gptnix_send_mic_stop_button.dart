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

import 'index.dart';

class GptnixSendMicStopButton extends StatefulWidget {
  const GptnixSendMicStopButton({
    super.key,

    // ✅ FlutterFlow friendly
    this.width,
    this.height,
    required this.isStreaming,
    required this.isSending,
    required this.canSend,
    required this.isDark,
    required this.borderColor,

    // ✅ FF-safe dynamic callbacks:
    // can be () => void OR () => Future<void>
    this.onStop,
    this.onSend,
    this.onVoiceChat,
  });

  final double? width;
  final double? height;

  final bool isStreaming;
  final bool isSending;
  final bool canSend;
  final bool isDark;
  final Color borderColor;

  final dynamic onStop;
  final dynamic onSend;
  final dynamic onVoiceChat;

  @override
  State<GptnixSendMicStopButton> createState() =>
      _GptnixSendMicStopButtonState();
}

class _GptnixSendMicStopButtonState extends State<GptnixSendMicStopButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  late final Animation<double> _breath;

  bool _pressed = false;

  bool get _disabled => widget.isSending;

  // ✅ Smooth icon switching
  IconData get _icon {
    if (widget.isStreaming) return Icons.stop_rounded;
    if (widget.canSend) return Icons.arrow_upward_rounded;
    return Icons.mic_none_rounded;
  }

  // ✅ ALL BLUE – only shade changes depending on state
  Color get _baseBlue {
    // streaming stop = malo "tamnije ozbiljno"
    if (widget.isStreaming) {
      return widget.isDark ? const Color(0xFF2563EB) : const Color(0xFF1D4ED8);
    }

    // canSend = "primary send"
    if (widget.canSend) {
      return widget.isDark ? const Color(0xFF3B82F6) : const Color(0xFF2563EB);
    }

    // mic idle = "soft blue"
    return widget.isDark ? const Color(0xFF1E40AF) : const Color(0xFF60A5FA);
  }

  // ✅ always white icon
  Color get _iconColor => Colors.white;

  // ✅ breathing intensity by state (subtle)
  double get _breathStrength {
    if (_disabled) return 0.0;
    if (widget.isStreaming) return 0.055;
    if (widget.canSend) return 0.045;
    return 0.030; // mic idle – najsuptilnije
  }

  // ✅ scale: pressed > breathing
  double get _scale {
    if (_disabled) return 1.0;
    if (_pressed) return 0.94;
    return 1.0;
  }

  // ✅ shadow: blue glow (ChatGPT-ish premium)
  List<BoxShadow> get _shadow {
    if (_disabled) return [];

    final c = _baseBlue;
    final base = widget.isDark ? 0.38 : 0.22;

    return [
      BoxShadow(
        color: c.withOpacity(base),
        blurRadius: widget.isDark ? 18 : 16,
        offset: const Offset(0, 6),
      ),
      BoxShadow(
        color: Colors.black.withOpacity(widget.isDark ? 0.35 : 0.12),
        blurRadius: 10,
        offset: const Offset(0, 4),
      ),
    ];
  }

  @override
  void initState() {
    super.initState();

    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1250),
    );

    // 0.0 → 1.0 → 0.0 (breath)
    _breath = CurvedAnimation(
      parent: _pulse,
      curve: Curves.easeInOut,
    );

    _syncPulse();
  }

  @override
  void didUpdateWidget(covariant GptnixSendMicStopButton oldWidget) {
    super.didUpdateWidget(oldWidget);

    // ako se stanje promijeni, sync pulse (npr. mic -> send -> stop)
    if (oldWidget.isStreaming != widget.isStreaming ||
        oldWidget.canSend != widget.canSend ||
        oldWidget.isSending != widget.isSending) {
      _syncPulse();
    }
  }

  void _syncPulse() {
    if (!mounted) return;

    // diše samo kad nije disabled
    if (_disabled) {
      _pulse.stop();
      return;
    }

    // uvijek diše (ali strength je različit po stanju)
    if (!_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  /// ✅ Safe call: accepts void OR Future<void> — never crashes UI
  Future<void> _safeCall(dynamic cb) async {
    if (cb == null) return;
    try {
      final res = cb();
      if (res is Future) {
        await res.catchError((_) {});
      }
    } catch (_) {}
  }

  Future<void> _handleTap() async {
    if (_disabled) return;

    if (widget.isStreaming) {
      await _safeCall(widget.onStop);
      return;
    }

    if (!widget.canSend) {
      await _safeCall(widget.onVoiceChat);
      return;
    }

    await _safeCall(widget.onSend);
  }

  @override
  Widget build(BuildContext context) {
    final double sizeW = widget.width ?? 46;
    final double sizeH = widget.height ?? 46;
    final double size = sizeW < sizeH ? sizeW : sizeH;

    // final color (disabled fade)
    final bg = _baseBlue.withOpacity(_disabled ? 0.45 : 1.0);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) {
        if (_disabled) return;
        setState(() => _pressed = true);
      },
      onTapUp: (_) {
        if (!mounted) return;
        setState(() => _pressed = false);
      },
      onTapCancel: () {
        if (!mounted) return;
        setState(() => _pressed = false);
      },
      onTap: _handleTap,
      child: AnimatedBuilder(
        animation: _breath,
        builder: (context, _) {
          // breathing glow + subtle scale
          final breath = (_breath.value - 0.5).abs() * 2; // 0..1..0
          final extraScale = 1.0 + (breath * _breathStrength);

          final glowOpacity =
              widget.isDark ? (0.30 + 0.20 * breath) : (0.18 + 0.14 * breath);

          return AnimatedScale(
            scale: _scale * extraScale,
            duration: const Duration(milliseconds: 120),
            curve: Curves.easeOut,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              curve: Curves.easeOutCubic,
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: bg,
                shape: BoxShape.circle,
                boxShadow: _disabled
                    ? []
                    : [
                        // blue breathing halo
                        BoxShadow(
                          color: _baseBlue.withOpacity(glowOpacity),
                          blurRadius: 18 + 10 * breath,
                          spreadRadius: 0 + 1.2 * breath,
                          offset: const Offset(0, 7),
                        ),
                        ..._shadow,
                      ],
              ),
              child: Center(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 160),
                  switchInCurve: Curves.easeOut,
                  switchOutCurve: Curves.easeIn,
                  transitionBuilder: (child, anim) {
                    return FadeTransition(
                      opacity: anim,
                      child: ScaleTransition(
                        scale:
                            Tween<double>(begin: 0.88, end: 1.0).animate(anim),
                        child: child,
                      ),
                    );
                  },
                  child: Icon(
                    _icon,
                    key: ValueKey(_icon.codePoint),
                    color: _iconColor.withOpacity(_disabled ? 0.7 : 1.0),
                    size: (size * 0.52).clamp(18.0, 25.0),
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
