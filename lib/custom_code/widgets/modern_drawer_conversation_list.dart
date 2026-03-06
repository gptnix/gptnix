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

import 'package:provider/provider.dart';

import 'package:google_fonts/google_fonts.dart';

import 'modern_drawer_core.dart';
import 'modern_drawer_conversation_tile.dart';
import 'modern_drawer_ui_bits.dart';

// Lightweight sealed-class hierarchy for the flat index list used by
// ListView.builder so tiles are constructed lazily instead of all at once.
abstract class _ListEntry {}

class _SectionEntry extends _ListEntry {
  final String label;
  _SectionEntry(this.label);
}

class _TileEntry extends _ListEntry {
  final ConversationItem item;
  _TileEntry(this.item);
}

class _FooterEntry extends _ListEntry {
  final bool showLoadMore;
  _FooterEntry({required this.showLoadMore});
}

class ModernDrawerConversationList extends StatelessWidget {
  const ModernDrawerConversationList({
    super.key,
    required this.isDark,
    required this.controller,
    required this.onSelectConversation,
    required this.onDesktopContextMenu,
    required this.onMobileActions,
    required this.onLoadMoreOlder,
  });

  final bool isDark;
  final ScrollController controller;

  // ✅ FIX: Future callback (da tile može await)
  final Future<void> Function(ConversationItem item, BuildContext ctx)
      onSelectConversation;

  final void Function(ConversationItem item, Offset globalPos)
      onDesktopContextMenu;

  final Future<void> Function(BuildContext ctx, ConversationItem item)
      onMobileActions;

  final Future<void> Function() onLoadMoreOlder;

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<ModernDrawerNotifier>();

    // ✅ OVO JE TVOJ STVARNI SOURCE (iz modern_drawer_core.dart)
    final items = vm.recent;

    if (vm.isLoadingConversations && items.isEmpty) {
      return Center(
        child: SizedBox(
          width: 26,
          height: 26,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(
              isDark ? Colors.white70 : Colors.black54,
            ),
          ),
        ),
      );
    }

    if (!vm.isLoadingConversations && items.isEmpty) {
      return ModernDrawerEmptyState(
        isDark: isDark,
        title: 'No chats yet',
        subtitle: 'Start a new chat and it will appear here.',
        icon: Icons.chat_bubble_outline,
      );
    }

    final grouped = modernDrawerGroupConversations(items);

    // Build a flat index list so ListView.builder can render lazily.
    // Each entry is one of: _SectionEntry | _TileEntry | _FooterEntry
    final entries = <_ListEntry>[];
    for (final g in grouped) {
      entries.add(_SectionEntry(g.label));
      for (final it in g.items) {
        entries.add(_TileEntry(it));
      }
    }
    final showLoadMore = items.length >= 50;
    entries.add(_FooterEntry(showLoadMore: showLoadMore));

    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.only(bottom: 8),
      itemCount: entries.length,
      itemBuilder: (ctx, i) {
        final entry = entries[i];
        if (entry is _SectionEntry) {
          return ModernDrawerSectionHeader(
              label: entry.label, isDark: isDark);
        }
        if (entry is _TileEntry) {
          final it = entry.item;
          final tile = ModernDrawerConversationTile(
            isDark: isDark,
            item: it,
            title: vm.resolvedTitle(it),
            isActive: it.ref.id == (FFAppState().activeConvRef?.id ?? ''),
            onSelect: () async => await onSelectConversation(it, context),
            onDesktopContextMenu: (pos) => onDesktopContextMenu(it, pos),
            onMobileActions: () => onMobileActions(context, it),
          );
          return Dismissible(
            key: Key('conv_${it.ref.id}'),
            direction: DismissDirection.endToStart,
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: 20),
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.85),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.delete_outline_rounded,
                  color: Colors.white, size: 22),
            ),
            confirmDismiss: (_) async {
              final ok = await showDialog<bool>(
                context: ctx,
                builder: (dialogCtx) => AlertDialog(
                  title: Text('Obriši razgovor?',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
                  content: const Text(
                      'Ovo će trajno obrisati razgovor i sve poruke.'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(dialogCtx, false),
                      child: const Text('Otkaži'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(dialogCtx, true),
                      child: const Text('Obriši',
                          style: TextStyle(color: Colors.red)),
                    ),
                  ],
                ),
              );
              return ok == true;
            },
            onDismissed: (_) => vm.deleteConversation(it, context),
            child: tile,
          );
        }
        // _FooterEntry
        final footer = entry as _FooterEntry;
        if (footer.showLoadMore) {
          return ModernDrawerLoadMoreCard(
            isDark: isDark,
            isLoading: vm.isLoadingOlder,
            onTap: () => onLoadMoreOlder(),
          );
        }
        return const SizedBox(height: 18);
      },
    );
  }
}
