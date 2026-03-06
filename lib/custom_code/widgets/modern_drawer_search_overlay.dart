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

import '/custom_code/widgets/index.dart';
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

import 'dart:async';

import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import 'modern_drawer_core.dart';
import 'modern_drawer_ui_bits.dart';

class ModernDrawerSearchOverlay extends StatefulWidget {
  const ModernDrawerSearchOverlay({
    super.key,
    required this.isDark,
  });

  final bool isDark;

  @override
  State<ModernDrawerSearchOverlay> createState() =>
      _ModernDrawerSearchOverlayState();
}

class _ModernDrawerSearchOverlayState extends State<ModernDrawerSearchOverlay> {
  final TextEditingController ctrl = TextEditingController();
  final FocusNode focus = FocusNode();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => focus.requestFocus());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    ctrl.dispose();
    focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<ModernDrawerNotifier>();

    return Positioned.fill(
      child: Material(
        color: Colors.black.withOpacity(0.55),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: Focus(
                autofocus: true,
                onKeyEvent: (node, evt) {
                  if (evt is KeyDownEvent) {
                    if (evt.logicalKey == LogicalKeyboardKey.escape) {
                      vm.closeSearchOverlay();
                      return KeyEventResult.handled;
                    }
                    if (evt.logicalKey == LogicalKeyboardKey.arrowDown) {
                      vm.moveSearchSelection(1);
                      return KeyEventResult.handled;
                    }
                    if (evt.logicalKey == LogicalKeyboardKey.arrowUp) {
                      vm.moveSearchSelection(-1);
                      return KeyEventResult.handled;
                    }
                    if (evt.logicalKey == LogicalKeyboardKey.enter) {
                      if (vm.searchResults.isNotEmpty) {
                        final r = vm.searchResults[vm.searchSelectedIndex
                            .clamp(0, vm.searchResults.length - 1)];
                        final conv = vm.recent.firstWhere(
                          (c) => c.id == r.conversationId,
                          orElse: () => ConversationItem(
                            ref: r.conversationRef,
                            rawTitle: r.title,
                            titleIsManual: true,
                            lastMessage: r.snippet,
                            updatedAt: r.updatedAt,
                            isPinned: r.isPinned,
                            conversationType: null,
                          ),
                        );
                        vm.closeSearchOverlay();
                        unawaited(vm.selectConversation(conv, null));
                      }
                      return KeyEventResult.handled;
                    }
                  }
                  return KeyEventResult.ignored;
                },
                child: Container(
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color:
                        widget.isDark ? const Color(0xFF0D0D0D) : Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: widget.isDark
                          ? const Color(0xFF2A2A2A)
                          : const Color(0xFFE5E5E5),
                    ),
                    boxShadow: [
                      BoxShadow(
                        blurRadius: 24,
                        spreadRadius: 2,
                        color: Colors.black.withOpacity(0.25),
                      )
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                        child: Row(
                          children: [
                            Icon(Icons.search,
                                size: 20,
                                color: widget.isDark
                                    ? const Color(0xFF8E8E93)
                                    : const Color(0xFF6B6B6B)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: TextField(
                                controller: ctrl,
                                focusNode: focus,
                                onChanged: (v) {
                                  _debounce?.cancel();
                                  _debounce = Timer(
                                    const Duration(milliseconds: 300),
                                    () => vm.performSearch(v),
                                  );
                                },
                                style: GoogleFonts.inter(
                                  fontSize: 16,
                                  color: widget.isDark
                                      ? Colors.white
                                      : const Color(0xFF1A1A1A),
                                ),
                                decoration: InputDecoration(
                                  hintText: 'Search by title or content…',
                                  hintStyle: GoogleFonts.inter(
                                    color: widget.isDark
                                        ? const Color(0xFF4A4A4A)
                                        : const Color(0xFFAAAAAA),
                                  ),
                                  border: InputBorder.none,
                                ),
                              ),
                            ),
                            IconButton(
                              tooltip: 'Close',
                              onPressed: () => vm.closeSearchOverlay(),
                              icon: Icon(Icons.close,
                                  size: 18,
                                  color: widget.isDark
                                      ? Colors.white
                                      : const Color(0xFF1A1A1A)),
                            ),
                          ],
                        ),
                      ),
                      const Divider(height: 1),
                      SizedBox(
                        height: 420,
                        child: vm.isSearching
                            ? const Center(
                                child: SizedBox(
                                  width: 20,
                                  height: 20,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                ),
                              )
                            : (vm.searchQuery.trim().isEmpty
                                ? ModernDrawerSearchEmptyHint(
                                    isDark: widget.isDark)
                                : (vm.searchResults.isEmpty
                                    ? ModernDrawerSearchNoResults(
                                        isDark: widget.isDark)
                                    : ListView.builder(
                                        padding: const EdgeInsets.all(10),
                                        itemCount: vm.searchResults.length,
                                        itemBuilder: (context, i) {
                                          final r = vm.searchResults[i];
                                          final selected =
                                              i == vm.searchSelectedIndex;
                                          return ModernDrawerSearchResultTile(
                                            isDark: widget.isDark,
                                            selected: selected,
                                            title: r.title,
                                            snippet: r.snippet,
                                            time: modernDrawerTimeAgo(
                                                r.updatedAt),
                                            pinned: r.isPinned,
                                            onTap: () {
                                              final conv = vm.recent.firstWhere(
                                                (c) => c.id == r.conversationId,
                                                orElse: () => ConversationItem(
                                                  ref: r.conversationRef,
                                                  rawTitle: r.title,
                                                  titleIsManual: true,
                                                  lastMessage: r.snippet,
                                                  updatedAt: r.updatedAt,
                                                  isPinned: r.isPinned,
                                                  conversationType: null,
                                                ),
                                              );
                                              vm.closeSearchOverlay();
                                              unawaited(vm.selectConversation(
                                                  conv, null));
                                            },
                                          );
                                        },
                                      ))),
                      ),
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
                        decoration: BoxDecoration(
                          color: widget.isDark
                              ? const Color(0xFF0D0D0D)
                              : Colors.white,
                          borderRadius: const BorderRadius.vertical(
                            bottom: Radius.circular(18),
                          ),
                        ),
                        child: Row(
                          children: [
                            ModernDrawerKbd(isDark: widget.isDark, text: '↑'),
                            const SizedBox(width: 6),
                            ModernDrawerKbd(isDark: widget.isDark, text: '↓'),
                            const SizedBox(width: 10),
                            Text('navigate',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: widget.isDark
                                      ? const Color(0xFF8E8E93)
                                      : const Color(0xFF6B6B6B),
                                )),
                            const SizedBox(width: 14),
                            ModernDrawerKbd(
                                isDark: widget.isDark, text: 'Enter'),
                            const SizedBox(width: 10),
                            Text('open',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: widget.isDark
                                      ? const Color(0xFF8E8E93)
                                      : const Color(0xFF6B6B6B),
                                )),
                            const Spacer(),
                            ModernDrawerKbd(isDark: widget.isDark, text: 'Esc'),
                            const SizedBox(width: 10),
                            Text('close',
                                style: GoogleFonts.inter(
                                  fontSize: 12,
                                  color: widget.isDark
                                      ? const Color(0xFF8E8E93)
                                      : const Color(0xFF6B6B6B),
                                )),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ============================================================
// Search overlay helper widgets
// ============================================================

class ModernDrawerSearchEmptyHint extends StatelessWidget {
  const ModernDrawerSearchEmptyHint({super.key, required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final fg = isDark ? Colors.white38 : Colors.black26;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.search, size: 40, color: fg),
          const SizedBox(height: 12),
          Text(
            'Type to search chats…',
            style: GoogleFonts.inter(fontSize: 14, color: fg),
          ),
        ],
      ),
    );
  }
}

class ModernDrawerSearchNoResults extends StatelessWidget {
  const ModernDrawerSearchNoResults({super.key, required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final fg = isDark ? Colors.white38 : Colors.black26;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.search_off_rounded, size: 40, color: fg),
          const SizedBox(height: 12),
          Text(
            'No results found',
            style: GoogleFonts.inter(fontSize: 14, color: fg),
          ),
        ],
      ),
    );
  }
}

class ModernDrawerSearchResultTile extends StatelessWidget {
  const ModernDrawerSearchResultTile({
    super.key,
    required this.isDark,
    required this.selected,
    required this.title,
    required this.snippet,
    required this.time,
    required this.pinned,
    required this.onTap,
  });

  final bool isDark;
  final bool selected;
  final String title;
  final String snippet;
  final String time;
  final bool pinned;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = selected
        ? (isDark ? const Color(0xFF1E3A5F) : const Color(0xFFE8F0FE))
        : Colors.transparent;

    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(
              pinned
                  ? Icons.push_pin_rounded
                  : Icons.chat_bubble_outline_rounded,
              size: 16,
              color: isDark ? Colors.white38 : Colors.black26,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title.isEmpty ? 'Untitled chat' : title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                    ),
                  ),
                  if (snippet.isNotEmpty)
                    Text(
                      snippet,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: isDark
                            ? const Color(0xFF8E8E93)
                            : const Color(0xFF6B6B6B),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              time,
              style: GoogleFonts.inter(
                fontSize: 11,
                color:
                    isDark ? const Color(0xFF4A4A4A) : const Color(0xFFAAAAAA),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
