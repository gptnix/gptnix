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
import 'package:cloud_firestore/cloud_firestore.dart';

class ModernProfileSettingsWidget extends StatefulWidget {
  const ModernProfileSettingsWidget({
    super.key,
    this.width,
    this.height,
    required this.userDoc,
    this.currentLanguage,
    this.isDarkMode,
    // Navigation callbacks
    this.onBack,
    this.onEditProfile,
    this.onPersonalization,
    this.onVoiceSettings,
    this.onSubscription,
    this.onPricingPlans,
    this.onLanguage,
    this.onDataControl,
    this.onPrivacyPolicy,
    this.onTermsOfUse,
    this.onSignOut,
  });

  final double? width;
  final double? height;
  final DocumentReference userDoc;

  /// Current language code (e.g., 'en', 'hr')
  final String? currentLanguage;

  /// Current dark mode state
  final bool? isDarkMode;

  final Future Function()? onBack;
  final Future Function()? onEditProfile;
  final Future Function()? onPersonalization;
  final Future Function()? onVoiceSettings;
  final Future Function()? onSubscription;
  final Future Function()? onPricingPlans;
  final Future Function()? onLanguage;
  final Future Function()? onDataControl;
  final Future Function()? onPrivacyPolicy;
  final Future Function()? onTermsOfUse;
  final Future Function()? onSignOut;

  @override
  State<ModernProfileSettingsWidget> createState() =>
      _ModernProfileSettingsWidgetState();
}

class _ModernProfileSettingsWidgetState
    extends State<ModernProfileSettingsWidget> {
  bool _isDarkMode = false;
  String _currentLanguage = 'en';

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  void _loadSettings() {
    // Read from parameters or use defaults
    _isDarkMode = widget.isDarkMode ?? false;
    _currentLanguage = widget.currentLanguage ?? 'en';
  }

  void _toggleDarkMode(bool value) {
    setState(() => _isDarkMode = value);
    // Note: This only affects widget state.
    // Use FlutterFlow's setDarkModeSetting action for app-wide dark mode.
  }

  String _getLanguageName(String code) {
    const languages = {
      'en': 'English',
      'hr': 'Hrvatski',
      'de': 'Deutsch',
      'es': 'Español',
      'fr': 'Français',
      'it': 'Italiano',
      'pt': 'Português',
      'ru': 'Русский',
      'zh': '中文',
      'ja': '日本語',
      'ko': '한국어',
      'ar': 'العربية',
      'bs': 'Bosanski',
      'sr': 'Српски',
    };
    return languages[code] ?? code.toUpperCase();
  }

  String _getUserInitials(Map<String, dynamic>? userData) {
    if (userData == null) return 'U';

    final firstName = userData['first_name']?.toString() ?? '';
    final lastName = userData['last_name']?.toString() ?? '';
    final displayName = userData['display_name']?.toString() ?? '';

    if (firstName.isNotEmpty && lastName.isNotEmpty) {
      return '${firstName[0]}${lastName[0]}'.toUpperCase();
    }
    if (displayName.isNotEmpty) {
      final parts = displayName.split(' ');
      if (parts.length >= 2) {
        return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      }
      return displayName[0].toUpperCase();
    }
    if (firstName.isNotEmpty) return firstName[0].toUpperCase();

    return 'U';
  }

  String _getDisplayName(Map<String, dynamic>? userData) {
    if (userData == null) return 'User';

    final firstName = userData['first_name']?.toString() ?? '';
    final lastName = userData['last_name']?.toString() ?? '';
    final displayName = userData['display_name']?.toString() ?? '';

    if (firstName.isNotEmpty && lastName.isNotEmpty) {
      return '$firstName $lastName';
    }
    if (displayName.isNotEmpty) return displayName;
    if (firstName.isNotEmpty) return firstName;

    return 'User';
  }

  String _getUsername(Map<String, dynamic>? userData) {
    if (userData == null) return '';
    return userData['username']?.toString() ??
        userData['display_name']
            ?.toString()
            ?.toLowerCase()
            .replaceAll(' ', '_') ??
        '';
  }

  String _getEmail(Map<String, dynamic>? userData) {
    return userData?['email']?.toString() ?? '';
  }

  String _getPhoneNumber(Map<String, dynamic>? userData) {
    return userData?['phone_number']?.toString() ?? '';
  }

  String _getSubscriptionPlan(Map<String, dynamic>? userData) {
    return userData?['subscription_plan']?.toString() ?? 'Free';
  }

  Future<void> _handleSignOut() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Sign Out',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : const Color(0xFF1A1A1A),
          ),
        ),
        content: Text(
          'Are you sure you want to sign out?',
          style: GoogleFonts.inter(
            fontSize: 15,
            color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Cancel',
              style: GoogleFonts.inter(
                color:
                    isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              'Sign Out',
              style: GoogleFonts.inter(
                fontWeight: FontWeight.w600,
                color: const Color(0xFFFF3B30),
              ),
            ),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await widget.onSignOut?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? const Color(0xFF0D0D0D) : const Color(0xFFFAFAFA),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(isDark),
            Expanded(
              child: FutureBuilder<DocumentSnapshot>(
                future: widget.userDoc.get(),
                builder: (context, snapshot) {
                  final userData =
                      snapshot.data?.data() as Map<String, dynamic>?;

                  return SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 8),

                        // Profile Card
                        _buildProfileCard(isDark, userData),
                        const SizedBox(height: 24),

                        // My GPTNiX Section
                        _buildSectionTitle('My GPTNiX', isDark),
                        const SizedBox(height: 8),
                        _buildSettingsCard(isDark, [
                          _SettingsTile(
                            icon: Icons.person_outline_rounded,
                            title: 'Personalization',
                            subtitle: 'Customize your AI experience',
                            onTap: () => widget.onPersonalization?.call(),
                            isDark: isDark,
                          ),
                          _SettingsTile(
                            icon: Icons.mic_outlined,
                            title: 'Voice',
                            subtitle: 'Voice chat settings',
                            onTap: () => widget.onVoiceSettings?.call(),
                            isDark: isDark,
                          ),
                        ]),
                        const SizedBox(height: 24),

                        // Account Section
                        _buildSectionTitle('Account', isDark),
                        const SizedBox(height: 8),
                        _buildSettingsCard(isDark, [
                          _SettingsTile(
                            icon: Icons.workspace_premium_outlined,
                            title: 'Subscription',
                            subtitle: _getSubscriptionPlan(userData),
                            onTap: () => widget.onSubscription?.call(),
                            isDark: isDark,
                          ),
                          _SettingsTile(
                            icon: Icons.diamond_outlined,
                            title: 'Upgrade Plan',
                            subtitle: 'View available plans',
                            onTap: () => widget.onPricingPlans?.call(),
                            isDark: isDark,
                          ),
                          _SettingsTile(
                            icon: Icons.email_outlined,
                            title: 'Email',
                            subtitle: _getEmail(userData).isNotEmpty
                                ? _getEmail(userData)
                                : 'Not set',
                            showChevron: false,
                            isDark: isDark,
                          ),
                          if (_getPhoneNumber(userData).isNotEmpty)
                            _SettingsTile(
                              icon: Icons.phone_outlined,
                              title: 'Phone',
                              subtitle: _getPhoneNumber(userData),
                              showChevron: false,
                              isDark: isDark,
                            ),
                        ]),
                        const SizedBox(height: 24),

                        // App Settings Section
                        _buildSectionTitle('App Settings', isDark),
                        const SizedBox(height: 8),
                        _buildSettingsCard(isDark, [
                          _SettingsToggle(
                            icon: Icons.dark_mode_outlined,
                            title: 'Dark Mode',
                            subtitle: _isDarkMode ? 'On' : 'Off',
                            value: _isDarkMode,
                            onChanged: _toggleDarkMode,
                            isDark: isDark,
                          ),
                          _SettingsTile(
                            icon: Icons.language_outlined,
                            title: 'Language',
                            subtitle: _getLanguageName(_currentLanguage),
                            onTap: () => widget.onLanguage?.call(),
                            isDark: isDark,
                          ),
                          _SettingsTile(
                            icon: Icons.storage_outlined,
                            title: 'Data Controls',
                            subtitle: 'Manage your data',
                            onTap: () => widget.onDataControl?.call(),
                            isDark: isDark,
                          ),
                        ]),
                        const SizedBox(height: 24),

                        // Legal Section
                        _buildSectionTitle('Legal', isDark),
                        const SizedBox(height: 8),
                        _buildSettingsCard(isDark, [
                          _SettingsTile(
                            icon: Icons.shield_outlined,
                            title: 'Privacy Policy',
                            onTap: () => widget.onPrivacyPolicy?.call(),
                            isDark: isDark,
                          ),
                          _SettingsTile(
                            icon: Icons.description_outlined,
                            title: 'Terms of Use',
                            onTap: () => widget.onTermsOfUse?.call(),
                            isDark: isDark,
                          ),
                        ]),
                        const SizedBox(height: 24),

                        // About Section
                        _buildSectionTitle('About', isDark),
                        const SizedBox(height: 8),
                        _buildAboutCard(isDark),
                        const SizedBox(height: 24),

                        // Sign Out Button
                        _buildSignOutButton(isDark),
                        const SizedBox(height: 40),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
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

  Widget _buildProfileCard(bool isDark, Map<String, dynamic>? userData) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: Column(
        children: [
          // Avatar
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(40),
            ),
            child: Center(
              child: Text(
                _getUserInitials(userData),
                style: GoogleFonts.inter(
                  fontSize: 28,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Name
          Text(
            _getDisplayName(userData),
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
          ),

          // Username
          if (_getUsername(userData).isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '@${_getUsername(userData)}',
              style: GoogleFonts.inter(
                fontSize: 14,
                color:
                    isDark ? const Color(0xFF6B6B6B) : const Color(0xFF8E8E93),
              ),
            ),
          ],
          const SizedBox(height: 16),

          // Edit Profile Button
          GestureDetector(
            onTap: () => widget.onEditProfile?.call(),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF3A3A3A)
                      : const Color(0xFFD5D5D5),
                ),
              ),
              child: Text(
                'Edit profile',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                ),
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
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _buildSettingsCard(bool isDark, List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: Column(
        children: children.asMap().entries.map((entry) {
          final index = entry.key;
          final child = entry.value;
          final isLast = index == children.length - 1;

          return Column(
            children: [
              child,
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

  Widget _buildAboutCard(bool isDark) {
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
          // App Icon
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                'N',
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
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
                  'GPTNiX',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Version 1.0.0',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: isDark
                        ? const Color(0xFF6B6B6B)
                        : const Color(0xFF8E8E93),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignOutButton(bool isDark) {
    return GestureDetector(
      onTap: _handleSignOut,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: const Color(0xFFFF3B30).withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFFFF3B30).withOpacity(0.2),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.logout_rounded,
              size: 20,
              color: Color(0xFFFF3B30),
            ),
            const SizedBox(width: 8),
            Text(
              'Sign Out',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: const Color(0xFFFF3B30),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────
// SETTINGS TILE WIDGET
// ─────────────────────────────────────────
class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool showChevron;
  final bool isDark;

  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.showChevron = true,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
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
                  icon,
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
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
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
              if (showChevron && onTap != null)
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
}

// ─────────────────────────────────────────
// SETTINGS TOGGLE WIDGET
// ─────────────────────────────────────────
class _SettingsToggle extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool isDark;

  const _SettingsToggle({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.value,
    required this.onChanged,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              size: 20,
              color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
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
          Transform.scale(
            scale: 0.85,
            child: Switch(
              value: value,
              onChanged: onChanged,
              activeColor: Colors.white,
              activeTrackColor: isDark ? Colors.white : const Color(0xFF1A1A1A),
              inactiveThumbColor:
                  isDark ? const Color(0xFF6B6B6B) : Colors.white,
              inactiveTrackColor:
                  isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
            ),
          ),
        ],
      ),
    );
  }
}
