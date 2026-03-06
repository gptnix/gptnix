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

import '/custom_code/widgets/index.dart';
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

class ModernDrawerSearchRow extends StatelessWidget {
  const ModernDrawerSearchRow({
    super.key,
    required this.isDark,
    required this.onOpenSearchOverlay,
    required this.onRefreshImages,
  });

  final bool isDark;
  final VoidCallback onOpenSearchOverlay;
  final VoidCallback onRefreshImages;

  @override
  Widget build(BuildContext context) {
    final hintKey =
        Theme.of(context).platform == TargetPlatform.macOS ? '⌘K' : 'Ctrl K';
    final theme = FlutterFlowTheme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      child: Semantics(
        label: 'Search chat history',
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            HapticFeedback.selectionClick();
            onOpenSearchOverlay();
          },
          child: Container(
            decoration: BoxDecoration(
              color: theme.secondaryBackground,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: theme.alternate),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Icon(Icons.search, size: 20, color: theme.secondaryText),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Search chats',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      color: theme.secondaryText,
                    ),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                  decoration: BoxDecoration(
                    color: theme.primaryBackground,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: theme.alternate),
                  ),
                  child: Text(
                    hintKey,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: theme.primaryText,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton(
                  tooltip: 'Refresh images',
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    onRefreshImages();
                  },
                  icon: Icon(
                    Icons.photo_library_outlined,
                    size: 18,
                    color: theme.secondaryText,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
