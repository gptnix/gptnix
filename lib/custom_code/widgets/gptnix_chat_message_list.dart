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

// BITNO: sakrij ChatViewportController ako ga index.dart exporta
import '/custom_code/widgets/index.dart' hide ChatViewportController;
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

import 'package:flutter/foundation.dart'; // ValueListenable / ValueNotifier
import 'package:flutter/rendering.dart'; // ScrollDirection

// Ako lokalni index.dart (u istom folderu) također exporta controller, sakrij ga:
import 'index.dart' hide ChatViewportController;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'dart:async';
import 'package:flutter/scheduler.dart';

// ✅ Jedini izvor istog tipa controller-a u cijelom projektu:
import '/custom_code/widgets/chat_viewport_controller.dart' as vp;

// ────────────────────────────────────────────────────────────
// _MessageEntryAnimator - ChatGPT-like ulazna animacija poruke
// ────────────────────────────────────────────────────────────
class _MessageEntryAnimator extends StatefulWidget {
  final Widget child;
  final Duration duration;
  final double slideDy;
  final bool animate;

  const _MessageEntryAnimator({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 220),
    this.slideDy = 0.03,
    this.animate = true,
  });

  @override
  State<_MessageEntryAnimator> createState() => _MessageEntryAnimatorState();
}

class _MessageEntryAnimatorState extends State<_MessageEntryAnimator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: widget.duration);
    _fade = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);
    _slide = Tween<Offset>(
      begin: Offset(0, widget.slideDy),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _c, curve: Curves.easeOutCubic));

    if (widget.animate) {
      _c.forward();
    } else {
      _c.value = 1.0;
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.animate) return widget.child;

    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: widget.child,
      ),
    );
  }
}

// ────────────────────────────────────────────────────────────
// ChatGPT-like physics (bounce na iOS/macOS, clamp drugdje)
// ────────────────────────────────────────────────────────────
ScrollPhysics _adaptivePhysics(BuildContext context) {
  final platform = Theme.of(context).platform;
  if (platform == TargetPlatform.iOS || platform == TargetPlatform.macOS) {
    return const BouncingScrollPhysics();
  }
  return const ClampingScrollPhysics();
}

// ────────────────────────────────────────────────────────────
// VM + Timeline builder
// ────────────────────────────────────────────────────────────
class ChatMessageVM {
  ChatMessageVM({
    required this.id,
    required this.createdAtMs,
    this.doc,
    this.isEphemeral = false,
    this.animateOnInsert = false,
  });

  final String id;
  final int createdAtMs;
  final DocumentSnapshot? doc;

  final bool isEphemeral;
  final bool animateOnInsert;
}

class _TimelineResult {
  _TimelineResult(this.items, this.docCount);
  final List<ChatMessageVM> items;
  final int docCount;
}

class _TimelineBuilder {
  static int _createdAtMsFromDoc(DocumentSnapshot doc) {
    final d = doc.data();
    if (d is! Map) return 0;

    final raw = d['created_at_ms'];
    if (raw is int) return raw;
    if (raw is String) return int.tryParse(raw) ?? 0;
    return int.tryParse(raw?.toString() ?? '') ?? 0;
  }

  static String _roleFromDoc(DocumentSnapshot doc) {
    final d = doc.data();
    if (d is! Map) return '';
    return (d['role'] ?? '').toString().toLowerCase().trim();
  }

  static _TimelineResult build({
    required List<DocumentSnapshot> docs,
    required Set<String> knownIds,
    required bool initialBatchSeen,
    required bool showEphemeral,
    required bool animateEphemeralInsert,
    required int? activeStreamStartMs,
    required String? activeStreamFinalMessageIdHint,
  }) {
    final sorted = List<DocumentSnapshot>.from(docs);
    sorted.sort((a, b) {
      final am = _createdAtMsFromDoc(a);
      final bm = _createdAtMsFromDoc(b);
      if (am != bm) return am.compareTo(bm);
      return a.id.compareTo(b.id);
    });

    bool effectiveShowEphemeral = showEphemeral;

    if (effectiveShowEphemeral && activeStreamFinalMessageIdHint != null) {
      final exists = sorted.any((d) => d.id == activeStreamFinalMessageIdHint);
      if (exists) effectiveShowEphemeral = false;
    }

    if (effectiveShowEphemeral &&
        activeStreamFinalMessageIdHint == null &&
        activeStreamStartMs != null) {
      for (int i = sorted.length - 1; i >= 0; i--) {
        final role = _roleFromDoc(sorted[i]);
        if (role == 'assistant') {
          final ms = _createdAtMsFromDoc(sorted[i]);
          if (ms >= (activeStreamStartMs - 50)) {
            effectiveShowEphemeral = false;
          }
          break;
        }
      }
    }

    final vms = <ChatMessageVM>[];
    for (final doc in sorted) {
      final id = doc.id;
      final createdAtMs = _createdAtMsFromDoc(doc);
      final animate = initialBatchSeen ? !knownIds.contains(id) : false;

      vms.add(ChatMessageVM(
        id: id,
        createdAtMs: createdAtMs,
        doc: doc,
        isEphemeral: false,
        animateOnInsert: animate,
      ));
    }

    if (effectiveShowEphemeral) {
      final lastMs = vms.isNotEmpty ? vms.last.createdAtMs : 0;
      vms.add(ChatMessageVM(
        id: 'ephemeral',
        createdAtMs: lastMs + 1,
        doc: null,
        isEphemeral: true,
        animateOnInsert: animateEphemeralInsert,
      ));
    }

    return _TimelineResult(vms, sorted.length);
  }
}

/// ────────────────────────────────────────────────────────────
/// GptnixChatMessageList - ChatGPT-style message list (Slivers)
/// ────────────────────────────────────────────────────────────
// Debug flag — keyboard/layout diagnostics (flip to true locally)
const bool _msgListKbDebug = false;

class GptnixChatMessageList extends StatefulWidget {
  const GptnixChatMessageList({
    super.key,
    required this.scrollController,
    required this.messages,
    required this.showEphemeral,
    required this.activeStreamStartMs,
    required this.ephemeralKey,
    required this.msgKeys,
    this.onScrollNotification,
    this.onUserTouch,
    required this.buildEphemeralMessage,
    required this.buildMessageItem,
    this.ephemeralTextListenable,
    this.buildEphemeralMessageFromText,
    this.activeStreamFinalMessageIdHint,
    this.subtext,
    this.subtextColor,
    this.bottomPadding = 140,
    this.topPadding = 18,
    this.sidePadding = 14,
    this.cacheExtent = 1600,
    this.disableAnimations = false,
    this.maxWidth = 760,
    this.showChatGptEmptyState = true,
    this.showFloatingToBottomButton = true,
    this.fabBottomOffset = 16,
    this.fabRightOffset = 12,

    // ✅ sada je JEDINI TIP: vp.ChatViewportController
    this.viewportController,
  });

  final ScrollController scrollController;
  final List<DocumentSnapshot> messages;

  final bool showEphemeral;
  final int? activeStreamStartMs;

  final GlobalKey ephemeralKey;
  final Map<String, GlobalKey> msgKeys;

  final bool Function(ScrollNotification n)? onScrollNotification;
  final VoidCallback? onUserTouch;

  final Widget Function() buildEphemeralMessage;
  final Widget Function(DocumentSnapshot doc, int index) buildMessageItem;

  final ValueListenable<String>? ephemeralTextListenable;
  final Widget Function(String text)? buildEphemeralMessageFromText;

  final String? activeStreamFinalMessageIdHint;

  final Color? subtext;
  final Color? subtextColor;

  final double bottomPadding;
  final double topPadding;
  final double sidePadding;

  final double cacheExtent;
  final bool disableAnimations;

  final double? maxWidth;
  final bool showChatGptEmptyState;

  final bool showFloatingToBottomButton;
  final double fabBottomOffset;
  final double fabRightOffset;

  // ✅ TIP FIX
  final vp.ChatViewportController? viewportController;

  @override
  State<GptnixChatMessageList> createState() => _GptnixChatMessageListState();
}

class _GptnixChatMessageListState extends State<GptnixChatMessageList> {
  late vp.ChatViewportController _viewport;
  bool _ownsViewport = false;

  final Set<String> _knownIds = <String>{};
  bool _initialBatchSeen = false;

  bool _ephemeralWasVisible = false;

  int _lastDocCount = 0;
  int _lastTimelineCount = 0;

  VoidCallback? _ephemeralTextListener;

  @override
  void initState() {
    super.initState();

    if (widget.viewportController != null) {
      _viewport = widget.viewportController!;
      _ownsViewport = false;
    } else {
      _viewport = vp.ChatViewportController(
        scrollController: widget.scrollController,
      );
      _ownsViewport = true;
    }

    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _viewport.jumpToBottom();
    });

    _bindEphemeralTextListener();
  }

  @override
  void didUpdateWidget(covariant GptnixChatMessageList oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.viewportController != widget.viewportController) {
      if (_ownsViewport) _viewport.dispose();

      if (widget.viewportController != null) {
        _viewport = widget.viewportController!;
        _ownsViewport = false;
      } else {
        _viewport = vp.ChatViewportController(
          scrollController: widget.scrollController,
        );
        _ownsViewport = true;
      }
    } else if (_ownsViewport &&
        oldWidget.scrollController != widget.scrollController) {
      _viewport.dispose();
      _viewport = vp.ChatViewportController(
        scrollController: widget.scrollController,
      );
      _ownsViewport = true;
    }

    if (oldWidget.ephemeralTextListenable != widget.ephemeralTextListenable) {
      _unbindEphemeralTextListener(oldWidget.ephemeralTextListenable);
      _bindEphemeralTextListener();
    }
  }

  @override
  void dispose() {
    _unbindEphemeralTextListener(widget.ephemeralTextListenable);
    if (_ownsViewport) _viewport.dispose();
    super.dispose();
  }

  void _bindEphemeralTextListener() {
    final l = widget.ephemeralTextListenable;
    if (l == null) return;

    _ephemeralTextListener = () {
      _viewport.notifyContentSizeMaybeChanged();
    };
    l.addListener(_ephemeralTextListener!);
  }

  void _unbindEphemeralTextListener(ValueListenable<String>? l) {
    if (l == null) return;
    if (_ephemeralTextListener == null) return;
    l.removeListener(_ephemeralTextListener!);
    _ephemeralTextListener = null;
  }

  Color _resolveSubtext(BuildContext context) {
    return widget.subtextColor ??
        widget.subtext ??
        Theme.of(context).textTheme.bodySmall?.color ??
        const Color(0xFF6B7280);
  }

  Widget _wrapWithMaxWidth(Widget child) {
    if (widget.maxWidth == null) return child;

    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: widget.maxWidth!),
        child: child,
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, Color resolvedSubtext) {
    if (widget.showChatGptEmptyState) {
      return Padding(
        padding: EdgeInsets.only(bottom: widget.bottomPadding),
        child: GptnixChatEmptyState(
          subtext: resolvedSubtext,
        ),
      );
    }

    return Center(
      child: Padding(
        padding: EdgeInsets.only(bottom: widget.bottomPadding),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Započni razgovor',
              style: TextStyle(
                color: resolvedSubtext.withOpacity(0.7),
                fontSize: 16,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Pošalji poruku da krenemo',
              style: TextStyle(
                color: resolvedSubtext.withOpacity(0.5),
                fontSize: 13,
                fontWeight: FontWeight.w400,
                letterSpacing: 0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _handleScrollNotification(ScrollNotification n) {
    _viewport.onScrollNotification(n);
    final legacy = widget.onScrollNotification?.call(n) ?? false;
    return legacy;
  }

  void _handleUserTouch() {
    _viewport.onUserScrollIntent();
    widget.onUserTouch?.call();
  }

  Widget _buildFirestoreItem(ChatMessageVM vm, int index) {
    final doc = vm.doc!;
    widget.msgKeys.putIfAbsent(doc.id, () => GlobalKey());

    Widget child = RepaintBoundary(
      child: _wrapWithMaxWidth(
        widget.buildMessageItem(doc, index),
      ),
    );

    final shouldAnimate = !widget.disableAnimations && vm.animateOnInsert;

    if (shouldAnimate) {
      child = _MessageEntryAnimator(
        animate: true,
        child: child,
      );
    }

    return KeyedSubtree(
      key: ValueKey<String>(vm.id),
      child: KeyedSubtree(
        key: widget.msgKeys[doc.id],
        child: child,
      ),
    );
  }

  Widget _buildEphemeralItem(ChatMessageVM vm) {
    Widget inner;

    if (widget.ephemeralTextListenable != null &&
        widget.buildEphemeralMessageFromText != null) {
      inner = ValueListenableBuilder<String>(
        valueListenable: widget.ephemeralTextListenable!,
        builder: (context, text, _) {
          return widget.buildEphemeralMessageFromText!(text);
        },
      );
    } else {
      inner = widget.buildEphemeralMessage();
    }

    inner = NotificationListener<SizeChangedLayoutNotification>(
      onNotification: (_) {
        _viewport.notifyContentSizeMaybeChanged();
        return false;
      },
      child: SizeChangedLayoutNotifier(child: inner),
    );

    Widget child = RepaintBoundary(
      child: _wrapWithMaxWidth(inner),
    );

    final shouldAnimate = !widget.disableAnimations && vm.animateOnInsert;

    if (shouldAnimate) {
      child = _MessageEntryAnimator(
        animate: true,
        child: child,
      );
    }

    return KeyedSubtree(
      key: const ValueKey<String>('ephemeral'),
      child: KeyedSubtree(
        key: widget.ephemeralKey,
        child: child,
      ),
    );
  }

  Widget _buildTimelineItem(List<ChatMessageVM> items, int i) {
    final vm = items[i];
    if (vm.isEphemeral) return _buildEphemeralItem(vm);
    return _buildFirestoreItem(vm, i);
  }

  Widget _buildScrollToBottomFab(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: _viewport.showScrollToBottom,
      builder: (context, show, _) {
        if (!widget.showFloatingToBottomButton || !show) {
          return const SizedBox.shrink();
        }

        return Positioned(
          right: widget.fabRightOffset,
          bottom: widget.fabBottomOffset,
          child: ValueListenableBuilder<int>(
            valueListenable: _viewport.pendingNewItems,
            builder: (context, pending, __) {
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Material(
                    color: Theme.of(context).colorScheme.surface,
                    elevation: 3,
                    shape: const CircleBorder(),
                    child: InkWell(
                      customBorder: const CircleBorder(),
                      onTap: () =>
                          _viewport.scrollToBottom(force: true, animated: true),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Icon(
                          Icons.arrow_downward_rounded,
                          size: 18,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withOpacity(0.8),
                        ),
                      ),
                    ),
                  ),
                  if (pending > 0)
                    Positioned(
                      top: -6,
                      right: -6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          pending > 99 ? '99+' : pending.toString(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.onPrimary,
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final resolvedSubtext = _resolveSubtext(context);

    final animateEphemeralInsert =
        widget.showEphemeral && !_ephemeralWasVisible;
    _ephemeralWasVisible = widget.showEphemeral;

    final timeline = _TimelineBuilder.build(
      docs: widget.messages,
      knownIds: _knownIds,
      initialBatchSeen: _initialBatchSeen,
      showEphemeral: widget.showEphemeral,
      animateEphemeralInsert: animateEphemeralInsert,
      activeStreamStartMs: widget.activeStreamStartMs,
      activeStreamFinalMessageIdHint: widget.activeStreamFinalMessageIdHint,
    );

    final items = timeline.items;

    if (items.isEmpty) {
      return _buildEmptyState(context, resolvedSubtext);
    }

    final docCountNow = timeline.docCount;
    final docDelta = docCountNow - _lastDocCount;
    _lastDocCount = docCountNow;

    if (!_initialBatchSeen && docCountNow > 0) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        for (final d in widget.messages) {
          _knownIds.add(d.id);
        }
        _initialBatchSeen = true;
      });
    } else {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        for (final d in widget.messages) {
          _knownIds.add(d.id);
        }
      });
    }

    if (docDelta > 0) {
      _viewport.onNewItemsArrived(docDelta);
    }

    if (items.length != _lastTimelineCount) {
      _lastTimelineCount = items.length;
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _viewport.notifyContentSizeMaybeChanged();
      });
    }

    final physics = _adaptivePhysics(context);

    final scrollView = NotificationListener<ScrollNotification>(
      onNotification: _handleScrollNotification,
      child: Listener(
        onPointerDown: (_) => _handleUserTouch(),
        child: PrimaryScrollController(
          controller: widget.scrollController,
          child: Scrollbar(
            controller: widget.scrollController,
            thumbVisibility: false,
            interactive: true,
            child: CustomScrollView(
              controller: widget.scrollController,
              cacheExtent: widget.cacheExtent,
              physics: physics,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              slivers: [
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(
                    widget.sidePadding,
                    widget.topPadding,
                    widget.sidePadding,
                    widget.bottomPadding,
                  ),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) => _buildTimelineItem(items, i),
                      childCount: items.length,
                      addRepaintBoundaries: true,
                      addAutomaticKeepAlives: false,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    return Stack(
      children: [
        scrollView,
        _buildScrollToBottomFab(context),
      ],
    );
  }
}
