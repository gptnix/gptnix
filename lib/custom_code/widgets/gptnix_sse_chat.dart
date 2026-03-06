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

import 'package:flutter/services.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/rendering.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';

// ✅ Shared viewport controller
import '/custom_code/widgets/chat_viewport_controller.dart' as vp;

class GptnixSseChat extends StatefulWidget {
  const GptnixSseChat({
    super.key,
    this.width,
    this.height,
    this.conversationRef,
    this.model,
    this.isDark,
    this.backendUrl,
    this.preferredLanguage,
  });

  final double? width;
  final double? height;
  final DocumentReference? conversationRef;
  final String? model;
  final bool? isDark;
  final String? backendUrl;
  final String? preferredLanguage;

  @override
  State<GptnixSseChat> createState() => _GptnixSseChatState();

  static _GptnixSseChatState? of(BuildContext context) {
    return context.findAncestorStateOfType<_GptnixSseChatState>();
  }
}

class _GptnixSseChatState extends State<GptnixSseChat> {
  void _setStateSafe(VoidCallback fn) {
    if (!mounted) return;
    setState(fn);
  }

  bool _resolveDark() {
    if (widget.isDark != null) return widget.isDark!;
    return Theme.of(context).brightness == Brightness.dark;
  }

  // --- UI State ---
  bool _isLoading = true;
  bool _isStreaming = false;
  bool _isSending = false;
  bool _typingFadeOut = false;
  bool _showEphemeral = false;
  bool _deepThink = false;

  bool _pendingImageActive = false;
  String _pendingImagePrompt = '';

  bool _attachOpen = false;

  // --- IDs ---
  late String _userId;
  String _conversationId = '';

  // --- Controllers ---
  late final ScrollController _scroll;
  late final TextEditingController _controller;
  late final FocusNode _inputFocus;

  late final vp.ChatViewportController _viewport;

  // --- SSE ---
  GptnixSseStreamEngine? _engine;
  ValueNotifier<String>? _activeStream;
  Timer? _softStopTimer;
  int? _activeStreamStartMs;

  final StringBuffer _tokenBuf = StringBuffer();
  Timer? _tokenFlushTimer;
  bool _flushScheduled = false;
  static const int _tokenFlushEveryMs = 50;

  // --- Data ---
  List<DocumentSnapshot> _historyDocs = [];
  final GlobalKey _ephemeralKey = GlobalKey();
  final Map<String, GlobalKey> _msgKeys = {};

  final List<Map<String, dynamic>> _toolStatuses = [];
  final List<dynamic> _webSources = [];

  final List<FFUploadedFile> _pickedFiles = [];
  final List<String> _pickedExts = [];
  final List<String> _generatedImages = [];

  // --- Assistant Logic ---
  bool _savedAssistantThisTurn = false;
  String _lastSavedAssistantText = '';
  String _doneMessageCandidate = '';

  // --- Layout Logic ---
  double _ephemeralMinHeight = 0;
  bool _pinInProgress = false;
  String? _lastPinnedUserId;
  bool _keyboardScrollPending = false;

  final GlobalKey _inputBarKey = GlobalKey();
  final ValueNotifier<double> _inputBarHeight = ValueNotifier(160.0);

  // --- Stream Pinning ---
  bool _streamPinned = false;
  String? _pinnedUserId;
  double? _pinnedScrollOffset;
  double _pinnedMinEphemeralHeight = 0;

  String? _editingMsgId;
  String? _replyToMsgId;
  String? _replyPreviewText;
  String? _ephemeralAfterUserId;

  static const bool _kbDebug = false;

  String get _backendUrl =>
      widget.backendUrl ??
          'https://gptnix-backend-496151959855.us-central1.run.app';
  String get _preferredLanguage => widget.preferredLanguage ?? 'hr';

  // ---------------------------
  // LIFECYCLE
  // ---------------------------
  @override
  void initState() {
    super.initState();
    _scroll = ScrollController();
    _controller = TextEditingController();
    _inputFocus = FocusNode();
    _viewport = vp.ChatViewportController(scrollController: _scroll);

    _inputFocus.addListener(_onInputFocusChange);
    _initializeChat();
  }

  @override
  void didUpdateWidget(covariant GptnixSseChat oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.conversationRef?.path != widget.conversationRef?.path) {
      _initializeChat();
    }
  }

  @override
  void dispose() {
    _inputFocus.removeListener(_onInputFocusChange);
    _scroll.dispose();
    _controller.dispose();
    _inputFocus.dispose();
    _viewport.dispose();
    _inputBarHeight.dispose();

    _flushTokenBufferNow();
    _engine?.stop();
    _activeStream?.dispose();
    _softStopTimer?.cancel();
    _tokenFlushTimer?.cancel();
    super.dispose();
  }

  // ---------------------------
  // INIT & LOAD
  // ---------------------------
  Future<void> _initializeChat() async {
    _setStateSafe(() => _isLoading = true);

    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null) {
      _toast('Niste prijavljeni', icon: Icons.error_outline);
      _setStateSafe(() => _isLoading = false);
      return;
    }
    _userId = currentUser.uid;

    try {
      if (widget.conversationRef != null) {
        final doc = await widget.conversationRef!.get();
        if (doc.exists) {
          _conversationId = widget.conversationRef!.id;
          await _loadMessages();
          await _scrollToBottomInitial();
          _setStateSafe(() => _isLoading = false);
          return;
        }
      }

      final recentChatsQuery = await FirebaseFirestore.instance
          .collection('conversations')
          .where('user_id', isEqualTo: _userId)
          .orderBy('updated_at', descending: true)
          .limit(1)
          .get();

      if (recentChatsQuery.docs.isNotEmpty) {
        final mostRecentChat = recentChatsQuery.docs.first;
        _conversationId = mostRecentChat.id;
        FFAppState().activeConvRef = mostRecentChat.reference;

        await _loadMessages();
        await _scrollToBottomInitial();
        _setStateSafe(() => _isLoading = false);
        return;
      }

      await _createNewConversation();
    } catch (_) {
      await _createNewConversation();
    }
    _setStateSafe(() => _isLoading = false);
  }

  Future<void> _createNewConversation() async {
    try {
      final newConv =
          await FirebaseFirestore.instance.collection('conversations').add({
        'user_id': _userId,
        'title': '',
        'title_is_manual': false,
        'last_message': '',
        'message_count': 0,
        'is_pinned': false,
        'created_at': FieldValue.serverTimestamp(),
        'updated_at': FieldValue.serverTimestamp(),
      });

      _conversationId = newConv.id;
      FFAppState().activeConvRef = newConv;

      await _loadMessages();
      _setStateSafe(() => _isLoading = false);
    } catch (_) {
      _toast('Greška pri kreiranju razgovora', icon: Icons.error_outline);
      _setStateSafe(() => _isLoading = false);
    }
  }

  Future<void> _loadMessages() async {
    if (_conversationId.isEmpty) return;
    try {
      final snap = await FirebaseFirestore.instance
          .collection('conversations')
          .doc(_conversationId)
          .collection('messages')
          .orderBy('created_at_ms', descending: false)
          .get();

      if (!mounted) return;

      _setStateSafe(() {
        _historyDocs = snap.docs;
        for (final doc in snap.docs) {
          _msgKeys.putIfAbsent(doc.id, () => GlobalKey());
        }
      });
    } catch (_) {}
  }

  Future<void> _scrollToBottomInitial() async {
    if (!mounted) return;
    await SchedulerBinding.instance.endOfFrame;
    await Future.delayed(const Duration(milliseconds: 120));
    if (!mounted) return;
    _viewport.jumpToBottom();
  }

  bool _isNearBottom() {
    if (!_scroll.hasClients) return true;
    final pos = _scroll.position;
    return (pos.maxScrollExtent - pos.pixels) < 150.0;
  }

  void _onInputFocusChange() {
    if (!_inputFocus.hasFocus) return;
    if (_keyboardScrollPending) return;
    if (_streamPinned) return;
    if (!_isNearBottom()) return;

    _keyboardScrollPending = true;
    Future.delayed(const Duration(milliseconds: 300), () {
      _keyboardScrollPending = false;
      if (!mounted) return;
      if (_streamPinned) return;
      if (!_isNearBottom()) return;
      if (_viewport.scrollController.hasClients) {
        _viewport.scrollToBottom(force: false, animated: true);
      }
    });
  }

  // ---------------------------
  // HELPERS
  // ---------------------------
  void _lockStreamPin({
    required String userMsgId,
    required double pinnedOffset,
    required double minEphemeralHeight,
  }) {
    _pinnedUserId = userMsgId;
    _pinnedScrollOffset = pinnedOffset;
    _pinnedMinEphemeralHeight = minEphemeralHeight;
    _streamPinned = true;
    _viewport.setAutoFollow(false);
  }

  void _unlockStreamPin() {
    _streamPinned = false;
    _pinnedUserId = null;
    _pinnedScrollOffset = null;
    _pinnedMinEphemeralHeight = 0;
  }

  void _toast(String msg, {IconData? icon}) {
    if (!mounted) return;
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _copyTextSilent(String text) async {
    if (text.trim().isEmpty) return;
    await Clipboard.setData(ClipboardData(text: text));
    HapticFeedback.mediumImpact();
  }

  // ---------------------------
  // EDIT & REPLY
  // ---------------------------
  Future<void> _updateMessageContent(String msgId, String newContent) async {
    try {
      await FirebaseFirestore.instance
          .collection('conversations')
          .doc(_conversationId)
          .collection('messages')
          .doc(msgId)
          .update({
        'content': newContent,
        'updated_at_ms': DateTime.now().millisecondsSinceEpoch,
      });
      await _loadMessages();
      _toast('Poruka ažurirana', icon: Icons.check_circle_outline);
    } catch (e) {
      _toast('Greška: $e', icon: Icons.error_outline);
    }
  }

  void _cancelEdit() {
    _setStateSafe(() {
      _editingMsgId = null;
      _controller.clear();
    });
  }

  void _cancelReply() {
    _setStateSafe(() {
      _replyToMsgId = null;
      _replyPreviewText = null;
    });
  }

  // ---------------------------
  // FILE HANDLING
  // ---------------------------
  String _normalizeExt(String ext) {
    var e = ext.trim().toLowerCase();
    if (e.startsWith('.')) e = e.substring(1);
    return e.isEmpty ? 'bin' : e;
  }

  bool _isImageExt(String extOrName) {
    final s = extOrName.toLowerCase();
    return s.endsWith('.png') ||
        s.endsWith('.jpg') ||
        s.endsWith('.jpeg') ||
        s.endsWith('.webp');
  }

  String _getContentType(String ext) {
    switch (ext.toLowerCase()) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  Future<List<Map<String, dynamic>>> _uploadFilesToStorage() async {
    if (_pickedFiles.isEmpty) return [];
    final out = <Map<String, dynamic>>[];
    try {
      for (int i = 0; i < _pickedFiles.length; i++) {
        final file = _pickedFiles[i];
        final extRaw = (i < _pickedExts.length ? _pickedExts[i] : '').trim();
        if (file.bytes == null) continue;

        final safeExt = _normalizeExt(extRaw);
        final originalName = (file.name ?? 'file').trim();
        final timestamp = DateTime.now().millisecondsSinceEpoch;
        final fileName =
            '${timestamp}_${i}_${originalName.replaceAll(' ', '_')}';
        final storagePath = 'chat_files/$_userId/$_conversationId/$fileName';

        final ref = FirebaseStorage.instance.ref().child(storagePath);
        final uploadTask = await ref.putData(
          file.bytes!,
          SettableMetadata(contentType: _getContentType(safeExt)),
        );
        final downloadUrl = await uploadTask.ref.getDownloadURL();

        out.add({
          'name': originalName,
          'ext': safeExt,
          'mimetype': _getContentType(safeExt),
          'size': file.bytes!.length,
          'storagePath': storagePath,
          'downloadUrl': downloadUrl,
          'uploadedAtMs': timestamp,
          'isImage': _isImageExt(safeExt),
        });
      }
    } catch (e) {
      _toast('Greška pri upload-u: $e', icon: Icons.error_outline);
    }
    return out;
  }

  // ---------------------------
  // SSE LOGIC
  // ---------------------------
  void _clearToolStatus() => _setStateSafe(() => _toolStatuses.clear());

  void _pushToolStatus(Map<String, dynamic> raw) {
    if (!mounted) return;
    _setStateSafe(() => _toolStatuses.add(raw));
  }

  String _resolveModelForRequest() {
    String m = (widget.model ?? 'deepseek-chat').trim();
    if (m.isEmpty) m = 'deepseek-chat';
    if (_deepThink) {
      if (m.contains('deepseek') && !m.contains('reasoner')) {
        m = 'deepseek-reasoner';
      }
    }
    return m;
  }

  Future<DocumentReference?> _saveUserMessage(
    String text, {
    List<Map<String, dynamic>> attachments = const [],
  }) async {
    if (_conversationId.isEmpty) return null;
    try {
      final data = <String, dynamic>{
        'role': 'user',
        'content': text,
        'created_at_ms': DateTime.now().millisecondsSinceEpoch,
      };

      if (attachments.isNotEmpty) {
        data['attachments'] = attachments;
        data['has_files'] = true;
        data['file_names'] = attachments.map((a) => a['name']).toList();
      }

      if (_replyToMsgId != null && _replyPreviewText != null) {
        data['replyTo'] = _replyToMsgId;
        data['replyPreview'] = _replyPreviewText;
      }

      final docRef = await FirebaseFirestore.instance
          .collection('conversations')
          .doc(_conversationId)
          .collection('messages')
          .add(data);

      await FirebaseFirestore.instance
          .collection('conversations')
          .doc(_conversationId)
          .update({'updated_at': FieldValue.serverTimestamp()});

      return docRef;
    } catch (_) {
      return null;
    }
  }

  Future<void> _saveAssistantMessage(String text) async {
    if (_conversationId.isEmpty) return;
    if (_savedAssistantThisTurn && text == _lastSavedAssistantText) return;
    if (text.isEmpty && _generatedImages.isEmpty) return;

    try {
      final data = <String, dynamic>{
        'role': 'assistant',
        'content': text,
        'created_at_ms': DateTime.now().millisecondsSinceEpoch,
      };
      if (_generatedImages.isNotEmpty) {
        data['images'] = _generatedImages;
        data['has_images'] = true;
      }
      await FirebaseFirestore.instance
          .collection('conversations')
          .doc(_conversationId)
          .collection('messages')
          .add(data);

      _savedAssistantThisTurn = true;
      _lastSavedAssistantText = text;
      await _loadMessages();
      await _viewport.scrollToBottom(force: true, animated: true);
    } catch (_) {}
  }

  // ---------------------------
  // SMART PIN
  // ---------------------------
  double _viewportHeight() {
    final mq = MediaQuery.of(context);
    return context.size?.height ?? mq.size.height;
  }

  double _measureWidgetHeight(GlobalKey key) {
    final ctx = key.currentContext;
    if (ctx == null) return 0;
    final ro = ctx.findRenderObject();
    if (ro is RenderBox) return ro.size.height;
    return 0;
  }

  Future<void> _prepareEphemeralSpacerForPin(String userMsgId) async {
    final key = _msgKeys[userMsgId];
    if (key == null) return;
    final userH = _measureWidgetHeight(key);
    if (userH <= 0) return;

    final screenH = _viewportHeight();
    final topPad = (MediaQuery.of(context).padding.top) + 18.0;
    var spacer = screenH - userH - topPad;
    spacer = spacer.clamp(0.0, screenH * 1.2);

    _setStateSafe(() => _ephemeralMinHeight = spacer);
  }

  Future<void> _pinUserMessageSmart(String userMsgId) async {
    if (_pinInProgress) return;
    if (!mounted || !_scroll.hasClients) return;
    if (_lastPinnedUserId == userMsgId) return;

    _pinInProgress = true;
    _lastPinnedUserId = userMsgId;

    try {
      await SchedulerBinding.instance.endOfFrame;
      await _prepareEphemeralSpacerForPin(userMsgId);
      await SchedulerBinding.instance.endOfFrame;

      final key = _msgKeys[userMsgId];
      final ctx = key?.currentContext;
      if (ctx == null) return;

      final ro = ctx.findRenderObject();
      if (ro is! RenderBox) return;

      final box = ro;
      final offsetGlobal = box.localToGlobal(Offset.zero);
      final current = _scroll.position.pixels;

      final target = current + offsetGlobal.dy - 100;

      _viewport.setAutoFollow(false);
      await _scroll.animateTo(
        target.clamp(0, _scroll.position.maxScrollExtent),
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
      );
      _pinnedScrollOffset = target;
    } finally {
      _pinInProgress = false;
    }
  }

  // ---------------------------
  // SEND MESSAGE
  // ---------------------------
  Future<void> _sendMessage() async {
    if (_conversationId.isEmpty) return;
    final rawText = _controller.text.trim();
    if (_isStreaming) return;
    if (rawText.isEmpty && _pickedFiles.isEmpty) return;

    final currentUser = FirebaseAuth.instance.currentUser;
    if (currentUser == null) return;
    _userId = currentUser.uid;

    if (_editingMsgId != null) {
      await _updateMessageContent(_editingMsgId!, rawText);
      _controller.clear();
      _setStateSafe(() => _editingMsgId = null);
      return;
    }

    _controller.clear();
    _inputFocus.unfocus();
    _setStateSafe(() => _isSending = true);

    final attachments = await _uploadFilesToStorage();
    final docRef = await _saveUserMessage(
      rawText.isNotEmpty ? rawText : '📎 Prilozi',
      attachments: attachments,
    );

    if (docRef == null) {
      _setStateSafe(() => _isSending = false);
      return;
    }

    _setStateSafe(() {
      _replyToMsgId = null;
      _replyPreviewText = null;
      _pickedFiles.clear();
      _pickedExts.clear();
      _attachOpen = false;
    });

    await _loadMessages();

    _savedAssistantThisTurn = false;
    _lastSavedAssistantText = '';
    _doneMessageCandidate = '';
    _clearToolStatus();
    _webSources.clear();
    _generatedImages.clear();

    _activeStream?.dispose();
    _activeStream = ValueNotifier<String>('');

    _unlockStreamPin();

    _setStateSafe(() {
      _isStreaming = true;
      _isSending = false;
      _showEphemeral = true;
      _ephemeralMinHeight = 0;
      _ephemeralAfterUserId = docRef.id;
    });

    await _pinUserMessageSmart(docRef.id);

    if (_pinnedScrollOffset != null) {
      _lockStreamPin(
        userMsgId: docRef.id,
        pinnedOffset: _pinnedScrollOffset!,
        minEphemeralHeight: _ephemeralMinHeight,
      );
    }

    final body = {
      "message": rawText,
      "conversationId": _conversationId,
      "userId": _userId,
      "stream": true,
      "model": _resolveModelForRequest(),
      "preferredLanguage": _preferredLanguage,
    };

    _engine?.stop();
    _engine = GptnixSseStreamEngine(
      onToken: _onSseToken,
      onJson: _onSseJson,
      onError: _onSseError,
      onDone: _onSseDone,
    );

    final _authToken =
        await FirebaseAuth.instance.currentUser?.getIdToken(true);

    try {
      await _engine!.start(
        backendUrl: _backendUrl,
        headers: {
          'Accept': 'text/event-stream',
          if (_authToken != null) 'Authorization': 'Bearer $_authToken',
        },
        jsonBody: body,
      );
    } catch (e) {
      _onSseError(e);
    }
  }

  Future<void> _finalizeAndCloseStream({required bool userStopped}) async {
    _flushTokenBufferNow();
    final acc = (_activeStream?.value ?? '').trim();
    final finalText = acc.isNotEmpty ? acc : _doneMessageCandidate.trim();

    _setStateSafe(() => _typingFadeOut = true);
    await Future.delayed(const Duration(milliseconds: 140));

    await _saveAssistantMessage(finalText);

    if (!mounted) return;
    _unlockStreamPin();
    _setStateSafe(() {
      _showEphemeral = false;
      _ephemeralMinHeight = 0;
      _isStreaming = false;
      _typingFadeOut = false;
    });
  }

  Future<void> _stopStreamByUser() async {
    _engine?.stop();
    await _finalizeAndCloseStream(userStopped: true);
  }

  void _scheduleTokenFlush() {
    if (_flushScheduled) return;
    _flushScheduled = true;
    _tokenFlushTimer?.cancel();
    _tokenFlushTimer =
        Timer(const Duration(milliseconds: _tokenFlushEveryMs), () {
      _flushScheduled = false;
      _flushTokenBuffer();
    });
  }

  void _flushTokenBuffer() {
    if (!mounted) return;
    final chunk = _tokenBuf.toString();
    if (chunk.isEmpty) return;
    _tokenBuf.clear();

    final old = _activeStream?.value ?? '';
    _activeStream?.value = old + chunk;

    if (!_streamPinned) {
      SchedulerBinding.instance.addPostFrameCallback((_) {
        if (mounted) _viewport.notifyContentSizeMaybeChanged();
      });
    }
  }

  void _flushTokenBufferNow() {
    _tokenFlushTimer?.cancel();
    _flushScheduled = false;
    _flushTokenBuffer();
  }

  void _onSseToken(String token) {
    if (!mounted) return;
    _tokenBuf.write(token);
    _scheduleTokenFlush();
  }

  void _onSseJson(Map<String, dynamic> json) {
    if (!mounted) return;
    final type = (json['type'] ?? '').toString();
    if (type == 'token') _onSseToken((json['content'] ?? '').toString());
    if (type == 'done') {
      _doneMessageCandidate = (json['message'] ?? '').toString();
      _flushTokenBufferNow();
    }
    if (type == 'tool_status') _pushToolStatus(json);
  }

  void _onSseError(dynamic e) {
    _toast('Error: $e');
    _unlockStreamPin();
    _setStateSafe(() {
      _isStreaming = false;
      _isSending = false;
      _showEphemeral = false;
      _typingFadeOut = false;
    });
  }

  void _onSseDone() {
    _finalizeAndCloseStream(userStopped: false);
  }

  // ---------------------------
  // PICKERS
  // ---------------------------
  Future<void> _removeFileAt(int i) async {
    _setStateSafe(() {
      _pickedFiles.removeAt(i);
      _pickedExts.removeAt(i);
    });
  }

  Future<void> _pickFromCamera() async {
    try {
      final picker = ImagePicker();
      final photo = await picker.pickImage(source: ImageSource.camera);
      if (photo != null) {
        final bytes = await photo.readAsBytes();
        final file = FFUploadedFile(name: photo.name, bytes: bytes);
        _setStateSafe(() {
          _pickedFiles.add(file);
          _pickedExts.add('jpg');
        });
        HapticFeedback.lightImpact();
      }
    } catch (e) {
      _toast('Camera error: $e', icon: Icons.error_outline);
    }
  }

  Future<void> _pickFromGallery() async {
    try {
      final picker = ImagePicker();
      final images = await picker.pickMultiImage();
      if (images.isEmpty) return;
      final newFiles = <FFUploadedFile>[];
      final newExts = <String>[];
      for (final img in images) {
        final bytes = await img.readAsBytes();
        newFiles.add(FFUploadedFile(name: img.name, bytes: bytes));
        newExts.add(img.path.toLowerCase().endsWith('.png') ? 'png' : 'jpg');
      }
      _setStateSafe(() {
        _pickedFiles.addAll(newFiles);
        _pickedExts.addAll(newExts);
      });
      HapticFeedback.lightImpact();
    } catch (e) {
      _toast('Gallery error: $e', icon: Icons.error_outline);
    }
  }

  Future<void> _pickDocuments() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        allowMultiple: true,
        type: FileType.custom,
        allowedExtensions: [
          'pdf',
          'doc',
          'docx',
          'xls',
          'xlsx',
          'txt',
          'csv',
          'json',
          'md',
          'dart',
          'js',
          'ts',
          'py',
          'zip',
        ],
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;
      final newFiles = <FFUploadedFile>[];
      final newExts = <String>[];
      for (final file in result.files) {
        if (file.bytes == null) continue;
        newFiles.add(FFUploadedFile(name: file.name, bytes: file.bytes!));
        newExts.add((file.extension ?? '').trim().isEmpty
            ? 'bin'
            : (file.extension ?? 'bin'));
      }
      if (newFiles.isEmpty) return;
      _setStateSafe(() {
        _pickedFiles.addAll(newFiles);
        _pickedExts.addAll(newExts);
      });
      HapticFeedback.lightImpact();
    } catch (e) {
      _toast('File picker error: $e', icon: Icons.error_outline);
    }
  }

  // ---------------------------
  // BUILDERS
  // ---------------------------
  Widget _buildEphemeralMessageWithText(String txt) {
    final bool dark = _resolveDark();
    final double minH = (_streamPinned && _pinnedMinEphemeralHeight > 0)
        ? _pinnedMinEphemeralHeight
        : _ephemeralMinHeight;

    return Padding(
      key: _ephemeralKey,
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GptnixAssistantMessageBody(
            rawText: txt,
            isTyping: true,
            stableId: 'ephemeral',
            toolsJson: _toolStatuses,
            isDark: dark,
            isStreaming: _isStreaming,
            deepThink: _deepThink,
            onSkipTool: _stopStreamByUser,
          ),
          if (minH > 0) SizedBox(height: minH),
        ],
      ),
    );
  }

  Widget _buildEphemeralMessage() {
    return _buildEphemeralMessageWithText(_activeStream?.value ?? '');
  }

  Widget _buildMessageItem(DocumentSnapshot doc, int index) {
    final data = doc.data() as Map<String, dynamic>;
    final role = (data['role'] ?? '').toString();
    final content = data['content'] ?? '';

    if (role == 'user') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: GptnixUserMessageTile(
          text: content,
          stableId: doc.id,
          fileNamesJson: data['file_names'],
          isDark: widget.isDark,
          onLongPress: () {},
        ),
      );
    }
    return GestureDetector(
      onLongPress: () => _copyTextSilent(content.toString()),
      child: GptnixAssistantMessageTile(
        stableId: doc.id,
        content: content,
        isDark: _resolveDark(),
        onCopy: () => _copyTextSilent(content.toString()),
        onShare: () async {}, // ✅ ako je Future<void> callback
      ),
    );
  }

  bool _onScrollNotification(ScrollNotification n) {
    if (_streamPinned && n is UserScrollNotification) _unlockStreamPin();
    _viewport.onScrollNotification(n);
    return false;
  }

  void _onUserTouch() {
    if (_streamPinned) {
      _viewport.setAutoFollow(false);
      return;
    }
    _viewport.onUserScrollIntent();
  }

  Widget _buildReplyEditHeader(bool isDark) {
    if (_editingMsgId != null) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1F1F1F) : const Color(0xFFF0F0F0),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
        ),
        child: Row(
          children: [
            const Icon(Icons.edit, size: 14),
            const SizedBox(width: 8),
            const Expanded(
              child: Text("Uređivanje...", style: TextStyle(fontSize: 12)),
            ),
            InkWell(
                onTap: _cancelEdit, child: const Icon(Icons.close, size: 16)),
          ],
        ),
      );
    }
    if (_replyToMsgId != null) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1F1F1F) : const Color(0xFFF0F0F0),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
        ),
        child: Row(
          children: [
            const Icon(Icons.reply, size: 14),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                "Odgovaranje na: ${_replyPreviewText ?? '...'}",
                style: const TextStyle(fontSize: 12),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            InkWell(
                onTap: _cancelReply, child: const Icon(Icons.close, size: 16)),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }

  // ---------------------------
  // BUILD
  // ---------------------------
  @override
  Widget build(BuildContext context) {
    final bool dark = _resolveDark();
    final double bottomInset = MediaQuery.of(context).viewInsets.bottom;

    if (_isLoading) {
      return AnimatedPadding(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.only(bottom: bottomInset),
        child: const SizedBox.expand(
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    SchedulerBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctx = _inputBarKey.currentContext;
      if (ctx == null) return;
      final ro = ctx.findRenderObject();
      if (ro is RenderBox) {
        final h = ro.size.height;
        if (h > 0 && (h - _inputBarHeight.value).abs() > 2) {
          _inputBarHeight.value = h;
        }
      }
    });

    if (_kbDebug) {
      // ignore: avoid_print
      print(
        '[KB] bottomInset=$bottomInset  '
        'padding.bottom=${MediaQuery.of(context).padding.bottom}  '
        'context.size=${context.size}',
      );
    }

    return AnimatedPadding(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.only(bottom: bottomInset),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double w = widget.width ?? constraints.maxWidth;

          return SizedBox(
            width: w,
            height: constraints.maxHeight,
            child: Column(
              children: [
                Expanded(
                  child: Stack(
                    children: [
                      ValueListenableBuilder<double>(
                        valueListenable: _inputBarHeight,
                        builder: (context, inputBarH, _) {
                          return GptnixChatMessageList(
                            scrollController: _scroll,
                            messages: _historyDocs,
                            showEphemeral: _showEphemeral,
                            activeStreamStartMs: _activeStreamStartMs,
                            ephemeralKey: _ephemeralKey,
                            msgKeys: _msgKeys,
                            onScrollNotification: _onScrollNotification,
                            onUserTouch: _onUserTouch,
                            ephemeralTextListenable: _activeStream,
                            buildEphemeralMessageFromText: (txt) {
                              return _buildEphemeralMessageWithText(txt);
                            },
                            buildEphemeralMessage: _buildEphemeralMessage,
                            buildMessageItem: _buildMessageItem,
                            bottomPadding: inputBarH + 20,
                            viewportController: _viewport,
                            activeStreamFinalMessageIdHint:
                                _ephemeralAfterUserId,
                          );
                        },
                      ),
                    ],
                  ),
                ),
                _buildReplyEditHeader(dark),
                GptnixInputBar(
                  key: _inputBarKey,
                  controller: _controller,
                  focusNode: _inputFocus,
                  isStreaming: _isStreaming,
                  isSending: _isSending,
                  deepThink: _deepThink,
                  isDark: dark,
                  pickedFiles: _pickedFiles,
                  pickedExts: _pickedExts,
                  onSend: () async => await _sendMessage(),
                  onStop: () async => await _stopStreamByUser(),

                  // ✅ OVO JE FIX ZA TVOJU GREŠKU:
                  onToggleDeepThink: () async {
                    if (_isStreaming) return;
                    _setStateSafe(() => _deepThink = !_deepThink);
                  },

                  onPickCamera: () async => await _pickFromCamera(),
                  onPickGallery: () async => await _pickFromGallery(),
                  onPickDocuments: () async => await _pickDocuments(),
                  onRemoveFile: (i) async => await _removeFileAt(i),
                  onVoiceChat: () async {
                    if (_isStreaming) return;
                    HapticFeedback.lightImpact();
                    final convRef =
                        FFAppState().activeConvRef ?? widget.conversationRef;
                    await Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => GptnixVoiceChatPage(
                          backendUrl: _backendUrl,
                          voicePath: '/voice/chat',
                          conversationRef: convRef,
                          model: widget.model ?? 'gpt-4o-mini',
                          autoStart: true,
                          autoPlay: true,
                          alwaysListening: true,
                          bargeIn: true,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
