// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/custom_code/widgets/index.dart'; // Imports other custom widgets
import '/custom_code/actions/index.dart'; // Imports custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'package:google_fonts/google_fonts.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class ModernPersonalizationWidget extends StatefulWidget {
  const ModernPersonalizationWidget({
    super.key,
    this.width,
    this.height,
    required this.userDoc,
    this.onBack,
    this.onSave,
    this.onMemories,
  });

  final double? width;
  final double? height;
  final DocumentReference userDoc;
  final Future Function()? onBack;
  final Future Function()? onSave;
  final Future Function()? onMemories;

  @override
  State<ModernPersonalizationWidget> createState() =>
      _ModernPersonalizationWidgetState();
}

class _ModernPersonalizationWidgetState
    extends State<ModernPersonalizationWidget> {
  late TextEditingController _nicknameController;
  late TextEditingController _occupationController;
  late TextEditingController _aboutYouController;
  late TextEditingController _customInstructionsController;

  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasChanges = false;
  bool _advancedExpanded = false;

  String _selectedStyle = 'default';
  final List<String> _characteristics = [];

  bool _webSearchEnabled = true;
  bool _codeEnabled = true;
  bool _imageGenEnabled = true;
  bool _voiceEnabled = false;

  // Firestore subcollection reference — matches backend preferred path:
  // users/{uid}/personalization/main
  DocumentReference get _personalizationRef =>
      widget.userDoc.collection('personalization').doc('main');

  final List<Map<String, String>> _styleOptions = [
    {'value': 'default',      'label': 'Default',      'description': 'Balanced and helpful'},
    {'value': 'concise',      'label': 'Concise',      'description': 'Brief and to the point'},
    {'value': 'detailed',     'label': 'Detailed',     'description': 'Thorough explanations'},
    {'value': 'creative',     'label': 'Creative',     'description': 'Imaginative and expressive'},
    {'value': 'professional', 'label': 'Professional', 'description': 'Formal and business-like'},
    {'value': 'casual',       'label': 'Casual',       'description': 'Friendly and relaxed'},
  ];

  final List<Map<String, dynamic>> _availableCharacteristics = [
    {'id': 'humor',       'label': 'Humorous',    'icon': Icons.sentiment_very_satisfied_outlined},
    {'id': 'direct',      'label': 'Direct',      'icon': Icons.arrow_forward_rounded},
    {'id': 'encouraging', 'label': 'Encouraging', 'icon': Icons.thumb_up_outlined},
    {'id': 'technical',   'label': 'Technical',   'icon': Icons.code_rounded},
    {'id': 'empathetic',  'label': 'Empathetic',  'icon': Icons.favorite_outline_rounded},
    {'id': 'analytical',  'label': 'Analytical',  'icon': Icons.analytics_outlined},
  ];

  @override
  void initState() {
    super.initState();
    _nicknameController = TextEditingController();
    _occupationController = TextEditingController();
    _aboutYouController = TextEditingController();
    _customInstructionsController = TextEditingController();
    _loadUserData();
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _occupationController.dispose();
    _aboutYouController.dispose();
    _customInstructionsController.dispose();
    super.dispose();
  }

  Future<void> _loadUserData() async {
    try {
      // Read from subcollection (backend preferred path)
      final doc = await _personalizationRef.get();
      Map<String, dynamic> data = {};

      if (doc.exists) {
        data = doc.data() as Map<String, dynamic>? ?? {};
      } else {
        // Fallback: check root user doc (migration from old schema)
        final userDoc = await widget.userDoc.get();
        final userData = userDoc.data() as Map<String, dynamic>?;
        if (userData != null && userData['personalization'] is Map) {
          data = Map<String, dynamic>.from(userData['personalization'] as Map);
          // Migrate: write to subcollection so next read is fast
          if (data.isNotEmpty) {
            _personalizationRef.set(data, SetOptions(merge: true)).ignore();
          }
        }
      }

      if (mounted) {
        setState(() {
          _nicknameController.text = data['nickname']?.toString() ?? '';
          _occupationController.text = data['occupation']?.toString() ?? '';
          // about_you = Flutter field name (backend accepts both)
          _aboutYouController.text = data['about_you']?.toString() ?? '';
          // custom_instructions = Flutter field name (backend accepts both)
          _customInstructionsController.text =
              data['custom_instructions']?.toString() ?? '';
          _selectedStyle = data['style']?.toString() ?? 'default';

          final chars = data['characteristics'] as List<dynamic>? ?? [];
          _characteristics
            ..clear()
            ..addAll(chars.map((e) => e.toString()));

          _webSearchEnabled = data['web_search_enabled'] as bool? ?? true;
          _codeEnabled = data['code_enabled'] as bool? ?? true;
          _imageGenEnabled = data['image_gen_enabled'] as bool? ?? true;
          _voiceEnabled = data['voice_enabled'] as bool? ?? false;

          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackbar('Error loading settings', isSuccess: false);
      }
    }
  }

  void _onFieldChanged() {
    if (!_hasChanges) setState(() => _hasChanges = true);
  }

  Future<void> _savePersonalization() async {
    setState(() => _isSaving = true);

    try {
      final data = {
        // About You
        'nickname':             _nicknameController.text.trim(),
        'occupation':           _occupationController.text.trim(),
        'about_you':            _aboutYouController.text.trim(),
        // Style
        'style':                _selectedStyle,
        'characteristics':      List<String>.from(_characteristics),
        // Custom instructions
        'custom_instructions':  _customInstructionsController.text.trim(),
        // Feature toggles
        'web_search_enabled':   _webSearchEnabled,
        'code_enabled':         _codeEnabled,
        'image_gen_enabled':    _imageGenEnabled,
        'voice_enabled':        _voiceEnabled,
        // Metadata
        'updated_at':           FieldValue.serverTimestamp(),
      };

      // Write to subcollection users/{uid}/personalization/main
      await _personalizationRef.set(data);

      if (mounted) {
        _showSnackbar('Settings saved', isSuccess: true);
        setState(() => _hasChanges = false);
        await widget.onSave?.call();
      }
    } catch (e) {
      if (mounted) _showSnackbar('Error saving settings', isSuccess: false);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _showSnackbar(String message, {required bool isSuccess}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: GoogleFonts.inter(fontSize: 14)),
        backgroundColor:
            isSuccess ? const Color(0xFF34C759) : const Color(0xFFFF3B30),
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  void _showStylePicker() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
          borderRadius:
              const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFF3A3A3A)
                    : const Color(0xFFE0E0E0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Text(
                'Base Style and Tone',
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color:
                      isDark ? Colors.white : const Color(0xFF1A1A1A),
                ),
              ),
            ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _styleOptions.length,
                itemBuilder: (context, index) {
                  final option = _styleOptions[index];
                  final isSelected = _selectedStyle == option['value'];

                  return ListTile(
                    onTap: () {
                      setState(() {
                        _selectedStyle = option['value']!;
                        _onFieldChanged();
                      });
                      Navigator.pop(context);
                    },
                    leading: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected
                              ? (isDark
                                  ? Colors.white
                                  : const Color(0xFF1A1A1A))
                              : (isDark
                                  ? const Color(0xFF3A3A3A)
                                  : const Color(0xFFE0E0E0)),
                          width: 2,
                        ),
                        color: isSelected
                            ? (isDark
                                ? Colors.white
                                : const Color(0xFF1A1A1A))
                            : Colors.transparent,
                      ),
                      child: isSelected
                          ? Icon(
                              Icons.check,
                              size: 14,
                              color: isDark
                                  ? const Color(0xFF1A1A1A)
                                  : Colors.white,
                            )
                          : null,
                    ),
                    title: Text(
                      option['label']!,
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: isDark
                            ? Colors.white
                            : const Color(0xFF1A1A1A),
                      ),
                    ),
                    subtitle: Text(
                      option['description']!,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        color: isDark
                            ? const Color(0xFF6B6B6B)
                            : const Color(0xFF8E8E93),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  void _showCharacteristicsPicker() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF3A3A3A)
                      : const Color(0xFFE0E0E0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'Add Characteristics',
                  style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? Colors.white
                        : const Color(0xFF1A1A1A),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children:
                      _availableCharacteristics.map((char) {
                    final isSelected =
                        _characteristics.contains(char['id']);
                    return GestureDetector(
                      onTap: () {
                        setModalState(() {
                          if (isSelected) {
                            _characteristics.remove(char['id']);
                          } else {
                            _characteristics.add(char['id'] as String);
                          }
                        });
                        setState(() => _onFieldChanged());
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? (isDark
                                  ? Colors.white
                                  : const Color(0xFF1A1A1A))
                              : (isDark
                                  ? const Color(0xFF2A2A2A)
                                  : const Color(0xFFF5F5F5)),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isSelected
                                ? Colors.transparent
                                : (isDark
                                    ? const Color(0xFF3A3A3A)
                                    : const Color(0xFFE5E5E5)),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              char['icon'] as IconData,
                              size: 18,
                              color: isSelected
                                  ? (isDark
                                      ? const Color(0xFF1A1A1A)
                                      : Colors.white)
                                  : (isDark
                                      ? const Color(0xFF8E8E93)
                                      : const Color(0xFF6B6B6B)),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              char['label'] as String,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: isSelected
                                    ? (isDark
                                        ? const Color(0xFF1A1A1A)
                                        : Colors.white)
                                    : (isDark
                                        ? Colors.white
                                        : const Color(0xFF1A1A1A)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
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
              child: _isLoading
                  ? _buildLoadingState(isDark)
                  : SingleChildScrollView(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 8),
                          _buildSectionTitle('Style & Tone', isDark),
                          const SizedBox(height: 8),
                          _buildStyleSelector(isDark),
                          const SizedBox(height: 8),
                          _buildHelperText(
                              'This is the main voice and tone GPTNiX uses in your conversations.',
                              isDark),
                          const SizedBox(height: 24),
                          _buildSectionTitle('Characteristics', isDark),
                          const SizedBox(height: 8),
                          _buildCharacteristicsSelector(isDark),
                          const SizedBox(height: 8),
                          _buildHelperText(
                              'Choose additional customizations on top of your base style and tone.',
                              isDark),
                          const SizedBox(height: 24),
                          _buildSectionTitle(
                              'Custom Instructions', isDark),
                          const SizedBox(height: 8),
                          _buildTextArea(
                            isDark,
                            controller: _customInstructionsController,
                            hint:
                                'Tell GPTNiX how you\'d like it to respond...',
                            maxLines: 6,
                            maxLength: 1500,
                          ),
                          const SizedBox(height: 24),
                          _buildSectionTitle('About You', isDark),
                          const SizedBox(height: 8),
                          _buildInputCard(isDark, [
                            _buildTextField(
                              isDark,
                              controller: _nicknameController,
                              label: 'Your nickname',
                              hint: 'What should GPTNiX call you?',
                            ),
                            _buildTextField(
                              isDark,
                              controller: _occupationController,
                              label: 'Your occupation',
                              hint: 'What do you do?',
                            ),
                          ]),
                          const SizedBox(height: 16),
                          _buildSectionTitle('More about you', isDark),
                          const SizedBox(height: 8),
                          _buildTextArea(
                            isDark,
                            controller: _aboutYouController,
                            hint:
                                'Tell GPTNiX about yourself, your interests, and what you\'re working on...',
                            maxLines: 5,
                            maxLength: 1000,
                          ),
                          const SizedBox(height: 24),
                          _buildNavigationTile(
                            isDark,
                            icon: Icons.auto_awesome_outlined,
                            title: 'Memories',
                            subtitle:
                                'Things GPTNiX remembers about you',
                            onTap: () => widget.onMemories?.call(),
                          ),
                          const SizedBox(height: 24),
                          _buildAdvancedSection(isDark),
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
                color:
                    isDark ? const Color(0xFF1A1A1A) : Colors.white,
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
                color:
                    isDark ? Colors.white : const Color(0xFF1A1A1A),
              ),
            ),
          ),
          Expanded(
            child: Text(
              'Personalization',
              style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : const Color(0xFF1A1A1A),
              ),
              textAlign: TextAlign.center,
            ),
          ),
          GestureDetector(
            onTap: (_hasChanges && !_isSaving)
                ? _savePersonalization
                : null,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _hasChanges
                    ? (isDark
                        ? Colors.white
                        : const Color(0xFF1A1A1A))
                    : (isDark
                        ? const Color(0xFF1A1A1A)
                        : Colors.white),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5),
                ),
              ),
              child: _isSaving
                  ? Padding(
                      padding: const EdgeInsets.all(10),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          isDark
                              ? const Color(0xFF1A1A1A)
                              : Colors.white,
                        ),
                      ),
                    )
                  : Icon(
                      Icons.check_rounded,
                      size: 20,
                      color: _hasChanges
                          ? (isDark
                              ? const Color(0xFF1A1A1A)
                              : Colors.white)
                          : (isDark
                              ? const Color(0xFF4A4A4A)
                              : const Color(0xFFCCCCCC)),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(
          isDark ? Colors.white : const Color(0xFF1A1A1A),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        title,
        style: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: isDark
              ? const Color(0xFF8E8E93)
              : const Color(0xFF6B6B6B),
        ),
      ),
    );
  }

  Widget _buildHelperText(String text, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 13,
          color: isDark
              ? const Color(0xFF4A4A4A)
              : const Color(0xFFAAAAAA),
          height: 1.4,
        ),
      ),
    );
  }

  Widget _buildStyleSelector(bool isDark) {
    final selectedOption = _styleOptions.firstWhere(
      (o) => o['value'] == _selectedStyle,
      orElse: () => _styleOptions.first,
    );

    return GestureDetector(
      onTap: _showStylePicker,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark
                ? const Color(0xFF2A2A2A)
                : const Color(0xFFE5E5E5),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Base style and tone',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: isDark
                          ? const Color(0xFF6B6B6B)
                          : const Color(0xFF8E8E93),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    selectedOption['label']!,
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: isDark
                          ? Colors.white
                          : const Color(0xFF1A1A1A),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              color: isDark
                  ? const Color(0xFF6B6B6B)
                  : const Color(0xFF8E8E93),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCharacteristicsSelector(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: _showCharacteristicsPicker,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark
                    ? const Color(0xFF2A2A2A)
                    : const Color(0xFFE5E5E5),
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.add_rounded,
                    size: 20,
                    color: isDark
                        ? Colors.white
                        : const Color(0xFF1A1A1A)),
                const SizedBox(width: 12),
                Text(
                  'Add characteristics',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? Colors.white
                        : const Color(0xFF1A1A1A),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_characteristics.isNotEmpty) ...[
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _characteristics.map((charId) {
              final char = _availableCharacteristics.firstWhere(
                (c) => c['id'] == charId,
                orElse: () => {
                  'id': charId,
                  'label': charId,
                  'icon': Icons.star_outline
                },
              );
              return Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFF5F5F5),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(char['icon'] as IconData,
                        size: 16,
                        color: isDark
                            ? const Color(0xFF8E8E93)
                            : const Color(0xFF6B6B6B)),
                    const SizedBox(width: 6),
                    Text(
                      char['label'] as String,
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isDark
                            ? Colors.white
                            : const Color(0xFF1A1A1A),
                      ),
                    ),
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () => setState(() {
                        _characteristics.remove(charId);
                        _onFieldChanged();
                      }),
                      child: Icon(Icons.close_rounded,
                          size: 16,
                          color: isDark
                              ? const Color(0xFF6B6B6B)
                              : const Color(0xFF8E8E93)),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }

  Widget _buildInputCard(bool isDark, List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color:
              isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: Column(
        children: children.asMap().entries.map((entry) {
          final isLast = entry.key == children.length - 1;
          return Column(
            children: [
              entry.value,
              if (!isLast)
                Divider(
                  height: 1,
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

  Widget _buildTextField(
    bool isDark, {
    required TextEditingController controller,
    required String label,
    String? hint,
  }) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 13,
                  color: isDark
                      ? const Color(0xFF6B6B6B)
                      : const Color(0xFF8E8E93))),
          const SizedBox(height: 8),
          TextField(
            controller: controller,
            onChanged: (_) => _onFieldChanged(),
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: EdgeInsets.zero,
              border: InputBorder.none,
              hintText: hint,
              hintStyle: GoogleFonts.inter(
                fontSize: 16,
                color: isDark
                    ? const Color(0xFF4A4A4A)
                    : const Color(0xFFCCCCCC),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextArea(
    bool isDark, {
    required TextEditingController controller,
    required String hint,
    int maxLines = 5,
    int? maxLength,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color:
              isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: TextField(
        controller: controller,
        onChanged: (_) => _onFieldChanged(),
        maxLines: maxLines,
        maxLength: maxLength,
        style: GoogleFonts.inter(
          fontSize: 15,
          height: 1.5,
          color: isDark ? Colors.white : const Color(0xFF1A1A1A),
        ),
        decoration: InputDecoration(
          isDense: true,
          contentPadding: EdgeInsets.zero,
          border: InputBorder.none,
          hintText: hint,
          hintStyle: GoogleFonts.inter(
            fontSize: 15,
            color: isDark
                ? const Color(0xFF4A4A4A)
                : const Color(0xFFCCCCCC),
          ),
          counterStyle: GoogleFonts.inter(
            fontSize: 11,
            color: isDark
                ? const Color(0xFF4A4A4A)
                : const Color(0xFFAAAAAA),
          ),
        ),
      ),
    );
  }

  Widget _buildNavigationTile(
    bool isDark, {
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark
                ? const Color(0xFF2A2A2A)
                : const Color(0xFFE5E5E5),
          ),
        ),
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
              child: Icon(icon,
                  size: 20,
                  color: isDark
                      ? const Color(0xFF8E8E93)
                      : const Color(0xFF6B6B6B)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: isDark
                              ? Colors.white
                              : const Color(0xFF1A1A1A))),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: GoogleFonts.inter(
                            fontSize: 13,
                            color: isDark
                                ? const Color(0xFF6B6B6B)
                                : const Color(0xFF8E8E93))),
                  ],
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded,
                size: 20,
                color: isDark
                    ? const Color(0xFF4A4A4A)
                    : const Color(0xFFCCCCCC)),
          ],
        ),
      ),
    );
  }

  Widget _buildAdvancedSection(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () =>
              setState(() => _advancedExpanded = !_advancedExpanded),
          child: Row(
            children: [
              Text('Advanced',
                  style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark
                          ? const Color(0xFF8E8E93)
                          : const Color(0xFF6B6B6B))),
              const SizedBox(width: 8),
              Icon(
                _advancedExpanded
                    ? Icons.keyboard_arrow_up
                    : Icons.keyboard_arrow_down,
                size: 20,
                color: isDark
                    ? const Color(0xFF6B6B6B)
                    : const Color(0xFF8E8E93),
              ),
            ],
          ),
        ),
        if (_advancedExpanded) ...[
          const SizedBox(height: 12),
          _buildInputCard(isDark, [
            _buildToggleTile(isDark,
                icon: Icons.language_rounded,
                title: 'Web Search',
                subtitle: 'Search the web to find answers',
                value: _webSearchEnabled,
                onChanged: (v) => setState(() {
                      _webSearchEnabled = v;
                      _onFieldChanged();
                    })),
            _buildToggleTile(isDark,
                icon: Icons.code_rounded,
                title: 'Code',
                subtitle: 'Execute code using Code Interpreter',
                value: _codeEnabled,
                onChanged: (v) => setState(() {
                      _codeEnabled = v;
                      _onFieldChanged();
                    })),
            _buildToggleTile(isDark,
                icon: Icons.image_outlined,
                title: 'Image Generation',
                subtitle: 'Generate images from text',
                value: _imageGenEnabled,
                onChanged: (v) => setState(() {
                      _imageGenEnabled = v;
                      _onFieldChanged();
                    })),
            _buildToggleTile(isDark,
                icon: Icons.mic_outlined,
                title: 'Advanced Voice',
                subtitle: 'More natural conversation in voice mode',
                value: _voiceEnabled,
                onChanged: (v) => setState(() {
                      _voiceEnabled = v;
                      _onFieldChanged();
                    })),
          ]),
        ],
      ],
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
            child: Icon(icon,
                size: 20,
                color: isDark
                    ? const Color(0xFF8E8E93)
                    : const Color(0xFF6B6B6B)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: isDark
                            ? Colors.white
                            : const Color(0xFF1A1A1A))),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: GoogleFonts.inter(
                        fontSize: 13,
                        color: isDark
                            ? const Color(0xFF6B6B6B)
                            : const Color(0xFF8E8E93))),
              ],
            ),
          ),
          Transform.scale(
            scale: 0.85,
            child: Switch(
              value: value,
              onChanged: onChanged,
              activeColor: Colors.white,
              activeTrackColor:
                  isDark ? Colors.white : const Color(0xFF1A1A1A),
              inactiveThumbColor:
                  isDark ? const Color(0xFF6B6B6B) : Colors.white,
              inactiveTrackColor: isDark
                  ? const Color(0xFF2A2A2A)
                  : const Color(0xFFE5E5E5),
            ),
          ),
        ],
      ),
    );
  }
}
