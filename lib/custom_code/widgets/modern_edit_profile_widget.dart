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

class ModernEditProfileWidget extends StatefulWidget {
  const ModernEditProfileWidget({
    super.key,
    this.width,
    this.height,
    required this.userDoc,
    this.onBack,
    this.onSave,
    this.onChangePhoto,
  });

  final double? width;
  final double? height;
  final DocumentReference userDoc;
  final Future Function()? onBack;
  final Future Function()? onSave;
  final Future Function()? onChangePhoto;

  @override
  State<ModernEditProfileWidget> createState() =>
      _ModernEditProfileWidgetState();
}

class _ModernEditProfileWidgetState extends State<ModernEditProfileWidget> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _usernameController;
  late TextEditingController _emailController;
  late TextEditingController _phoneController;
  late TextEditingController _bioController;

  bool _isLoading = true;
  bool _isSaving = false;
  bool _hasChanges = false;

  String? _photoUrl;
  String _initials = 'U';
  Map<String, dynamic>? _originalData;

  @override
  void initState() {
    super.initState();
    _firstNameController = TextEditingController();
    _lastNameController = TextEditingController();
    _usernameController = TextEditingController();
    _emailController = TextEditingController();
    _phoneController = TextEditingController();
    _bioController = TextEditingController();

    _loadUserData();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _loadUserData() async {
    try {
      final doc = await widget.userDoc.get();
      final data = doc.data() as Map<String, dynamic>?;

      if (data != null && mounted) {
        setState(() {
          _originalData = Map.from(data);
          _firstNameController.text = data['first_name']?.toString() ?? '';
          _lastNameController.text = data['last_name']?.toString() ?? '';
          _usernameController.text = data['username']?.toString() ?? '';
          _emailController.text = data['email']?.toString() ?? '';
          _phoneController.text = data['phone_number']?.toString() ?? '';
          _bioController.text = data['bio']?.toString() ?? '';
          _photoUrl = data['photo_url']?.toString();
          _initials = _getInitials(data);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackbar('Error loading profile', isSuccess: false);
      }
    }
  }

  String _getInitials(Map<String, dynamic>? data) {
    if (data == null) return 'U';

    final firstName = data['first_name']?.toString() ?? '';
    final lastName = data['last_name']?.toString() ?? '';

    if (firstName.isNotEmpty && lastName.isNotEmpty) {
      return '${firstName[0]}${lastName[0]}'.toUpperCase();
    }
    if (firstName.isNotEmpty) return firstName[0].toUpperCase();

    return 'U';
  }

  void _onFieldChanged() {
    if (_originalData == null) return;

    final hasChanges = _firstNameController.text !=
            (_originalData!['first_name']?.toString() ?? '') ||
        _lastNameController.text !=
            (_originalData!['last_name']?.toString() ?? '') ||
        _usernameController.text !=
            (_originalData!['username']?.toString() ?? '') ||
        _phoneController.text !=
            (_originalData!['phone_number']?.toString() ?? '') ||
        _bioController.text != (_originalData!['bio']?.toString() ?? '');

    if (hasChanges != _hasChanges) {
      setState(() => _hasChanges = hasChanges);
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      await widget.userDoc.update({
        'first_name': _firstNameController.text.trim(),
        'last_name': _lastNameController.text.trim(),
        'username': _usernameController.text.trim(),
        'phone_number': _phoneController.text.trim(),
        'bio': _bioController.text.trim(),
        'updated_at': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        _showSnackbar('Profile updated successfully', isSuccess: true);
        setState(() {
          _hasChanges = false;
          _originalData = {
            ..._originalData!,
            'first_name': _firstNameController.text.trim(),
            'last_name': _lastNameController.text.trim(),
            'username': _usernameController.text.trim(),
            'phone_number': _phoneController.text.trim(),
            'bio': _bioController.text.trim(),
          };
        });
        await widget.onSave?.call();
      }
    } catch (e) {
      if (mounted) {
        _showSnackbar('Error saving profile', isSuccess: false);
      }
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
              child: _isLoading
                  ? _buildLoadingState(isDark)
                  : SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            const SizedBox(height: 16),

                            // Profile Photo
                            _buildProfilePhoto(isDark),
                            const SizedBox(height: 32),

                            // Name Section
                            _buildSectionTitle('Personal Information', isDark),
                            const SizedBox(height: 12),
                            _buildInputCard(isDark, [
                              _buildTextField(
                                isDark,
                                controller: _firstNameController,
                                label: 'First Name',
                                icon: Icons.person_outline_rounded,
                                onChanged: (_) => _onFieldChanged(),
                              ),
                              _buildTextField(
                                isDark,
                                controller: _lastNameController,
                                label: 'Last Name',
                                icon: Icons.person_outline_rounded,
                                onChanged: (_) => _onFieldChanged(),
                              ),
                              _buildTextField(
                                isDark,
                                controller: _usernameController,
                                label: 'Username',
                                icon: Icons.alternate_email_rounded,
                                prefix: '@',
                                onChanged: (_) => _onFieldChanged(),
                              ),
                            ]),
                            const SizedBox(height: 24),

                            // Contact Section
                            _buildSectionTitle('Contact Information', isDark),
                            const SizedBox(height: 12),
                            _buildInputCard(isDark, [
                              _buildTextField(
                                isDark,
                                controller: _emailController,
                                label: 'Email',
                                icon: Icons.email_outlined,
                                enabled: false,
                                helperText: 'Email cannot be changed',
                              ),
                              _buildTextField(
                                isDark,
                                controller: _phoneController,
                                label: 'Phone Number',
                                icon: Icons.phone_outlined,
                                keyboardType: TextInputType.phone,
                                onChanged: (_) => _onFieldChanged(),
                              ),
                            ]),
                            const SizedBox(height: 24),

                            // Bio Section
                            _buildSectionTitle('About', isDark),
                            const SizedBox(height: 12),
                            _buildInputCard(isDark, [
                              _buildTextField(
                                isDark,
                                controller: _bioController,
                                label: 'Bio',
                                icon: Icons.info_outline_rounded,
                                maxLines: 3,
                                maxLength: 150,
                                onChanged: (_) => _onFieldChanged(),
                              ),
                            ]),

                            const SizedBox(height: 32),

                            // Save Button
                            _buildSaveButton(isDark),

                            const SizedBox(height: 40),
                          ],
                        ),
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
              'Edit Profile',
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

  Widget _buildLoadingState(bool isDark) {
    return Center(
      child: CircularProgressIndicator(
        valueColor: AlwaysStoppedAnimation<Color>(
          isDark ? Colors.white : const Color(0xFF1A1A1A),
        ),
      ),
    );
  }

  Widget _buildProfilePhoto(bool isDark) {
    return Column(
      children: [
        Stack(
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF667EEA), Color(0xFF764BA2)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(50),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5),
                  width: 3,
                ),
              ),
              child: _photoUrl != null && _photoUrl!.isNotEmpty
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(47),
                      child: Image.network(
                        _photoUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _buildInitialsAvatar(),
                      ),
                    )
                  : _buildInitialsAvatar(),
            ),
            Positioned(
              bottom: 0,
              right: 0,
              child: GestureDetector(
                onTap: () => widget.onChangePhoto?.call(),
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isDark
                          ? const Color(0xFF0D0D0D)
                          : const Color(0xFFFAFAFA),
                      width: 2,
                    ),
                  ),
                  child: Icon(
                    Icons.camera_alt_outlined,
                    size: 16,
                    color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: () => widget.onChangePhoto?.call(),
          child: Text(
            'Change Photo',
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildInitialsAvatar() {
    return Center(
      child: Text(
        _initials,
        style: GoogleFonts.inter(
          fontSize: 36,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
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
      ),
    );
  }

  Widget _buildInputCard(bool isDark, List<Widget> children) {
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

  Widget _buildTextField(
    bool isDark, {
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? prefix,
    String? helperText,
    bool enabled = true,
    int maxLines = 1,
    int? maxLength,
    TextInputType? keyboardType,
    ValueChanged<String>? onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment:
            maxLines > 1 ? CrossAxisAlignment.start : CrossAxisAlignment.center,
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
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? const Color(0xFF6B6B6B)
                        : const Color(0xFF8E8E93),
                  ),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (prefix != null)
                      Text(
                        prefix,
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          color: isDark
                              ? const Color(0xFF6B6B6B)
                              : const Color(0xFF8E8E93),
                        ),
                      ),
                    Expanded(
                      child: TextFormField(
                        controller: controller,
                        enabled: enabled,
                        maxLines: maxLines,
                        maxLength: maxLength,
                        keyboardType: keyboardType,
                        onChanged: onChanged,
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: enabled
                              ? (isDark
                                  ? Colors.white
                                  : const Color(0xFF1A1A1A))
                              : (isDark
                                  ? const Color(0xFF4A4A4A)
                                  : const Color(0xFFAAAAAA)),
                        ),
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: EdgeInsets.zero,
                          border: InputBorder.none,
                          hintText: 'Enter $label',
                          hintStyle: GoogleFonts.inter(
                            fontSize: 15,
                            color: isDark
                                ? const Color(0xFF4A4A4A)
                                : const Color(0xFFCCCCCC),
                          ),
                          counterText: '',
                        ),
                      ),
                    ),
                  ],
                ),
                if (helperText != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    helperText,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: isDark
                          ? const Color(0xFF4A4A4A)
                          : const Color(0xFFAAAAAA),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSaveButton(bool isDark) {
    return GestureDetector(
      onTap: (_hasChanges && !_isSaving) ? _saveProfile : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: _hasChanges
              ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
              : (isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5)),
          borderRadius: BorderRadius.circular(16),
        ),
        child: _isSaving
            ? Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      isDark ? const Color(0xFF1A1A1A) : Colors.white,
                    ),
                  ),
                ),
              )
            : Text(
                'Save Changes',
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: _hasChanges
                      ? (isDark ? const Color(0xFF1A1A1A) : Colors.white)
                      : (isDark
                          ? const Color(0xFF4A4A4A)
                          : const Color(0xFFAAAAAA)),
                ),
                textAlign: TextAlign.center,
              ),
      ),
    );
  }
}
