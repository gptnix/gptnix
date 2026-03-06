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

// modern_drawer_ui_bits.dart
//
// Sitni zajednički UI komadići koje koriste list/search/overlay.

import 'package:google_fonts/google_fonts.dart';

class ModernDrawerSectionHeader extends StatelessWidget {
  const ModernDrawerSectionHeader({
    super.key,
    required this.label,
    required this.isDark,
  });

  final String label;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
      child: Text(
        label,
        style: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
          color: isDark ? Colors.white70 : Colors.black54,
        ),
      ),
    );
  }
}

class ModernDrawerEmptyState extends StatelessWidget {
  const ModernDrawerEmptyState({
    super.key,
    required this.isDark,
    required this.title,
    this.subtitle,
    this.icon = Icons.inbox_outlined,
  });

  final bool isDark;
  final String title;
  final String? subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final fg = isDark ? Colors.white70 : Colors.black54;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 26),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 34, color: fg),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
          if ((subtitle ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 12,
                color: fg.withOpacity(0.85),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class ModernDrawerLoadMoreCard extends StatelessWidget {
  const ModernDrawerLoadMoreCard({
    super.key,
    required this.isDark,
    required this.isLoading,
    required this.onTap,
  });

  final bool isDark;
  final bool isLoading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? const Color(0xFF1B1B1B) : const Color(0xFFF4F4F4);
    final fg = isDark ? Colors.white70 : Colors.black54;

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 18),
      child: InkWell(
        onTap: isLoading ? null : onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? Colors.white10 : Colors.black12,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (isLoading) ...[
                const SizedBox(
                  height: 14,
                  width: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 10),
                Text(
                  'Loading...',
                  style: GoogleFonts.inter(fontSize: 13, color: fg),
                ),
              ] else ...[
                Icon(Icons.expand_more, size: 18, color: fg),
                const SizedBox(width: 8),
                Text(
                  'Load more',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: fg,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class ModernDrawerKbd extends StatelessWidget {
  const ModernDrawerKbd({
    super.key,
    required this.text,
    required this.isDark,
  });

  final String text;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? Colors.white10 : Colors.black12;
    final fg = isDark ? Colors.white70 : Colors.black87;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isDark ? Colors.white12 : Colors.black12,
        ),
      ),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}
