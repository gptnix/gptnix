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

import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'modern_drawer_core.dart';

class ModernDrawerUserFooter extends StatelessWidget {
  const ModernDrawerUserFooter({
    super.key,
    required this.isDark,
    required this.userDoc,
    required this.onShowUserMenu,
  });

  final bool isDark;
  final DocumentReference userDoc;
  final Future<void> Function(Map<String, dynamic>? userData) onShowUserMenu;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: FutureBuilder<DocumentSnapshot>(
        future: userDoc.get(),
        builder: (context, snapshot) {
          final userData = snapshot.data?.data() as Map<String, dynamic>?;
          final userDataSafe = userData ?? {};
          final fullName = modernDrawerGetFullName(userDataSafe);
          final email = userData?['email']?.toString() ?? '';
          final initials = modernDrawerGetUserInitials(userDataSafe);

          return Semantics(
            button: true,
            label: 'User menu',
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () async {
                HapticFeedback.selectionClick();
                await onShowUserMenu(userData);
              },
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Center(
                      child: Text(
                        initials,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullName,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color:
                                isDark ? Colors.white : const Color(0xFF1A1A1A),
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (email.isNotEmpty)
                          Text(
                            email,
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: isDark
                                  ? const Color(0xFF6B6B6B)
                                  : const Color(0xFF8E8E93),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  Icon(Icons.unfold_more_rounded,
                      size: 18,
                      color: isDark
                          ? const Color(0xFF6B6B6B)
                          : const Color(0xFF8E8E93)),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
