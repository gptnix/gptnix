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

import '/auth/firebase_auth/auth_util.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:firebase_auth/firebase_auth.dart'; // ✅ FIX: za signOut()

class ModernProfileWidget extends StatefulWidget {
  const ModernProfileWidget({
    super.key,
    this.width,
    this.height,
    this.onBack,
    this.onEditProfile,
    this.onSubscription,
    this.onPersonalization,
    this.onDataControl,
    this.onNotifications,
    this.onTerms,
    this.onPrivacy,
    this.onHelp,
    this.onFeedback,
    this.onLogout,
    this.onDeleteAccount,
    this.appVersion,
    this.subscriptionPlan,
  });

  final double? width;
  final double? height;

  // Navigation callbacks
  final Future Function()? onBack;
  final Future Function()? onEditProfile;
  final Future Function()? onSubscription;
  final Future Function()? onPersonalization;
  final Future Function()? onDataControl;
  final Future Function()? onNotifications;
  final Future Function()? onTerms;
  final Future Function()? onPrivacy;
  final Future Function()? onHelp;
  final Future Function()? onFeedback;
  final Future Function()? onLogout;
  final Future Function()? onDeleteAccount;

  // Data
  final String? appVersion;
  final String? subscriptionPlan;

  @override
  State<ModernProfileWidget> createState() => _ModernProfileWidgetState();
}

class _ModernProfileWidgetState extends State<ModernProfileWidget> {
  bool _isLoggingOut = false;

  String get _userName =>
      currentUserDisplayName.isNotEmpty ? currentUserDisplayName : 'User';

  String get _userEmail =>
      currentUserEmail.isNotEmpty ? currentUserEmail : 'No email';

  String get _userInitials {
    final name = _userName;
    if (name.isEmpty) return 'U';
    final parts = name.split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  // ✅ FIX: authManager nije dostupan u custom widgetu -> koristimo FirebaseAuth direktno
  Future<void> _ffSignOut() async {
    await FirebaseAuth.instance.signOut();
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => _LogoutDialog(),
    );

    if (confirmed == true) {
      setState(() => _isLoggingOut = true);
      try {
        await _ffSignOut(); // ✅ umjesto authManager.signOut()
        await widget.onLogout?.call();
      } finally {
        if (mounted) setState(() => _isLoggingOut = false);
      }
    }
  }

  Future<void> _handleDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => _DeleteAccountDialog(),
    );

    if (confirmed == true) {
      await widget.onDeleteAccount?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      width: widget.width ?? double.infinity,
      height: widget.height ?? double.infinity,
      child: Scaffold(
        backgroundColor:
            isDark ? const Color(0xFF0D0D0D) : const Color(0xFFFAFAFA),
        body: SafeArea(
          child: Column(
            children: [
              // Header
              _buildHeader(isDark),

              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 24),

                      // Profile Card
                      _buildProfileCard(isDark),
                      const SizedBox(height: 32),

                      // Account Section
                      _buildSectionTitle('Account', isDark),
                      const SizedBox(height: 12),
                      _buildSettingsCard(isDark, [
                        _SettingsItem(
                          icon: Icons.workspace_premium_outlined,
                          title: 'Subscription',
                          subtitle: widget.subscriptionPlan ?? 'Free',
                          onTap: () => widget.onSubscription?.call(),
                          showChevron: true,
                        ),
                        _SettingsItem(
                          icon: Icons.person_outline_rounded,
                          title: 'Edit Profile',
                          onTap: () => widget.onEditProfile?.call(),
                          showChevron: true,
                        ),
                      ]),
                      const SizedBox(height: 24),

                      // Preferences Section
                      _buildSectionTitle('Preferences', isDark),
                      const SizedBox(height: 12),
                      _buildSettingsCard(isDark, [
                        _SettingsItem(
                          icon: Icons.palette_outlined,
                          title: 'Personalization',
                          subtitle: 'Theme, colors, chat style',
                          onTap: () => widget.onPersonalization?.call(),
                          showChevron: true,
                        ),
                        _SettingsItem(
                          icon: Icons.notifications_none_rounded,
                          title: 'Notifications',
                          onTap: () => widget.onNotifications?.call(),
                          showChevron: true,
                        ),
                      ]),
                      const SizedBox(height: 24),

                      // Data & Privacy Section
                      _buildSectionTitle('Data & Privacy', isDark),
                      const SizedBox(height: 12),
                      _buildSettingsCard(isDark, [
                        _SettingsItem(
                          icon: Icons.storage_outlined,
                          title: 'Data Control',
                          subtitle: 'Manage your data',
                          onTap: () => widget.onDataControl?.call(),
                          showChevron: true,
                        ),
                        _SettingsItem(
                          icon: Icons.shield_outlined,
                          title: 'Privacy Policy',
                          onTap: () => widget.onPrivacy?.call(),
                          showChevron: true,
                        ),
                        _SettingsItem(
                          icon: Icons.description_outlined,
                          title: 'Terms of Service',
                          onTap: () => widget.onTerms?.call(),
                          showChevron: true,
                        ),
                      ]),
                      const SizedBox(height: 24),

                      // Support Section
                      _buildSectionTitle('Support', isDark),
                      const SizedBox(height: 12),
                      _buildSettingsCard(isDark, [
                        _SettingsItem(
                          icon: Icons.help_outline_rounded,
                          title: 'Help Center',
                          onTap: () => widget.onHelp?.call(),
                          showChevron: true,
                        ),
                        _SettingsItem(
                          icon: Icons.chat_bubble_outline_rounded,
                          title: 'Send Feedback',
                          onTap: () => widget.onFeedback?.call(),
                          showChevron: true,
                        ),
                        _SettingsItem(
                          icon: Icons.info_outline_rounded,
                          title: 'App Version',
                          subtitle: widget.appVersion ?? '1.0.0',
                          onTap: null,
                          showChevron: false,
                        ),
                      ]),
                      const SizedBox(height: 32),

                      // Logout Button
                      _buildLogoutButton(isDark),
                      const SizedBox(height: 16),

                      // Delete Account
                      _buildDeleteAccountButton(isDark),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => widget.onBack?.call(),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5),
                ),
              ),
              child: Icon(
                Icons.arrow_back_rounded,
                size: 20,
                color: isDark ? Colors.white : const Color(0xFF1A1A1A),
              ),
            ),
          ),
          Expanded(
            child: Text(
              'Settings',
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : const Color(0xFF1A1A1A),
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 40),
        ],
      ),
    );
  }

  Widget _buildProfileCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                _userInitials,
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _userName,
                  style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  _userEmail,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    color: isDark
                        ? const Color(0xFF8E8E93)
                        : const Color(0xFF6B6B6B),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => widget.onEditProfile?.call(),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color:
                    isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.edit_outlined,
                size: 18,
                color:
                    isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: isDark ? const Color(0xFF6B6B6B) : const Color(0xFF8E8E93),
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildSettingsCard(bool isDark, List<_SettingsItem> items) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: Column(
        children: items.asMap().entries.map((entry) {
          final index = entry.key;
          final item = entry.value;
          final isLast = index == items.length - 1;

          return Column(
            children: [
              _buildSettingsItem(item, isDark),
              if (!isLast)
                Divider(
                  height: 1,
                  indent: 56,
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5),
                ),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSettingsItem(_SettingsItem item, bool isDark) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: item.onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFF5F5F5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  item.icon,
                  size: 20,
                  color: isDark
                      ? const Color(0xFF8E8E93)
                      : const Color(0xFF6B6B6B),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                      ),
                    ),
                    if (item.subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        item.subtitle!,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: isDark
                              ? const Color(0xFF6B6B6B)
                              : const Color(0xFF8E8E93),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (item.showChevron)
                Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: isDark
                      ? const Color(0xFF4A4A4A)
                      : const Color(0xFFCCCCCC),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLogoutButton(bool isDark) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _isLoggingOut ? null : _handleLogout,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
            ),
          ),
          child: Center(
            child: _isLoggingOut
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isDark ? Colors.white : const Color(0xFF1A1A1A),
                      ),
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.logout_rounded,
                        size: 20,
                        color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Log Out',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color:
                              isDark ? Colors.white : const Color(0xFF1A1A1A),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildDeleteAccountButton(bool isDark) {
    return Center(
      child: GestureDetector(
        onTap: _handleDeleteAccount,
        child: Text(
          'Delete Account',
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: const Color(0xFFFF3B30),
          ),
        ),
      ),
    );
  }
}

class _SettingsItem {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool showChevron;

  _SettingsItem({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.showChevron = true,
  });
}

class _LogoutDialog extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AlertDialog(
      backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(
        'Log Out',
        style: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: isDark ? Colors.white : const Color(0xFF1A1A1A),
        ),
      ),
      content: Text(
        'Are you sure you want to log out?',
        style: GoogleFonts.inter(
          fontSize: 15,
          color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(
            'Cancel',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
            ),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(
            'Log Out',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: const Color(0xFFFF3B30),
            ),
          ),
        ),
      ],
    );
  }
}

class _DeleteAccountDialog extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AlertDialog(
      backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(
        'Delete Account',
        style: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: const Color(0xFFFF3B30),
        ),
      ),
      content: Text(
        'This action cannot be undone. All your data will be permanently deleted.',
        style: GoogleFonts.inter(
          fontSize: 15,
          color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(
            'Cancel',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w500,
              color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
            ),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(
            'Delete',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: const Color(0xFFFF3B30),
            ),
          ),
        ),
      ],
    );
  }
}
