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

import 'modern_drawer_core.dart';
import 'modern_drawer_conversation_tile.dart';
import 'modern_drawer_ui_bits.dart';

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

    final children = <Widget>[];

    for (final g in grouped) {
      children.add(ModernDrawerSectionHeader(label: g.label, isDark: isDark));

      for (final it in g.items) {
        children.add(
          FutureBuilder<String>(
            future: vm.titleService.getOrGenerate(it),
            builder: (ctx, snap) {
              final title = (snap.data ?? it.titleFallback).trim();
              return ModernDrawerConversationTile(
                isDark: isDark,
                item: it,
                title: title.isEmpty ? it.titleFallback : title,
                // ✅ FIX: await select
                onSelect: () async => await onSelectConversation(it, context),
                onDesktopContextMenu: (pos) => onDesktopContextMenu(it, pos),
                onMobileActions: () => onMobileActions(context, it),
              );
            },
          ),
        );
      }
    }

    // original logika: pokaži "Load more" nakon 50 (bootstrap limit)
    final showLoadMore = items.length >= 50;
    if (showLoadMore) {
      children.add(
        ModernDrawerLoadMoreCard(
          isDark: isDark,
          isLoading: vm.isLoadingOlder,
          onTap: () => onLoadMoreOlder(),
        ),
      );
    } else {
      children.add(const SizedBox(height: 18));
    }

    return ListView(
      controller: controller,
      padding: const EdgeInsets.only(bottom: 8),
      children: children,
    );
  }
}
