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

import '/custom_code/widgets/index.dart';
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'modern_drawer_ui_bits.dart';
import 'modern_profile_widget.dart';
import 'modern_settings_widget.dart';
import 'modern_edit_profile_widget.dart';
import 'modern_personalization_widget.dart';
import 'modern_privacy_policy_widget.dart';
import 'modern_terms_of_use_widget.dart';
import 'modern_data_control_widget.dart';

class ModernDrawerUserMenuSheet extends StatelessWidget {
  const ModernDrawerUserMenuSheet({
    super.key,
    required this.isDark,
    required this.fullName,
    required this.email,
    required this.initials,
    this.userDoc,
    required this.onLogout,
  });

  final bool isDark;

  final String fullName;
  final String email;
  final String initials;
  final DocumentReference? userDoc;

  final Future<void> Function() onLogout;

  /// Open ModernProfileWidget in full-screen dialog
  Future<void> _openProfile(BuildContext context) async {
    if (userDoc == null) {
      // Ako nema userDoc, ne možemo otvoriti profile
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User document not available')),
      );
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (context) => ModernProfileWidget(
          onBack: () async {
            Navigator.of(context).pop();
          },
          onEditProfile: () async {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (ctx) => ModernEditProfileWidget(
                  userDoc: userDoc!,
                  onBack: () async => Navigator.of(ctx).pop(),
                ),
              ),
            );
          },

          // ✅ FIX: ModernPersonalizationWidget traži required userDoc
          onPersonalization: () async {
            if (userDoc == null) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('User document not available')),
              );
              return;
            }
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (ctx) => ModernPersonalizationWidget(
                  userDoc: userDoc!, // ✅ DODANO
                  onBack: () async => Navigator.of(ctx).pop(),
                ),
              ),
            );
          },

          onDataControl: () async {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (ctx) => ModernDataControlWidget(
                  onBack: () async => Navigator.of(ctx).pop(),
                ),
              ),
            );
          },
          onPrivacy: () async {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (ctx) => ModernPrivacyPolicyWidget(
                  onBack: () async => Navigator.of(ctx).pop(),
                ),
              ),
            );
          },
          onTerms: () async {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (ctx) => ModernTermsOfUseWidget(
                  onBack: () async => Navigator.of(ctx).pop(),
                ),
              ),
            );
          },
          onLogout: onLogout,
        ),
      ),
    );
  }

  Future<void> _openSettings(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (context) => ModernSettingsWidget(
          onBack: () async {
            Navigator.of(context).pop();
          },
          onPrivacyPolicy: () async {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (ctx) => ModernPrivacyPolicyWidget(
                  onBack: () async => Navigator.of(ctx).pop(),
                ),
              ),
            );
          },
          onTermsOfService: () async {
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (ctx) => ModernTermsOfUseWidget(
                  onBack: () async => Navigator.of(ctx).pop(),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? const Color(0xFF151515) : Colors.white;
    final fg = isDark ? Colors.white : Colors.black87;
    final sub = isDark ? Colors.white70 : Colors.black54;
    final border = isDark ? Colors.white12 : Colors.black12;

    return SafeArea(
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),

            // Header: user info
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: isDark ? Colors.white10 : Colors.black12,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      initials,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: fg,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullName.isNotEmpty ? fullName : 'User',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: fg,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          email,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontSize: 12.5,
                            color: sub,
                          ),
                        ),
                      ],
                    ),
                  ),
                  ModernDrawerIconCircleBtn(
                    isDark: isDark,
                    icon: Icons.close_rounded,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      Navigator.of(context).maybePop();
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),
            Divider(height: 1, thickness: 1, color: border),
            const SizedBox(height: 8),

            // Menu items
            _menuRow(
              isDark: isDark,
              icon: Icons.person_outline_rounded,
              title: 'Profile',
              subtitle: 'View and manage your profile',
              fg: fg,
              sub: sub,
              onTap: () async {
                Navigator.of(context).maybePop();
                await _openProfile(context);
              },
            ),
            _menuRow(
              isDark: isDark,
              icon: Icons.settings_outlined,
              title: 'Settings',
              subtitle: 'App preferences and data controls',
              fg: fg,
              sub: sub,
              onTap: () async {
                Navigator.of(context).maybePop();
                await _openSettings(context);
              },
            ),
            _menuRow(
              isDark: isDark,
              icon: Icons.logout_rounded,
              title: 'Logout',
              subtitle: 'Sign out from your account',
              fg: const Color(0xFFFF3B30),
              sub: isDark ? const Color(0xFFFFB3AE) : const Color(0xFFB3261E),
              danger: true,
              onTap: () async {
                Navigator.of(context).maybePop();
                await onLogout();
              },
            ),

            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Widget _menuRow({
    required bool isDark,
    required IconData icon,
    required String title,
    required String subtitle,
    required Color fg,
    required Color sub,
    required Future<void> Function() onTap,
    bool danger = false,
  }) {
    final bgHover = isDark ? Colors.white10 : Colors.black.withOpacity(0.04);

    return InkWell(
      onTap: () async {
        HapticFeedback.selectionClick();
        await onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        color: Colors.transparent,
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: danger
                    ? const Color(0xFFFF3B30).withOpacity(0.12)
                    : bgHover,
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 20, color: fg),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: fg,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 12.5,
                      color: sub,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: sub),
          ],
        ),
      ),
    );
  }
}

class ModernDrawerIconCircleBtn extends StatelessWidget {
  const ModernDrawerIconCircleBtn({
    super.key,
    required this.isDark,
    required this.icon,
    required this.onTap,
    this.size = 40,
    this.iconSize = 20,
  });

  final bool isDark;
  final IconData icon;
  final VoidCallback onTap;
  final double size;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final border = isDark ? Colors.white.withOpacity(0.12) : Colors.black12;
    final bg = isDark
        ? Colors.white.withOpacity(0.08)
        : Colors.black.withOpacity(0.06);
    final fg = isDark ? Colors.white : Colors.black87;

    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: bg,
          shape: BoxShape.circle,
          border: Border.all(color: border),
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: iconSize, color: fg),
      ),
    );
  }
}
