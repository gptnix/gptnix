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

class GptnixActionIconButton extends StatefulWidget {
  const GptnixActionIconButton({
    super.key,
    this.width,
    this.height,

    /// ✅ FlutterFlow SAFE: icon is dynamic (String / int / IconData)
    required this.icon,
    required this.tooltip,
    required this.surface,
    required this.border,
    required this.subtext,

    /// ✅ FlutterFlow SAFE: dynamic callback
    /// Expected: () => void OR () => Future<void>
    this.onTap,

    /// ✅ optional polish
    this.enabled = true,
    this.radius = 18,
    this.iconSize = 16,
    this.padding = 8,
    this.showTooltip = true,
  });

  final double? width;
  final double? height;

  /// ✅ DO NOT use IconData directly (FF can't process it)
  final dynamic icon;

  final String tooltip;

  final Color surface;
  final Color border;
  final Color subtext;

  /// ✅ FF safe
  final dynamic onTap;

  final bool enabled;

  final double radius;
  final double iconSize;
  final double padding;

  final bool showTooltip;

  @override
  State<GptnixActionIconButton> createState() => _GptnixActionIconButtonState();
}

class _GptnixActionIconButtonState extends State<GptnixActionIconButton> {
  bool _hover = false;
  bool _pressed = false;

  bool get _isDesktop {
    final platform = Theme.of(context).platform;
    return platform == TargetPlatform.windows ||
        platform == TargetPlatform.macOS ||
        platform == TargetPlatform.linux;
  }

  // ✅ Convert dynamic -> IconData
  IconData _resolveIcon(dynamic v) {
    // If used from code: IconData already
    if (v is IconData) return v;

    // If FlutterFlow sends int (codePoint)
    if (v is int) {
      return IconData(v, fontFamily: 'MaterialIcons');
    }

    // If FlutterFlow sends string keys (recommended)
    final key = (v ?? '').toString().trim().toLowerCase();

    switch (key) {
      case 'add':
      case 'plus':
        return Icons.add_rounded;

      case 'close':
      case 'x':
        return Icons.close_rounded;

      case 'send':
      case 'arrow':
      case 'up':
        return Icons.arrow_upward_rounded;

      case 'attach':
      case 'paperclip':
      case 'file':
        return Icons.attach_file_rounded;

      case 'camera':
        return Icons.camera_alt_outlined;

      case 'gallery':
      case 'photo':
        return Icons.photo_outlined;

      case 'copy':
        return Icons.content_copy_rounded;

      case 'retry':
      case 'refresh':
        return Icons.refresh_rounded;

      case 'edit':
      case 'pencil':
        return Icons.edit_rounded;

      case 'trash':
      case 'delete':
        return Icons.delete_outline_rounded;

      case 'stop':
        return Icons.stop_rounded;

      case 'mic':
      case 'voice':
        return Icons.mic_none_rounded;

      default:
        return Icons.more_horiz_rounded;
    }
  }

  double get _scale {
    if (!widget.enabled) return 1.0;
    if (_pressed) return 0.95;
    if (_hover) return 1.03;
    return 1.0;
  }

  Color get _bg {
    if (!widget.enabled) return widget.surface.withOpacity(0.55);

    if (_hover) {
      final dark = Theme.of(context).brightness == Brightness.dark;
      return dark
          ? Colors.white.withOpacity(0.06)
          : Colors.black.withOpacity(0.04);
    }

    return widget.surface;
  }

  Color get _border {
    if (!widget.enabled) return widget.border.withOpacity(0.55);
    return widget.border.withOpacity(0.85);
  }

  Color get _iconColor {
    if (!widget.enabled) return widget.subtext.withOpacity(0.55);
    return widget.subtext.withOpacity(0.95);
  }

  List<BoxShadow> get _shadow {
    if (!widget.enabled) return const [];

    final dark = Theme.of(context).brightness == Brightness.dark;
    return [
      BoxShadow(
        color: Colors.black.withOpacity(dark ? 0.22 : 0.08),
        blurRadius: _hover ? 14 : 10,
        offset: Offset(0, _hover ? 7 : 5),
      ),
    ];
  }

  Future<void> _safeTap() async {
    if (!widget.enabled) return;
    final cb = widget.onTap;
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
    final iconData = _resolveIcon(widget.icon);
    final r = BorderRadius.circular(widget.radius);

    final core = MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() {
        _hover = false;
        _pressed = false;
      }),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) {
          if (!widget.enabled) return;
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
        onTap: _safeTap,
        child: AnimatedScale(
          scale: _scale,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOut,
            width: widget.width,
            height: widget.height,
            padding: EdgeInsets.all(widget.padding),
            decoration: BoxDecoration(
              color: _bg,
              borderRadius: r,
              border: Border.all(color: _border, width: 1),
              boxShadow: _shadow,
            ),
            child: Icon(
              iconData,
              size: widget.iconSize,
              color: _iconColor,
            ),
          ),
        ),
      ),
    );

    // Tooltip only makes sense on desktop/web
    if (widget.showTooltip && _isDesktop && widget.tooltip.trim().isNotEmpty) {
      return Tooltip(message: widget.tooltip, child: core);
    }

    return core;
  }
}
