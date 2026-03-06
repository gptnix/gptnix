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
import 'package:firebase_auth/firebase_auth.dart'; // ✅ FIX

class ModernResetPasswordWidget extends StatefulWidget {
  const ModernResetPasswordWidget({
    super.key,
    this.width,
    this.height,
    this.onBack,
    this.onResetSuccess,
  });

  final double? width;
  final double? height;

  /// Called when user taps back button
  final Future Function()? onBack;

  /// Called after successful password reset email sent
  final Future Function()? onResetSuccess;

  @override
  State<ModernResetPasswordWidget> createState() =>
      _ModernResetPasswordWidgetState();
}

class _ModernResetPasswordWidgetState extends State<ModernResetPasswordWidget>
    with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _emailFocusNode = FocusNode();

  bool _isLoading = false;
  bool _emailSent = false;
  String? _errorMessage;

  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOut),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeOutCubic,
    ));

    _animationController.forward();

    _emailFocusNode.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _emailController.dispose();
    _emailFocusNode.dispose();
    _animationController.dispose();
    super.dispose();
  }

  String _friendlyAuthError(Object e) {
    if (e is FirebaseAuthException) {
      switch (e.code) {
        case 'invalid-email':
          return 'Please enter a valid email';
        case 'user-not-found':
          // namjerno “ne otkrivamo” previše, ali možemo dati neutralno:
          return 'If this email exists, you will receive a reset link shortly.';
        case 'too-many-requests':
          return 'Too many attempts. Please try again later.';
        default:
          return 'Failed to send reset email. Please try again.';
      }
    }
    return 'Failed to send reset email. Please try again.';
  }

  Future<void> _handleResetPassword() async {
    final email = _emailController.text.trim();

    if (email.isEmpty) {
      setState(() => _errorMessage = 'Please enter your email');
      return;
    }

    if (!email.contains('@')) {
      setState(() => _errorMessage = 'Please enter a valid email');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // ✅ FIX: authManager nije dostupan u custom widgetu -> direktno Firebase
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);

      if (!mounted) return;
      setState(() => _emailSent = true);
      await widget.onResetSuccess?.call();
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = _friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
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
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: SlideTransition(
              position: _slideAnimation,
              child: Column(
                children: [
                  _buildHeader(isDark),
                  Expanded(
                    child: Center(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 400),
                          child: _emailSent
                              ? _buildSuccessState(isDark)
                              : _buildFormState(isDark),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return Padding(
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
          const Spacer(),
        ],
      ),
    );
  }

  Widget _buildFormState(bool isDark) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildLogo(isDark),
        const SizedBox(height: 40),
        _buildTitle(isDark),
        const SizedBox(height: 40),
        if (_errorMessage != null) ...[
          _buildErrorMessage(),
          const SizedBox(height: 16),
        ],
        _buildEmailField(isDark),
        const SizedBox(height: 24),
        _buildResetButton(isDark),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildSuccessState(bool isDark) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFF34C759).withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              Icons.mark_email_read_outlined,
              size: 40,
              color: Color(0xFF34C759),
            ),
          ),
        ),
        const SizedBox(height: 32),
        Text(
          'Check your email',
          style: GoogleFonts.inter(
            fontSize: 28,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            letterSpacing: -0.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Text(
          'We sent a password reset link to\n${_emailController.text.trim()}',
          style: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w400,
            color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
            height: 1.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 40),
        _buildBackToSignInButton(isDark),
        const SizedBox(height: 16),
        Center(
          child: GestureDetector(
            onTap: () => setState(() => _emailSent = false),
            child: Text(
              "Didn't receive the email? Try again",
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isDark ? Colors.white : const Color(0xFF1A1A1A),
              ),
            ),
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildLogo(bool isDark) {
    return Center(
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: isDark ? Colors.white : const Color(0xFF1A1A1A),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Center(
          child: Text(
            'N',
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTitle(bool isDark) {
    return Column(
      children: [
        Text(
          'Reset Password',
          style: GoogleFonts.inter(
            fontSize: 28,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            letterSpacing: -0.5,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Enter your email and we\'ll send you\na link to reset your password',
          style: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w400,
            color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
            height: 1.5,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildErrorMessage() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFF3B30).withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFF3B30).withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: Color(0xFFFF3B30), size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              _errorMessage!,
              style: GoogleFonts.inter(
                fontSize: 14,
                color: const Color(0xFFFF3B30),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmailField(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Email',
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: isDark ? const Color(0xFFE5E5E5) : const Color(0xFF1A1A1A),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _emailFocusNode.hasFocus
                  ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                  : (isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5)),
              width: _emailFocusNode.hasFocus ? 1.5 : 1,
            ),
          ),
          child: TextField(
            controller: _emailController,
            focusNode: _emailFocusNode,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            style: GoogleFonts.inter(
              fontSize: 16,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
            decoration: InputDecoration(
              hintText: 'name@email.com',
              hintStyle: GoogleFonts.inter(
                fontSize: 16,
                color:
                    isDark ? const Color(0xFF4A4A4A) : const Color(0xFFAAAAAA),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              border: InputBorder.none,
              prefixIcon: Padding(
                padding: const EdgeInsets.only(left: 16, right: 12),
                child: Icon(
                  Icons.mail_outline_rounded,
                  size: 20,
                  color: isDark
                      ? const Color(0xFF6B6B6B)
                      : const Color(0xFF8E8E93),
                ),
              ),
              prefixIconConstraints: const BoxConstraints(minWidth: 0),
            ),
            onSubmitted: (_) => _handleResetPassword(),
            onChanged: (_) => setState(() {}),
          ),
        ),
      ],
    );
  }

  Widget _buildResetButton(bool isDark) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _isLoading ? null : _handleResetPassword,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 52,
          decoration: BoxDecoration(
            color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: _isLoading
                ? SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        isDark ? const Color(0xFF1A1A1A) : Colors.white,
                      ),
                    ),
                  )
                : Text(
                    'Send Reset Link',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
                    ),
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildBackToSignInButton(bool isDark) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => widget.onBack?.call(),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Text(
              'Back to Sign In',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
