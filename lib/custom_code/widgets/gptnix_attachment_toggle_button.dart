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

class GptnixAttachmentButtonClaude extends StatefulWidget {
  const GptnixAttachmentButtonClaude({
    super.key,
    this.width,
    this.height,
    required this.isOpen,
    required this.disabled,
    required this.isDark,

    /// ✅ FF-safe: može biti () => void ili () => Future<void>
    required this.onTap,
  });

  final double? width;
  final double? height;

  final bool isOpen;
  final bool disabled;
  final bool isDark;

  final dynamic onTap;

  @override
  State<GptnixAttachmentButtonClaude> createState() =>
      _GptnixAttachmentButtonClaudeState();
}

class _GptnixAttachmentButtonClaudeState
    extends State<GptnixAttachmentButtonClaude>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  late final Animation<double> _breath;

  bool _hover = false;
  bool _pressed = false;

  bool get _disabled => widget.disabled;

  IconData get _icon => widget.isOpen ? Icons.close_rounded : Icons.add_rounded;

  // ✅ Plava baza (kao ostali gumbi)
  Color get _baseBlue {
    // otvoreno -> malo "jače" da se vidi da je aktivno
    if (widget.isOpen) {
      return widget.isDark ? const Color(0xFF3B82F6) : const Color(0xFF2563EB);
    }
    // zatvoreno -> standard
    return widget.isDark ? const Color(0xFF2563EB) : const Color(0xFF3B82F6);
  }

  Color get _iconColor => Colors.white;

  double get _breathStrength {
    if (_disabled) return 0.0;
    if (widget.isOpen) return 0.040; // open -> malo više "živi"
    return 0.025; // idle -> suptilno
  }

  double get _scale {
    if (_disabled) return 1.0;
    if (_pressed) return 0.94;
    if (_hover) return 1.03;
    return 1.0;
  }

  List<BoxShadow> get _shadow {
    if (_disabled) return [];

    final base = widget.isDark ? 0.30 : 0.16;
    final c = _baseBlue;

    return [
      BoxShadow(
        color: c.withOpacity(base),
        blurRadius: _hover ? 18 : 14,
        offset: Offset(0, _hover ? 7 : 6),
      ),
      BoxShadow(
        color: Colors.black.withOpacity(widget.isDark ? 0.30 : 0.10),
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
      duration: const Duration(milliseconds: 1300),
    );

    _breath = CurvedAnimation(
      parent: _pulse,
      curve: Curves.easeInOut,
    );

    _syncPulse();
  }

  @override
  void didUpdateWidget(covariant GptnixAttachmentButtonClaude oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.disabled != widget.disabled ||
        oldWidget.isOpen != widget.isOpen) {
      _syncPulse();
    }
  }

  void _syncPulse() {
    if (!mounted) return;

    if (_disabled) {
      _pulse.stop();
      return;
    }

    if (!_pulse.isAnimating) {
      _pulse.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
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
    await _safeCall(widget.onTap);
  }

  @override
  Widget build(BuildContext context) {
    final double w = widget.width ?? 40;
    final double h = widget.height ?? 40;
    final double size = w < h ? w : h;

    final bg = _baseBlue.withOpacity(_disabled ? 0.35 : 1.0);

    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() {
        _hover = false;
        _pressed = false;
      }),
      child: GestureDetector(
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
            final breath = (_breath.value - 0.5).abs() * 2; // 0..1..0
            final extraScale = 1.0 + (breath * _breathStrength);

            final glowOpacity =
                widget.isDark ? (0.18 + 0.16 * breath) : (0.12 + 0.12 * breath);

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
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: _disabled
                      ? []
                      : [
                          // breathing halo
                          BoxShadow(
                            color: _baseBlue.withOpacity(glowOpacity),
                            blurRadius: 14 + 8 * breath,
                            offset: const Offset(0, 6),
                          ),
                          ..._shadow,
                        ],
                ),
                child: Center(
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 120),
                    opacity: _disabled ? 0.65 : 1.0,
                    child: Icon(
                      _icon,
                      color: _iconColor,
                      size: (size * 0.60).clamp(18.0, 24.0),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
