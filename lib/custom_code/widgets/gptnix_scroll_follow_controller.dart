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

import 'dart:async';
import 'package:flutter/rendering.dart' as rendering;

class GptnixScrollFollowController extends StatelessWidget {
  const GptnixScrollFollowController({super.key, this.width, this.height});
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

class GptnixScrollFollowCore {
  GptnixScrollFollowCore({
    this.nearBottomPx = 70,
    this.scrollBtnAutoHideSeconds = 3,
    this.onHaptic,
    this.isAutofollowBlocked,
  });

  final double nearBottomPx;
  final int scrollBtnAutoHideSeconds;
  final VoidCallback? onHaptic;
  final bool Function()? isAutofollowBlocked;

  ScrollController? _scroll;
  bool _programmaticScroll = false;

  bool followEnabled = true;
  bool userPaused = false;
  double? pauseAnchorPx;

  bool showScrollButton = false;
  Timer? _hideBtnTimer;

  bool get hasClients => _scroll?.hasClients == true;

  void attach(ScrollController controller) {
    _scroll = controller;
  }

  void dispose() {
    _hideBtnTimer?.cancel();
    _hideBtnTimer = null;
    _scroll = null;
  }

  bool isNearBottom() {
    final s = _scroll;
    if (s == null || !s.hasClients) return true;
    final max = s.position.maxScrollExtent;
    final px = s.position.pixels;
    return (max - px) <= nearBottomPx;
  }

  bool get autoFollowAllowed => followEnabled && !userPaused;

  void _scheduleHideButton({
    required VoidCallback requestRebuild,
    bool forceKeep = false,
  }) {
    _hideBtnTimer?.cancel();
    if (forceKeep) return;

    _hideBtnTimer = Timer(Duration(seconds: scrollBtnAutoHideSeconds), () {
      if (userPaused) return;
      if (showScrollButton) {
        showScrollButton = false;
        requestRebuild();
      }
    });
  }

  void scrollToBottom({
    required VoidCallback requestRebuild,
    bool animated = true,
    bool force = false,
  }) {
    final s = _scroll;
    if (s == null || !s.hasClients) return;

    if (!force) {
      if (isAutofollowBlocked?.call() == true) return;
      if (!autoFollowAllowed) return;
    }

    _programmaticScroll = true;

    final target = s.position.maxScrollExtent;
    final current = s.position.pixels;
    final dist = (target - current).abs();

    if (animated && dist < 1500) {
      s
          .animateTo(
            target,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          )
          .whenComplete(() => _programmaticScroll = false);
    } else {
      s.jumpTo(target);
      _programmaticScroll = false;
    }
  }

  void ensureVisibleBottom({
    required VoidCallback requestRebuild,
    required BuildContext context,
    required GlobalKey ephemeralKey,
    bool animated = false,
  }) {
    if (isAutofollowBlocked?.call() == true) return;
    if (!autoFollowAllowed) return;

    final ctx = ephemeralKey.currentContext;
    if (ctx == null) {
      scrollToBottom(requestRebuild: requestRebuild, animated: animated);
      return;
    }

    _programmaticScroll = true;
    Scrollable.ensureVisible(
      ctx,
      alignment: 1.0,
      duration: animated ? const Duration(milliseconds: 160) : Duration.zero,
      curve: Curves.easeOut,
    ).whenComplete(() => _programmaticScroll = false);
  }

  // ✅ ključni fix: "anchor lock" samo kad NIJE user drag
  void _applyPauseAnchorIfNeeded({required bool allowAnchorLock}) {
    if (!allowAnchorLock) return;
    if (!userPaused) return;
    if (pauseAnchorPx == null) return;

    final s = _scroll;
    if (s == null || !s.hasClients) return;

    final min = s.position.minScrollExtent;
    final max = s.position.maxScrollExtent;
    final wanted = pauseAnchorPx!.clamp(min, max).toDouble();

    if ((s.position.pixels - wanted).abs() <= 0.5) return;

    _programmaticScroll = true;
    s.jumpTo(wanted);
    _programmaticScroll = false;
  }

  void onUserTouch({
    required VoidCallback requestRebuild,
    required bool isStreaming,
  }) {
    if (!isStreaming) return;
    if (userPaused) return;

    onHaptic?.call();

    userPaused = true;
    followEnabled = false;

    final s = _scroll;
    pauseAnchorPx = (s != null && s.hasClients) ? s.position.pixels : 0.0;

    showScrollButton = true;
    requestRebuild();

    // kad user pauzira, ne skrivaj button automatski
    _scheduleHideButton(requestRebuild: requestRebuild, forceKeep: true);
  }

  void resumeAndGoBottom({
    required VoidCallback requestRebuild,
  }) {
    userPaused = false;
    followEnabled = true;
    pauseAnchorPx = null;

    showScrollButton = false;
    requestRebuild();

    scrollToBottom(requestRebuild: requestRebuild, animated: true, force: true);
  }

  bool onScrollNotification({
    required ScrollNotification n,
    required VoidCallback requestRebuild,
    required bool isStreaming,
  }) {
    if (_programmaticScroll) return false;

    final s = _scroll;
    if (s == null || !s.hasClients) return false;

    // 1) korisnik je krenuo skrolat -> pauza (ali ne ubij scroll)
    if (n is UserScrollNotification) {
      if (n.direction != rendering.ScrollDirection.idle) {
        if (!userPaused) onHaptic?.call();

        userPaused = true;
        followEnabled = false;
        pauseAnchorPx = s.position.pixels;

        showScrollButton = true;
        requestRebuild();

        _scheduleHideButton(requestRebuild: requestRebuild, forceKeep: true);
      }
      return false;
    }

    // 2) update/end -> button logika + eventualni anchor lock
    if (n is ScrollUpdateNotification || n is ScrollEndNotification) {
      final near = isNearBottom();

      // ✅ stabilna logika gumba:
      // vidljiv ako je userPaused ili nije near-bottom
      final newShow = userPaused || !near;
      if (newShow != showScrollButton) {
        showScrollButton = newShow;
        requestRebuild();
      }

      // anchor spremamo samo kad user NIJE pauzirao
      if (!userPaused) {
        pauseAnchorPx = s.position.pixels;
      }

      // ✅ KLJUČ: ne smije se anchor-lock raditi dok user DRAG-a prstom
      final bool isUserDrag =
          (n is ScrollUpdateNotification) && (n.dragDetails != null);

      if (isStreaming && userPaused) {
        _applyPauseAnchorIfNeeded(allowAnchorLock: !isUserDrag);
      }
    }

    return false;
  }
}
