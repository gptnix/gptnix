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

import 'dart:typed_data';
import 'package:flutter/services.dart';

/// ─────────────────────────────────────────────────────────────────────────
/// GptnixInputBar — themed, production-grade chat input bar
///
/// All colors sourced from FlutterFlowTheme tokens — works in dark AND light.
/// No hardcoded Color() values except intentional icon colors (_AttachSheet).
/// ─────────────────────────────────────────────────────────────────────────

// Debug flag — flip to true locally to inspect keyboard padding values
const bool _kbDebug = false;

// ── Dimension tokens (no color constants — all colors via FlutterFlowTheme) ─
const double kInputBarRadius = 28.0;
const double kSendBtnSize = 40.0;
const double kActionBtnSize = 36.0;

class GptnixInputBar extends StatefulWidget {
  const GptnixInputBar({
    super.key,
    this.width,
    this.height,
    required this.controller,
    required this.focusNode,
    required this.isStreaming,
    required this.isSending,
    required this.deepThink,
    required this.pickedFiles,
    required this.pickedExts,
    required this.isDark,
    required this.onSend,
    required this.onStop,
    required this.onVoiceChat,
    required this.onPickCamera,
    required this.onPickGallery,
    required this.onPickDocuments,
    required this.onRemoveFile,
    required this.onToggleDeepThink,
  });

  final double? width;
  final double? height;

  /// ✅ FF-friendly dynamic (FlutterFlow cannot serialize TextEditingController)
  final dynamic controller;
  final dynamic focusNode;

  final bool isStreaming;
  final bool isSending;
  final bool deepThink;
  final List<FFUploadedFile> pickedFiles;
  final List<String> pickedExts;

  /// Kept for API compatibility — theming now uses FlutterFlowTheme.of(context)
  final bool isDark;

  final dynamic onSend;
  final dynamic onStop;
  final dynamic onVoiceChat;
  final dynamic onPickCamera;
  final dynamic onPickGallery;
  final dynamic onPickDocuments;

  /// ✅ FF-friendly dynamic (FlutterFlow cannot serialize Future<void> Function(int))
  final dynamic onRemoveFile;
  final dynamic onToggleDeepThink;

  @override
  State<GptnixInputBar> createState() => _GptnixInputBarState();
}

class _GptnixInputBarState extends State<GptnixInputBar> {
  late final ValueNotifier<bool> _canSend;
  bool _hasFocus = false;

  TextEditingController? get _ctrl {
    final c = widget.controller;
    if (c is TextEditingController) return c;
    return null;
  }

  FocusNode? get _focus {
    final f = widget.focusNode;
    if (f is FocusNode) return f;
    return null;
  }

  @override
  void initState() {
    super.initState();
    _canSend = ValueNotifier(_computeCanSend());
    _ctrl?.addListener(_onTextChanged);
    _focus?.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(covariant GptnixInputBar old) {
    super.didUpdateWidget(old);

    if (old.controller != widget.controller) {
      final oldCtrl = (old.controller is TextEditingController)
          ? old.controller as TextEditingController
          : null;
      oldCtrl?.removeListener(_onTextChanged);
      _ctrl?.addListener(_onTextChanged);
      _refreshCanSend();
    }

    if (old.focusNode != widget.focusNode) {
      final oldFocus =
          (old.focusNode is FocusNode) ? old.focusNode as FocusNode : null;
      oldFocus?.removeListener(_onFocusChange);
      _focus?.addListener(_onFocusChange);
    }

    if (old.isStreaming != widget.isStreaming ||
        old.isSending != widget.isSending ||
        old.pickedFiles.length != widget.pickedFiles.length) {
      _refreshCanSend();
    }
  }

  @override
  void dispose() {
    _ctrl?.removeListener(_onTextChanged);
    _focus?.removeListener(_onFocusChange);
    _canSend.dispose();
    super.dispose();
  }

  bool _computeCanSend() {
    final txt = (_ctrl?.text ?? '').trim();
    return (txt.isNotEmpty || widget.pickedFiles.isNotEmpty) &&
        !widget.isStreaming &&
        !widget.isSending;
  }

  void _onTextChanged() => _refreshCanSend();

  void _onFocusChange() {
    if (!mounted) return;
    final f = _focus?.hasFocus ?? false;
    if (f != _hasFocus) setState(() => _hasFocus = f);
  }

  void _refreshCanSend() {
    final can = _computeCanSend();
    if (_canSend.value != can) _canSend.value = can;
  }

  Future<void> _safeCall(dynamic cb) async {
    if (cb == null) return;
    try {
      final r = cb();
      if (r is Future) await r.catchError((_) {});
    } catch (_) {}
  }

  Future<void> _safeCallWithIndex(dynamic cb, int index) async {
    if (cb == null) return;
    try {
      if (cb is Function) {
        final r = Function.apply(cb, [index]);
        if (r is Future) await r.catchError((_) {});
      }
    } catch (_) {}
  }

  // FIX-02 #5: Enter = send, Shift+Enter = new line (desktop/tablet)
  KeyEventResult _handleKey(FocusNode node, RawKeyEvent e) {
    if (e is! RawKeyDownEvent) return KeyEventResult.ignored;
    final platform = Theme.of(context).platform;
    final isDesktop = platform == TargetPlatform.macOS ||
        platform == TargetPlatform.windows ||
        platform == TargetPlatform.linux;
    if (!isDesktop) return KeyEventResult.ignored;

    final key = e.logicalKey;
    if ((key == LogicalKeyboardKey.enter ||
            key == LogicalKeyboardKey.numpadEnter) &&
        !e.isShiftPressed) {
      if (_canSend.value) {
        _safeCall(widget.onSend);
        return KeyEventResult.handled;
      }
    }
    return KeyEventResult.ignored;
  }

  void _showAttachSheet() {
    HapticFeedback.lightImpact();
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      enableDrag: true,
      builder: (_) => _AttachSheet(
        onCamera: () async {
          Navigator.pop(context);
          await _safeCall(widget.onPickCamera);
        },
        onGallery: () async {
          Navigator.pop(context);
          await _safeCall(widget.onPickGallery);
        },
        onFiles: () async {
          Navigator.pop(context);
          await _safeCall(widget.onPickDocuments);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final hasFiles = widget.pickedFiles.isNotEmpty;

    final double safeBottom = MediaQuery.of(context).padding.bottom;
    if (_kbDebug) {
      // ignore: avoid_print
      print('[InputBar] safeArea.bottom=$safeBottom  '
          'viewInsets.bottom=${MediaQuery.of(context).viewInsets.bottom}');
    }

    // ── Resolved theme colors ──────────────────────────────────────────────
    final cardBg = theme.secondaryBackground;
    final cardBorderColor = (_hasFocus && !widget.isStreaming)
        ? theme.accent1.withOpacity(0.6)
        : theme.alternate.withOpacity(0.4);
    final dividerColor = theme.alternate.withOpacity(0.25);

    return Padding(
      padding: EdgeInsets.fromLTRB(12, 8, 12, 10 + safeBottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // FIX-02 #6: File attachment chips above bar
          if (hasFiles) ...[
            _FilePreviewStrip(
              files: widget.pickedFiles,
              exts: widget.pickedExts,
              onRemove: (i) async =>
                  await _safeCallWithIndex(widget.onRemoveFile, i),
            ),
            const SizedBox(height: 8),
          ],

          // Floating input card
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(kInputBarRadius),
              border: Border.all(color: cardBorderColor, width: 1.0),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.10),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(kInputBarRadius - 1),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // FIX-02 #1: AnimatedSize for smooth height growth as user types
                  AnimatedSize(
                    duration: const Duration(milliseconds: 150),
                    curve: Curves.easeOut,
                    alignment: Alignment.topCenter,
                    child: Focus(
                      onKey: _handleKey,
                      child: TextField(
                        controller: _ctrl,
                        focusNode: _focus,
                        minLines: 1,
                        maxLines: 6,
                        enabled: true,
                        canRequestFocus: !widget.isStreaming,
                        readOnly: widget.isStreaming,
                        style: TextStyle(
                          fontSize: 15.5,
                          height: 1.5,
                          letterSpacing: -0.25,
                          fontWeight: FontWeight.w400,
                          color: widget.isStreaming
                              ? theme.primaryText.withOpacity(0.35)
                              : theme.primaryText,
                        ),
                        cursorColor: theme.accent1,
                        cursorWidth: 2.0,
                        cursorRadius: const Radius.circular(2),
                        decoration: InputDecoration(
                          hintText: widget.isStreaming
                              ? 'Generiram odgovor…'
                              : 'Napiši poruku…',
                          hintStyle: TextStyle(
                            fontSize: 15.5,
                            height: 1.5,
                            letterSpacing: -0.25,
                            fontWeight: FontWeight.w400,
                            color: theme.secondaryText,
                          ),
                          border: InputBorder.none,
                          isDense: false,
                          contentPadding:
                              const EdgeInsets.fromLTRB(16, 14, 16, 8),
                        ),
                        textInputAction: TextInputAction.newline,
                      ),
                    ),
                  ),

                  // Hairline divider
                  Container(height: 0.5, color: dividerColor),

                  // Toolbar
                  Padding(
                    padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Attach (+) — always visible
                        _AttachIconBtn(
                          disabled: widget.isStreaming,
                          hasBadge:
                              hasFiles ? widget.pickedFiles.length : null,
                          onTap:
                              widget.isStreaming ? null : _showAttachSheet,
                        ),

                        const SizedBox(width: 6),

                        // FIX-02 #7: Think chip — always visible, themed active state
                        _ThinkChip(
                          enabled: widget.deepThink,
                          disabled: widget.isStreaming,
                          onTap: () => _safeCall(widget.onToggleDeepThink),
                        ),

                        const Spacer(),

                        // FIX-02 #4: Mic — fade out during streaming, no layout shift
                        AnimatedOpacity(
                          opacity: widget.isStreaming ? 0.0 : 1.0,
                          duration: const Duration(milliseconds: 200),
                          child: IgnorePointer(
                            ignoring: widget.isStreaming,
                            child: _MicBtn(
                              isRecording: false,
                              onTap: () => _safeCall(widget.onVoiceChat),
                            ),
                          ),
                        ),

                        const SizedBox(width: 4),

                        // FIX-02 #2: Send/Stop — 3-state, RepaintBoundary so text
                        // changes don't cause button repaints
                        RepaintBoundary(
                          child: ValueListenableBuilder<bool>(
                            valueListenable: _canSend,
                            builder: (ctx, canSend, _) => _SendStopBtn(
                              isStreaming: widget.isStreaming,
                              isSending: widget.isSending,
                              canSend: canSend,
                              onSend: () => _safeCall(widget.onSend),
                              onStop: () => _safeCall(widget.onStop),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _ThinkChip — animated deep-think toggle, fully themed
// ══════════════════════════════════════════════════════════════════════════

class _ThinkChip extends StatefulWidget {
  const _ThinkChip({
    required this.enabled,
    required this.disabled,
    required this.onTap,
  });

  final bool enabled;
  final bool disabled;
  final VoidCallback onTap;

  @override
  State<_ThinkChip> createState() => _ThinkChipState();
}

class _ThinkChipState extends State<_ThinkChip> with TickerProviderStateMixin {
  late final AnimationController _glowC;
  late final AnimationController _fillC;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _glowC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    _fillC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
      value: widget.enabled ? 1.0 : 0.0,
    );
    if (widget.enabled) _glowC.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant _ThinkChip old) {
    super.didUpdateWidget(old);
    if (old.enabled != widget.enabled) {
      if (widget.enabled) {
        _fillC.forward();
        Future.delayed(const Duration(milliseconds: 60), () {
          if (mounted) _glowC.repeat(reverse: true);
        });
      } else {
        _fillC.reverse();
        _glowC.animateTo(0,
            duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
    }
  }

  @override
  void dispose() {
    _glowC.dispose();
    _fillC.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);

    return Semantics(
      label: widget.enabled ? 'Disable deep reasoning' : 'Enable deep reasoning',
      button: true,
      child: Tooltip(
        message: 'Deep reasoning mode',
        child: Opacity(
          opacity: widget.disabled ? 0.4 : 1.0,
          child: GestureDetector(
            onTapDown:
                widget.disabled ? null : (_) => setState(() => _pressed = true),
            onTapUp: widget.disabled
                ? null
                : (_) {
                    setState(() => _pressed = false);
                    HapticFeedback.lightImpact();
                    widget.onTap();
                  },
            onTapCancel:
                widget.disabled ? null : () => setState(() => _pressed = false),
            child: AnimatedBuilder(
              animation: Listenable.merge([_glowC, _fillC]),
              builder: (context, _) {
                final t = _fillC.value;
                final glow = _glowC.value;

                // FIX-01: all colors from theme
                final chipBg = Color.lerp(
                  Colors.transparent,
                  theme.accent1,
                  t,
                )!;
                final chipBorder = Color.lerp(
                  theme.alternate.withOpacity(0.6),
                  theme.accent1,
                  t,
                )!;
                final chipContent = Color.lerp(
                  theme.secondaryText,
                  Colors.white,
                  t,
                )!;

                return Transform.scale(
                  scale: _pressed ? 0.94 : 1.0,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: chipBg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: chipBorder, width: 1.0),
                      boxShadow: t > 0.1
                          ? [
                              BoxShadow(
                                color: theme.accent1
                                    .withOpacity(t * (0.15 + glow * 0.15)),
                                blurRadius: 8 + glow * 6,
                              ),
                            ]
                          : [],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.psychology_rounded,
                          size: 13,
                          color: chipContent,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          widget.enabled ? 'Thinking' : 'Think',
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: chipContent,
                            letterSpacing: -0.15,
                            height: 1.0,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _SendStopBtn — 3-state: disabled / ready / streaming — fully themed
// ══════════════════════════════════════════════════════════════════════════

class _SendStopBtn extends StatefulWidget {
  const _SendStopBtn({
    required this.isStreaming,
    required this.isSending,
    required this.canSend,
    required this.onSend,
    required this.onStop,
  });

  final bool isStreaming;
  final bool isSending;
  final bool canSend;
  final VoidCallback onSend;
  final VoidCallback onStop;

  @override
  State<_SendStopBtn> createState() => _SendStopBtnState();
}

class _SendStopBtnState extends State<_SendStopBtn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _stopGlowC;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _stopGlowC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    if (widget.isStreaming) _stopGlowC.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant _SendStopBtn old) {
    super.didUpdateWidget(old);
    if (old.isStreaming != widget.isStreaming) {
      if (widget.isStreaming) {
        _stopGlowC.repeat(reverse: true);
      } else {
        _stopGlowC.stop();
        _stopGlowC.value = 0;
      }
    }
  }

  @override
  void dispose() {
    _stopGlowC.dispose();
    super.dispose();
  }

  void _onTap() {
    HapticFeedback.mediumImpact();
    if (widget.isStreaming) {
      widget.onStop();
    } else if (widget.canSend) {
      widget.onSend();
    }
  }

  Widget _buildSpinner(FlutterFlowTheme theme) {
    return SizedBox(
      width: kSendBtnSize,
      height: kSendBtnSize,
      child: Container(
        decoration: BoxDecoration(
          color: theme.accent1.withOpacity(0.25),
          shape: BoxShape.circle,
        ),
        child: const Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              valueColor: AlwaysStoppedAnimation(Colors.white),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSend(FlutterFlowTheme theme) {
    return Container(
      key: const ValueKey('send'),
      width: kSendBtnSize,
      height: kSendBtnSize,
      decoration: widget.canSend
          ? BoxDecoration(
              gradient: LinearGradient(
                colors: [theme.accent1, theme.accent2],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
            )
          : BoxDecoration(
              color: theme.alternate.withOpacity(0.6),
              shape: BoxShape.circle,
            ),
      child: Center(
        child: Icon(
          Icons.arrow_upward_rounded,
          color: widget.canSend ? Colors.white : theme.secondaryText,
          size: 20,
        ),
      ),
    );
  }

  Widget _buildStop(FlutterFlowTheme theme) {
    return AnimatedBuilder(
      key: const ValueKey('stop'),
      animation: _stopGlowC,
      builder: (_, __) {
        final glow = _stopGlowC.value;
        return Container(
          width: kSendBtnSize,
          height: kSendBtnSize,
          decoration: BoxDecoration(
            color: theme.error.withOpacity(0.12),
            shape: BoxShape.circle,
            border: Border.all(
              color: theme.error.withOpacity(0.45 + glow * 0.3),
              width: 1.5,
            ),
          ),
          child: Center(
            child: Icon(
              Icons.stop_rounded,
              color: theme.error,
              size: 22,
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);

    if (widget.isSending) return _buildSpinner(theme);

    final bool active = widget.isStreaming || widget.canSend;

    return Semantics(
      label: widget.isStreaming ? 'Stop generating' : 'Send message',
      button: true,
      child: Tooltip(
        message: widget.isStreaming ? 'Stop' : 'Send',
        child: GestureDetector(
          onTapDown: active ? (_) => setState(() => _pressed = true) : null,
          onTapUp: active
              ? (_) {
                  setState(() => _pressed = false);
                  _onTap();
                }
              : null,
          onTapCancel: active ? () => setState(() => _pressed = false) : null,
          onTap: active ? _onTap : null,
          child: AnimatedScale(
            scale: _pressed ? 0.90 : 1.0,
            duration: const Duration(milliseconds: 90),
            child: AnimatedSwitcher(
              // FIX-02 #2: 150ms crossfade, same position — no layout shift
              duration: const Duration(milliseconds: 150),
              transitionBuilder: (child, anim) => FadeTransition(
                opacity: anim,
                child: ScaleTransition(
                  scale: Tween<double>(begin: 0.80, end: 1.0).animate(
                    CurvedAnimation(
                      parent: anim,
                      curve: Curves.easeOutBack,
                    ),
                  ),
                  child: child,
                ),
              ),
              child: widget.isStreaming
                  ? _buildStop(theme)
                  : _buildSend(theme),
            ),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _MicBtn — mic button with optional recording indicator, fully themed
// ══════════════════════════════════════════════════════════════════════════

class _MicBtn extends StatefulWidget {
  const _MicBtn({
    required this.isRecording,
    required this.onTap,
  });

  final bool isRecording;
  final dynamic onTap;

  @override
  State<_MicBtn> createState() => _MicBtnState();
}

class _MicBtnState extends State<_MicBtn> with SingleTickerProviderStateMixin {
  late final AnimationController _dotC;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _dotC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    if (widget.isRecording) _dotC.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant _MicBtn old) {
    super.didUpdateWidget(old);
    if (old.isRecording != widget.isRecording) {
      if (widget.isRecording) {
        _dotC.repeat(reverse: true);
      } else {
        _dotC.stop();
        _dotC.value = 0;
      }
    }
  }

  @override
  void dispose() {
    _dotC.dispose();
    super.dispose();
  }

  Future<void> _safeCall(dynamic cb) async {
    if (cb == null) return;
    try {
      final r = cb();
      if (r is Future) await r.catchError((_) {});
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final Color iconColor =
        widget.isRecording ? theme.error : theme.secondaryText;

    return Semantics(
      label: widget.isRecording ? 'Stop recording' : 'Microphone',
      button: true,
      child: Tooltip(
        message: widget.isRecording ? 'Stop recording' : 'Voice input',
        child: GestureDetector(
          onTapDown: (_) => setState(() => _pressed = true),
          onTapUp: (_) {
            setState(() => _pressed = false);
            HapticFeedback.lightImpact();
            _safeCall(widget.onTap);
          },
          onTapCancel: () => setState(() => _pressed = false),
          child: AnimatedScale(
            scale: _pressed ? 0.88 : 1.0,
            duration: const Duration(milliseconds: 90),
            child: SizedBox(
              width: kActionBtnSize,
              height: kActionBtnSize,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.mic_rounded,
                      key: ValueKey(widget.isRecording),
                      color: iconColor,
                      size: kActionBtnSize * 0.6,
                    ),
                  ),
                  if (widget.isRecording)
                    Positioned(
                      bottom: 3,
                      right: 3,
                      child: AnimatedBuilder(
                        animation: _dotC,
                        builder: (_, __) => Opacity(
                          opacity: 0.3 + _dotC.value * 0.7,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: theme.error,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _AttachIconBtn — + attach button with badge, fully themed
// ══════════════════════════════════════════════════════════════════════════

class _AttachIconBtn extends StatefulWidget {
  const _AttachIconBtn({
    required this.disabled,
    this.hasBadge,
    this.onTap,
  });

  final bool disabled;
  final int? hasBadge;
  final VoidCallback? onTap;

  @override
  State<_AttachIconBtn> createState() => _AttachIconBtnState();
}

class _AttachIconBtnState extends State<_AttachIconBtn> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final Color iconColor = widget.disabled
        ? theme.secondaryText.withOpacity(0.35)
        : theme.secondaryText;

    return Semantics(
      label: 'Attach file',
      button: true,
      child: Tooltip(
        message: 'Attach file',
        child: GestureDetector(
          onTapDown:
              widget.disabled ? null : (_) => setState(() => _pressed = true),
          onTapUp: widget.disabled
              ? null
              : (_) {
                  setState(() => _pressed = false);
                  widget.onTap?.call();
                },
          onTapCancel:
              widget.disabled ? null : () => setState(() => _pressed = false),
          child: AnimatedScale(
            scale: _pressed ? 0.88 : 1.0,
            duration: const Duration(milliseconds: 90),
            child: SizedBox(
              width: kActionBtnSize,
              height: kActionBtnSize,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Icon(Icons.add_rounded, size: 22, color: iconColor),
                  if (widget.hasBadge != null && widget.hasBadge! > 0)
                    Positioned(
                      top: 1,
                      right: 1,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: theme.accent1,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            widget.hasBadge! > 9 ? '9+' : '${widget.hasBadge}',
                            style: const TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              height: 1.0,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _ToolbarIconBtn — generic icon button (kept for future use), themed
// ══════════════════════════════════════════════════════════════════════════

class _ToolbarIconBtn extends StatefulWidget {
  const _ToolbarIconBtn({
    required this.icon,
    required this.disabled,
    this.size = 32,
    this.onTap,
  });

  final IconData icon;
  final bool disabled;
  final double size;
  final VoidCallback? onTap;

  @override
  State<_ToolbarIconBtn> createState() => _ToolbarIconBtnState();
}

class _ToolbarIconBtnState extends State<_ToolbarIconBtn> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final Color c = widget.disabled
        ? theme.secondaryText.withOpacity(0.35)
        : theme.secondaryText;

    return GestureDetector(
      onTapDown:
          widget.disabled ? null : (_) => setState(() => _pressed = true),
      onTapUp: widget.disabled
          ? null
          : (_) {
              setState(() => _pressed = false);
              widget.onTap?.call();
            },
      onTapCancel:
          widget.disabled ? null : () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.88 : 1.0,
        duration: const Duration(milliseconds: 90),
        child: SizedBox(
          width: widget.size,
          height: widget.size,
          child: Center(
            child: Icon(widget.icon, size: widget.size * 0.66, color: c),
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _FilePreviewStrip — horizontal chip row, fully themed
// ══════════════════════════════════════════════════════════════════════════

class _FilePreviewStrip extends StatelessWidget {
  const _FilePreviewStrip({
    required this.files,
    required this.exts,
    required this.onRemove,
  });

  final List<FFUploadedFile> files;
  final List<String> exts;
  final Future<void> Function(int index) onRemove;

  IconData _iconForExt(String ext) {
    if (ext == 'png' || ext == 'jpg' || ext == 'jpeg' || ext == 'webp') {
      return Icons.image_rounded;
    }
    if (ext == 'pdf') return Icons.picture_as_pdf_rounded;
    return Icons.insert_drive_file_rounded;
  }

  bool _isImage(String ext) =>
      ext == 'png' || ext == 'jpg' || ext == 'jpeg' || ext == 'webp';

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);

    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 2),
        itemCount: files.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (ctx, i) {
          final ext = (i < exts.length ? exts[i] : '')
              .toLowerCase()
              .replaceAll('.', '');
          final file = files[i];
          final bytes = file.bytes;
          final hasImage = _isImage(ext) && bytes != null && bytes.isNotEmpty;
          final name = file.name ?? 'file';
          final displayName =
              name.length > 18 ? '${name.substring(0, 15)}…' : name;

          return Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: theme.alternate.withOpacity(0.25),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: theme.alternate.withOpacity(0.5),
                width: 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (hasImage)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: Image.memory(
                      bytes!,
                      width: 24,
                      height: 24,
                      fit: BoxFit.cover,
                    ),
                  )
                else
                  Icon(
                    _iconForExt(ext),
                    size: 16,
                    color: theme.accent1,
                  ),
                const SizedBox(width: 4),
                Text(
                  displayName,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: theme.primaryText,
                    height: 1.0,
                  ),
                ),
                const SizedBox(width: 4),
                GestureDetector(
                  onTap: () => onRemove(i),
                  child: Icon(
                    Icons.close_rounded,
                    size: 14,
                    color: theme.secondaryText,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _AttachSheet — bottom sheet, fully themed
// ══════════════════════════════════════════════════════════════════════════

class _AttachSheet extends StatelessWidget {
  const _AttachSheet({
    required this.onCamera,
    required this.onGallery,
    required this.onFiles,
  });

  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onFiles;

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: Container(
          decoration: BoxDecoration(
            color: theme.secondaryBackground,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: theme.alternate.withOpacity(0.3),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.20),
                blurRadius: 36,
                offset: const Offset(0, -6),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 11, bottom: 18),
                child: Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                      color: theme.alternate.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
              _SheetOption(
                icon: Icons.camera_alt_rounded,
                // Intentional brand color — no theme equivalent
                iconBg: const Color(0xFFF97316),
                title: 'Kamera',
                subtitle: 'Fotografiraj ili snimi video',
                onTap: onCamera,
              ),
              Container(
                height: 0.5,
                margin: const EdgeInsets.only(left: 76),
                color: theme.alternate.withOpacity(0.3),
              ),
              _SheetOption(
                icon: Icons.photo_library_rounded,
                // Intentional brand color — no theme equivalent
                iconBg: const Color(0xFF8B5CF6),
                title: 'Galerija',
                subtitle: 'Odaberi slike iz galerije',
                onTap: onGallery,
              ),
              Container(
                height: 0.5,
                margin: const EdgeInsets.only(left: 76),
                color: theme.alternate.withOpacity(0.3),
              ),
              _SheetOption(
                icon: Icons.folder_rounded,
                // Intentional brand color — no theme equivalent
                iconBg: const Color(0xFF10B981),
                title: 'Datoteke',
                subtitle: 'PDF, Word, Excel i ostalo',
                onTap: onFiles,
              ),
              const SizedBox(height: 6),
            ],
          ),
        ),
      ),
    );
  }
}

class _SheetOption extends StatefulWidget {
  const _SheetOption({
    required this.icon,
    required this.iconBg,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color iconBg;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  State<_SheetOption> createState() => _SheetOptionState();
}

class _SheetOptionState extends State<_SheetOption> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        color: _pressed
            ? theme.alternate.withOpacity(0.15)
            : Colors.transparent,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: widget.iconBg,
                borderRadius: BorderRadius.circular(13),
                boxShadow: [
                  BoxShadow(
                    color: widget.iconBg.withOpacity(0.35),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(widget.icon, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: theme.primaryText,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.subtitle,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w400,
                      color: theme.secondaryText,
                      letterSpacing: -0.1,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: theme.secondaryText.withOpacity(0.5),
            ),
          ],
        ),
      ),
    );
  }
}
