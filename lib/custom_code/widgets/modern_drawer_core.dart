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

import 'index.dart'; // Imports other custom widgets

import 'index.dart'; // Imports other custom widgets

import 'index.dart'; // Imports other custom widgets

// modern_drawer_core.dart
//
// Svrha: sav “non-UI” sloj za ModernDrawer (modeli, repo, servisi, notifier, helperi).
// Pravilo: logika + ponašanje ostaju isti, samo izdvojeno u jedan core file.

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'modern_drawer_user_menu_sheet.dart';

/// ============================
/// MODELI
/// ============================

@immutable
class ConversationItem {
  final DocumentReference ref;
  final String? rawTitle;
  final bool titleIsManual;
  final String? lastMessage;
  final Timestamp? updatedAt;
  final bool isPinned;
  final String? conversationType;

  const ConversationItem({
    required this.ref,
    required this.rawTitle,
    required this.titleIsManual,
    required this.lastMessage,
    required this.updatedAt,
    required this.isPinned,
    required this.conversationType,
  });

  String get id => ref.id;

  // Alias getters - koriste ih search overlay i conversation tile
  String get title => titleFallback;
  String get snippet => (lastMessage ?? '').trim();
  String get conversationId => ref.id;
  DocumentReference get conversationRef => ref;

  bool get isArchived => false;

  String get titleFallback {
    final t = (rawTitle ?? '').trim();
    return t.isEmpty ? 'New chat' : t;
  }

  bool get needsTitleGeneration {
    if (titleIsManual) return false;
    final t = (rawTitle ?? '').trim();
    if (t.isEmpty) return true;
    final lower = t.toLowerCase();
    return lower == 'new chat' ||
        lower == 'novi chat' ||
        lower == 'new conversation' ||
        lower == 'nova konverzacija';
  }

  static ConversationItem fromDoc(DocumentSnapshot doc) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};
    return ConversationItem(
      ref: doc.reference,
      rawTitle: data['title']?.toString(),
      titleIsManual: data['title_is_manual'] == true,
      lastMessage: data['last_message']?.toString(),
      updatedAt: data['updated_at'] as Timestamp?,
      isPinned: data['is_pinned'] == true,
      conversationType: data['conversation_type']?.toString(),
    );
  }
}

@immutable
class RecentImageItem {
  final String url;
  final int createdAtMs;
  final DocumentReference? conversationRef;
  final String? prompt;
  final bool hasSources;

  const RecentImageItem({
    required this.url,
    required this.createdAtMs,
    this.conversationRef,
    this.prompt,
    this.hasSources = false,
  });
}

enum DateGroup { today, yesterday, last7Days, last30Days, older }

@immutable
class GroupedConversations {
  final DateGroup group;
  final List<ConversationItem> items;

  const GroupedConversations(this.group, this.items);

  String get label {
    switch (group) {
      case DateGroup.today:
        return 'Danas';
      case DateGroup.yesterday:
        return 'Jučer';
      case DateGroup.last7Days:
        return 'Prošlih 7 dana';
      case DateGroup.last30Days:
        return 'Prošlih 30 dana';
      case DateGroup.older:
        return 'Starije';
    }
  }
}

/// ============================
/// REPOSITORIES
/// ============================

class ConversationRepository {
  ConversationRepository(this.db);
  final FirebaseFirestore db;

  Query<Map<String, dynamic>> _baseQuery(String userId) {
    return db
        .collection('conversations')
        .where('user_id', isEqualTo: userId)
        .orderBy('updated_at', descending: true);
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> watchRecentSnapshot({
    required String userId,
    int limit = 50,
  }) {
    return _baseQuery(userId).limit(limit).snapshots();
  }

  Stream<List<ConversationItem>> watchRecent({
    required String userId,
    int limit = 50,
  }) {
    return watchRecentSnapshot(userId: userId, limit: limit).map((snap) {
      return snap.docs.map((d) => ConversationItem.fromDoc(d)).toList();
    });
  }

  Future<List<ConversationItem>> fetchOlder({
    required String userId,
    required DocumentSnapshot? startAfter,
    int limit = 50,
  }) async {
    if (startAfter == null) return const [];
    final q = _baseQuery(userId).startAfterDocument(startAfter).limit(limit);
    final snap = await q.get();
    return snap.docs.map((d) => ConversationItem.fromDoc(d)).toList();
  }

  /// Za search: uzmi malo veći batch i filtriraj lokalno.
  Future<List<ConversationItem>> fetchForSearch({
    required String userId,
    int limit = 200,
  }) async {
    final snap = await _baseQuery(userId).limit(limit).get();
    return snap.docs.map((d) => ConversationItem.fromDoc(d)).toList();
  }

  Future<void> setPinned(ConversationItem item, bool pinned) =>
      item.ref.update({'is_pinned': pinned});

  Future<void> rename(ConversationItem item, String newTitle) =>
      item.ref.update({'title': newTitle, 'title_is_manual': true});

  Future<void> deleteConversationAndMessages(ConversationItem item) async {
    final msgs = await item.ref.collection('messages').get();
    final batch = db.batch();
    for (final m in msgs.docs) {
      batch.delete(m.reference);
    }
    batch.delete(item.ref);
    await batch.commit();
  }
}

class MessageRepository {
  MessageRepository(this.db);
  final FirebaseFirestore db;

  Future<List<Map<String, dynamic>>> fetchFirstMessages(
    DocumentReference convRef, {
    int limit = 6,
  }) async {
    final q = await convRef
        .collection('messages')
        .orderBy('created_at_ms', descending: false)
        .limit(limit)
        .get();
    return q.docs.map((d) => d.data()).toList();
  }

  Future<QuerySnapshot<Map<String, dynamic>>> fastPathImages({
    required String userId,
    required int limit,
  }) {
    return db
        .collectionGroup('messages')
        .where('has_images', isEqualTo: true)
        .where('user_id', isEqualTo: userId)
        .orderBy('created_at_ms', descending: true)
        .limit(limit)
        .get();
  }
}

/// ============================
/// SERVICES
/// ============================

class TitleCache {
  static final TitleCache _instance = TitleCache._internal();
  factory TitleCache() => _instance;
  TitleCache._internal();

  final Map<String, String> _cache = {};
  final Map<String, Future<String>> _pending = {};

  String? get(String id) => _cache[id];
  void set(String id, String title) => _cache[id] = title;

  Future<String>? pending(String id) => _pending[id];
  void setPending(String id, Future<String> f) => _pending[id] = f;
  void clearPending(String id) => _pending.remove(id);

  void clearAll() {
    _cache.clear();
    _pending.clear();
  }
}

class TitleService {
  TitleService({required this.messageRepo, required this.cache});
  final MessageRepository messageRepo;
  final TitleCache cache;

  final Map<String, Timer> _debouncedWrites = {};

  /// Compatibility alias (ako negdje još zove getTitle).
  Future<String> getTitle(ConversationItem item) => getOrGenerate(item);

  Future<String> getOrGenerate(ConversationItem item) async {
    final cached = cache.get(item.id);
    if (cached != null && cached.trim().isNotEmpty) return cached;

    final raw = (item.rawTitle ?? '').trim();
    if (!item.needsTitleGeneration && raw.isNotEmpty) {
      cache.set(item.id, raw);
      return raw;
    }

    final pending = cache.pending(item.id);
    if (pending != null) return pending;

    final f = _generateAndMaybeSave(item);
    cache.setPending(item.id, f);
    try {
      final title = await f;
      cache.set(item.id, title);
      return title;
    } finally {
      cache.clearPending(item.id);
    }
  }

  Future<String> _generateAndMaybeSave(ConversationItem item) async {
    if (item.titleIsManual) return item.titleFallback;

    try {
      final msgs = await messageRepo.fetchFirstMessages(item.ref, limit: 8);
      final userText = _firstUsefulUserMessage(msgs);
      if (userText == null) return 'New chat';

      final title = _extractSmartTitle(userText);

      // ✅ FIX: NE pisati u Firestore — backend je jedini vlasnik title fielda.
      // TitleService je display-only: generira lokalni privremeni prikaz dok
      // backend AI title ne stigne (obično ~3s nakon poruke).
      // Ako bi TitleService pisao u Firestore, backend bi vidio neprazan title
      // i preskočio AI generaciju (shouldGenerateTitle → false).
      // _debouncedWrites su zadržani samo kao no-op placeholder radi dispose().

      return title;
    } catch (_) {
      return 'New chat';
    }
  }

  String? _firstUsefulUserMessage(List<Map<String, dynamic>> msgs) {
    for (final m in msgs) {
      if (m['role'] == 'user') {
        final text = (m['text'] ?? m['content'] ?? '').toString().trim();
        if (text.isNotEmpty) return text;
      }
    }
    return null;
  }

  String _extractSmartTitle(String message) {
    String cleaned = message
        .replaceAll(
            RegExp(
              r'^(hey|hi|hello|please|can you|could you|i need|i want|help me|tell me|explain|show me|write|create|make|generate)\s+',
              caseSensitive: false,
            ),
            '')
        .trim();

    if (cleaned.isEmpty) cleaned = message.trim();
    if (cleaned.isEmpty) return 'New chat';

    cleaned = cleaned.replaceAll(RegExp(r'\s+'), ' ');

    if (cleaned.length <= 45) return _cap(cleaned);

    final sentenceEnd = cleaned.indexOf(RegExp(r'[.!?]'));
    if (sentenceEnd > 0 && sentenceEnd <= 55) {
      return _cap(cleaned.substring(0, sentenceEnd));
    }

    final words = cleaned.split(' ').where((w) => w.isNotEmpty).toList();
    final out = <String>[];
    int len = 0;
    for (final w in words) {
      if (len + w.length + 1 > 42) break;
      out.add(w);
      len += w.length + 1;
    }
    if (out.isEmpty) return '${_cap(cleaned.substring(0, 42))}...';
    return '${_cap(out.join(' '))}...';
  }

  String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  void dispose() {
    for (final t in _debouncedWrites.values) {
      t.cancel();
    }
    _debouncedWrites.clear();
  }
}

class RecentImagesService {
  RecentImagesService({required this.msgRepo});
  final MessageRepository msgRepo;

  /// Vadi slike iz message dokumenata (collectionGroup fast path).
  Future<List<RecentImageItem>> loadRecentImages({
    required String userId,
    int limit = 24,
  }) async {
    final snap = await msgRepo.fastPathImages(userId: userId, limit: limit);
    final out = <RecentImageItem>[];
    final seen = <String>{};

    for (final d in snap.docs) {
      final data = d.data();

      final createdAtMs = _toInt(data['created_at_ms']) ??
          (data['created_at'] is Timestamp
              ? (data['created_at'] as Timestamp).millisecondsSinceEpoch
              : DateTime.now().millisecondsSinceEpoch);

      final prompt = (data['prompt'] ?? data['text'] ?? data['content'])
          ?.toString()
          .trim();

      final hasSources = (data['has_sources'] == true) ||
          ((data['sources'] is List) && (data['sources'] as List).isNotEmpty);

      final convRef = _conversationRefFromMessageDoc(d.reference);

      final urls = _extractImageUrls(data);
      for (final url in urls) {
        final u = url.trim();
        if (u.isEmpty) continue;
        if (seen.contains(u)) continue;
        seen.add(u);
        out.add(RecentImageItem(
          url: u,
          createdAtMs: createdAtMs,
          conversationRef: convRef,
          prompt: prompt,
          hasSources: hasSources,
        ));
      }
    }

    out.sort((a, b) => b.createdAtMs.compareTo(a.createdAtMs));
    return out;
  }

  DocumentReference? _conversationRefFromMessageDoc(DocumentReference msgRef) {
    // messages subcollection -> parent is CollectionReference('messages'),
    // parent.parent is conversation doc reference
    final parent = msgRef.parent.parent;
    return parent;
  }

  List<String> _extractImageUrls(Map<String, dynamic> data) {
    final out = <String>[];

    void addAny(dynamic v) {
      if (v == null) return;
      if (v is String) {
        if (v.trim().isNotEmpty) out.add(v.trim());
        return;
      }
      if (v is List) {
        for (final x in v) {
          addAny(x);
        }
        return;
      }
      if (v is Map) {
        // ponekad: {url: "..."} ili {src: "..."}
        final u = v['url'] ?? v['src'] ?? v['href'];
        addAny(u);
      }
    }

    addAny(data['image_urls']);
    addAny(data['images']);
    addAny(data['image_url']);
    addAny(data['image']);
    addAny(data['url']);

    return out;
  }

  int? _toInt(dynamic v) {
    if (v == null) return null;
    if (v is int) return v;
    if (v is double) return v.toInt();
    return int.tryParse(v.toString());
  }
}

class SearchService {
  SearchService({required this.convRepo});
  final ConversationRepository convRepo;

  Future<List<ConversationItem>> search({
    required String userId,
    required String query,
    int limit = 30,
  }) async {
    final q = query.trim();
    if (q.isEmpty) return const [];

    final all = await convRepo.fetchForSearch(userId: userId, limit: 250);

    final lower = q.toLowerCase();
    int score(ConversationItem it) {
      final title = (it.rawTitle ?? '').toLowerCase();
      final last = (it.lastMessage ?? '').toLowerCase();
      int s = 0;

      if (title == lower) s += 100;
      if (title.startsWith(lower)) s += 60;
      if (title.contains(lower)) s += 40;

      if (last.startsWith(lower)) s += 30;
      if (last.contains(lower)) s += 20;

      if (it.isPinned) s += 10;

      // novije malo gore
      final ms = it.updatedAt?.millisecondsSinceEpoch ?? 0;
      s += (ms ~/ 100000000); // grubo, ali deterministično
      return s;
    }

    final hits = all.where((it) {
      final title = (it.rawTitle ?? '').toLowerCase();
      final last = (it.lastMessage ?? '').toLowerCase();
      return title.contains(lower) || last.contains(lower);
    }).toList();

    hits.sort((a, b) => score(b).compareTo(score(a)));
    if (hits.length > limit) return hits.sublist(0, limit);
    return hits;
  }
}

/// ============================
/// NOTIFIER (STATE)
/// ============================

class ModernDrawerNotifier extends ChangeNotifier {
  ModernDrawerNotifier({
    required this.userId,
    required this.userDoc,
    required this.convRepo,
    required this.msgRepo,
    required this.titleService,
    required this.imagesService,
    required this.searchService,
    required this.onConversationSelected,
    required this.onNewChat,
  });

  final String userId;
  final DocumentReference userDoc;

  final ConversationRepository convRepo;
  final MessageRepository msgRepo;
  final TitleService titleService;
  final RecentImagesService imagesService;
  final SearchService searchService;

  final Future<void> Function(DocumentReference convRef) onConversationSelected;
  final Future<void> Function() onNewChat;

  StreamSubscription? _convSub;

  // conversations
  bool isLoadingConversations = true;
  bool isLoadingOlder = false;
  List<ConversationItem> recent = const [];

  // images
  bool imagesLoading = false;
  bool imagesLoadedOnce = false;
  List<RecentImageItem> recentImages = const [];

  // search overlay
  bool isSearchOverlayOpen = false;
  bool isSearching = false;
  String searchQuery = '';
  List<ConversationItem> searchResults = const [];
  int searchSelectedIndex = 0;

  // gallery overlay
  bool galleryOpen = false;
  int galleryIndex = 0;

  // internal pagination anchor
  DocumentSnapshot? _lastConvSnapshot;

  // Synchronous title cache — populated lazily in background after each
  // snapshot so tiles never need a FutureBuilder.
  final Map<String, String> _titleCache = {};

  /// Returns the resolved display title for [item], falling back to
  /// [ConversationItem.titleFallback] until the background resolve completes.
  String resolvedTitle(ConversationItem item) =>
      _titleCache[item.ref.id] ?? item.titleFallback;

  bool _bootstrapped = false;

  void bootstrap({int conversationsLimit = 50}) {
    if (_bootstrapped) return;
    _bootstrapped = true;

    isLoadingConversations = true;
    notifyListeners();

    _convSub?.cancel();
    _convSub = convRepo
        .watchRecentSnapshot(userId: userId, limit: conversationsLimit)
        .listen((snap) {
      final list = snap.docs.map((d) => ConversationItem.fromDoc(d)).toList();

      // pinovi gore + ostalo po updated_at (već je orderBy updated_at desc)
      final pinned = list.where((x) => x.isPinned).toList();
      final rest = list.where((x) => !x.isPinned).toList();
      final merged = <ConversationItem>[...pinned, ...rest];

      recent = merged;
      _lastConvSnapshot = snap.docs.isNotEmpty ? snap.docs.last : null;

      isLoadingConversations = false;
      notifyListeners();

      // Prefetch titles in background so tiles can read synchronously.
      _prefetchTitles(merged);
    }, onError: (_) {
      isLoadingConversations = false;
      notifyListeners();
    });

    // images lazy-load (da ne blokira prvi paint)
    Future.microtask(() => refreshRecentImages());
  }

  /// Resolves titles for [items] in the background and notifies once done.
  /// Only resolves items whose title is not already cached to avoid redundant work.
  void _prefetchTitles(List<ConversationItem> items) {
    final unresolved = items
        .where((it) => !_titleCache.containsKey(it.ref.id))
        .toList();
    if (unresolved.isEmpty) return;

    Future.microtask(() async {
      bool anyNew = false;
      for (final item in unresolved) {
        try {
          final title = await titleService.getOrGenerate(item);
          if (title.trim().isNotEmpty && title != item.titleFallback) {
            _titleCache[item.ref.id] = title;
            anyNew = true;
          }
        } catch (_) {}
      }
      if (anyNew) notifyListeners();
    });
  }

  Future<void> refreshRecentImages({int limit = 24}) async {
    if (imagesLoading) return;
    imagesLoading = true;
    notifyListeners();

    try {
      final items =
          await imagesService.loadRecentImages(userId: userId, limit: limit);
      recentImages = items;
      imagesLoadedOnce = true;
    } catch (_) {
      // ne rušimo UI — samo ostane prazan strip
      recentImages = const [];
      imagesLoadedOnce = true;
    } finally {
      imagesLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadMoreOlder({int limit = 50}) async {
    if (isLoadingOlder) return;
    if (_lastConvSnapshot == null) return;

    isLoadingOlder = true;
    notifyListeners();

    try {
      final older = await convRepo.fetchOlder(
        userId: userId,
        startAfter: _lastConvSnapshot,
        limit: limit,
      );
      if (older.isNotEmpty) {
        // održimo pinned na vrhu, a starije samo dodajemo na kraj
        recent = [...recent, ...older];

        // update anchor snapshot
        final lastRef = older.last.ref;
        _lastConvSnapshot = await lastRef.get();
      }
    } catch (_) {
      // ignore
    } finally {
      isLoadingOlder = false;
      notifyListeners();
    }
  }

  void openSearchOverlay() {
    isSearchOverlayOpen = true;
    notifyListeners();
  }

  void closeSearchOverlay({bool clear = true}) {
    isSearchOverlayOpen = false;
    if (clear) {
      searchQuery = '';
      searchResults = const [];
      searchSelectedIndex = 0;
      isSearching = false;
    }
    notifyListeners();
  }

  Future<void> performSearch(String q) async {
    final next = q;
    searchQuery = next;

    if (next.trim().isEmpty) {
      searchResults = const [];
      searchSelectedIndex = 0;
      isSearching = false;
      notifyListeners();
      return;
    }

    isSearching = true;
    notifyListeners();

    try {
      final res =
          await searchService.search(userId: userId, query: next, limit: 30);
      searchResults = res;
      if (searchSelectedIndex >= searchResults.length) {
        searchSelectedIndex =
            searchResults.isEmpty ? 0 : searchResults.length - 1;
      }
    } catch (_) {
      searchResults = const [];
      searchSelectedIndex = 0;
    } finally {
      isSearching = false;
      notifyListeners();
    }
  }

  void moveSearchSelection(int delta) {
    if (searchResults.isEmpty) return;
    final next = (searchSelectedIndex + delta) % searchResults.length;
    searchSelectedIndex = next < 0 ? searchResults.length - 1 : next;
    notifyListeners();
  }

  Future<void> selectConversation(
      ConversationItem item, BuildContext? context) async {
    try {
      await onConversationSelected(item.ref);
    } catch (_) {
      if (context != null) {
        modernDrawerSnack(context, 'Failed to open chat', isError: true);
      }
    } finally {
      closeSearchOverlay(clear: true);
      closeGallery();
    }
  }

  Future<void> createNewChat(BuildContext? context) async {
    await onNewChat();
    closeSearchOverlay(clear: true);
    closeGallery();
  }

  void openGalleryAt(int index) {
    galleryOpen = true;
    galleryIndex =
        index.clamp(0, recentImages.isEmpty ? 0 : recentImages.length - 1);
    notifyListeners();
  }

  void closeGallery() {
    if (!galleryOpen) return;
    galleryOpen = false;
    notifyListeners();
  }

  Future<void> togglePinned(ConversationItem item, BuildContext context) async {
    try {
      await convRepo.setPinned(item, !item.isPinned);
    } catch (_) {
      modernDrawerSnack(context, 'Failed', isError: true);
    }
  }

  Future<void> renameConversation(
      ConversationItem item, BuildContext context) async {
    final ctrl = TextEditingController(text: item.titleFallback);
    final res = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF151515) : Colors.white,
          title: Text('Rename chat',
              style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          content: TextField(
            controller: ctrl,
            autofocus: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => Navigator.pop(ctx, ctrl.text.trim()),
            decoration: const InputDecoration(hintText: 'Title'),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('Save'),
            ),
          ],
        );
      },
    );

    final title = (res ?? '').trim();
    if (title.isEmpty) return;

    try {
      await convRepo.rename(item, title);
      // cache update
      titleService.cache.set(item.id, title);
    } catch (_) {
      modernDrawerSnack(context, 'Failed', isError: true);
    }
  }

  Future<void> deleteConversation(
      ConversationItem item, BuildContext context) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF151515) : Colors.white,
          title: Text('Delete chat?',
              style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
          content: const Text('This will delete the chat and its messages.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );

    if (ok != true) return;

    try {
      await convRepo.deleteConversationAndMessages(item);
    } catch (_) {
      modernDrawerSnack(context, 'Failed', isError: true);
    }
  }

  Future<void> openUserMenuSheet(BuildContext context) async {
    // Dohvati korisničke podatke prije prikaza sheet-a
    Map<String, dynamic> userData = {};
    try {
      final snap = await userDoc.get();
      userData = (snap.data() as Map<String, dynamic>?) ?? {};
    } catch (_) {}

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fullName = modernDrawerGetFullName(userData);
    final email = userData['email']?.toString() ?? '';
    final initials = modernDrawerGetUserInitials(userData);

    if (!context.mounted) return;

    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) {
        return ModernDrawerUserMenuSheet(
          isDark: isDark,
          fullName: fullName,
          email: email,
          initials: initials,
          userDoc: userDoc,
          onLogout: () => signOut(context),
        );
      },
    );
  }

  Future<void> signOut(BuildContext context) async {
    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {
      // ignore
    }
    // zatvori sheet + drawer ako je otvoren
    Navigator.of(context).maybePop();
  }

  @override
  void dispose() {
    _convSub?.cancel();
    titleService.dispose();
    super.dispose();
  }
}

/// ============================
/// HELPERS (public API)
/// ============================

DateGroup getDateGroup(Timestamp? ts) {
  if (ts == null) return DateGroup.today;
  final date = ts.toDate();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final yesterday = today.subtract(const Duration(days: 1));
  final conversationDate = DateTime(date.year, date.month, date.day);

  if (conversationDate == today) return DateGroup.today;
  if (conversationDate == yesterday) return DateGroup.yesterday;
  if (now.difference(date).inDays < 7) return DateGroup.last7Days;
  if (now.difference(date).inDays < 30) return DateGroup.last30Days;
  return DateGroup.older;
}

List<GroupedConversations> groupConversations(List<ConversationItem> items) {
  final Map<DateGroup, List<ConversationItem>> grouped = {};
  for (final item in items) {
    final group = getDateGroup(item.updatedAt);
    grouped.putIfAbsent(group, () => []).add(item);
  }

  return [
    DateGroup.today,
    DateGroup.yesterday,
    DateGroup.last7Days,
    DateGroup.last30Days,
    DateGroup.older,
  ]
      .where((g) => grouped.containsKey(g))
      .map((g) => GroupedConversations(g, grouped[g]!))
      .toList();
}

/// Kompatibilnost (stariji pozivi iz drugih widgeta)
List<GroupedConversations> modernDrawerGroupConversations(
        List<ConversationItem> items) =>
    groupConversations(items);

String timeAgo(Timestamp? ts) {
  if (ts == null) return '';
  final date = ts.toDate();
  final diff = DateTime.now().difference(date);

  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';
  if (diff.inDays == 1) return '1d';
  if (diff.inDays < 7) return '${diff.inDays}d';

  return DateFormat('MMM d').format(date);
}

/// Kompatibilnost (widgeti zovu modernDrawerTimeAgo)
String modernDrawerTimeAgo(Timestamp? ts) => timeAgo(ts);

void showSnack(BuildContext context, String message, {bool isError = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message, style: GoogleFonts.inter(fontSize: 14)),
      backgroundColor:
          isError ? const Color(0xFFFF3B30) : const Color(0xFF34C759),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 2),
    ),
  );
}

/// Kompatibilnost (widgeti zovu modernDrawerSnack)
void modernDrawerSnack(BuildContext context, String message,
        {bool isError = false}) =>
    showSnack(context, message, isError: isError);

String modernDrawerGetFullName(Map<String, dynamic> data) {
  final dn = (data['display_name'] ??
          data['displayName'] ??
          data['name'] ??
          data['full_name'])
      ?.toString()
      .trim();
  if (dn != null && dn.isNotEmpty) return dn;

  final first = (data['first_name'] ?? data['firstName'])?.toString().trim();
  final last = (data['last_name'] ?? data['lastName'])?.toString().trim();
  final combined = '${first ?? ''} ${last ?? ''}'.trim();
  if (combined.isNotEmpty) return combined;

  final email = (data['email'] ?? data['user_email'])?.toString().trim();
  if (email != null && email.isNotEmpty) return email;

  return 'User';
}

String modernDrawerGetUserInitials(Map<String, dynamic> data) {
  final name = modernDrawerGetFullName(data).trim();
  final parts = name.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return 'U';
  if (parts.length == 1) {
    final p = parts.first;
    return p.isEmpty ? 'U' : p.substring(0, 1).toUpperCase();
  }
  return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
}

/// Utility: copy to clipboard (opcionalno)
Future<void> modernDrawerCopyToClipboard(
    String text, BuildContext? context) async {
  try {
    await Clipboard.setData(ClipboardData(text: text));
    if (context != null) modernDrawerSnack(context, 'Copied');
  } catch (_) {
    if (context != null) modernDrawerSnack(context, 'Failed', isError: true);
  }
}
