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

import 'package:google_fonts/google_fonts.dart';

class ModernDataControlWidget extends StatefulWidget {
  const ModernDataControlWidget({
    super.key,
    this.width,
    this.height,
    this.onBack,
    this.onArchivedChats,
    this.onClearChatHistory,
    this.onExportData,
    this.useContentForTraining,
  });

  final double? width;
  final double? height;
  final Future Function()? onBack;
  final Future Function()? onArchivedChats;
  final Future Function()? onClearChatHistory;
  final Future Function()? onExportData;

  /// Initial state for "Use My Content to Train Model" toggle
  final bool? useContentForTraining;

  @override
  State<ModernDataControlWidget> createState() =>
      _ModernDataControlWidgetState();
}

class _ModernDataControlWidgetState extends State<ModernDataControlWidget> {
  late bool _useContentForTraining;
  bool _isClearing = false;
  bool _isExporting = false;

  @override
  void initState() {
    super.initState();
    _useContentForTraining = widget.useContentForTraining ?? false;
  }

  Future<void> _handleClearHistory() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Clear Chat History',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: const Color(0xFFFF3B30),
          ),
        ),
        content: Text(
          'This will permanently delete all your conversations. This action cannot be undone.',
          style: GoogleFonts.inter(
            fontSize: 15,
            height: 1.4,
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
              'Clear All',
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
      setState(() => _isClearing = true);
      try {
        await widget.onClearChatHistory?.call();
        if (mounted) {
          _showSnackbar('Chat history cleared', isSuccess: true);
        }
      } catch (e) {
        if (mounted) {
          _showSnackbar('Error clearing history', isSuccess: false);
        }
      } finally {
        if (mounted) setState(() => _isClearing = false);
      }
    }
  }

  Future<void> _handleExportData() async {
    setState(() => _isExporting = true);
    try {
      await widget.onExportData?.call();
      if (mounted) {
        _showSnackbar('Export started. You\'ll receive an email shortly.',
            isSuccess: true);
      }
    } catch (e) {
      if (mounted) {
        _showSnackbar('Error exporting data', isSuccess: false);
      }
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  void _showSnackbar(String message, {required bool isSuccess}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.inter(fontSize: 14)),
        backgroundColor:
            isSuccess ? const Color(0xFF34C759) : const Color(0xFFFF3B30),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 3),
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
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),

                    // Training Data Section
                    _buildSectionTitle('AI Training', isDark),
                    const SizedBox(height: 8),
                    _buildSettingsCard(isDark, [
                      _buildToggleTile(
                        isDark,
                        icon: Icons.model_training_outlined,
                        title: 'Use My Content to Train Model',
                        subtitle:
                            'Help improve AI by allowing your conversations to be used for training',
                        value: _useContentForTraining,
                        onChanged: (value) {
                          setState(() => _useContentForTraining = value);
                          // You can add a callback here to save to backend
                        },
                      ),
                    ]),
                    const SizedBox(height: 24),

                    // Chat Management Section
                    _buildSectionTitle('Chat Management', isDark),
                    const SizedBox(height: 8),
                    _buildSettingsCard(isDark, [
                      _buildNavigationTile(
                        isDark,
                        icon: Icons.archive_outlined,
                        title: 'Archived Chats',
                        subtitle: 'View your archived conversations',
                        onTap: () => widget.onArchivedChats?.call(),
                      ),
                    ]),
                    const SizedBox(height: 24),

                    // Danger Zone Section
                    _buildSectionTitle('Danger Zone', isDark,
                        isDestructive: true),
                    const SizedBox(height: 8),
                    _buildDangerCard(isDark, [
                      _buildDangerTile(
                        isDark,
                        icon: Icons.delete_sweep_outlined,
                        title: 'Clear Chat History',
                        subtitle: 'Permanently delete all conversations',
                        onTap: _handleClearHistory,
                        isLoading: _isClearing,
                      ),
                    ]),
                    const SizedBox(height: 24),

                    // Export Section
                    _buildSectionTitle('Your Data', isDark),
                    const SizedBox(height: 8),
                    _buildSettingsCard(isDark, [
                      _buildNavigationTile(
                        isDark,
                        icon: Icons.download_outlined,
                        title: 'Export Data',
                        subtitle: 'Download a copy of all your data',
                        onTap: _handleExportData,
                        isLoading: _isExporting,
                      ),
                    ]),

                    const SizedBox(height: 24),

                    // Info Card
                    _buildInfoCard(isDark),

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
              'Data Controls',
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
        title.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 11,
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

  Widget _buildDangerCard(bool isDark, List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFFF3B30).withOpacity(0.3),
        ),
      ),
      child: Column(children: children),
    );
  }

  Widget _buildToggleTile(
    bool isDark, {
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
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
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    height: 1.4,
                    color: isDark
                        ? const Color(0xFF6B6B6B)
                        : const Color(0xFF8E8E93),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
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

  Widget _buildNavigationTile(
    bool isDark, {
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
    bool isLoading = false,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isLoading ? null : onTap,
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
                        subtitle,
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

  Widget _buildDangerTile(
    bool isDark, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isLoading = false,
  }) {
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
                  color: const Color(0xFFFF3B30).withOpacity(0.1),
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
                        color: const Color(0xFFFF3B30),
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
              if (isLoading)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor:
                        AlwaysStoppedAnimation<Color>(Color(0xFFFF3B30)),
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

  Widget _buildInfoCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              Icons.info_outline_rounded,
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
                  'About Your Data',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Your conversations are encrypted and securely stored. We never sell your personal data to third parties. You can delete your data at any time.',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    height: 1.5,
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
}
