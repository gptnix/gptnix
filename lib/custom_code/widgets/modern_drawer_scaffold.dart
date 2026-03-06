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

import 'package:provider/provider.dart';

import 'modern_drawer_core.dart';
import 'modern_drawer_header.dart';
import 'modern_drawer_search_row.dart';
import 'modern_drawer_recent_images_strip.dart';
import 'modern_drawer_conversation_list.dart';
import 'modern_drawer_search_overlay.dart';
import 'modern_drawer_fullscreen_gallery.dart';
import 'modern_drawer_user_footer.dart';

class ModernDrawerScaffold extends StatelessWidget {
  const ModernDrawerScaffold({
    super.key,
    required this.isDark,
    required this.listController,
    required this.galleryController,
    required this.closeDrawerSafely,
    required this.onNewChat,
    required this.onSelectConversation,
    required this.onDesktopContextMenu,
    required this.onMobileActions,
    required this.onLoadMoreOlder,
    required this.onOpenGalleryAt,
    required this.onCopyGalleryUrl,
    required this.onJumpToChatFromGallery,
    required this.onCloseSearchOverlay,
    required this.onCloseGallery,
    this.onNavEditProfile,
    this.onNavSettings,
    this.onNavHelp,
  });

  final bool isDark;

  final ScrollController listController;
  final PageController galleryController;

  final VoidCallback closeDrawerSafely;

  // ✅ FIX: async callback
  final Future<void> Function() onNewChat;

  // ✅ FIX: async callback (await u listi/tile-u)
  final Future<void> Function(ConversationItem item, BuildContext ctx)
      onSelectConversation;

  final void Function(ConversationItem item, Offset globalPos)
      onDesktopContextMenu;

  final Future<void> Function(BuildContext ctx, ConversationItem item)
      onMobileActions;

  final Future<void> Function() onLoadMoreOlder;

  final void Function(int index) onOpenGalleryAt;

  // ✅ FIX: async copy url (tip usklađen do galerije)
  final Future<void> Function(String url) onCopyGalleryUrl;

  // ✅ FIX: async jump (može i void, ali nek bude future radi konzistentnosti)
  final Future<void> Function(DocumentReference? convRef)
      onJumpToChatFromGallery;

  final VoidCallback onCloseSearchOverlay;
  final VoidCallback onCloseGallery;

  final VoidCallback? onNavEditProfile;
  final VoidCallback? onNavSettings;
  final VoidCallback? onNavHelp;

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<ModernDrawerNotifier>();

    final theme = FlutterFlowTheme.of(context);
    final divider = theme.alternate;

    return Container(
      color: theme.primaryBackground,
      child: SafeArea(
        bottom: true,
        child: Stack(
          children: [
            Column(
              children: [
                ModernDrawerHeader(
                  isDark: isDark,
                  onNewChat: () async {
                    // ✅ FIX: await async callback
                    await onNewChat();
                  },
                ),
                Divider(height: 1, thickness: 1, color: divider),
                ModernDrawerSearchRow(
                  isDark: isDark,
                  onOpenSearchOverlay: () => vm.openSearchOverlay(),
                  onRefreshImages: () => vm.refreshRecentImages(),
                ),
                ModernDrawerRecentImagesStrip(
                  isDark: isDark,
                  onOpenGalleryAt: (i) => onOpenGalleryAt(i),
                ),
                Expanded(
                  child: ModernDrawerConversationList(
                    isDark: isDark,
                    controller: listController,
                    onSelectConversation: onSelectConversation, // ✅ Future
                    onDesktopContextMenu: onDesktopContextMenu,
                    onMobileActions: onMobileActions,
                    onLoadMoreOlder: onLoadMoreOlder,
                  ),
                ),
                Divider(height: 1, thickness: 1, color: divider),
                ModernDrawerUserFooter(
                  isDark: isDark,
                  userDoc: vm.userDoc,
                  onShowUserMenu: (userData) => vm.openUserMenuSheet(context),
                ),
              ],
            ),

            // Search overlay
            if (vm.isSearchOverlayOpen)
              Positioned.fill(
                child: GestureDetector(
                  onTap: onCloseSearchOverlay,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    color: Colors.black54,
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: GestureDetector(
                        onTap: () {}, // swallow
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
                          child: ModernDrawerSearchOverlay(isDark: isDark),
                        ),
                      ),
                    ),
                  ),
                ),
              ),

            // Fullscreen gallery
            if (vm.galleryOpen)
              Positioned.fill(
                child: ModernDrawerFullscreenGallery(
                  isDark: isDark,
                  controller: galleryController,
                  onClose: onCloseGallery,
                  onCopyUrl:
                      onCopyGalleryUrl, // ✅ Future<void> Function(String)
                ),
              ),
          ],
        ),
      ),
    );
  }
}
