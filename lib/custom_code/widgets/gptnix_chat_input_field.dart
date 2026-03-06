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

class GptnixChatInputField extends StatefulWidget {
  const GptnixChatInputField({
    super.key,
    this.width,
    this.height,

    // ✅ FF-friendly dynamic FocusNode / Controller
    required this.focusNode,
    required this.controller,
    required this.enabled,
    required this.surface,
    required this.border,
    required this.textColor,
    required this.muted,
    required this.hintText,
    required this.onChanged,

    // ✅ polish
    this.borderRadius = 22,
    this.autofocus = false,

    // ✅ (String) => void OR Future<void>
    this.onSubmit,

    // ✅ Used only when height == null
    this.minHeight = 52,

    // ✅ auto-grow
    this.maxLines = 6,

    // ✅ left/right widgets INSIDE the input
    this.prefix,
    this.prefixSize = 36,
    this.prefixGap = 8,
    this.suffix,
    this.suffixSize = 36,
    this.suffixGap = 6,
  });

  final double? width;
  final double? height;

  final dynamic focusNode;
  final dynamic controller;

  final bool enabled;

  final Color surface;
  final Color border;
  final Color textColor;
  final Color muted;

  final String hintText;

  final Future Function(String v) onChanged;

  final double borderRadius;
  final bool autofocus;

  final dynamic onSubmit;

  final double minHeight;
  final int maxLines;

  final Widget? prefix;
  final double prefixSize;
  final double prefixGap;

  final Widget? suffix;
  final double suffixSize;
  final double suffixGap;

  @override
  State<GptnixChatInputField> createState() => _GptnixChatInputFieldState();
}

class _GptnixChatInputFieldState extends State<GptnixChatInputField> {
  late final FocusNode _internalFocusNode;
  late final TextEditingController _internalController;

  bool _focused = false;

  FocusNode get _focusNode {
    final fn = widget.focusNode;
    if (fn is FocusNode) return fn;
    return _internalFocusNode;
  }

  TextEditingController get _controller {
    final c = widget.controller;
    if (c is TextEditingController) return c;
    return _internalController;
  }

  @override
  void initState() {
    super.initState();
    _internalFocusNode = FocusNode();
    _internalController = TextEditingController();

    _focused = _focusNode.hasFocus;
    _focusNode.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(covariant GptnixChatInputField oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.focusNode != widget.focusNode) {
      try {
        final oldFn = oldWidget.focusNode;
        if (oldFn is FocusNode) {
          oldFn.removeListener(_onFocusChange);
        } else {
          _internalFocusNode.removeListener(_onFocusChange);
        }
      } catch (_) {}

      _focused = _focusNode.hasFocus;
      _focusNode.addListener(_onFocusChange);
    }
  }

  @override
  void dispose() {
    try {
      _focusNode.removeListener(_onFocusChange);
    } catch (_) {}

    _internalFocusNode.dispose();
    _internalController.dispose();
    super.dispose();
  }

  void _onFocusChange() {
    if (!mounted) return;
    final now = _focusNode.hasFocus;
    if (now == _focused) return;
    setState(() => _focused = now);
  }

  void _safeCallOnChanged(String v) {
    try {
      final f = widget.onChanged(v);
      f.catchError((_) {});
    } catch (_) {}
  }

  void _safeCallOnSubmit(String v) {
    final cb = widget.onSubmit;
    if (cb == null) return;
    try {
      final res = cb(v);
      if (res is Future) res.catchError((_) {});
    } catch (_) {}
  }

  // ✅ FF-stable: RawKeyEvent (Enter send, Shift+Enter newline on desktop)
  KeyEventResult _handleRawKey(FocusNode node, RawKeyEvent event) {
    if (widget.onSubmit == null) return KeyEventResult.ignored;

    final platform = Theme.of(context).platform;
    final isDesktop = platform == TargetPlatform.macOS ||
        platform == TargetPlatform.windows ||
        platform == TargetPlatform.linux;

    if (!isDesktop) return KeyEventResult.ignored;

    if (event is RawKeyDownEvent) {
      final key = event.logicalKey;
      final isEnter = key == LogicalKeyboardKey.enter ||
          key == LogicalKeyboardKey.numpadEnter;

      if (isEnter) {
        if (!event.isShiftPressed) {
          final clean = _controller.text.trim();
          if (clean.isNotEmpty) _safeCallOnSubmit(clean);
          return KeyEventResult.handled; // prevent newline
        }
      }
    }

    return KeyEventResult.ignored;
  }

  Color _inputTextColor() =>
      widget.enabled ? widget.textColor : widget.muted.withOpacity(0.85);

  Color _hintColor() => widget.muted.withOpacity(widget.enabled ? 1.0 : 0.75);

  Color _baseBorderColor() {
    if (!_focused) return widget.border;
    final c = widget.border;
    final a = (c.opacity == 1.0) ? 1.0 : (c.opacity + 0.22).clamp(0.0, 1.0);
    return c.withOpacity(a);
  }

  double _borderWidth() => _focused ? 1.15 : 1.0;

  List<BoxShadow> _shadows() {
    final base = BoxShadow(
      color: Colors.black.withOpacity(widget.enabled ? 0.06 : 0.03),
      blurRadius: 18,
      offset: const Offset(0, 8),
    );

    if (!_focused) return [base];

    final glow = BoxShadow(
      color: widget.border.withOpacity(0.22),
      blurRadius: 18,
      offset: const Offset(0, 0),
      spreadRadius: 1.2,
    );

    return [glow, base];
  }

  EdgeInsets _contentPadding() {
    final left = widget.prefix != null ? 10.0 : 16.0;
    final right = widget.suffix != null ? 12.0 : 16.0;
    return EdgeInsets.fromLTRB(left, 12, right, 12);
  }

  Widget? _buildPrefix() {
    final p = widget.prefix;
    if (p == null) return null;

    return Padding(
      padding: EdgeInsets.only(left: 10, right: widget.prefixGap),
      child: SizedBox(
        width: widget.prefixSize,
        height: widget.prefixSize,
        child: Center(child: p),
      ),
    );
  }

  Widget? _buildSuffix() {
    final s = widget.suffix;
    if (s == null) return null;

    return Padding(
      padding: EdgeInsets.only(right: 10, left: widget.suffixGap),
      child: SizedBox(
        width: widget.suffixSize,
        height: widget.suffixSize,
        child: Center(child: s),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hint = widget.hintText.trim();
    final hasHint = hint.isNotEmpty;

    final radius = BorderRadius.circular(widget.borderRadius);

    final boxConstraints = widget.height == null
        ? BoxConstraints(minHeight: widget.minHeight)
        : const BoxConstraints();

    final hasSubmit = widget.onSubmit != null;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      curve: Curves.easeOut,
      width: widget.width,
      height: widget.height,
      constraints: boxConstraints,
      decoration: BoxDecoration(
        color: widget.surface,
        borderRadius: radius,
        border: Border.all(
          color: _baseBorderColor(),
          width: _borderWidth(),
        ),
        boxShadow: _shadows(),
      ),
      child: ClipRRect(
        borderRadius: radius,

        // ✅ BITNO: Focus wrapper BEZ focusNode (da ne napravi ciklus)
        child: Focus(
          onKey: _handleRawKey,
          child: TextField(
            focusNode: _focusNode, // ✅ samo ovdje
            controller: _controller,

            minLines: 1,
            maxLines: widget.maxLines,

            readOnly: !widget.enabled,
            enabled: true,
            canRequestFocus: widget.enabled,
            showCursor: widget.enabled,

            autofocus: widget.autofocus,
            textInputAction: TextInputAction.newline,

            onSubmitted: (v) {
              if (!hasSubmit) return;
              final clean = v.trim();
              if (clean.isEmpty) return;
              _safeCallOnSubmit(clean);
            },

            style: TextStyle(
              fontSize: 15.6,
              height: 1.35,
              color: _inputTextColor(),
              fontWeight: FontWeight.w400,
              letterSpacing: -0.1,
            ),
            decoration: InputDecoration(
              hintText: hasHint ? hint : null,
              hintStyle: TextStyle(
                fontSize: 15.6,
                height: 1.35,
                color: _hintColor(),
                fontWeight: FontWeight.w400,
                letterSpacing: -0.1,
              ),
              border: InputBorder.none,
              isDense: true,
              contentPadding: _contentPadding(),
              prefixIcon: _buildPrefix(),
              prefixIconConstraints: BoxConstraints(
                minWidth: widget.prefix != null
                    ? (10 + widget.prefixSize + widget.prefixGap)
                    : 0,
                minHeight: widget.prefixSize,
              ),
              suffixIcon: _buildSuffix(),
              suffixIconConstraints: BoxConstraints(
                minWidth: widget.suffix != null
                    ? (10 + widget.suffixSize + widget.suffixGap)
                    : 0,
                minHeight: widget.suffixSize,
              ),
            ),
            onChanged: _safeCallOnChanged,
          ),
        ),
      ),
    );
  }
}
