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

import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'dart:async';

class GptnixChatScrollShell extends StatefulWidget {
  const GptnixChatScrollShell({
    super.key,
    required this.scrollController,
    required this.child,
    required this.isStreaming,
    required this.ephemeralKey,
    required this.bottomOffset,
    required this.surface,
    required this.border,
    required this.iconColor,
    required this.placeholderPinActive,
    required this.onForceBottom,
  });

  final ScrollController scrollController;
  final Widget child;

  final bool isStreaming;
  final GlobalKey ephemeralKey;

  final double bottomOffset;

  final Color surface;
  final Color border;
  final Color iconColor;

  final bool placeholderPinActive;
  final Future<void> Function() onForceBottom;

  @override
  State<GptnixChatScrollShell> createState() => _GptnixChatScrollShellState();
}

class _GptnixChatScrollShellState extends State<GptnixChatScrollShell> {
  late final _ScrollFollow _follow;

  @override
  void initState() {
    super.initState();
    _follow = _ScrollFollow(
      nearBottomPx: 70,
      onHaptic: () => HapticFeedback.lightImpact(),
      isAutofollowBlocked: () => widget.placeholderPinActive,
    );
    _follow.attach(widget.scrollController);
  }

  @override
  void didUpdateWidget(covariant GptnixChatScrollShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scrollController != widget.scrollController) {
      _follow.attach(widget.scrollController);
    }
  }

  @override
  void dispose() {
    _follow.dispose();
    super.dispose();
  }

  void _rebuild() {
    if (!mounted) return;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isStreaming &&
        !widget.placeholderPinActive &&
        _follow.autoFollowAllowed) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _follow.ensureVisibleBottom(
          context: context,
          ephemeralKey: widget.ephemeralKey,
          animated: false,
        );
      });
    }

    final showBtn = _follow.showBtn || widget.placeholderPinActive;

    return PrimaryScrollController(
      controller: widget.scrollController,
      child: Stack(
        children: [
          Listener(
            behavior: HitTestBehavior.translucent,
            onPointerDown: (_) {
              _follow.onUserTouch(
                rebuild: _rebuild,
                isStreaming: widget.isStreaming,
              );
            },
            child: NotificationListener<ScrollNotification>(
              onNotification: (n) => _follow.onScrollNotification(
                n: n,
                rebuild: _rebuild,
                isStreaming: widget.isStreaming,
              ),
              child: widget.child,
            ),
          ),
          Positioned(
            right: 14,
            bottom: widget.bottomOffset,
            child: IgnorePointer(
              ignoring: !showBtn,
              child: AnimatedOpacity(
                opacity: showBtn ? 1.0 : 0.0,
                duration: const Duration(milliseconds: 160),
                curve: Curves.easeOut,
                child: _JumpToBottomButton(
                  surface: widget.surface,
                  border: widget.border,
                  iconColor: widget.iconColor,
                  onTap: () async {
                    await widget.onForceBottom();
                    _follow.resumeAndGoBottom(rebuild: _rebuild);
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScrollFollow {
  _ScrollFollow({
    this.nearBottomPx = 70,
    this.onHaptic,
    this.isAutofollowBlocked,
  });

  final double nearBottomPx;
  final VoidCallback? onHaptic;
  final bool Function()? isAutofollowBlocked;

  ScrollController? _scroll;
  bool _programmatic = false;

  bool userPaused = false;
  bool showBtn = false;
  double? pauseAnchorPx;

  Timer? _hideBtnTimer;

  void attach(ScrollController c) => _scroll = c;

  void dispose() {
    _hideBtnTimer?.cancel();
    _hideBtnTimer = null;
    _scroll = null;
  }

  bool get autoFollowAllowed =>
      !userPaused && (isAutofollowBlocked?.call() != true);

  bool isNearBottom() {
    final s = _scroll;
    if (s == null || !s.hasClients) return true;
    final max = s.position.maxScrollExtent;
    final px = s.position.pixels;
    return (max - px) <= nearBottomPx;
  }

  void _scheduleHide(VoidCallback rebuild) {
    _hideBtnTimer?.cancel();
    _hideBtnTimer = Timer(const Duration(seconds: 3), () {
      if (userPaused) return;
      if (showBtn) {
        showBtn = false;
        rebuild();
      }
    });
  }

  void onUserTouch({required VoidCallback rebuild, required bool isStreaming}) {
    if (!isStreaming) return;
    if (userPaused) return;

    onHaptic?.call();
    userPaused = true;
    showBtn = true;

    final s = _scroll;
    pauseAnchorPx = (s != null && s.hasClients) ? s.position.pixels : 0.0;

    rebuild();
  }

  bool onScrollNotification({
    required ScrollNotification n,
    required VoidCallback rebuild,
    required bool isStreaming,
  }) {
    if (_programmatic) return false;

    final s = _scroll;
    if (s == null || !s.hasClients) return false;

    if (n is UserScrollNotification) {
      if (n.direction != ScrollDirection.idle) {
        if (!userPaused) onHaptic?.call();
        userPaused = true;
        showBtn = true;
        pauseAnchorPx = s.position.pixels;
        rebuild();
      }
      return false;
    }

    if (n is ScrollUpdateNotification || n is ScrollEndNotification) {
      final near = isNearBottom();

      if (near) {
        if (showBtn) {
          showBtn = false;
          rebuild();
        }
      } else {
        if (!showBtn) {
          showBtn = true;
          rebuild();
          _scheduleHide(rebuild);
        }
        pauseAnchorPx = s.position.pixels;
      }

      if (isStreaming && userPaused && pauseAnchorPx != null) {
        final min = s.position.minScrollExtent;
        final max = s.position.maxScrollExtent;
        final wanted = pauseAnchorPx!.clamp(min, max).toDouble();
        if ((s.position.pixels - wanted).abs() > 0.5) {
          _programmatic = true;
          s.jumpTo(wanted);
          _programmatic = false;
        }
      }
    }

    return false;
  }

  void ensureVisibleBottom({
    required BuildContext context,
    required GlobalKey ephemeralKey,
    bool animated = false,
  }) {
    if (!autoFollowAllowed) return;

    final ctx = ephemeralKey.currentContext;
    if (ctx == null) {
      scrollToBottom(animated: animated, force: false);
      return;
    }

    _programmatic = true;
    Scrollable.ensureVisible(
      ctx,
      alignment: 1.0,
      duration: animated ? const Duration(milliseconds: 160) : Duration.zero,
      curve: Curves.easeOut,
    ).whenComplete(() => _programmatic = false);
  }

  void scrollToBottom({bool animated = true, bool force = false}) {
    final s = _scroll;
    if (s == null || !s.hasClients) return;

    if (!force) {
      if (!autoFollowAllowed) return;
    }

    final target = s.position.maxScrollExtent;

    _programmatic = true;
    if (animated) {
      s
          .animateTo(
            target,
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeOut,
          )
          .whenComplete(() => _programmatic = false);
    } else {
      s.jumpTo(target);
      _programmatic = false;
    }
  }

  void resumeAndGoBottom({required VoidCallback rebuild}) {
    userPaused = false;
    showBtn = false;
    pauseAnchorPx = null;

    rebuild();
    scrollToBottom(animated: true, force: true);
  }
}

class _JumpToBottomButton extends StatelessWidget {
  const _JumpToBottomButton({
    required this.surface,
    required this.border,
    required this.iconColor,
    required this.onTap,
  });

  final Color surface;
  final Color border;
  final Color iconColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: border.withOpacity(0.9)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.18),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.arrow_downward_rounded, size: 18, color: iconColor),
              const SizedBox(width: 6),
              Text(
                'Dolje',
                style: TextStyle(
                  color: iconColor,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
