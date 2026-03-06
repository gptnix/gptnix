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
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import 'package:firebase_auth/firebase_auth.dart';
import '/auth/firebase_auth/auth_util.dart';

enum VoiceState { idle, listening, thinking, speaking }

class _VoiceMessage {
  final String role; // 'user' | 'assistant' | 'system'
  final String text;
  final DateTime ts;
  _VoiceMessage(this.role, this.text) : ts = DateTime.now();
}

class GptnixVoiceChatPage extends StatefulWidget {
  const GptnixVoiceChatPage({
    super.key,
    this.width,
    this.height,

    // core
    this.backendUrl,
    this.voicePath,
    this.conversationRef,
    this.model,

    // behavior
    this.autoStart = false,
    this.autoPlay = true,
    this.alwaysListening = false,
    this.bargeIn = true,

    // --- VAD TUNING (Optimizirano za brzinu) ---
    this.vadThresholdDb = -38.0,
    this.vadMarginDb = 8.0,
    this.vadCalibrateMs = 500,
    this.endSilenceMs = 600,
    this.minSpeechMs = 300,
    this.maxIdleRecordMs = 60000,
    this.maxTotalRecordMs = 120000,
    this.sampleRate = 16000,

    // ux
    this.showTranscript = true,
    this.historyMaxMessages = 120,
    this.orbSize = 64.0,
    this.restartDelayMs = 200,
  });

  final double? width;
  final double? height;

  final String? backendUrl;
  final String? voicePath;
  final DocumentReference? conversationRef;
  final String? model;

  final bool autoStart;
  final bool autoPlay;
  final bool alwaysListening;
  final bool bargeIn;

  final double vadThresholdDb;
  final double vadMarginDb;
  final int vadCalibrateMs;
  final int endSilenceMs;
  final int minSpeechMs;
  final int maxIdleRecordMs;
  final int maxTotalRecordMs;
  final int sampleRate;

  final bool showTranscript;
  final int historyMaxMessages;
  final double orbSize;
  final int restartDelayMs;

  @override
  State<GptnixVoiceChatPage> createState() => _GptnixVoiceChatPageState();
}

class _GptnixVoiceChatPageState extends State<GptnixVoiceChatPage>
    with AutomaticKeepAliveClientMixin, TickerProviderStateMixin {
  @override
  bool get wantKeepAlive => true;

  bool get _isLoggedIn => currentUserUid.isNotEmpty;

  final AudioRecorder _recorder = AudioRecorder();
  final AudioPlayer _player = AudioPlayer();

  VoiceState _state = VoiceState.idle;
  bool _micPermission = false;

  final List<_VoiceMessage> _messages = [];
  final ScrollController _scroll = ScrollController();

  bool _continuousMode = false;

  // monitoring
  Timer? _ampTimer;
  Timer? _vadTimer;
  Timer? _maxIdleTimer;
  Timer? _maxTotalTimer;

  double _ampNorm = 0.0;
  double _db = -160.0;

  // vad internal
  bool _inSpeech = false;
  DateTime? _speechStart;
  int _silenceMs = 0;

  // noise calibration
  bool _calibrating = false;
  int _calibLeftMs = 0;
  double _noiseAvgDb = -55.0;
  int _noiseSamples = 0;

  // playback
  Duration _playPos = Duration.zero;
  Duration _playDur = Duration.zero;

  // orb anim
  late final AnimationController _orbController;
  late final Animation<double> _orbAnim;

  bool _bootstrapped = false;
  Timer? _authBootTimer;

  // ✅ REQUEST GUARD (cancel / stale response ignore)
  int _reqNonce = 0;

  // ----------------------------
  // PRO UI THEME HELPERS
  // ----------------------------
  bool _dark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  Color _bg(BuildContext context) =>
      _dark(context) ? const Color(0xFF0B0D10) : const Color(0xFFF6F7FB);

  Color _surface(BuildContext context) =>
      _dark(context) ? const Color(0xFF11151B) : Colors.white;

  Color _surface2(BuildContext context) =>
      _dark(context) ? const Color(0xFF0F1318) : const Color(0xFFF1F4F9);

  Color _stroke(BuildContext context) =>
      _dark(context) ? const Color(0xFF222A35) : const Color(0xFFE3E8F2);

  Color _textStrong(BuildContext context) =>
      _dark(context) ? const Color(0xFFEAF0FF) : const Color(0xFF0F172A);

  Color _textMuted(BuildContext context) =>
      _dark(context) ? const Color(0xFF9AA7BD) : const Color(0xFF64748B);

  Color _accent(BuildContext context) => FlutterFlowTheme.of(context).primary;

  Color _danger(BuildContext context) =>
      _dark(context) ? const Color(0xFFFF5C5C) : const Color(0xFFE11D48);

  double get _radius => 16.0;

  List<BoxShadow> _shadow(BuildContext context, {bool strong = false}) {
    final dark = _dark(context);
    if (dark) {
      return [
        BoxShadow(
          color: Colors.black.withOpacity(strong ? 0.40 : 0.28),
          blurRadius: strong ? 26 : 18,
          offset: const Offset(0, 12),
        ),
      ];
    }
    return [
      BoxShadow(
        color: Colors.black.withOpacity(strong ? 0.10 : 0.06),
        blurRadius: strong ? 28 : 18,
        offset: const Offset(0, 12),
      ),
    ];
  }

  TextStyle _titleStyle(BuildContext context) => TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.2,
        color: _textStrong(context),
      );

  TextStyle _metaStyle(BuildContext context) => TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: _textMuted(context),
      );

  @override
  void initState() {
    super.initState();

    _continuousMode = widget.alwaysListening;

    _orbController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _orbAnim = CurvedAnimation(parent: _orbController, curve: Curves.easeInOut);

    _setupPlayer();
    _bootstrapAfterAuth();
  }

  void _setupPlayer() {
    _player.onPlayerStateChanged.listen((s) {
      if (!mounted) return;

      if (s == PlayerState.completed) {
        _orbController.stop();
        setState(() => _state = VoiceState.idle);

        if (_continuousMode && _micPermission && !kIsWeb) {
          Future.delayed(Duration(milliseconds: widget.restartDelayMs), () {
            if (mounted && _state == VoiceState.idle) _startListening();
          });
        }
      }
    });

    _player.onDurationChanged.listen((d) {
      if (!mounted) return;
      setState(() => _playDur = d);
    });

    _player.onPositionChanged.listen((p) {
      if (!mounted) return;
      setState(() => _playPos = p);
    });
  }

  void _bootstrapAfterAuth() {
    _authBootTimer?.cancel();
    if (_bootstrapped) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _tryBootstrap();
    });

    _authBootTimer = Timer.periodic(const Duration(milliseconds: 250), (_) {
      if (!mounted) return;
      _tryBootstrap();
    });
  }

  Future<void> _tryBootstrap() async {
    if (_bootstrapped) return;
    if (!_isLoggedIn) return;

    _bootstrapped = true;
    _authBootTimer?.cancel();
    _authBootTimer = null;

    await _checkMicPermission();

    if (widget.autoStart && _micPermission && _continuousMode && !kIsWeb) {
      _add('system', 'AutoStart: slušam…');
      _startListening();
    }
  }

  Future<void> _checkMicPermission() async {
    if (kIsWeb) {
      if (!mounted) return;
      setState(() => _micPermission = false);
      return;
    }

    try {
      final ok = await _recorder.hasPermission();
      if (!mounted) return;
      setState(() => _micPermission = ok);
    } catch (_) {
      if (!mounted) return;
      setState(() => _micPermission = false);
    }
  }

  @override
  void didUpdateWidget(covariant GptnixVoiceChatPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldId = oldWidget.conversationRef?.id;
    final newId = widget.conversationRef?.id;

    if (oldId != newId) {
      _invalidateRequests();
      _stopAllAudio();
      _stopTimers();
      if (!mounted) return;
      setState(() {
        _messages.clear();
        _state = VoiceState.idle;
        _continuousMode = widget.alwaysListening;
      });
    }
  }

  @override
  void dispose() {
    _invalidateRequests();
    _authBootTimer?.cancel();
    _stopTimers();
    _recorder.dispose();
    _player.dispose();
    _scroll.dispose();
    _orbController.dispose();
    super.dispose();
  }

  void _invalidateRequests() {
    _reqNonce++;
  }

  void _stopTimers() {
    _ampTimer?.cancel();
    _vadTimer?.cancel();
    _maxIdleTimer?.cancel();
    _maxTotalTimer?.cancel();
    _ampTimer = null;
    _vadTimer = null;
    _maxIdleTimer = null;
    _maxTotalTimer = null;
  }

  // ----------------------------
  // UI actions
  // ----------------------------
  void _pttDown() {
    if (kIsWeb) return;
    if (!_micPermission) return;

    if (widget.bargeIn && _state == VoiceState.speaking) {
      _stopAllAudio();
      _startListening();
      return;
    }

    if (_state != VoiceState.idle) return;
    HapticFeedback.lightImpact();
    _startListening();
  }

  void _pttUp() {
    if (kIsWeb) return;
    if (!_micPermission) return;
    if (_continuousMode) return;
    if (_state == VoiceState.listening) _stopAndSend();
  }

  void _toggleContinuous() {
    if (kIsWeb) return;
    if (!_micPermission) return;
    HapticFeedback.mediumImpact();
    setState(() => _continuousMode = !_continuousMode);

    if (_continuousMode) {
      _add('system', 'Continuous: automatski slušam');
      if (_state == VoiceState.idle) _startListening();
    } else {
      _add('system', 'PTT: drži za govor');
      if (_state == VoiceState.listening) _manualStop();
    }
  }

  Future<void> _manualStop() async {
    if (_state != VoiceState.listening) return;
    await _stopRecordingOnly();
    if (!mounted) return;
    setState(() => _state = VoiceState.idle);
  }

  void _stop() {
    HapticFeedback.lightImpact();

    if (_state == VoiceState.listening) {
      _stopAndSend();
      return;
    }

    if (_state == VoiceState.speaking) {
      _skip();
      return;
    }

    if (_state == VoiceState.thinking) {
      _invalidateRequests();
      _orbController.stop();
      if (!mounted) return;
      setState(() => _state = VoiceState.idle);
      _add('system', 'Otkazano.');
      return;
    }
  }

  void _skip() {
    _stopAllAudio();
    if (!mounted) return;
    setState(() => _state = VoiceState.idle);

    if (_continuousMode && _micPermission && !kIsWeb) {
      Future.delayed(Duration(milliseconds: widget.restartDelayMs), () {
        if (mounted && _state == VoiceState.idle) _startListening();
      });
    }
  }

  void _clearMessages() {
    if (_messages.isNotEmpty) setState(() => _messages.clear());
  }

  // ----------------------------
  // Recording + VAD
  // ----------------------------
  Future<void> _startListening() async {
    if (kIsWeb) {
      _add('system', 'Voice nije podržan na webu.');
      return;
    }
    if (!_micPermission) return;
    if (_state == VoiceState.listening) return;

    try {
      await _stopAllAudio();
      _stopTimers();

      final config = RecordConfig(
        encoder: AudioEncoder.wav,
        sampleRate: widget.sampleRate,
        numChannels: 1,
      );

      final tmpDir = await getTemporaryDirectory();
      final outPath =
          '${tmpDir.path}/gptnix_${DateTime.now().millisecondsSinceEpoch}.wav';

      await _recorder.start(config, path: outPath);

      if (!mounted) return;
      setState(() {
        _state = VoiceState.listening;
        _ampNorm = 0.0;
        _db = -160.0;

        _inSpeech = false;
        _speechStart = null;
        _silenceMs = 0;

        _calibrating = _continuousMode;
        _calibLeftMs = widget.vadCalibrateMs;
        _noiseAvgDb = -55.0;
        _noiseSamples = 0;
      });

      _orbController.repeat(reverse: true);

      _startAmplitudeMonitor();
      if (_continuousMode) _startVad();

      _maxIdleTimer = Timer(Duration(milliseconds: widget.maxIdleRecordMs), () {
        if (_state == VoiceState.listening) _manualStop();
      });

      _maxTotalTimer =
          Timer(Duration(milliseconds: widget.maxTotalRecordMs), () {
        if (_state == VoiceState.listening) _stopAndSend();
      });
    } catch (_) {
      _orbController.stop();
      _stopTimers();
      if (!mounted) return;
      setState(() => _state = VoiceState.idle);
    }
  }

  void _startAmplitudeMonitor() {
    _ampTimer?.cancel();
    _ampTimer = Timer.periodic(const Duration(milliseconds: 80), (_) async {
      if (!mounted || _state != VoiceState.listening) {
        _ampTimer?.cancel();
        return;
      }
      try {
        final a = await _recorder.getAmplitude();
        final db = a.current;

        setState(() {
          _db = db;
          final targetNorm = ((db + 55.0) / 55.0).clamp(0.0, 1.0);
          _ampNorm = (_ampNorm * 0.6) + (targetNorm * 0.4);
        });

        if (_calibrating) {
          _calibLeftMs -= 80;
          if (db < widget.vadThresholdDb - 2) {
            _noiseAvgDb =
                ((_noiseAvgDb * _noiseSamples) + db) / (_noiseSamples + 1);
            _noiseSamples++;
          }
          if (_calibLeftMs <= 0) _calibrating = false;
        }
      } catch (_) {}
    });
  }

  double _dynamicThresholdDb() {
    final dyn = _noiseAvgDb + widget.vadMarginDb;
    return math.max(widget.vadThresholdDb, dyn);
  }

  void _startVad() {
    _vadTimer?.cancel();
    _vadTimer = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (!mounted || _state != VoiceState.listening || !_continuousMode) {
        _vadTimer?.cancel();
        return;
      }

      final th = _dynamicThresholdDb();
      final startTh = th;
      final stopTh = th - 3.0;

      final isSpeechNow = !_inSpeech ? (_db > startTh) : (_db > stopTh);

      if (isSpeechNow) {
        _inSpeech = true;
        _silenceMs = 0;
        _speechStart ??= DateTime.now();
        return;
      }

      if (!_inSpeech) return;

      _silenceMs += 100;

      final speechMs = _speechStart == null
          ? 0
          : DateTime.now().difference(_speechStart!).inMilliseconds;

      if (_silenceMs >= widget.endSilenceMs && speechMs >= widget.minSpeechMs) {
        _vadTimer?.cancel();
        _stopAndSend();
      }
    });
  }

  Future<void> _stopRecordingOnly() async {
    _stopTimers();
    _orbController.stop();
    try {
      await _recorder.stop();
    } catch (_) {}
  }

  Future<void> _stopAndSend() async {
    if (_state != VoiceState.listening) return;

    _stopTimers();
    if (!mounted) return;

    HapticFeedback.mediumImpact();
    setState(() => _state = VoiceState.thinking);
    _orbController.repeat();

    final int myNonce = ++_reqNonce;

    try {
      final path = await _recorder.stop();

      if (!mounted) return;

      if (path == null || path.isEmpty) {
        _orbController.stop();
        setState(() => _state = VoiceState.idle);
        return;
      }

      final f = File(path);
      if (!await f.exists()) {
        _orbController.stop();
        setState(() => _state = VoiceState.idle);
        return;
      }

      final bytes = await f.readAsBytes();

      await _sendToBackend(bytes, filename: 'voice.wav', reqNonce: myNonce);
    } catch (e) {
      if (!mounted) return;
      _orbController.stop();
      _add('system', 'Greška: ${e.toString()}');
      setState(() => _state = VoiceState.idle);
    }
  }

  // ----------------------------
  // Backend
  // ----------------------------
  Uri? _buildVoiceUri() {
    final base = (widget.backendUrl ?? '').trim();
    if (base.isEmpty) return null;

    final p = (widget.voicePath ?? '').trim();
    final cleanBase =
        base.endsWith('/') ? base.substring(0, base.length - 1) : base;

    if (p.isEmpty) return Uri.parse('$cleanBase/voice/chat');
    final cleanPath = p.startsWith('/') ? p : '/$p';
    return Uri.parse('$cleanBase$cleanPath');
  }

  Future<void> _sendToBackend(
    Uint8List audioBytes, {
    required String filename,
    required int reqNonce,
  }) async {
    if (!_isLoggedIn) {
      _orbController.stop();
      if (!mounted) return;
      _add('system', 'Nisi prijavljen');
      setState(() => _state = VoiceState.idle);
      return;
    }

    final uri = _buildVoiceUri();
    if (uri == null) {
      _orbController.stop();
      if (!mounted) return;
      setState(() => _state = VoiceState.idle);
      return;
    }

    final model = (widget.model ?? '').trim();

    try {
      final req = http.MultipartRequest('POST', uri);

      req.fields['userId'] = currentUserUid;
      req.fields['model'] = model.isNotEmpty ? model : 'gpt-4o-mini';
      req.fields['historyMaxMessages'] = widget.historyMaxMessages.toString();

      if (widget.conversationRef != null) {
        req.fields['conversationId'] = widget.conversationRef!.id;
      }

      req.fields['languageHint'] = FFLocalizations.of(context).languageCode;

      final now = DateTime.now();
      req.fields['clientEpochMs'] = now.millisecondsSinceEpoch.toString();
      req.fields['clientTzName'] = now.timeZoneName;

      req.files.add(
        http.MultipartFile.fromBytes(
          'audio',
          audioBytes,
          filename: filename,
        ),
      );

      final _authToken =
          await FirebaseAuth.instance.currentUser?.getIdToken(true);
      if (_authToken != null) {
        req.headers['Authorization'] = 'Bearer $_authToken';
      }

      final res = await req.send().timeout(
            const Duration(seconds: 45),
            onTimeout: () =>
                throw TimeoutException('Server ne odgovara (timeout)'),
          );

      final body = await res.stream.bytesToString();

      if (!mounted || reqNonce != _reqNonce) return;

      if (res.statusCode != 200) {
        throw Exception('Greška servera (${res.statusCode})');
      }

      final json = jsonDecode(body) as Map<String, dynamic>;

      final userText =
          (json['transcriptText'] ?? json['userText'] ?? '').toString().trim();
      final aiText =
          (json['assistantText'] ?? json['text'] ?? '').toString().trim();

      if (widget.showTranscript && userText.isNotEmpty) _add('user', userText);
      if (aiText.isNotEmpty) _add('assistant', aiText);

      if (!widget.autoPlay) {
        _orbController.stop();
        if (!mounted) return;
        setState(() => _state = VoiceState.idle);
        return;
      }

      final audioUrl = (json['audioUrl'] ?? json['audio_url'] ?? '').toString();
      final audioB64 = (json['audioBase64'] ?? '').toString();

      if (!mounted || reqNonce != _reqNonce) return;

      if (audioUrl.isNotEmpty && audioUrl.startsWith('http')) {
        await _playUrl(audioUrl, reqNonce: reqNonce);
      } else if (audioB64.isNotEmpty) {
        await _playBase64(audioB64, reqNonce: reqNonce);
      } else {
        _orbController.stop();
        if (!mounted) return;
        setState(() => _state = VoiceState.idle);
        if (_continuousMode && _micPermission && !kIsWeb) {
          Future.delayed(Duration(milliseconds: widget.restartDelayMs), () {
            if (mounted && _state == VoiceState.idle) _startListening();
          });
        }
      }
    } catch (e) {
      if (!mounted || reqNonce != _reqNonce) return;
      _orbController.stop();
      _add('system', 'Greška: ${e.toString()}');
      if (!mounted) return;
      setState(() => _state = VoiceState.idle);
    }
  }

  // ----------------------------
  // Playback
  // ----------------------------
  Future<void> _playUrl(String url, {required int reqNonce}) async {
    try {
      if (!mounted || reqNonce != _reqNonce) return;
      setState(() {
        _state = VoiceState.speaking;
        _playPos = Duration.zero;
        _playDur = Duration.zero;
      });

      await _player.play(UrlSource(url));
      if (!mounted || reqNonce != _reqNonce) return;
      _orbController.repeat(reverse: true);
    } catch (_) {
      if (!mounted || reqNonce != _reqNonce) return;
      _orbController.stop();
      setState(() => _state = VoiceState.idle);
    }
  }

  Future<void> _playBase64(String b64, {required int reqNonce}) async {
    try {
      final bytes = base64Decode(b64);
      if (!mounted || reqNonce != _reqNonce) return;
      setState(() {
        _state = VoiceState.speaking;
        _playPos = Duration.zero;
        _playDur = Duration.zero;
      });

      await _player.play(BytesSource(bytes));
      if (!mounted || reqNonce != _reqNonce) return;
      _orbController.repeat(reverse: true);
    } catch (_) {
      if (!mounted || reqNonce != _reqNonce) return;
      _orbController.stop();
      setState(() => _state = VoiceState.idle);
    }
  }

  Future<void> _stopAllAudio() async {
    try {
      await _player.stop();
      _orbController.stop();
    } catch (_) {}
  }

  // ----------------------------
  // Messages Scroll
  // ----------------------------
  void _add(String role, String text) {
    if (!mounted) return;
    setState(() => _messages.add(_VoiceMessage(role, text)));

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      final target = _scroll.position.maxScrollExtent;
      _scroll.animateTo(
        target,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
    });
  }

  // ----------------------------
  // UI Build
  // ----------------------------
  @override
  Widget build(BuildContext context) {
    super.build(context);

    final content = SafeArea(
      top: true,
      bottom: false,
      child: Column(
        children: [
          _header(),
          Expanded(child: _list()),
          _status(),
          _controls(),
        ],
      ),
    );

    if (!_isLoggedIn) {
      return SizedBox(
        width: widget.width ?? double.infinity,
        height: widget.height ?? double.infinity,
        child: Container(
          color: _bg(context),
          alignment: Alignment.center,
          child: const CircularProgressIndicator(),
        ),
      );
    }

    if (kIsWeb) {
      return SizedBox(
        width: widget.width ?? double.infinity,
        height: widget.height ?? double.infinity,
        child: Container(
          color: _bg(context),
          alignment: Alignment.center,
          padding: const EdgeInsets.all(20),
          child: _cardShell(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.desktop_windows,
                    size: 44, color: _textMuted(context)),
                const SizedBox(height: 12),
                Text(
                  'Voice chat trenutno nije podržan na webu.\nOtvori ovu stranicu u mobilnoj aplikaciji.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: _textStrong(context), height: 1.35),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (!_micPermission) {
      return SizedBox(
        width: widget.width ?? double.infinity,
        height: widget.height ?? double.infinity,
        child: Container(
          color: _bg(context),
          padding: const EdgeInsets.all(20),
          alignment: Alignment.center,
          child: _cardShell(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.mic_off, size: 46, color: _danger(context)),
                const SizedBox(height: 12),
                Text(
                  'Potrebna je dozvola za mikrofon.',
                  style: TextStyle(
                    color: _textStrong(context),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: _checkMicPermission,
                  child: const Text('Provjeri dozvolu'),
                ),
                const SizedBox(height: 10),
                Text(
                  'Ako je trajno odbijeno: postavke uređaja → aplikacije → dozvole → Mikrofon.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 12, color: _textMuted(context), height: 1.35),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return SizedBox(
      width: widget.width ?? double.infinity,
      height: widget.height ?? double.infinity,
      child: Container(
        decoration: BoxDecoration(
          color: _bg(context),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              _bg(context),
              _dark(context)
                  ? const Color(0xFF07080A)
                  : const Color(0xFFF4F6FA),
            ],
          ),
        ),
        child: Center(
          child: Container(
            constraints: const BoxConstraints(maxWidth: 920),
            child: content,
          ),
        ),
      ),
    );
  }

  Widget _cardShell({required Widget child}) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 560),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface(context),
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: _stroke(context)),
        boxShadow: _shadow(context, strong: true),
      ),
      child: child,
    );
  }

  Widget _header() {
    final dark = _dark(context);

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 10, 12, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: _surface(context),
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: _stroke(context)),
        boxShadow: _shadow(context),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: LinearGradient(
                colors: dark
                    ? [const Color(0xFF1D2633), const Color(0xFF0F1722)]
                    : [const Color(0xFF0F172A), const Color(0xFF334155)],
              ),
            ),
            child: const Icon(Icons.multitrack_audio,
                color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Glasovni chat', style: _titleStyle(context)),
                const SizedBox(height: 2),
                Text(
                  _continuousMode
                      ? 'Continuous • Auto VAD'
                      : 'PTT • Push to Talk',
                  style: _metaStyle(context),
                ),
              ],
            ),
          ),
          _modeChip(),
          const SizedBox(width: 6),
          IconButton(
            onPressed: _toggleContinuous,
            icon: Icon(
              _continuousMode ? Icons.all_inclusive : Icons.touch_app,
              color: _continuousMode ? _accent(context) : _textMuted(context),
            ),
            tooltip: _continuousMode ? 'Automatski način' : 'Pritisni za govor',
          ),
          IconButton(
            onPressed: _clearMessages,
            icon: Icon(Icons.delete_outline, color: _textMuted(context)),
            tooltip: 'Očisti',
          ),
        ],
      ),
    );
  }

  Widget _modeChip() {
    final isBusy =
        _state == VoiceState.thinking || _state == VoiceState.speaking;
    final label = _continuousMode ? 'AUTO' : 'PTT';
    return AnimatedOpacity(
      duration: const Duration(milliseconds: 160),
      opacity: isBusy ? 0.55 : 1.0,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: _surface2(context),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: _stroke(context)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
            color: _textMuted(context),
          ),
        ),
      ),
    );
  }

  Widget _list() {
    if (_messages.isEmpty) {
      return Center(
        child: Container(
          padding: const EdgeInsets.all(18),
          margin: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: _surface(context),
            borderRadius: BorderRadius.circular(_radius),
            border: Border.all(color: _stroke(context)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.mic_none, color: _textMuted(context), size: 28),
              const SizedBox(height: 10),
              Text(
                _continuousMode
                    ? 'Slušam… govori normalno.'
                    : 'Drži mikrofon i pričaj.',
                textAlign: TextAlign.center,
                style: TextStyle(color: _textMuted(context), height: 1.35),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
      itemCount: _messages.length,
      itemBuilder: (_, i) => _bubble(_messages[i]),
    );
  }

  Widget _bubble(_VoiceMessage m) {
    final isUser = m.role == 'user';
    final isSystem = m.role == 'system';

    if (isSystem) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        alignment: Alignment.center,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: _surface2(context),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: _stroke(context)),
          ),
          child: Text(
            m.text,
            style: TextStyle(
                fontSize: 12, color: _textMuted(context), height: 1.2),
          ),
        ),
      );
    }

    final userBg = _accent(context);
    final aiBg = _surface(context);

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.86,
        ),
        decoration: BoxDecoration(
          color: isUser ? userBg : aiBg,
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(_radius),
            topRight: Radius.circular(_radius),
            bottomLeft: Radius.circular(isUser ? _radius : 6),
            bottomRight: Radius.circular(isUser ? 6 : _radius),
          ),
          border:
              Border.all(color: isUser ? Colors.transparent : _stroke(context)),
          boxShadow: isUser ? [] : _shadow(context),
        ),
        child: MarkdownBody(
          data: m.text,
          selectable: true,
          softLineBreak: true,
          styleSheet: MarkdownStyleSheet(
            p: TextStyle(
              color: isUser ? Colors.white : _textStrong(context),
              fontSize: 15,
              height: 1.40,
              fontWeight: FontWeight.w500,
            ),
            a: TextStyle(
              color: isUser ? Colors.white : _accent(context),
              decoration: TextDecoration.underline,
            ),
            code: TextStyle(
              color: isUser ? Colors.white : _textStrong(context),
              fontFamily: 'monospace',
              fontSize: 13.5,
            ),
            codeblockDecoration: BoxDecoration(
              color: _surface2(context),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _stroke(context)),
            ),
          ),
        ),
      ),
    );
  }

  Widget _status() {
    final (String label, IconData icon, Color tone) = switch (_state) {
      VoiceState.listening => ('Slušam', Icons.mic, _accent(context)),
      VoiceState.thinking => (
          'Obrada',
          Icons.hourglass_top,
          const Color(0xFFF59E0B)
        ),
      VoiceState.speaking => (
          'Govorim',
          Icons.volume_up,
          const Color(0xFF22C55E)
        ),
      _ => (
          _continuousMode ? 'Spreman (Auto)' : 'Spreman',
          Icons.circle_outlined,
          _textMuted(context)
        ),
    };

    final progress = _state == VoiceState.listening
        ? _ampNorm
        : (_state == VoiceState.speaking && _playDur.inMilliseconds > 0
            ? (_playPos.inMilliseconds / _playDur.inMilliseconds)
                .clamp(0.0, 1.0)
            : 0.0);

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: _surface(context),
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: _stroke(context)),
        boxShadow: _shadow(context),
      ),
      child: Row(
        children: [
          _haloIndicator(tone, icon),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: _textStrong(context),
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: (_state == VoiceState.listening ||
                            _state == VoiceState.speaking)
                        ? progress
                        : null, // indeterminate kad idle/thinking? ne - da bude mirno:
                    minHeight: 6,
                    backgroundColor: _surface2(context),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      (_state == VoiceState.thinking)
                          ? tone.withOpacity(0.85)
                          : tone,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _miniPill(
            text: _continuousMode ? 'AUTO' : 'PTT',
          ),
        ],
      ),
    );
  }

  Widget _haloIndicator(Color tone, IconData icon) {
    return AnimatedBuilder(
      animation: _orbAnim,
      builder: (_, __) {
        final active = _state == VoiceState.listening ||
            _state == VoiceState.thinking ||
            _state == VoiceState.speaking;

        final pulse = active ? (0.10 + 0.10 * _orbAnim.value) : 0.0;
        final amp = (_state == VoiceState.listening) ? (0.18 * _ampNorm) : 0.0;
        final scale = 1.0 + pulse + amp;

        return Transform.scale(
          scale: scale,
          child: Container(
            width: widget.orbSize,
            height: widget.orbSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: tone.withOpacity(_dark(context) ? 0.18 : 0.12),
              border: Border.all(color: tone.withOpacity(0.35), width: 1),
              boxShadow: [
                BoxShadow(
                  color: tone.withOpacity(_dark(context) ? 0.25 : 0.20),
                  blurRadius: 26,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Center(
              child: Container(
                width: widget.orbSize * 0.52,
                height: widget.orbSize * 0.52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: tone,
                ),
                child: Icon(icon, color: Colors.white, size: 22),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _miniPill({required String text}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _surface2(context),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: _stroke(context)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.7,
          color: _textMuted(context),
        ),
      ),
    );
  }

  Widget _controls() {
    final bottomInset = MediaQuery.of(context).padding.bottom;

    final micActive = _state == VoiceState.listening;
    final canStop = _state != VoiceState.idle;

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: EdgeInsets.fromLTRB(14, 12, 14, 12 + bottomInset),
      decoration: BoxDecoration(
        color: _surface(context),
        borderRadius: BorderRadius.circular(_radius),
        border: Border.all(color: _stroke(context)),
        boxShadow: _shadow(context),
      ),
      child: Row(
        children: [
          Expanded(
            child: _pttButton(
              active: micActive,
              onDown: _pttDown,
              onUp: _pttUp,
            ),
          ),
          const SizedBox(width: 12),
          IconButton(
            icon: Icon(Icons.stop_rounded,
                color: canStop ? _danger(context) : _textMuted(context)),
            iconSize: 28,
            onPressed: canStop ? _stop : null,
            tooltip: 'Prekini',
            style: ButtonStyle(
              backgroundColor: WidgetStatePropertyAll(_surface2(context)),
              shape: WidgetStatePropertyAll(
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              side: WidgetStatePropertyAll(BorderSide(color: _stroke(context))),
              padding: const WidgetStatePropertyAll(EdgeInsets.all(14)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _pttButton({
    required bool active,
    required VoidCallback onDown,
    required VoidCallback onUp,
  }) {
    final bg = active ? _accent(context) : _surface2(context);
    final fg = active ? Colors.white : _textStrong(context);

    return GestureDetector(
      onTapDown: (_) => onDown(),
      onTapUp: (_) => onUp(),
      onTapCancel: onUp,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        height: 56,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
          border:
              Border.all(color: active ? Colors.transparent : _stroke(context)),
          boxShadow: active ? _shadow(context, strong: true) : [],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(active ? Icons.mic : Icons.mic_none, color: fg, size: 22),
            const SizedBox(width: 10),
            Text(
              _continuousMode
                  ? (active ? 'Slušam…' : 'Spreman')
                  : (active ? 'Pusti za slanje' : 'Drži za govor'),
              style: TextStyle(
                color: fg,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
