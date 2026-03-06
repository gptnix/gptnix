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

import 'package:flutter/rendering.dart';

class GptnixAutoScrollController {
  GptnixAutoScrollController({
    this.nearBottomPx = 70,
    this.onHaptic,
    this.isAutofollowBlocked,
  });

  final double nearBottomPx;
  final VoidCallback? onHaptic;

  /// Ako želiš blokirati auto-follow dok je aktivan placeholder pin ili slično
  final bool Function()? isAutofollowBlocked;

  ScrollController? _scroll;
  bool _programmatic = false;

  /// Kad user tapne ili scrolla -> pauziraj auto-follow
  bool userPaused = false;

  /// Scroll-to-bottom button (FAB) prikaz
  bool showBtn = false;

  /// “anchor” pozicija gdje se user zaustavio (čuvamo da ga stream ne gura)
  double? pauseAnchorPx;

  void attach(ScrollController c) => _scroll = c;

  bool get hasClients => _scroll?.hasClients == true;

  bool isNearBottom() {
    final s = _scroll;
    if (s == null || !s.hasClients) return true;
    final max = s.position.maxScrollExtent;
    final px = s.position.pixels;
    return (max - px) <= nearBottomPx;
  }

  bool get autoFollowAllowed =>
      !userPaused && (isAutofollowBlocked?.call() != true);

  /// Tap na display -> pauza autoscrolla (stream i dalje radi)
  void onUserTouch({
    required VoidCallback rebuild,
    required bool isStreaming,
  }) {
    if (!isStreaming) return;
    if (userPaused) return;

    onHaptic?.call();
    userPaused = true;

    final s = _scroll;
    pauseAnchorPx = (s != null && s.hasClients) ? s.position.pixels : 0.0;

    // kad user pauzira, gumb treba biti vidljiv
    showBtn = true;

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

    // 1) User je krenuo scrollat -> pauziraj auto-follow
    if (n is UserScrollNotification) {
      if (n.direction != ScrollDirection.idle) {
        if (!userPaused) onHaptic?.call();
        userPaused = true;
        pauseAnchorPx = s.position.pixels;
        showBtn = true;
        rebuild();
      }
      return false;
    }

    // 2) Update/end -> show/hide button + anchor logika
    if (n is ScrollUpdateNotification || n is ScrollEndNotification) {
      final near = isNearBottom();

      // Gumb je vidljiv ako je userPaused ili nije near-bottom
      final newShowBtn = userPaused || !near;
      if (newShowBtn != showBtn) {
        showBtn = newShowBtn;
        rebuild();
      }

      // Ako user NIJE pauzirao, osvježi anchor (korisno dok stream “gura” dolje)
      if (!userPaused) {
        pauseAnchorPx = s.position.pixels;
      }

      // ✅ KLJUČNI FIX:
      // anchor-lock samo kad scroll nije od korisničkog draga
      // dragDetails != null znači da user vuče prstom -> NE DIRAJ scroll!
      final isUserDrag =
          (n is ScrollUpdateNotification) && (n.dragDetails != null);

      if (isStreaming &&
          userPaused &&
          !isUserDrag &&
          pauseAnchorPx != null &&
          (isAutofollowBlocked?.call() != true)) {
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
    required VoidCallback rebuild,
    bool animated = false,
  }) {
    if (!autoFollowAllowed) return;

    final ctx = ephemeralKey.currentContext;
    if (ctx == null) {
      scrollToBottom(rebuild: rebuild, animated: animated, force: false);
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

  void scrollToBottom({
    required VoidCallback rebuild,
    bool animated = true,
    bool force = false,
  }) {
    final s = _scroll;
    if (s == null || !s.hasClients) return;

    if (!force) {
      if (!autoFollowAllowed) return;
    }

    final target = s.position.maxScrollExtent;
    final current = s.position.pixels;
    final dist = (target - current).abs();

    _programmatic = true;
    if (animated && dist < 1500) {
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
    scrollToBottom(rebuild: rebuild, animated: true, force: true);
  }
}
