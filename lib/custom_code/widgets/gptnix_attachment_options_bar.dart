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

class GptnixAttachmentOptionsBar extends StatelessWidget {
  const GptnixAttachmentOptionsBar({
    super.key,
    this.width,
    this.height,
    required this.isDark,
    required this.surface2,
    required this.border,

    /// ✅ NEW preferred
    this.subtext,

    /// ✅ OLD backward compatible
    this.subtextColor,

    // ✅ FlutterFlow SAFE callbacks (void OR Future)
    this.onCamera,
    this.onGallery,
    this.onFiles,

    // ✅ polish
    this.compact = false,
  });

  final double? width;
  final double? height;

  final bool isDark;
  final Color surface2;
  final Color border;

  final Color? subtext;
  final Color? subtextColor;

  /// ✅ FF-safe dynamic callbacks: () => void OR () => Future<void>
  final dynamic onCamera;
  final dynamic onGallery;
  final dynamic onFiles;

  /// If true -> smaller labels / tighter padding
  final bool compact;

  Color _resolveSubtext(BuildContext context) {
    return subtext ??
        subtextColor ??
        FlutterFlowTheme.of(context).secondaryText;
  }

  Color _iconColor(Color sub) {
    // ChatGPT: icon subtle, almost same as subtext
    return isDark ? sub.withOpacity(0.95) : sub.withOpacity(0.90);
  }

  Color _dividerColor() {
    return isDark
        ? Colors.white.withOpacity(0.08)
        : Colors.black.withOpacity(0.07);
  }

  List<BoxShadow> _shadow() {
    // ChatGPT-like soft floating
    return [
      BoxShadow(
        color: Colors.black.withOpacity(isDark ? 0.22 : 0.10),
        blurRadius: 16,
        offset: const Offset(0, 8),
      ),
    ];
  }

  Future<void> _safeCall(dynamic cb) async {
    if (cb == null) return;
    try {
      final res = cb();
      if (res is Future) {
        await res.catchError((_) {});
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final s = _resolveSubtext(context);

    final pillRadius = BorderRadius.circular(18);

    // ChatGPT: bar lagano “pluta” i ne dere se
    final Color pillBg = surface2;
    final Color pillBorder = border.withOpacity(isDark ? 0.55 : 0.70);

    return Container(
      key: const ValueKey('attach_options'),
      width: width,
      height: height,
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          const SizedBox(width: 6),
          Material(
            color: Colors.transparent,
            child: Container(
              decoration: BoxDecoration(
                color: pillBg,
                borderRadius: pillRadius,
                border: Border.all(color: pillBorder, width: 1),
                boxShadow: _shadow(),
              ),
              child: ClipRRect(
                borderRadius: pillRadius,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _AttachOptionBtn(
                      icon: Icons.camera_alt_outlined,
                      label: 'Kamera',
                      compact: compact,
                      iconColor: _iconColor(s),
                      textColor: s,
                      onTap: () => _safeCall(onCamera),
                      isDark: isDark,
                    ),
                    _DividerLine(color: _dividerColor()),
                    _AttachOptionBtn(
                      icon: Icons.photo_outlined,
                      label: 'Galerija',
                      compact: compact,
                      iconColor: _iconColor(s),
                      textColor: s,
                      onTap: () => _safeCall(onGallery),
                      isDark: isDark,
                    ),
                    _DividerLine(color: _dividerColor()),
                    _AttachOptionBtn(
                      icon: Icons.folder_open_outlined,
                      label: 'Datoteke',
                      compact: compact,
                      iconColor: _iconColor(s),
                      textColor: s,
                      onTap: () => _safeCall(onFiles),
                      isDark: isDark,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DividerLine extends StatelessWidget {
  const _DividerLine({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(width: 1, height: 44, color: color);
  }
}

class _AttachOptionBtn extends StatefulWidget {
  const _AttachOptionBtn({
    required this.icon,
    required this.label,
    required this.iconColor,
    required this.textColor,
    required this.onTap,
    required this.isDark,
    required this.compact,
  });

  final IconData icon;
  final String label;
  final Color iconColor;
  final Color textColor;
  final Future<void> Function() onTap;
  final bool isDark;
  final bool compact;

  @override
  State<_AttachOptionBtn> createState() => _AttachOptionBtnState();
}

class _AttachOptionBtnState extends State<_AttachOptionBtn> {
  bool _hover = false;
  bool _pressed = false;

  double get _scale {
    if (_pressed) return 0.97;
    if (_hover) return 1.02;
    return 1.0;
  }

  Color get _bg {
    // ChatGPT hover = barely visible tint
    if (!_hover) return Colors.transparent;
    return widget.isDark
        ? Colors.white.withOpacity(0.06)
        : Colors.black.withOpacity(0.04);
  }

  @override
  Widget build(BuildContext context) {
    final padX = widget.compact ? 12.0 : 14.0;
    final padY = widget.compact ? 10.0 : 12.0;

    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() {
        _hover = false;
        _pressed = false;
      }),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedScale(
          scale: _scale,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.onTap,
              splashColor: widget.isDark
                  ? Colors.white.withOpacity(0.08)
                  : Colors.black.withOpacity(0.06),
              highlightColor: Colors.transparent,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 140),
                curve: Curves.easeOut,
                color: _bg,
                padding: EdgeInsets.symmetric(horizontal: padX, vertical: padY),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      widget.icon,
                      size: 22,
                      color: widget.iconColor,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.label,
                      style: TextStyle(
                        fontSize: widget.compact ? 11.5 : 12,
                        color: widget.textColor.withOpacity(0.95),
                        fontWeight: FontWeight.w700, // manje agresivno od 900
                        letterSpacing: -0.1,
                        height: 1.0,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
