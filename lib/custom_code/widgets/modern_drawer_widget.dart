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

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:provider/provider.dart';

import 'modern_drawer_core.dart';
import 'modern_drawer_scaffold.dart';

class ModernDrawerWidget extends StatefulWidget {
  const ModernDrawerWidget({
    super.key,
    this.width,
    this.height,
    required this.isDark,
    this.userId,
    this.userDoc,
  }) : assert(userId != null || userDoc != null,
            'Either userId or userDoc must be provided');

  final double? width;
  final double? height;

  final bool isDark;

  /// User ID (koristit će se za kreiranje userDoc ako nije proslijeđen)
  final String? userId;

  /// User document reference (ili će biti generiran iz userId)
  final DocumentReference? userDoc;

  @override
  State<ModernDrawerWidget> createState() => _ModernDrawerWidgetState();
}

class _ModernDrawerWidgetState extends State<ModernDrawerWidget> {
  late final ScrollController _listController;
  late final PageController _galleryController;

  late final ModernDrawerNotifier _vm;
  late final Future<void> Function(DocumentReference conversationRef)
      _onConversationSelected;

  @override
  void initState() {
    super.initState();

    _listController = ScrollController();
    _galleryController = PageController();

    final db = FirebaseFirestore.instance;
    final convRepo = ConversationRepository(db);
    final msgRepo = MessageRepository(db);

    final titleService = TitleService(
      messageRepo: msgRepo,
      cache: TitleCache(),
    );

    final imagesService = RecentImagesService(msgRepo: msgRepo);
    final searchService = SearchService(convRepo: convRepo);

    // Resolve userDoc from userId if needed
    final userDocResolved =
        widget.userDoc ?? db.collection('users').doc(widget.userId!);
    final userId = userDocResolved.id;

    // Hardcoded: navigiraj na ChatPage kad se odabere chat
    _onConversationSelected = (DocumentReference ref) async {
      if (!context.mounted) return;

      // KLJUČNO: Postavi activeConvRef u FFAppState
      FFAppState().activeConvRef = ref;
      FFAppState()
          .update(() {}); // Notificiraj FlutterFlow da se state promijenio

      context.pushNamed(
        'ChatPage',
        queryParameters: {'conversationId': ref.id},
      );
    };

    // Kreiraj novi chat ili usmjeri na postojeći prazni chat
    // LOGIKA (ChatGPT stil):
    //   1. Dohvati zadnjih 20 chatova ovog usera (query samo po user_id — auto-index, bez composite indexa)
    //   2. Filtriraj u Dartu: message_count == 0 i nema title-a (prazan chat)
    //   3. Ako postoji → navigiraj na njega (bez kreiranja novog)
    //   4. Ako ne postoji → kreiraj novi Firestore dokument
    Future<void> onNewChatDefault() async {
      if (!context.mounted) return;

      try {
        // FIX: Query SAMO po user_id (single-field auto-index).
        // Nema orderBy na drugom fieldu — to bi zahtijevalo composite index!
        // Sortiranje i filtriranje radimo u Dartu.
        final recentSnap = await db
            .collection('conversations')
            .where('user_id', isEqualTo: userId)
            .limit(50)
            .get();

        // Sortiraj u Dartu po created_at (desc) — bez Firestore orderBy
        final docs = List<DocumentSnapshot>.from(recentSnap.docs);
        docs.sort((a, b) {
          final aData = a.data() as Map<String, dynamic>? ?? {};
          final bData = b.data() as Map<String, dynamic>? ?? {};
          // Timestamp može biti null ako serverTimestamp još nije resolvan
          final aTs = aData['created_at'];
          final bTs = bData['created_at'];
          if (aTs == null && bTs == null) return 0;
          if (aTs == null) return 1;
          if (bTs == null) return -1;
          // Firestore Timestamp ima compareTo
          try {
            return (bTs as dynamic).compareTo(aTs as dynamic);
          } catch (_) {
            return 0;
          }
        });

        // Filtriraj u Dartu: prazan chat = message_count 0 ili null + title prazan/generic
        DocumentSnapshot? emptyDoc;
        for (final doc in docs) {
          final data = doc.data() as Map<String, dynamic>? ?? {};
          final msgCount = (data['message_count'] ?? 0) as int;
          final title = (data['title'] ?? '').toString().trim().toLowerCase();
          final isGeneric =
              title.isEmpty || title == 'new chat' || title == 'novi chat';
          if (msgCount == 0 && isGeneric) {
            emptyDoc = doc;
            break;
          }
        }

        DocumentReference chatRef;

        if (emptyDoc != null) {
          // Već postoji prazan chat — usmjeri korisnika na njega
          debugPrint('[NEW_CHAT] Existing empty chat found: ${emptyDoc.id}');
          chatRef = emptyDoc.reference;
        } else {
          // Nema praznog chata — kreiraj novi
          debugPrint('[NEW_CHAT] No empty chat found, creating new one');
          chatRef = await db.collection('conversations').add({
            'user_id': userId,
            'created_at': FieldValue.serverTimestamp(),
            'updated_at': FieldValue.serverTimestamp(),
            'title': '',
            'title_is_manual': false,
            'last_message': '',
            'message_count': 0,
            'is_pinned': false,
          });
        }

        if (!context.mounted) return;

        // Postavi activeConvRef u FFAppState
        FFAppState().activeConvRef = chatRef;
        FFAppState().update(() {});

        // Navigiraj na ChatPage
        context.pushNamed(
          'ChatPage',
          queryParameters: {'conversationId': chatRef.id},
        );
      } catch (e) {
        debugPrint('[NEW_CHAT] Error: $e');
        if (context.mounted) {
          modernDrawerSnack(context, 'Failed to open chat', isError: true);
        }
      }
    }

    _vm = ModernDrawerNotifier(
      userId: userId,
      userDoc: userDocResolved,
      convRepo: convRepo,
      msgRepo: msgRepo,
      titleService: titleService,
      imagesService: imagesService,
      searchService: searchService,
      onConversationSelected: _onConversationSelected,
      onNewChat: onNewChatDefault,
    )..bootstrap();
  }

  @override
  void dispose() {
    _listController.dispose();
    _galleryController.dispose();
    _vm.dispose();
    super.dispose();
  }

  void _closeDrawerSafely() {
    final scaffold = Scaffold.maybeOf(context);
    if (scaffold != null && scaffold.isDrawerOpen) {
      scaffold.closeDrawer();
      return;
    }
    Navigator.of(context).maybePop();
  }

  Future<void> _handleSelectConversation(ConversationItem item) async {
    await _vm.selectConversation(item, context);
    _closeDrawerSafely();
  }

  Future<void> _handleNewChat() async {
    await _vm.createNewChat(context);
    _closeDrawerSafely();
  }

  void _openGalleryAt(int index) {
    _vm.openGalleryAt(index);
    // jump bez animacije da bude instant (ChatGPT feel)
    if (_galleryController.hasClients) {
      _galleryController.jumpToPage(index);
    } else {
      // ako još nema clients (prvi frame), pokušaj nakon microtask
      Future.microtask(() {
        if (_galleryController.hasClients) _galleryController.jumpToPage(index);
      });
    }
  }

  Future<void> _copyGalleryUrl(String url) async {
    await modernDrawerCopyToClipboard(url, context);
  }

  Future<void> _jumpToChatFromGallery(DocumentReference? convRef) async {
    if (convRef == null) return;
    try {
      await _onConversationSelected(convRef);
      _vm.closeGallery();
      _closeDrawerSafely();
    } catch (_) {
      modernDrawerSnack(context, 'Failed', isError: true);
    }
  }

  Future<void> _showMobileActions(
      BuildContext ctx, ConversationItem item) async {
    final isDark = widget.isDark;
    final bg = isDark ? const Color(0xFF151515) : Colors.white;
    final fg = isDark ? Colors.white : Colors.black87;
    final sub = isDark ? Colors.white70 : Colors.black54;

    await showModalBottomSheet(
      context: ctx,
      backgroundColor: Colors.transparent,
      builder: (_) {
        return SafeArea(
          child: Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(16),
              border:
                  Border.all(color: isDark ? Colors.white12 : Colors.black12),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _sheetRow(
                  icon:
                      item.isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                  title: item.isPinned ? 'Unpin' : 'Pin',
                  subtitle: 'Keep this chat at the top',
                  fg: fg,
                  sub: sub,
                  onTap: () async {
                    Navigator.pop(ctx);
                    await _vm.togglePinned(item, context);
                  },
                ),
                _sheetRow(
                  icon: Icons.edit_outlined,
                  title: 'Rename',
                  subtitle: 'Change chat title',
                  fg: fg,
                  sub: sub,
                  onTap: () async {
                    Navigator.pop(ctx);
                    await _vm.renameConversation(item, context);
                  },
                ),
                _sheetRow(
                  icon: Icons.delete_outline,
                  title: 'Delete',
                  subtitle: 'Delete chat and messages',
                  fg: fg,
                  sub: sub,
                  danger: true,
                  onTap: () async {
                    Navigator.pop(ctx);
                    await _vm.deleteConversation(item, context);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _sheetRow({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color fg,
    required Color sub,
    required VoidCallback onTap,
    bool danger = false,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        child: Row(
          children: [
            Icon(icon, size: 20, color: danger ? const Color(0xFFFF3B30) : fg),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: danger ? const Color(0xFFFF3B30) : fg,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 12, color: sub),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showDesktopMenu(ConversationItem item, Offset globalPos) async {
    final overlay =
        Overlay.of(context).context.findRenderObject() as RenderBox?;
    final rect = RelativeRect.fromRect(
      Rect.fromPoints(globalPos, globalPos),
      Offset.zero & (overlay?.size ?? const Size(1000, 1000)),
    );

    final selected = await showMenu<String>(
      context: context,
      position: rect,
      items: [
        PopupMenuItem(
          value: 'pin',
          child: Row(
            children: [
              Icon(item.isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                  size: 18),
              const SizedBox(width: 10),
              Text(item.isPinned ? 'Unpin' : 'Pin'),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'rename',
          child: Row(
            children: [
              Icon(Icons.edit_outlined, size: 18),
              SizedBox(width: 10),
              Text('Rename'),
            ],
          ),
        ),
        const PopupMenuItem(
          value: 'delete',
          child: Row(
            children: [
              Icon(Icons.delete_outline, size: 18, color: Color(0xFFFF3B30)),
              SizedBox(width: 10),
              Text('Delete', style: TextStyle(color: Color(0xFFFF3B30))),
            ],
          ),
        ),
      ],
    );

    if (!mounted) return;

    switch (selected) {
      case 'pin':
        await _vm.togglePinned(item, context);
        break;
      case 'rename':
        await _vm.renameConversation(item, context);
        break;
      case 'delete':
        await _vm.deleteConversation(item, context);
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = ChangeNotifierProvider<ModernDrawerNotifier>.value(
      value: _vm,
      child: ModernDrawerScaffold(
        isDark: widget.isDark,
        listController: _listController,
        galleryController: _galleryController,
        closeDrawerSafely: _closeDrawerSafely,
        onNewChat: _handleNewChat,
        onSelectConversation: (item, ctx) => _handleSelectConversation(item),
        onDesktopContextMenu: (item, pos) => _showDesktopMenu(item, pos),
        onMobileActions: (ctx, item) => _showMobileActions(ctx, item),
        onLoadMoreOlder: () => _vm.loadMoreOlder(),
        onOpenGalleryAt: _openGalleryAt,
        onCopyGalleryUrl: _copyGalleryUrl,
        onJumpToChatFromGallery: _jumpToChatFromGallery,
        onCloseSearchOverlay: () => _vm.closeSearchOverlay(clear: true),
        onCloseGallery: _vm.closeGallery,
      ),
    );

    if (widget.width == null && widget.height == null) return child;

    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: child,
    );
  }
}
