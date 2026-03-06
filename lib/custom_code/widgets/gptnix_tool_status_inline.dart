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

class GptnixToolStatusInline extends StatefulWidget {
  const GptnixToolStatusInline({
    super.key,
    this.width,
    this.height,
    this.toolsJson,
    this.visible = true,
    this.isDark,
    this.subtext,
    this.muted,
    this.fadeMs = 220,
    this.maxWidth = 560,
    this.showDone = false,
    this.doneHoldMs = 850,
  });

  final double? width;
  final double? height;
  final dynamic toolsJson;
  final bool visible;
  final bool? isDark;
  final Color? subtext;
  final Color? muted;
  final int fadeMs;
  final double maxWidth;
  final bool showDone;
  final int doneHoldMs;

  @override
  State<GptnixToolStatusInline> createState() => _GptnixToolStatusInlineState();
}

class _GptnixToolStatusInlineState extends State<GptnixToolStatusInline>
    with TickerProviderStateMixin {
  late final AnimationController _fadeCtl;
  late final Animation<double> _fade;
  late final AnimationController _breatheCtl;
  late final Animation<double> _breathe;

  String _line1 = '';
  String _line2 = '';
  String _previousKey = '';
  Timer? _doneTimer;

  @override
  void initState() {
    super.initState();

    _fadeCtl = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: widget.fadeMs),
    );
    _fade = CurvedAnimation(parent: _fadeCtl, curve: Curves.easeOutCubic);

    _breatheCtl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _breathe = Tween<double>(begin: 0.55, end: 0.95).animate(
      CurvedAnimation(parent: _breatheCtl, curve: Curves.easeInOut),
    );

    _recompute();
  }

  @override
  void didUpdateWidget(covariant GptnixToolStatusInline oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Update fade duration if changed
    if (oldWidget.fadeMs != widget.fadeMs) {
      _fadeCtl.duration = Duration(milliseconds: widget.fadeMs);
    }

    // Only recompute if relevant data changed
    final shouldUpdate = oldWidget.toolsJson != widget.toolsJson ||
        oldWidget.visible != widget.visible ||
        oldWidget.showDone != widget.showDone;

    if (shouldUpdate) {
      _recompute();
    }
  }

  @override
  void dispose() {
    _cancelDoneTimer();
    _fadeCtl.dispose();
    _breatheCtl.dispose();
    super.dispose();
  }

  void _cancelDoneTimer() {
    _doneTimer?.cancel();
    _doneTimer = null;
  }

  // Parse toolsJson (bulletproof)
  List<Map<String, dynamic>> _parse(dynamic json) {
    if (json == null) return [];

    if (json is List) {
      return json
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }

    if (json is Map) {
      final t = json['tools'] ?? json['items'] ?? json['data'];
      if (t is List) {
        return t
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    }

    return [];
  }

  // Pick best tool (priority: active > done)
  Map<String, dynamic>? _pickBestTool(List<Map<String, dynamic>> list) {
    if (list.isEmpty) return null;

    bool isActive(Map<String, dynamic> t) {
      final s = (t['status'] ?? '').toString().toLowerCase().trim();
      return s == 'start' || s == 'progress' || s == 'running';
    }

    bool isDone(Map<String, dynamic> t) {
      final s = (t['status'] ?? '').toString().toLowerCase().trim();
      return s == 'done' || s == 'complete' || s == 'completed';
    }

    // Priority #1: active tools
    final active = list.where(isActive).toList();
    if (active.isNotEmpty) return active.last;

    // Priority #2: done tools (only if showDone == true)
    if (widget.showDone) {
      final done = list.where(isDone).toList();
      if (done.isNotEmpty) return done.last;
    }

    return null;
  }

  String _getStatus(Map<String, dynamic> t) {
    return (t['status'] ?? '').toString().toLowerCase().trim();
  }

  String _fallbackTitle(Map<String, dynamic> t) {
    final tool = (t['tool'] ?? '').toString().toLowerCase();

    bool isWebSearch(String x) =>
        x == 'web_search' ||
        x == 'websearch' ||
        x.contains('tavily') ||
        x.contains('serper') ||
        x.contains('serp') ||
        x.contains('search');

    bool isRag(String x) =>
        x == 'rag' ||
        x.contains('retriev') ||
        x.contains('qdrant') ||
        x.contains('vector') ||
        x.contains('embed') ||
        x.contains('document') ||
        x.contains('file_search');

    bool isImage(String x) =>
        x == 'image_gen' || x.contains('image') || x.contains('img');

    bool isMap(String x) =>
        x == 'osm' ||
        x.contains('openstreet') ||
        x.contains('nominatim') ||
        x.contains('overpass') ||
        x.contains('geo');

    bool isWeather(String x) =>
        x.contains('weather') || x.contains('forecast') || x.contains('yr');

    bool isMedia(String x) =>
        x == 'tmdb' || x == 'omdb' || x.contains('movie') || x.contains('tv');

    if (isWebSearch(tool)) return 'Searching the web';
    if (isRag(tool)) return 'Reading relevant documents';
    if (isImage(tool)) return 'Generating an image';
    if (isMap(tool)) return 'Finding locations';
    if (isWeather(tool)) return 'Checking the weather';
    if (isMedia(tool)) return 'Looking up media';

    return 'Working on it';
  }

  String _fallbackMessage(Map<String, dynamic> t) {
    final extra = t['extra'];
    if (extra is Map) {
      final q = (extra['query'] ?? extra['q'] ?? '').toString().trim();
      if (q.isNotEmpty) return q;
    }
    return 'Please wait a moment…';
  }

  void _recompute() {
    // Cancel any pending done timer
    _cancelDoneTimer();

    // If explicitly hidden -> fade out
    if (!widget.visible) {
      _hideWidget();
      return;
    }

    final list = _parse(widget.toolsJson);
    final best = _pickBestTool(list);

    if (best == null) {
      _hideWidget();
      return;
    }

    // Extract text
    final titleRaw = (best['title'] ?? '').toString().trim();
    final msgRaw = (best['message'] ?? '').toString().trim();
    final title = titleRaw.isNotEmpty ? titleRaw : _fallbackTitle(best);
    final msg = msgRaw.isNotEmpty ? msgRaw : _fallbackMessage(best);
    final status = _getStatus(best);
    final tool = (best['tool'] ?? '').toString();

    // Create content key to detect real changes
    final newKey = '$tool|$status|$title|$msg';

    // Check if content actually changed
    final contentChanged = newKey != _previousKey;

    if (contentChanged) {
      // Content changed - update state
      _previousKey = newKey;
      _line1 = title;
      _line2 = msg;

      // Start fade in only if not already visible
      if (_fadeCtl.status != AnimationStatus.completed &&
          _fadeCtl.status != AnimationStatus.forward) {
        _fadeCtl.forward();
      }

      // Start breathing only if not already animating
      if (!_breatheCtl.isAnimating) {
        _breatheCtl.repeat(reverse: true);
      }

      // If done status and showDone is true, schedule auto-hide
      if (widget.showDone &&
          (status == 'done' || status == 'complete' || status == 'completed')) {
        _scheduleDoneHide();
      }

      if (mounted) setState(() {});
    } else {
      // Content hasn't changed, no need to restart animations
      // Just ensure breathing is running if we're visible
      if (_fadeCtl.isCompleted && !_breatheCtl.isAnimating) {
        _breatheCtl.repeat(reverse: true);
      }
    }
  }

  void _hideWidget() {
    _previousKey = '';
    _line1 = '';
    _line2 = '';
    _fadeCtl.reverse();
    _breatheCtl.stop();
    if (mounted) setState(() {});
  }

  void _scheduleDoneHide() {
    _cancelDoneTimer();
    _doneTimer = Timer(Duration(milliseconds: widget.doneHoldMs), () {
      if (!mounted) return;

      // Check if there's a new active tool
      final list = _parse(widget.toolsJson);
      final best = _pickBestTool(list);

      // Only hide if no active tool exists
      if (best == null) {
        _hideWidget();
      } else {
        final status = _getStatus(best);
        final isStillDone =
            status == 'done' || status == 'complete' || status == 'completed';
        if (isStillDone) {
          _hideWidget();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_line1.isEmpty && _line2.isEmpty) {
      return const SizedBox.shrink();
    }

    final dark =
        widget.isDark ?? (Theme.of(context).brightness == Brightness.dark);

    // ChatGPT-ish gray
    final baseGray = widget.subtext ??
        (dark
            ? Colors.white.withOpacity(0.50)
            : Colors.black.withOpacity(0.55));
    final msgGray = widget.muted ??
        (dark
            ? Colors.white.withOpacity(0.38)
            : Colors.black.withOpacity(0.42));

    final titleStyle = TextStyle(
      color: baseGray,
      fontSize: 12.5,
      height: 1.05,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.15,
    );

    final msgStyle = TextStyle(
      color: msgGray,
      fontSize: 12.0,
      height: 1.15,
      fontWeight: FontWeight.w500,
      letterSpacing: 0.10,
    );

    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: Align(
        alignment: Alignment.topLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: widget.maxWidth),
          child: FadeTransition(
            opacity: _fade,
            child: Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, top: 8),
              child: AnimatedBuilder(
                animation: _breathe,
                builder: (context, child) {
                  return Opacity(opacity: _breathe.value, child: child);
                },
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _line1,
                      style: titleStyle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _line2,
                      style: msgStyle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
