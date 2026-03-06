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

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'modern_drawer_core.dart';

class ModernDrawerConversationTile extends StatelessWidget {
  const ModernDrawerConversationTile({
    super.key,
    required this.isDark,
    required this.item,
    required this.title,
    required this.onSelect,
    required this.onDesktopContextMenu,
    required this.onMobileActions,
    this.isActive = false,
  });

  final bool isDark;
  final ConversationItem item;
  final String title;
  final bool isActive;

  // ✅ FIX: async tap handler
  final Future<void> Function() onSelect;

  final void Function(Offset globalPosition) onDesktopContextMenu;
  final Future<void> Function() onMobileActions;

  bool get _isDesktop {
    return kIsWeb ||
        defaultTargetPlatform == TargetPlatform.macOS ||
        defaultTargetPlatform == TargetPlatform.windows ||
        defaultTargetPlatform == TargetPlatform.linux;
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = (item.lastMessage ?? '').trim();
    final timeText = modernDrawerTimeAgo(item.updatedAt);
    final theme = FlutterFlowTheme.of(context);

    final tileBg = isActive
        ? theme.primary.withOpacity(0.12)
        : theme.secondaryBackground;
    final tileBorder = isActive
        ? Border(
            left: BorderSide(color: theme.primary, width: 3),
            top: BorderSide(color: theme.alternate),
            right: BorderSide(color: theme.alternate),
            bottom: BorderSide(color: theme.alternate),
          )
        : Border.all(color: theme.alternate);
    final titleColor = isActive
        ? theme.primaryText
        : (isDark ? Colors.white : const Color(0xFF1A1A1A));

    return Semantics(
      label: 'Otvori razgovor: $title',
      button: true,
      child: Builder(
        builder: (ctx) => InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () async {
            HapticFeedback.selectionClick();
            await onSelect();
          },
          onLongPress: () async {
            HapticFeedback.selectionClick();
            if (_isDesktop) {
              final pos = _tileGlobalCenter(ctx);
              onDesktopContextMenu(pos);
            } else {
              await onMobileActions();
            }
          },
          onSecondaryTapDown: (details) {
            if (_isDesktop) {
              onDesktopContextMenu(details.globalPosition);
            }
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: EdgeInsets.fromLTRB(isActive ? 9 : 12, 10, 10, 10),
            decoration: BoxDecoration(
              color: tileBg,
              borderRadius: BorderRadius.circular(14),
              border: tileBorder,
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: isActive
                        ? theme.primary.withOpacity(0.18)
                        : theme.primaryBackground,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    item.isPinned
                        ? Icons.push_pin_rounded
                        : Icons.chat_bubble_outline_rounded,
                    size: 18,
                    color: isActive ? theme.primary : theme.secondaryText,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              title.isEmpty ? 'Untitled chat' : title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: titleColor,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            timeText,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: theme.secondaryText,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle.isEmpty ? '—' : subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: theme.secondaryText,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () async {
                    HapticFeedback.selectionClick();
                    if (_isDesktop) {
                      final pos = _tileGlobalCenter(ctx);
                      onDesktopContextMenu(pos);
                    } else {
                      await onMobileActions();
                    }
                  },
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: theme.primaryBackground,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.more_horiz_rounded,
                      size: 18,
                      color: theme.secondaryText,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Offset _tileGlobalCenter(BuildContext ctx) {
    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null) return Offset.zero;
    final p =
        box.localToGlobal(Offset(box.size.width * 0.8, box.size.height * 0.5));
    return p;
  }
}
