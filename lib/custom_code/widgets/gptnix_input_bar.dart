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
/// GptnixInputBar — premium redesign (FF-friendly param types)
///
/// ✅ FIX: FlutterFlow ne može procesirati TextEditingController/FocusNode kao parametre
///    → koristimo dynamic i interno castamo.
///
/// ✅ FIX: FlutterFlow ne može procesirati callback tipa Future<void> Function(int)
///    → koristimo dynamic i interno zovemo s index argumentom.
///
/// Layout:
///   [file strip — optional, visible when files selected]
///   ┌─────────────────────────────────────────────────────┐  ← floating card
///   │  Napiši poruku…  (auto-grow 1–5 lines)              │
///   ├─────────────────────────────────────────────────────│  ← hairline
///   │  [+ Attach]  [⚡ Think chip]  ·  [🎤]  [▲ Send]    │
///   └─────────────────────────────────────────────────────┘
/// ─────────────────────────────────────────────────────────────────────────

// Debug flag — flip to true locally to inspect keyboard padding values
const bool _kbDebug = false;

class GptnixInputBar extends StatefulWidget {
  const GptnixInputBar({
    super.key,
    this.width,
    this.height,

    // ✅ FF-friendly: dynamic (umjesto TextEditingController/FocusNode)
    required this.controller,
    required this.focusNode,
    required this.isStreaming,
    required this.isSending,
    required this.deepThink,
    required this.pickedFiles,
    required this.pickedExts,
    required this.isDark,

    // FF-safe callbacks (dynamic)
    required this.onSend,
    required this.onStop,
    required this.onVoiceChat,
    required this.onPickCamera,
    required this.onPickGallery,
    required this.onPickDocuments,

    // ✅ FF-friendly: dynamic (umjesto Future<void> Function(int))
    required this.onRemoveFile,
    required this.onToggleDeepThink,
  });

  final double? width;
  final double? height;

  /// ✅ dynamic (FF)
  final dynamic controller;
  final dynamic focusNode;

  final bool isStreaming;
  final bool isSending;
  final bool deepThink;

  final List<FFUploadedFile> pickedFiles;
  final List<String> pickedExts;
  final bool isDark;

  final dynamic onSend;
  final dynamic onStop;
  final dynamic onVoiceChat;
  final dynamic onPickCamera;
  final dynamic onPickGallery;
  final dynamic onPickDocuments;

  /// ✅ dynamic (FF)
  final dynamic onRemoveFile;

  final dynamic onToggleDeepThink;

  @override
  State<GptnixInputBar> createState() => _GptnixInputBarState();
}

class _GptnixInputBarState extends State<GptnixInputBar> {
  // Rebuild SAMO send gumb kad se canSend mijenja — ne cijeli input bar
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

    // Listeneri samo ako je stvarni controller/focus došao
    _ctrl?.addListener(_onTextChanged);
    _focus?.addListener(_onFocusChange);
  }

  @override
  void didUpdateWidget(covariant GptnixInputBar old) {
    super.didUpdateWidget(old);

    // Ako se controller/focus promijenio, rebindi
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

    // Ažuriraj canSend kad se streaming/sending ili broj fajlova promijeni
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
      // pokušaj standardno: Function(int)
      if (cb is Function) {
        final r = Function.apply(cb, [index]);
        if (r is Future) await r.catchError((_) {});
      }
    } catch (_) {}
  }

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
        isDark: widget.isDark,
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

  // ── Colors ──────────────────────────────────────────────────────────────

  Color get _cardBg => widget.isDark ? const Color(0xFF171717) : Colors.white;

  Color get _cardBorder {
    if (_hasFocus && !widget.isStreaming) {
      return widget.isDark
          ? Colors.white.withOpacity(0.16)
          : Colors.black.withOpacity(0.14);
    }
    return widget.isDark
        ? Colors.white.withOpacity(0.07)
        : Colors.black.withOpacity(0.07);
  }

  Color get _textColor =>
      widget.isDark ? Colors.white : const Color(0xFF0D0D0D);

  Color get _hintColor => widget.isDark
      ? Colors.white.withOpacity(0.26)
      : Colors.black.withOpacity(0.26);

  Color get _dividerColor => widget.isDark
      ? Colors.white.withOpacity(0.05)
      : Colors.black.withOpacity(0.05);

  List<BoxShadow> get _cardShadow => [
        BoxShadow(
          color: Colors.black.withOpacity(widget.isDark ? 0.40 : 0.07),
          blurRadius: 32,
          offset: const Offset(0, 8),
        ),
        BoxShadow(
          color: Colors.black.withOpacity(widget.isDark ? 0.18 : 0.03),
          blurRadius: 8,
          offset: const Offset(0, 2),
        ),
      ];

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final hasFiles = widget.pickedFiles.isNotEmpty;

    // Padding: safe area bottom only (keyboard handled by parent / scaffold)
    final double safeBottom = MediaQuery.of(context).padding.bottom;
    if (_kbDebug) {
      // ignore: avoid_print
      print('[InputBar] safeArea.bottom=$safeBottom  '
          'viewInsets.bottom=${MediaQuery.of(context).viewInsets.bottom}');
    }

    return Padding(
      padding: EdgeInsets.fromLTRB(
        12,
        8,
        12,
        10 + safeBottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // File preview strip
          if (hasFiles) ...[
            _FilePreviewStrip(
              files: widget.pickedFiles,
              exts: widget.pickedExts,
              isDark: widget.isDark,
              onRemove: (i) async =>
                  await _safeCallWithIndex(widget.onRemoveFile, i),
            ),
            const SizedBox(height: 10),
          ],

          // Floating input card
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              color: _cardBg,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: _cardBorder, width: 1.0),
              boxShadow: _cardShadow,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(21),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // TextField
                  Focus(
                    onKey: _handleKey,
                    child: TextField(
                      controller: _ctrl,
                      focusNode: _focus,
                      minLines: 1,
                      maxLines: 5,
                      enabled: true,
                      canRequestFocus: !widget.isStreaming,
                      readOnly: widget.isStreaming,
                      style: TextStyle(
                        fontSize: 15.5,
                        height: 1.5,
                        letterSpacing: -0.25,
                        fontWeight: FontWeight.w400,
                        color: widget.isStreaming
                            ? _textColor.withOpacity(0.35)
                            : _textColor,
                      ),
                      cursorColor: const Color(0xFF3B82F6),
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
                          color: _hintColor,
                        ),
                        border: InputBorder.none,
                        isDense: false,
                        contentPadding:
                            const EdgeInsets.fromLTRB(16, 14, 16, 8),
                      ),
                      textInputAction: TextInputAction.newline,
                    ),
                  ),

                  // Hairline divider
                  Container(height: 0.5, color: _dividerColor),

                  // Toolbar
                  Padding(
                    padding: const EdgeInsets.fromLTRB(10, 7, 10, 9),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Attach button (+)
                        _AttachIconBtn(
                          isDark: widget.isDark,
                          disabled: widget.isStreaming,
                          hasBadge: hasFiles ? widget.pickedFiles.length : null,
                          onTap: widget.isStreaming ? null : _showAttachSheet,
                        ),

                        const SizedBox(width: 8),

                        // ⚡ Deep Think chip
                        _ThinkChip(
                          enabled: widget.deepThink,
                          disabled: widget.isStreaming,
                          isDark: widget.isDark,
                          onTap: () => _safeCall(widget.onToggleDeepThink),
                        ),

                        const Spacer(),

                        // Voice
                        _ToolbarIconBtn(
                          icon: Icons.mic_none_rounded,
                          size: 32,
                          isDark: widget.isDark,
                          disabled: widget.isStreaming,
                          onTap: () => _safeCall(widget.onVoiceChat),
                        ),

                        const SizedBox(width: 8),

                        // Send / Stop — rebuilda se samo kad canSend zmijeni
                        ValueListenableBuilder<bool>(
                          valueListenable: _canSend,
                          builder: (ctx, canSend, _) => _SendStopBtn(
                            isStreaming: widget.isStreaming,
                            isSending: widget.isSending,
                            canSend: canSend,
                            isDark: widget.isDark,
                            onSend: () => _safeCall(widget.onSend),
                            onStop: () => _safeCall(widget.onStop),
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
// _ThinkChip — animirani Deep Think toggle
// ══════════════════════════════════════════════════════════════════════════

class _ThinkChip extends StatefulWidget {
  const _ThinkChip({
    required this.enabled,
    required this.disabled,
    required this.isDark,
    required this.onTap,
  });

  final bool enabled;
  final bool disabled;
  final bool isDark;
  final VoidCallback onTap;

  @override
  State<_ThinkChip> createState() => _ThinkChipState();
}

class _ThinkChipState extends State<_ThinkChip> with TickerProviderStateMixin {
  late final AnimationController _glowC;
  late final AnimationController _scaleC;

  bool _pressed = false;

  static const _blue = Color(0xFF3B82F6);
  static const _blueDark = Color(0xFF60A5FA);

  @override
  void initState() {
    super.initState();
    _glowC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    _scaleC = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 240),
      value: widget.enabled ? 1.0 : 0.0,
    );
    if (widget.enabled) _glowC.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant _ThinkChip old) {
    super.didUpdateWidget(old);
    if (old.enabled != widget.enabled) {
      if (widget.enabled) {
        _scaleC.forward();
        Future.delayed(const Duration(milliseconds: 60), () {
          if (mounted) _glowC.repeat(reverse: true);
        });
      } else {
        _scaleC.reverse();
        _glowC.animateTo(0,
            duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
    }
  }

  @override
  void dispose() {
    _glowC.dispose();
    _scaleC.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final blue = widget.isDark ? _blueDark : _blue;
    final double masterOpacity = widget.disabled ? 0.4 : 1.0;

    return Opacity(
      opacity: masterOpacity,
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
          animation: Listenable.merge([_glowC, _scaleC]),
          builder: (context, _) {
            final glow = _glowC.value; // 0..1..0
            final scaleT = _scaleC.value; // 0..1
            final pressScale = _pressed ? 0.94 : 1.0;

            final Color chipBg = Color.lerp(
              widget.isDark
                  ? Colors.white.withOpacity(0.05)
                  : Colors.black.withOpacity(0.04),
              blue.withOpacity(widget.isDark ? 0.14 : 0.09),
              scaleT,
            )!;

            final Color chipBorder = Color.lerp(
              widget.isDark
                  ? Colors.white.withOpacity(0.09)
                  : Colors.black.withOpacity(0.07),
              blue.withOpacity(
                  widget.isDark ? (0.4 + glow * 0.28) : (0.30 + glow * 0.22)),
              scaleT,
            )!;

            final Color chipText = Color.lerp(
              widget.isDark
                  ? Colors.white.withOpacity(0.42)
                  : Colors.black.withOpacity(0.36),
              blue,
              scaleT,
            )!;

            final glowAmount =
                scaleT * (widget.isDark ? 0.20 : 0.14) + glow * scaleT * 0.16;

            return Transform.scale(
              scale: pressScale,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: chipBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: chipBorder, width: 1.0),
                  boxShadow: scaleT > 0.1
                      ? [
                          BoxShadow(
                            color: blue.withOpacity(glowAmount),
                            blurRadius: 10 + glow * 8,
                            spreadRadius: 0,
                          ),
                        ]
                      : [],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: Icon(
                        widget.enabled
                            ? Icons.bolt_rounded
                            : Icons.bolt_outlined,
                        key: ValueKey(widget.enabled),
                        size: 13,
                        color: chipText,
                      ),
                    ),
                    const SizedBox(width: 4),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 180),
                      child: Text(
                        widget.enabled ? 'Deep Think' : 'Think',
                        key: ValueKey(widget.enabled),
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: chipText,
                          letterSpacing: -0.15,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _SendStopBtn — state machine: disabled / canSend / sending / streaming
// ══════════════════════════════════════════════════════════════════════════

class _SendStopBtn extends StatefulWidget {
  const _SendStopBtn({
    required this.isStreaming,
    required this.isSending,
    required this.canSend,
    required this.isDark,
    required this.onSend,
    required this.onStop,
  });

  final bool isStreaming;
  final bool isSending;
  final bool canSend;
  final bool isDark;
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

  @override
  Widget build(BuildContext context) {
    const double size = 36;

    if (widget.isSending) {
      return SizedBox(
        width: size,
        height: size,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF3B82F6).withOpacity(0.30),
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

    return AnimatedBuilder(
      animation: _stopGlowC,
      builder: (context, _) {
        final glow = _stopGlowC.value;

        final Color bg;
        final IconData icon;
        final Color iconColor;
        final List<BoxShadow> shadows;

        if (widget.isStreaming) {
          bg = widget.isDark ? const Color(0xFF292929) : Colors.white;
          icon = Icons.stop_rounded;
          iconColor = widget.isDark
              ? Colors.white.withOpacity(0.85)
              : const Color(0xFF0D0D0D).withOpacity(0.80);
          shadows = [
            BoxShadow(
              color: Colors.black.withOpacity(
                  widget.isDark ? (0.20 + glow * 0.10) : (0.08 + glow * 0.04)),
              blurRadius: 10 + glow * 4,
              offset: const Offset(0, 3),
            ),
          ];
        } else if (widget.canSend) {
          bg = const Color(0xFF3B82F6);
          icon = Icons.arrow_upward_rounded;
          iconColor = Colors.white;
          shadows = [
            BoxShadow(
              color: const Color(0xFF3B82F6)
                  .withOpacity(widget.isDark ? 0.45 : 0.32),
              blurRadius: 14,
              offset: const Offset(0, 5),
            ),
          ];
        } else {
          bg = widget.isDark
              ? Colors.white.withOpacity(0.07)
              : Colors.black.withOpacity(0.06);
          icon = Icons.arrow_upward_rounded;
          iconColor = widget.isDark
              ? Colors.white.withOpacity(0.22)
              : Colors.black.withOpacity(0.20);
          shadows = [];
        }

        final bool active = widget.isStreaming || widget.canSend;
        final double scale = _pressed ? 0.90 : 1.0;

        void onTap() {
          if (!active) return;
          HapticFeedback.mediumImpact();
          if (widget.isStreaming) {
            widget.onStop();
          } else {
            widget.onSend();
          }
        }

        return GestureDetector(
          onTapDown: active ? (_) => setState(() => _pressed = true) : null,
          onTapUp: active
              ? (_) {
                  setState(() => _pressed = false);
                  onTap();
                }
              : null,
          onTapCancel: active ? () => setState(() => _pressed = false) : null,
          onTap: active ? onTap : null,
          child: AnimatedScale(
            scale: scale,
            duration: const Duration(milliseconds: 90),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: bg,
                shape: BoxShape.circle,
                boxShadow: shadows,
              ),
              child: Center(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 190),
                  transitionBuilder: (child, anim) => FadeTransition(
                    opacity: anim,
                    child: ScaleTransition(
                      scale: Tween<double>(begin: 0.80, end: 1.0)
                          .animate(CurvedAnimation(
                        parent: anim,
                        curve: Curves.easeOutBack,
                      )),
                      child: child,
                    ),
                  ),
                  child: Icon(
                    icon,
                    key: ValueKey(icon.codePoint),
                    color: iconColor,
                    size: 18,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _AttachIconBtn — + gumb za attach (s badge)
// ══════════════════════════════════════════════════════════════════════════

class _AttachIconBtn extends StatefulWidget {
  const _AttachIconBtn({
    required this.isDark,
    required this.disabled,
    this.hasBadge,
    this.onTap,
  });

  final bool isDark;
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
    final Color iconColor = widget.disabled
        ? (widget.isDark
            ? Colors.white.withOpacity(0.18)
            : Colors.black.withOpacity(0.16))
        : (widget.isDark
            ? Colors.white.withOpacity(0.68)
            : Colors.black.withOpacity(0.62));

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
          width: 32,
          height: 32,
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
                    decoration: const BoxDecoration(
                      color: Color(0xFF3B82F6),
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
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _ToolbarIconBtn — generic icon gumb (voice, itd.)
// ══════════════════════════════════════════════════════════════════════════

class _ToolbarIconBtn extends StatefulWidget {
  const _ToolbarIconBtn({
    required this.icon,
    required this.isDark,
    required this.disabled,
    this.size = 32,
    this.onTap,
  });

  final IconData icon;
  final bool isDark;
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
    final Color c = widget.disabled
        ? (widget.isDark
            ? Colors.white.withOpacity(0.18)
            : Colors.black.withOpacity(0.16))
        : (widget.isDark
            ? Colors.white.withOpacity(0.60)
            : Colors.black.withOpacity(0.55));

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
// _FilePreviewStrip — horizontalni scroll s thumbnail/doc preview
// ══════════════════════════════════════════════════════════════════════════

class _FilePreviewStrip extends StatelessWidget {
  const _FilePreviewStrip({
    required this.files,
    required this.exts,
    required this.isDark,
    required this.onRemove,
  });

  final List<FFUploadedFile> files;
  final List<String> exts;
  final bool isDark;

  /// ✅ ovdje je normalno tipizirano (interni widget), ali parent call je FF-safe
  final Future<void> Function(int index) onRemove;

  String _formatTotalSize() {
    final total = files.fold<int>(0, (acc, f) => acc + (f.bytes?.length ?? 0));
    if (total < 1024) return '${total}B';
    if (total < 1024 * 1024) return '${(total / 1024).toStringAsFixed(0)}KB';
    return '${(total / (1024 * 1024)).toStringAsFixed(1)}MB';
  }

  @override
  Widget build(BuildContext context) {
    final labelColor = isDark
        ? Colors.white.withOpacity(0.32)
        : Colors.black.withOpacity(0.32);

    final count = files.length;
    final label =
        '$count ${count == 1 ? 'prilog' : 'priloga'} · ${_formatTotalSize()}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 76,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 2),
            itemCount: files.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (ctx, i) {
              final ext = (i < exts.length ? exts[i] : '')
                  .toLowerCase()
                  .replaceAll('.', '');
              return _FileTile(
                file: files[i],
                ext: ext,
                isDark: isDark,
                onRemove: () async => await onRemove(i),
              );
            },
          ),
        ),
        const SizedBox(height: 5),
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
              color: labelColor,
              letterSpacing: -0.1,
            ),
          ),
        ),
      ],
    );
  }
}

class _FileTile extends StatelessWidget {
  const _FileTile({
    required this.file,
    required this.ext,
    required this.isDark,
    required this.onRemove,
  });

  final FFUploadedFile file;
  final String ext;
  final bool isDark;
  final VoidCallback onRemove;

  bool get _isImage =>
      ext == 'png' || ext == 'jpg' || ext == 'jpeg' || ext == 'webp';

  Color get _extAccent {
    switch (ext) {
      case 'pdf':
        return const Color(0xFFEF4444);
      case 'doc':
      case 'docx':
        return const Color(0xFF3B82F6);
      case 'xls':
      case 'xlsx':
        return const Color(0xFF10B981);
      case 'txt':
      case 'md':
      case 'csv':
        return const Color(0xFF8B5CF6);
      default:
        return const Color(0xFF6B7280);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? const Color(0xFF242424) : Colors.white;
    final border = isDark
        ? Colors.white.withOpacity(0.08)
        : Colors.black.withOpacity(0.08);
    final bytes = file.bytes;
    final hasImage = _isImage && bytes != null && bytes.isNotEmpty;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 64,
          height: 76,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(13),
            border: Border.all(color: border, width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isDark ? 0.25 : 0.06),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: hasImage
                ? Image.memory(
                    bytes!,
                    fit: BoxFit.cover,
                    width: 64,
                    height: 76,
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: _extAccent.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: Center(
                          child: Text(
                            ext.isEmpty ? '?' : ext.toUpperCase(),
                            style: TextStyle(
                              fontSize: ext.length > 3 ? 7.5 : 9,
                              fontWeight: FontWeight.w800,
                              color: _extAccent,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 5),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Text(
                          file.name ?? 'file',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w500,
                            color: isDark
                                ? Colors.white.withOpacity(0.42)
                                : Colors.black.withOpacity(0.40),
                            height: 1.1,
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
        Positioned(
          top: -5,
          right: -5,
          child: GestureDetector(
            onTap: onRemove,
            child: Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF383838) : Colors.white,
                shape: BoxShape.circle,
                border: Border.all(
                  color: isDark
                      ? Colors.white.withOpacity(0.10)
                      : Colors.black.withOpacity(0.10),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.18),
                    blurRadius: 6,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Icon(
                Icons.close_rounded,
                size: 12,
                color: isDark
                    ? Colors.white.withOpacity(0.72)
                    : Colors.black.withOpacity(0.60),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════
// _AttachSheet — bottom sheet s 3 opcije (Camera / Gallery / Files)
// ══════════════════════════════════════════════════════════════════════════

class _AttachSheet extends StatelessWidget {
  const _AttachSheet({
    required this.isDark,
    required this.onCamera,
    required this.onGallery,
    required this.onFiles,
  });

  final bool isDark;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onFiles;

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? const Color(0xFF1A1A1A) : Colors.white;
    final outerBorder = isDark
        ? Colors.white.withOpacity(0.07)
        : Colors.black.withOpacity(0.06);
    final divColor = isDark
        ? Colors.white.withOpacity(0.05)
        : Colors.black.withOpacity(0.05);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: Container(
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: outerBorder, width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(isDark ? 0.45 : 0.14),
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
                      color: isDark
                          ? Colors.white.withOpacity(0.14)
                          : Colors.black.withOpacity(0.11),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
              _SheetOption(
                icon: Icons.camera_alt_rounded,
                iconBg: const Color(0xFFF97316),
                title: 'Kamera',
                subtitle: 'Fotografiraj ili snimi video',
                isDark: isDark,
                onTap: onCamera,
              ),
              Container(
                height: 0.5,
                margin: const EdgeInsets.only(left: 76),
                color: divColor,
              ),
              _SheetOption(
                icon: Icons.photo_library_rounded,
                iconBg: const Color(0xFF8B5CF6),
                title: 'Galerija',
                subtitle: 'Odaberi slike iz galerije',
                isDark: isDark,
                onTap: onGallery,
              ),
              Container(
                height: 0.5,
                margin: const EdgeInsets.only(left: 76),
                color: divColor,
              ),
              _SheetOption(
                icon: Icons.folder_rounded,
                iconBg: const Color(0xFF10B981),
                title: 'Datoteke',
                subtitle: 'PDF, Word, Excel i ostalo',
                isDark: isDark,
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
    required this.isDark,
    required this.onTap,
  });

  final IconData icon;
  final Color iconBg;
  final String title;
  final String subtitle;
  final bool isDark;
  final VoidCallback onTap;

  @override
  State<_SheetOption> createState() => _SheetOptionState();
}

class _SheetOptionState extends State<_SheetOption> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final textColor = widget.isDark ? Colors.white : const Color(0xFF0D0D0D);
    final subColor = widget.isDark
        ? Colors.white.withOpacity(0.42)
        : Colors.black.withOpacity(0.38);
    final pressedBg = widget.isDark
        ? Colors.white.withOpacity(0.04)
        : Colors.black.withOpacity(0.025);
    final chevronColor = widget.isDark
        ? Colors.white.withOpacity(0.18)
        : Colors.black.withOpacity(0.16);

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        color: _pressed ? pressedBg : Colors.transparent,
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
                      color: textColor,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.subtitle,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w400,
                      color: subColor,
                      letterSpacing: -0.1,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 20, color: chevronColor),
          ],
        ),
      ),
    );
  }
}
