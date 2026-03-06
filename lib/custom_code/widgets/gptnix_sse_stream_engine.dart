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
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// SSE/NDJSON stream engine za GPTNiX
/// - zna parsirat SSE (data: ... \n\n)
/// - zna parsirat NDJSON (linija po linija)
/// - emitira callbackove (token, json event, error, done)
class GptnixSseStreamEngine {
  GptnixSseStreamEngine({
    required this.onToken,
    required this.onJson,
    required this.onError,
    required this.onDone,
    this.onRawChunk,
  });

  /// Token fallback (kad payload nije JSON event)
  final void Function(String token) onToken;

  /// JSON event (map)
  final void Function(Map<String, dynamic> json) onJson;

  /// Stream error
  final void Function(Object error) onError;

  /// Stream done (server zatvorio stream)
  final void Function() onDone;

  /// Debug/raw (optional)
  final void Function(String chunk)? onRawChunk;

  http.Client? _client;
  StreamSubscription<String>? _sub;

  String _buf = '';
  bool _sseDetected = false;

  int _session = 0;
  bool _closed = false;

  int get session => _session;

  bool get isActive => _sub != null;

  /// Start stream
  Future<void> start({
    required String backendUrl,
    required Map<String, String> headers,
    required Map<String, dynamic> jsonBody,
    Duration connectTimeout = const Duration(seconds: 60),
  }) async {
    stop(); // kill previous
    _closed = false;
    _session++;

    _buf = '';
    _sseDetected = false;

    final mySession = _session;

    try {
      final uri = Uri.parse('$backendUrl/chat');

      final req = http.Request('POST', uri)
        ..headers.addAll(headers)
        ..headers['Accept'] = 'text/event-stream'
        ..headers['Content-Type'] = 'application/json'
        ..headers['Cache-Control'] = 'no-cache'
        ..body = jsonEncode(jsonBody);

      _client = http.Client();
      final resp = await _client!.send(req).timeout(connectTimeout);

      if (resp.statusCode != 200) {
        throw Exception('HTTP ${resp.statusCode}');
      }

      final stream = resp.stream.transform(utf8.decoder);

      _sub = stream.listen(
        (chunk) {
          if (_closed) return;
          if (mySession != _session) return;

          onRawChunk?.call(chunk);

          // limit buffer growth
          if (_buf.length > 2000000) {
            _buf = _buf.substring(_buf.length - 200000);
          }

          _buf += chunk;
          if (!_sseDetected && _buf.contains('data:')) _sseDetected = true;

          if (_sseDetected) {
            _consumeSseBlocks(mySession);
          } else {
            _consumeNdjsonLines(mySession);
          }
        },
        onError: (e) {
          if (_closed) return;
          if (mySession != _session) return;
          onError(e);
          _safeDone(mySession);
        },
        onDone: () {
          if (_closed) return;
          if (mySession != _session) return;
          _safeDone(mySession);
        },
        cancelOnError: true,
      );
    } catch (e) {
      if (_closed) return;
      if (mySession != _session) return;
      onError(e);
      _safeDone(mySession);
    }
  }

  void _safeDone(int mySession) {
    if (_closed) return;
    if (mySession != _session) return;
    onDone();
  }

  /// Stop stream
  void stop() {
    _closed = true;
    _sub?.cancel();
    _sub = null;
    _client?.close();
    _client = null;
    _buf = '';
    _sseDetected = false;
  }

  // -----------------------------
  // Parsing
  // -----------------------------

  void _consumeSseBlocks(int mySession) {
    while (true) {
      if (_closed) return;
      if (mySession != _session) return;

      final idx = _buf.indexOf('\n\n');
      if (idx == -1) break;

      final block = _buf.substring(0, idx);
      _buf = _buf.substring(idx + 2);

      _parseSseBlock(block, mySession);
    }
  }

  void _parseSseBlock(String block, int mySession) {
    if (_closed) return;
    if (mySession != _session) return;

    if (block.trim().isEmpty) return;

    final lines = block.split('\n');
    for (var raw in lines) {
      if (_closed) return;
      if (mySession != _session) return;

      var line = raw;
      if (line.endsWith('\r')) line = line.substring(0, line.length - 1);
      if (!line.startsWith('data:')) continue;

      var p = line.substring(5);
      if (p.startsWith(' ')) p = p.substring(1);
      final payload = p.trimRight();
      if (payload.isEmpty) continue;

      _handlePayload(payload, mySession);
    }
  }

  void _consumeNdjsonLines(int mySession) {
    while (true) {
      if (_closed) return;
      if (mySession != _session) return;

      final idx = _buf.indexOf('\n');
      if (idx == -1) break;

      final rawLine = _buf.substring(0, idx);
      _buf = _buf.substring(idx + 1);

      final line = rawLine.trim();
      if (line.isEmpty) continue;

      if (line.startsWith('data:')) {
        _sseDetected = true;
        _handlePayload(line.substring(5).trimLeft(), mySession);
        continue;
      }

      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          final j = jsonDecode(line);
          if (j is Map) {
            onJson(Map<String, dynamic>.from(j));
            continue;
          }
        } catch (_) {}
      }

      // fallback token
      onToken(line);
    }
  }

  void _handlePayload(String payload, int mySession) {
    if (_closed) return;
    if (mySession != _session) return;

    final ctrl = payload.trim();
    if (ctrl.isEmpty || ctrl == '[DONE]' || ctrl == '[END]') return;

    if (ctrl.startsWith('{')) {
      try {
        final j = jsonDecode(ctrl);
        if (j is Map) {
          onJson(Map<String, dynamic>.from(j));
          return;
        }
      } catch (_) {}
    }

    onToken(payload);
  }
}
