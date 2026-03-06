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
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

class ModernSettingsWidget extends StatefulWidget {
  const ModernSettingsWidget({
    super.key,
    this.width,
    this.height,
    this.onBack,
    this.onClearHistory,
    this.onExportData,
    this.onDeactivateAccount,
    this.onDeleteAccount,
    this.onPrivacyPolicy,
    this.onTermsOfService,
    this.appVersion,
  });

  final double? width;
  final double? height;

  final Future Function()? onBack;
  final Future Function()? onClearHistory;
  final Future Function()? onExportData;
  final Future Function()? onDeactivateAccount;
  final Future Function()? onDeleteAccount;
  final Future Function()? onPrivacyPolicy;
  final Future Function()? onTermsOfService;
  final String? appVersion;

  @override
  State<ModernSettingsWidget> createState() => _ModernSettingsWidgetState();
}

class _ModernSettingsWidgetState extends State<ModernSettingsWidget> {
  bool _isClearing = false;
  bool _isExporting = false;

  Future<void> _handleClearHistory() async {
    final confirmed = await _showConfirmDialog(
      title: 'Clear Chat History',
      message:
          'This will permanently delete all your conversations. This action cannot be undone.',
      confirmText: 'Clear All',
      isDestructive: true,
    );

    if (confirmed == true) {
      setState(() => _isClearing = true);
      try {
        await widget.onClearHistory?.call();
        _showSuccessSnackbar('Chat history cleared');
      } finally {
        if (mounted) setState(() => _isClearing = false);
      }
    }
  }

  Future<void> _handleExportData() async {
    setState(() => _isExporting = true);
    try {
      await widget.onExportData?.call();
      _showSuccessSnackbar(
          'Data export started. You\'ll receive an email shortly.');
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  Future<void> _handleDeactivateAccount() async {
    final confirmed = await _showConfirmDialog(
      title: 'Deactivate Account',
      message:
          'Your account will be temporarily disabled. You can reactivate it by signing in again.',
      confirmText: 'Deactivate',
      isDestructive: false,
    );

    if (confirmed == true) {
      await widget.onDeactivateAccount?.call();
    }
  }

  Future<void> _handleDeleteAccount() async {
    final confirmed = await _showConfirmDialog(
      title: 'Delete Account',
      message:
          'This will permanently delete your account and all associated data. This action cannot be undone.',
      confirmText: 'Delete Forever',
      isDestructive: true,
    );

    if (confirmed == true) {
      // Second confirmation for delete
      final doubleConfirmed = await _showConfirmDialog(
        title: 'Are you absolutely sure?',
        message: 'Type "DELETE" to confirm permanent account deletion.',
        confirmText: 'Delete My Account',
        isDestructive: true,
        requiresTextConfirmation: true,
      );

      if (doubleConfirmed == true) {
        await widget.onDeleteAccount?.call();
      }
    }
  }

  Future<bool?> _showConfirmDialog({
    required String title,
    required String message,
    required String confirmText,
    required bool isDestructive,
    bool requiresTextConfirmation = false,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) => _ConfirmDialog(
        title: title,
        message: message,
        confirmText: confirmText,
        isDestructive: isDestructive,
        requiresTextConfirmation: requiresTextConfirmation,
      ),
    );
  }

  void _showSuccessSnackbar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: GoogleFonts.inter(fontSize: 14),
        ),
        backgroundColor: const Color(0xFF34C759),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
      ),
    );
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
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 24),

                    // Data Management Section
                    _buildSectionTitle('Data Management', isDark),
                    const SizedBox(height: 12),
                    _buildSettingsCard(isDark, [
                      _SettingsTile(
                        icon: Icons.download_outlined,
                        title: 'Export My Data',
                        subtitle: 'Download a copy of your data',
                        onTap: _handleExportData,
                        isLoading: _isExporting,
                        isDark: isDark,
                      ),
                      _SettingsTile(
                        icon: Icons.delete_sweep_outlined,
                        title: 'Clear Chat History',
                        subtitle: 'Delete all conversations',
                        onTap: _handleClearHistory,
                        isLoading: _isClearing,
                        isDark: isDark,
                      ),
                    ]),
                    const SizedBox(height: 32),

                    // Legal Section
                    _buildSectionTitle('Legal', isDark),
                    const SizedBox(height: 12),
                    _buildSettingsCard(isDark, [
                      _SettingsTile(
                        icon: Icons.shield_outlined,
                        title: 'Privacy Policy',
                        onTap: () => widget.onPrivacyPolicy?.call(),
                        isDark: isDark,
                      ),
                      _SettingsTile(
                        icon: Icons.description_outlined,
                        title: 'Terms of Service',
                        onTap: () => widget.onTermsOfService?.call(),
                        isDark: isDark,
                      ),
                    ]),
                    const SizedBox(height: 32),

                    // Danger Zone
                    _buildSectionTitle('Danger Zone', isDark,
                        isDestructive: true),
                    const SizedBox(height: 12),
                    _buildDangerCard(isDark),
                    const SizedBox(height: 32),

                    // App Info
                    _buildAppInfo(isDark),
                    const SizedBox(height: 40),
                  ],
                ),
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

  Widget _buildSectionTitle(String title, bool isDark,
      {bool isDestructive = false}) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: isDestructive
              ? const Color(0xFFFF3B30)
              : (isDark ? const Color(0xFF6B6B6B) : const Color(0xFF8E8E93)),
          letterSpacing: 0.5,
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

  Widget _buildDangerCard(bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFFF3B30).withOpacity(0.3),
        ),
      ),
      child: Column(
        children: [
          _DangerTile(
            icon: Icons.pause_circle_outline_rounded,
            title: 'Deactivate Account',
            subtitle: 'Temporarily disable your account',
            onTap: _handleDeactivateAccount,
            isDark: isDark,
          ),
          Divider(
            height: 1,
            indent: 56,
            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
          ),
          _DangerTile(
            icon: Icons.delete_forever_outlined,
            title: 'Delete Account',
            subtitle: 'Permanently delete your account and data',
            onTap: _handleDeleteAccount,
            isDark: isDark,
            isHighRisk: true,
          ),
        ],
      ),
    );
  }

  Widget _buildAppInfo(bool isDark) {
    return Center(
      child: Column(
        children: [
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
          const SizedBox(height: 12),
          Text(
            'GPTNiX',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Version ${widget.appVersion ?? '1.0.0'}',
            style: GoogleFonts.inter(
              fontSize: 13,
              color: isDark ? const Color(0xFF6B6B6B) : const Color(0xFF8E8E93),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final bool isLoading;
  final bool isDark;

  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.isLoading = false,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isLoading ? null : onTap,
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
              if (isLoading)
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      isDark ? Colors.white : const Color(0xFF1A1A1A),
                    ),
                  ),
                )
              else
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

class _DangerTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool isDark;
  final bool isHighRisk;

  const _DangerTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.isDark,
    this.isHighRisk = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFFF3B30)
                      .withOpacity(isHighRisk ? 0.15 : 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: const Color(0xFFFF3B30),
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
                        color: isHighRisk
                            ? const Color(0xFFFF3B30)
                            : (isDark ? Colors.white : const Color(0xFF1A1A1A)),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
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
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color:
                    isDark ? const Color(0xFF4A4A4A) : const Color(0xFFCCCCCC),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConfirmDialog extends StatefulWidget {
  final String title;
  final String message;
  final String confirmText;
  final bool isDestructive;
  final bool requiresTextConfirmation;

  const _ConfirmDialog({
    required this.title,
    required this.message,
    required this.confirmText,
    required this.isDestructive,
    this.requiresTextConfirmation = false,
  });

  @override
  State<_ConfirmDialog> createState() => _ConfirmDialogState();
}

class _ConfirmDialogState extends State<_ConfirmDialog> {
  final _textController = TextEditingController();
  bool _canConfirm = false;

  @override
  void initState() {
    super.initState();
    _canConfirm = !widget.requiresTextConfirmation;

    if (widget.requiresTextConfirmation) {
      _textController.addListener(() {
        setState(() {
          _canConfirm = _textController.text.toUpperCase() == 'DELETE';
        });
      });
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AlertDialog(
      backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(
        widget.title,
        style: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: widget.isDestructive
              ? const Color(0xFFFF3B30)
              : (isDark ? Colors.white : const Color(0xFF1A1A1A)),
        ),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.message,
            style: GoogleFonts.inter(
              fontSize: 15,
              color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
              height: 1.4,
            ),
          ),
          if (widget.requiresTextConfirmation) ...[
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color:
                    isDark ? const Color(0xFF0D0D0D) : const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5),
                ),
              ),
              child: TextField(
                controller: _textController,
                style: GoogleFonts.inter(
                  fontSize: 15,
                  color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                ),
                decoration: InputDecoration(
                  hintText: 'Type DELETE to confirm',
                  hintStyle: GoogleFonts.inter(
                    fontSize: 15,
                    color: isDark
                        ? const Color(0xFF4A4A4A)
                        : const Color(0xFFAAAAAA),
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  border: InputBorder.none,
                ),
              ),
            ),
          ],
        ],
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
          onPressed: _canConfirm ? () => Navigator.of(context).pop(true) : null,
          child: Text(
            widget.confirmText,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: _canConfirm
                  ? (widget.isDestructive
                      ? const Color(0xFFFF3B30)
                      : (isDark ? Colors.white : const Color(0xFF1A1A1A)))
                  : (isDark
                      ? const Color(0xFF4A4A4A)
                      : const Color(0xFFCCCCCC)),
            ),
          ),
        ),
      ],
    );
  }
}
