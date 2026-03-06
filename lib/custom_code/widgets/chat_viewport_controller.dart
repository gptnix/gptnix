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

import 'index.dart'; // Imports other custom widgets

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';

/// ChatViewportController - “ChatGPT scroll mozak”
///
/// BITNO: OVA KLASA MORA POSTOJATI SAMO JEDNOM U PROJEKTU.
/// Ne dupliciraj je u drugim widgetima.
class ChatViewportController {
  ChatViewportController({
    required this.scrollController,
    this.nearBottomThresholdPx = 96,
    this.followThrottleMs = 160,
    this.followAnimDuration = const Duration(milliseconds: 180),
    this.followCurve = Curves.easeOutCubic,
  }) : dynamicNearBottomPx = nearBottomThresholdPx;

  final ScrollController scrollController;

  final double nearBottomThresholdPx;
  final int followThrottleMs;
  final Duration followAnimDuration;
  final Curve followCurve;

  final ValueNotifier<bool> isNearBottom = ValueNotifier<bool>(true);
  final ValueNotifier<bool> showScrollToBottom = ValueNotifier<bool>(false);
  final ValueNotifier<int> pendingNewItems = ValueNotifier<int>(0);

  bool autoFollowEnabled = true;
  bool userHasScrolledAway = false;

  // ✅ FIX #1: Aggressive follow mode za streaming (smanjuje throttling)
  bool aggressiveFollow = false;

  // ✅ FIX #2: Dinamički near-bottom threshold (veći tokom streaminga)
  double dynamicNearBottomPx;

  bool _programmaticScrollInProgress = false;
  double _lastKnownMaxExtent = 0.0;

  Timer? _followTimer;
  int _lastFollowMs = 0;

  void dispose() {
    _followTimer?.cancel();
    isNearBottom.dispose();
    showScrollToBottom.dispose();
    pendingNewItems.dispose();
  }

  bool computeIsNearBottom(ScrollMetrics m) {
    final remaining = (m.maxScrollExtent - m.pixels).abs();
    // ✅ FIX: Koristi dinamički threshold umjesto statičkog
    return remaining <= dynamicNearBottomPx;
  }

  void setAutoFollow(bool enabled) {
    autoFollowEnabled = enabled;
    if (enabled) {
      userHasScrolledAway = false;
      pendingNewItems.value = 0;
    }
  }

  void onUserScrollIntent() {
    // ✅ FIX: Samo ako je korisnik STVARNO scrollao daleko od dna
    // Ne blokira autoFollow za slučajne dodire
    if (!isNearBottom.value) {
      userHasScrolledAway = true;
    }
  }

  void onNewItemsArrived(int delta) {
    if (delta <= 0) return;

    if (!isNearBottom.value || !autoFollowEnabled) {
      pendingNewItems.value = (pendingNewItems.value + delta).clamp(0, 9999);
    } else {
      pendingNewItems.value = 0;
    }
  }

  bool onScrollNotification(ScrollNotification n) {
    if (!scrollController.hasClients) return false;

    final m = n.metrics;
    final near = computeIsNearBottom(m);

    if (isNearBottom.value != near) {
      isNearBottom.value = near;
      showScrollToBottom.value = !near;

      if (near) {
        // ✅ FIX: Čim smo blizu dna, odmah reaktiviraj autoFollow
        setAutoFollow(true);
      } else if (!aggressiveFollow) {
        // ✅ FIX: Tokom aggressive mode-a, ne isključuj autoFollow previše brzo
        setAutoFollow(false);
        userHasScrolledAway = true;
      }
    }

    if (n is UserScrollNotification && !_programmaticScrollInProgress) {
      final dir = n.direction;
      // ✅ FIX: Samo isključi autoFollow ako korisnik aktivno scrolluje GORE
      if (dir == ScrollDirection.forward && !aggressiveFollow) {
        setAutoFollow(false);
        userHasScrolledAway = true;
      }
    }

    if (n is ScrollEndNotification) {
      _programmaticScrollInProgress = false;
      if (near) pendingNewItems.value = 0;
    }

    _lastKnownMaxExtent = m.maxScrollExtent;
    return false;
  }

  void notifyContentSizeMaybeChanged() {
    if (!scrollController.hasClients) return;

    final pos = scrollController.position;
    final maxNow = pos.maxScrollExtent;

    final changed = (maxNow - _lastKnownMaxExtent).abs() > 0.5;
    _lastKnownMaxExtent = maxNow;

    if (!changed) return;

    if (autoFollowEnabled && computeIsNearBottom(pos)) {
      _scheduleFollowToBottom(animated: true);
    }
  }

  void _scheduleFollowToBottom({required bool animated}) {
    if (!scrollController.hasClients) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final elapsed = now - _lastFollowMs;

    // ✅ FIX: Za aggressive mode, drastično smanji throttling (160ms → 30ms)
    final effectiveThrottle = aggressiveFollow ? 30 : followThrottleMs;

    if (elapsed >= effectiveThrottle) {
      _lastFollowMs = now;
      scrollToBottom(force: false, animated: animated);
      return;
    }

    _followTimer?.cancel();
    _followTimer =
        Timer(Duration(milliseconds: effectiveThrottle - elapsed), () {
      if (!scrollController.hasClients) return;
      if (!autoFollowEnabled) return;
      if (!computeIsNearBottom(scrollController.position)) return;

      _lastFollowMs = DateTime.now().millisecondsSinceEpoch;
      scrollToBottom(force: false, animated: animated);
    });
  }

  Future<void> scrollToBottom({
    bool force = false,
    bool animated = true,
  }) async {
    if (!scrollController.hasClients) return;

    final pos = scrollController.position;
    final target = pos.maxScrollExtent;

    final near = computeIsNearBottom(pos);
    final canFollow =
        force || (autoFollowEnabled && (near || !userHasScrolledAway));

    if (!canFollow) return;
    if (force) setAutoFollow(true);

    if ((target - pos.pixels).abs() <= 0.5) return;

    _programmaticScrollInProgress = true;

    if (!animated) {
      scrollController.jumpTo(target);
      _programmaticScrollInProgress = false;
      return;
    }

    try {
      await scrollController.animateTo(
        target,
        duration: followAnimDuration,
        curve: followCurve,
      );
    } catch (_) {
    } finally {
      _programmaticScrollInProgress = false;
    }
  }

  void jumpToBottom() {
    if (!scrollController.hasClients) return;
    _programmaticScrollInProgress = true;
    scrollController.jumpTo(scrollController.position.maxScrollExtent);
    _programmaticScrollInProgress = false;
    setAutoFollow(true);
  }
}
