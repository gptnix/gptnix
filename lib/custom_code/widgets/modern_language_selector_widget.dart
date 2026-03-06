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
import 'package:cloud_firestore/cloud_firestore.dart';
import '/auth/firebase_auth/auth_util.dart';

class ModernLanguageSelectorWidget extends StatefulWidget {
  const ModernLanguageSelectorWidget({
    super.key,
    this.width,
    this.height,
    this.currentLanguage,
    this.onBack,
    this.onLanguageChanged,
  });

  final double? width;
  final double? height;

  /// Current selected language code (e.g., 'en', 'es', 'hr', 'zh_TW' ili 'zh-TW')
  final String? currentLanguage;

  /// Called when back button is pressed
  final Future Function()? onBack;

  /// Called after language is selected - optional extra hook
  final Future Function()? onLanguageChanged;

  @override
  State<ModernLanguageSelectorWidget> createState() =>
      _ModernLanguageSelectorWidgetState();
}

class _Language {
  final String code; // BCP-47 (e.g. zh-TW)
  final String name;
  final String nativeName;
  final String flag;

  const _Language({
    required this.code,
    required this.name,
    required this.nativeName,
    required this.flag,
  });
}

class _ModernLanguageSelectorWidgetState
    extends State<ModernLanguageSelectorWidget> {
  static const String _fsPathSuffix = 'personalization/main';

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCode = 'en';

  bool _saving = false;

  static const Set<String> _rtlLangs = {
    'ar', // Arabic
    'he', // Hebrew
    'fa', // Persian
    'ur', // Urdu
  };

  static bool _isRtl(String code) {
    final base = code.split(RegExp(r'[_-]')).first.toLowerCase();
    return _rtlLangs.contains(base);
  }

  static String _toFlutterLocaleCode(String code) {
    // Flutter / FF često očekuju underscore locale (zh_TW)
    return code.replaceAll('-', '_');
  }

  static String _toDashCode(String code) {
    // UI lista koristi dash, pa normaliziramo ako dođe underscore
    return code.replaceAll('_', '-');
  }

  // Suggested languages (most common)
  static const List<_Language> _suggestedLanguages = [
    _Language(code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸'),
    _Language(code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸'),
    _Language(
        code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷'),
    _Language(code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪'),
  ];

  // All languages
  static const List<_Language> _allLanguages = [
    _Language(code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸'),
    _Language(code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸'),
    _Language(
        code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷'),
    _Language(code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪'),
    _Language(code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷'),
    _Language(
        code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹'),
    _Language(
        code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹'),
    _Language(
        code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱'),
    _Language(code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱'),
    _Language(code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺'),
    _Language(
        code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦'),
    _Language(code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿'),
    _Language(
        code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰'),
    _Language(
        code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮'),
    _Language(code: 'sr', name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸'),
    _Language(
        code: 'bs', name: 'Bosnian', nativeName: 'Bosanski', flag: '🇧🇦'),
    _Language(
        code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺'),
    _Language(code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴'),
    _Language(
        code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬'),
    _Language(code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷'),
    _Language(code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷'),
    _Language(code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦'),
    _Language(code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱'),
    _Language(code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷'),
    _Language(code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳'),
    _Language(code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩'),
    _Language(code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭'),
    _Language(
        code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳'),
    _Language(
        code: 'id',
        name: 'Indonesian',
        nativeName: 'Bahasa Indonesia',
        flag: '🇮🇩'),
    _Language(
        code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾'),
    _Language(
        code: 'zh',
        name: 'Chinese (Simplified)',
        nativeName: '简体中文',
        flag: '🇨🇳'),
    _Language(
        code: 'zh-TW',
        name: 'Chinese (Traditional)',
        nativeName: '繁體中文',
        flag: '🇹🇼'),
    _Language(code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵'),
    _Language(code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷'),
    _Language(code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪'),
    _Language(code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴'),
    _Language(code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰'),
    _Language(code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮'),
  ];

  List<_Language> get _filteredLanguages {
    if (_searchQuery.trim().isEmpty) return _allLanguages;
    final q = _searchQuery.trim().toLowerCase();
    return _allLanguages.where((lang) {
      return lang.name.toLowerCase().contains(q) ||
          lang.nativeName.toLowerCase().contains(q) ||
          lang.code.toLowerCase().contains(q);
    }).toList();
  }

  @override
  void initState() {
    super.initState();

    // widget.currentLanguage može biti zh_TW ili zh-TW -> normaliziramo na dash jer lista koristi dash.
    final incoming = widget.currentLanguage?.trim();
    if (incoming != null && incoming.isNotEmpty) {
      _selectedCode = _toDashCode(incoming);
    } else {
      _selectedCode = 'en';
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _persistToFirestore(_Language language) async {
    final uid = currentUserUid; // u FF-u je obično String (ne nullable)
    if (uid.isEmpty) return;

    final docRef = FirebaseFirestore.instance.doc('users/$uid/$_fsPathSuffix');

    await docRef.set({
      'language': {
        'code': language.code, // dash
        'name': language.name,
        'native': language.nativeName,
        'rtl': _isRtl(language.code),
      },
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Future<void> _applyAppLanguage(_Language language) async {
    // FF/Flutter locale često želi underscore (zh_TW)
    final flutterCode = _toFlutterLocaleCode(language.code);

    // ✅ NEMA setAppLanguage() jer u tvojoj FF verziji očito ne postoji.
    // Umjesto toga: spremimo u FFAppState i refresh.
    FFAppState().update(() {
      // Ovo ti već koristiš u svom kodu, pa pretpostavljam da postoji u App Stateu.
      FFAppState().selectedLanguage = flutterCode;
    });

    if (mounted) setState(() {});
  }

  Future<void> _selectLanguage(_Language language) async {
    if (_saving) return;

    setState(() {
      _saving = true;
      _selectedCode = language.code; // dash za UI selekciju
    });

    try {
      // 1) odmah prebaci UI (preko AppState) da user vidi instant
      await _applyAppLanguage(language);

      // 2) spremi u Firestore (dash) da backend / profil zna
      await _persistToFirestore(language);

      // 3) optional hook (ako želiš dodatne side-effecte)
      await widget.onLanguageChanged?.call();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Language changed to ${language.name}'),
            duration: const Duration(seconds: 1),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      debugPrint('❌ Language selection error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error saving language: $e'),
            duration: const Duration(seconds: 2),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
        await Future.delayed(const Duration(milliseconds: 120));
        await widget.onBack?.call();
      }
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
              _buildHeader(isDark),
              _buildSearchBar(isDark),
              Expanded(child: _buildLanguageList(isDark)),
              if (_saving) _buildSavingBar(isDark),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSavingBar(bool isDark) {
    return Container(
      height: 3,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const LinearProgressIndicator(minHeight: 3),
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
              'Language',
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

  Widget _buildSearchBar(bool isDark) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
          ),
        ),
        child: TextField(
          controller: _searchController,
          onChanged: (v) => setState(() => _searchQuery = v),
          style: GoogleFonts.inter(
            fontSize: 15,
            color: isDark ? Colors.white : const Color(0xFF1A1A1A),
          ),
          decoration: InputDecoration(
            hintText: 'Search languages...',
            hintStyle: GoogleFonts.inter(
              fontSize: 15,
              color: isDark ? const Color(0xFF4A4A4A) : const Color(0xFFAAAAAA),
            ),
            prefixIcon: Icon(
              Icons.search,
              size: 20,
              color: isDark ? const Color(0xFF6B6B6B) : const Color(0xFF8E8E93),
            ),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: Icon(
                      Icons.close,
                      size: 18,
                      color: isDark
                          ? const Color(0xFF6B6B6B)
                          : const Color(0xFF8E8E93),
                    ),
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _searchQuery = '');
                    },
                  )
                : null,
            border: InputBorder.none,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
        ),
      ),
    );
  }

  Widget _buildLanguageList(bool isDark) {
    if (_searchQuery.trim().isNotEmpty) {
      final filtered = _filteredLanguages;
      if (filtered.isEmpty) return _buildEmptyState(isDark);

      return ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: filtered.length,
        itemBuilder: (_, i) => _buildLanguageTile(filtered[i], isDark),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('Suggested', isDark),
          const SizedBox(height: 8),
          _buildLanguageCard(isDark, _suggestedLanguages),
          const SizedBox(height: 24),
          _buildSectionTitle('All Languages', isDark),
          const SizedBox(height: 8),
          _buildLanguageCard(isDark, _allLanguages),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: isDark ? const Color(0xFF6B6B6B) : const Color(0xFF8E8E93),
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildLanguageCard(bool isDark, List<_Language> languages) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: Column(
        children: List.generate(languages.length, (index) {
          final language = languages[index];
          final isLast = index == languages.length - 1;

          return Column(
            children: [
              _buildLanguageItem(language, isDark, compact: false),
              if (!isLast)
                Divider(
                  height: 1,
                  indent: 60,
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5),
                ),
            ],
          );
        }),
      ),
    );
  }

  Widget _buildLanguageTile(_Language language, bool isDark) {
    final isSelected = _selectedCode == language.code;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSelected
              ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
              : (isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5)),
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: _buildLanguageItem(language, isDark, compact: true),
    );
  }

  Widget _buildLanguageItem(_Language language, bool isDark,
      {required bool compact}) {
    final isSelected = _selectedCode == language.code;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _saving ? null : () => _selectLanguage(language),
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
                child: Center(
                  child:
                      Text(language.flag, style: const TextStyle(fontSize: 20)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      language.name,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      language.nativeName,
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
              if (isSelected)
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.check_rounded,
                    size: 16,
                    color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
                  ),
                )
              else
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: isDark
                          ? const Color(0xFF2A2A2A)
                          : const Color(0xFFE5E5E5),
                      width: 1.5,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1A1A1A) : const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.search_off_rounded,
              size: 28,
              color: isDark ? const Color(0xFF4A4A4A) : const Color(0xFFAAAAAA),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'No languages found',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Try a different search term',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: isDark ? const Color(0xFF4A4A4A) : const Color(0xFFAAAAAA),
            ),
          ),
        ],
      ),
    );
  }
}
