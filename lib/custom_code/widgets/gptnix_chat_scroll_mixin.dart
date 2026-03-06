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
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';

mixin GptnixChatScrollMixin<T extends StatefulWidget> on State<T> {
  /// REQUIRED: implement these in your State
  ScrollController get chatScroll;
  GlobalKey get chatEphemeralKey;

  bool get isStreamingNow;

  bool get placeholderPinActive;
  set placeholderPinActive(bool v);

  bool get userPaused;
  set userPaused(bool v);

  bool get followEnabled;
  set followEnabled(bool v);

  double? get pauseAnchorPx;
  set pauseAnchorPx(double? v);

  bool get programmaticScroll;
  set programmaticScroll(bool v);

  bool get showScrollBtn;
  set showScrollBtn(bool v);

  Timer? get hideScrollBtnTimer;
  set hideScrollBtnTimer(Timer? t);

  // ----------------------------
  // Core helpers
  // ----------------------------

  bool get autoFollowAllowed => followEnabled && !userPaused;

  bool isNearBottom({double threshold = 70}) {
    if (!chatScroll.hasClients) return true;
    final max = chatScroll.position.maxScrollExtent;
    final px = chatScroll.position.pixels;
    return (max - px) <= threshold;
  }

  void scrollToBottom({required bool animated, bool force = false}) {
    if (!chatScroll.hasClients || !mounted) return;

    if (placeholderPinActive && !force) return;
    if (!force && !autoFollowAllowed) return;

    programmaticScroll = true;

    final target = chatScroll.position.maxScrollExtent;
    final current = chatScroll.position.pixels;
    final dist = (target - current).abs();

    if (animated && dist < 1500) {
      chatScroll
          .animateTo(
        target,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      )
          .whenComplete(() {
        if (mounted) programmaticScroll = false;
      });
    } else {
      chatScroll.jumpTo(target);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        programmaticScroll = false;
      });
    }
  }

  void ensureEphemeralBottomVisible({bool animated = false}) {
    if (!chatScroll.hasClients || !autoFollowAllowed || placeholderPinActive) {
      return;
    }

    final ctx = chatEphemeralKey.currentContext;
    if (ctx == null) {
      scrollToBottom(animated: animated);
      return;
    }

    programmaticScroll = true;
    Scrollable.ensureVisible(
      ctx,
      alignment: 1.0,
      duration: animated ? const Duration(milliseconds: 160) : Duration.zero,
      curve: Curves.easeOut,
    ).whenComplete(() {
      if (mounted) programmaticScroll = false;
    });
  }

  void applyPauseAnchorIfNeeded() {
    if (!userPaused) return;
    if (pauseAnchorPx == null) return;
    if (!chatScroll.hasClients) return;

    final min = chatScroll.position.minScrollExtent;
    final max = chatScroll.position.maxScrollExtent;
    final wanted = pauseAnchorPx!.clamp(min, max);

    if ((chatScroll.position.pixels - wanted).abs() <= 0.5) return;

    programmaticScroll = true;
    chatScroll.jumpTo(wanted);
    programmaticScroll = false;
  }

  // ----------------------------
  // Pause / Resume logic
  // ----------------------------

  void pauseAutoscrollHard() {
    if (!isStreamingNow) return;
    if (userPaused) return;
    if (placeholderPinActive) return;

    HapticFeedback.lightImpact();

    setState(() {
      userPaused = true;
      followEnabled = false;
      showScrollBtn = true;
      pauseAnchorPx = chatScroll.hasClients ? chatScroll.position.pixels : 0.0;
    });

    scheduleHideScrollButton(forceKeep: true);
  }

  void handleUserTouchInChat() {
    if (placeholderPinActive) {
      placeholderPinActive = false;
    }
    if (!userPaused) {
      pauseAutoscrollHard();
    }
  }

  void resumeAutoscrollAndGoBottom() {
    setState(() {
      placeholderPinActive = false;
      pauseAnchorPx = null;
      showScrollBtn = false;
      userPaused = false;
      followEnabled = true;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      scrollToBottom(animated: true, force: true);
    });
  }

  void scheduleHideScrollButton({bool forceKeep = false}) {
    hideScrollBtnTimer?.cancel();
    if (forceKeep) return;

    hideScrollBtnTimer = Timer(const Duration(seconds: 3), () {
      if (!mounted) return;
      if (userPaused) return;
      if (showScrollBtn) setState(() => showScrollBtn = false);
    });
  }

  // ----------------------------
  // Scroll notification handler
  // ----------------------------

  bool onScrollNotification(ScrollNotification n) {
    if (programmaticScroll) return false;
    if (!chatScroll.hasClients) return false;

    if (n is UserScrollNotification) {
      if (n.direction != ScrollDirection.idle) {
        if (placeholderPinActive) placeholderPinActive = false;

        if (!userPaused) HapticFeedback.lightImpact();

        setState(() {
          userPaused = true;
          followEnabled = false;
          showScrollBtn = true;
          pauseAnchorPx = chatScroll.position.pixels;
        });

        scheduleHideScrollButton(forceKeep: true);
      }
      return false;
    }

    if (n is ScrollUpdateNotification || n is ScrollEndNotification) {
      if (placeholderPinActive) return false;

      final near = isNearBottom();

      if (near) {
        if (showScrollBtn) setState(() => showScrollBtn = false);
      } else {
        // user je negdje gore - drži anchor i pokaži gumb
        if (!userPaused || followEnabled || !showScrollBtn) {
          setState(() {
            userPaused = true;
            followEnabled = false;
            showScrollBtn = true;
            pauseAnchorPx = chatScroll.position.pixels;
          });
          scheduleHideScrollButton();
        } else {
          pauseAnchorPx = chatScroll.position.pixels;
        }
      }
    }

    return false;
  }
}
