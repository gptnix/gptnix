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

// ✅ FIX: direktno FirebaseAuth
import 'package:firebase_auth/firebase_auth.dart';

// ✅ Google sign-in
import 'package:google_sign_in/google_sign_in.dart';

// ✅ Apple sign-in
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

class ModernSignUpWidget extends StatefulWidget {
  const ModernSignUpWidget({
    super.key,
    this.width,
    this.height,
    this.onSignUp,
    this.onGoogleSignUp,
    this.onAppleSignUp,
    this.onSignIn,
  });

  /// Widget dimensions (required by FlutterFlow)
  final double? width;
  final double? height;

  /// Called after successful email/password sign up - use for navigation
  final Future Function()? onSignUp;

  /// Called after successful Google sign up - use for navigation
  final Future Function()? onGoogleSignUp;

  /// Called after successful Apple sign up - use for navigation
  final Future Function()? onAppleSignUp;

  /// Called when user taps "Sign In" link - navigate to sign in page
  final Future Function()? onSignIn;

  @override
  State<ModernSignUpWidget> createState() => _ModernSignUpWidgetState();
}

class _ModernSignUpWidgetState extends State<ModernSignUpWidget>
    with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  final _nameFocusNode = FocusNode();
  final _emailFocusNode = FocusNode();
  final _passwordFocusNode = FocusNode();
  final _confirmPasswordFocusNode = FocusNode();

  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isLoading = false;
  bool _acceptedTerms = false;
  String? _errorMessage;

  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  int _passwordStrength = 0;

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
    _passwordController.addListener(_updatePasswordStrength);

    _emailFocusNode.addListener(() => setState(() {}));
    _passwordFocusNode.addListener(() => setState(() {}));
    _nameFocusNode.addListener(() => setState(() {}));
    _confirmPasswordFocusNode.addListener(() => setState(() {}));
  }

  void _updatePasswordStrength() {
    final password = _passwordController.text;
    int strength = 0;

    if (password.length >= 8) strength++;
    if (password.contains(RegExp(r'[A-Z]'))) strength++;
    if (password.contains(RegExp(r'[0-9]'))) strength++;
    if (password.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) strength++;

    setState(() => _passwordStrength = strength);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _nameFocusNode.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    _confirmPasswordFocusNode.dispose();
    _animationController.dispose();
    super.dispose();
  }

  String _friendlyAuthError(Object e) {
    if (e is FirebaseAuthException) {
      switch (e.code) {
        case 'email-already-in-use':
          return 'Email je već registriran.';
        case 'invalid-email':
          return 'Neispravan email.';
        case 'weak-password':
          return 'Lozinka je preslaba.';
        case 'operation-not-allowed':
          return 'Prijava emailom nije omogućena u Firebase postavkama.';
        case 'network-request-failed':
          return 'Nema mreže ili je veza loša.';
        default:
          return 'Registracija nije uspjela. Pokušaj ponovno.';
      }
    }
    return 'Registracija nije uspjela. Pokušaj ponovno.';
  }

  String? _validateInputs() {
    if (_nameController.text.trim().isEmpty) {
      return 'Unesi ime i prezime.';
    }
    if (_emailController.text.trim().isEmpty) {
      return 'Unesi email.';
    }
    if (!_emailController.text.contains('@')) {
      return 'Unesi ispravan email.';
    }
    if (_passwordController.text.length < 6) {
      return 'Lozinka mora imati barem 6 znakova.';
    }
    if (_passwordController.text != _confirmPasswordController.text) {
      return 'Lozinke se ne podudaraju.';
    }
    if (!_acceptedTerms) {
      return 'Prihvati uvjete korištenja.';
    }
    return null;
  }

  Future<void> _handleSignUp() async {
    final error = _validateInputs();
    if (error != null) {
      setState(() => _errorMessage = error);
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final email = _emailController.text.trim();
      final pass = _passwordController.text;
      final fullName = _nameController.text.trim();

      final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email,
        password: pass,
      );

      // ✅ set display name
      await cred.user?.updateDisplayName(fullName);
      await cred.user?.reload();

      // ✅ optional: email verification (ugasi ako nećeš)
      if (cred.user != null && !(cred.user!.emailVerified)) {
        await cred.user!.sendEmailVerification();
      }

      await widget.onSignUp?.call();
    } catch (e) {
      setState(() => _errorMessage = _friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleSignUp() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        // cancelled
        return;
      }

      final googleAuth = await googleUser.authentication;

      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      await FirebaseAuth.instance.signInWithCredential(credential);

      await widget.onGoogleSignUp?.call();
    } catch (e) {
      setState(() => _errorMessage = _friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleAppleSignUp() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final appleIdCredential = await SignInWithApple.getAppleIDCredential(
        scopes: [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
      );

      final oauthCredential = OAuthProvider('apple.com').credential(
        idToken: appleIdCredential.identityToken,
        accessToken: appleIdCredential.authorizationCode,
      );

      final cred =
          await FirebaseAuth.instance.signInWithCredential(oauthCredential);

      // ✅ Apple često prvi put vrati ime/prezime — probaj setat displayName
      final fullName = [
        appleIdCredential.givenName,
        appleIdCredential.familyName
      ].where((s) => (s ?? '').trim().isNotEmpty).join(' ').trim();

      if (fullName.isNotEmpty &&
          (cred.user?.displayName ?? '').trim().isEmpty) {
        await cred.user?.updateDisplayName(fullName);
        await cred.user?.reload();
      }

      await widget.onAppleSignUp?.call();
    } catch (e) {
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
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 400),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 40),
                        _buildLogo(isDark),
                        const SizedBox(height: 40),
                        _buildWelcomeText(isDark),
                        const SizedBox(height: 32),
                        if (_errorMessage != null) ...[
                          _buildErrorMessage(),
                          const SizedBox(height: 16),
                        ],
                        _buildTextField(
                          controller: _nameController,
                          focusNode: _nameFocusNode,
                          label: 'Full Name',
                          hint: 'John Doe',
                          icon: Icons.person_outline_rounded,
                          isDark: isDark,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: 16),
                        _buildTextField(
                          controller: _emailController,
                          focusNode: _emailFocusNode,
                          label: 'Email',
                          hint: 'name@email.com',
                          icon: Icons.mail_outline_rounded,
                          isDark: isDark,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: 16),
                        _buildPasswordField(
                          controller: _passwordController,
                          focusNode: _passwordFocusNode,
                          label: 'Password',
                          hint: 'Min. 6 characters',
                          obscure: _obscurePassword,
                          onToggle: () => setState(
                              () => _obscurePassword = !_obscurePassword),
                          isDark: isDark,
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: 8),
                        _buildPasswordStrength(isDark),
                        const SizedBox(height: 16),
                        _buildPasswordField(
                          controller: _confirmPasswordController,
                          focusNode: _confirmPasswordFocusNode,
                          label: 'Confirm Password',
                          hint: 'Re-enter password',
                          obscure: _obscureConfirmPassword,
                          onToggle: () => setState(() =>
                              _obscureConfirmPassword =
                                  !_obscureConfirmPassword),
                          isDark: isDark,
                          textInputAction: TextInputAction.done,
                          onSubmitted: () => _handleSignUp(),
                        ),
                        const SizedBox(height: 20),
                        _buildTermsCheckbox(isDark),
                        const SizedBox(height: 24),
                        _buildSignUpButton(isDark),
                        const SizedBox(height: 32),
                        _buildDivider(isDark),
                        const SizedBox(height: 32),
                        _buildSocialButtons(isDark),
                        const SizedBox(height: 40),
                        _buildSignInLink(isDark),
                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
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

  Widget _buildWelcomeText(bool isDark) {
    return Column(
      children: [
        Text(
          'Create Account',
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
          'Sign up to get started',
          style: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w400,
            color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
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

  Widget _buildTextField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required IconData icon,
    required bool isDark,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
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
              color: focusNode.hasFocus
                  ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                  : (isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5)),
              width: focusNode.hasFocus ? 1.5 : 1,
            ),
          ),
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            style: GoogleFonts.inter(
              fontSize: 16,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
            decoration: InputDecoration(
              hintText: hint,
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
                child: Icon(icon,
                    size: 20,
                    color: isDark
                        ? const Color(0xFF6B6B6B)
                        : const Color(0xFF8E8E93)),
              ),
              prefixIconConstraints: const BoxConstraints(minWidth: 0),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required bool obscure,
    required VoidCallback onToggle,
    required bool isDark,
    TextInputAction? textInputAction,
    VoidCallback? onSubmitted,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
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
              color: focusNode.hasFocus
                  ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                  : (isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5)),
              width: focusNode.hasFocus ? 1.5 : 1,
            ),
          ),
          child: TextField(
            controller: controller,
            focusNode: focusNode,
            obscureText: obscure,
            textInputAction: textInputAction,
            style: GoogleFonts.inter(
              fontSize: 16,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
            decoration: InputDecoration(
              hintText: hint,
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
                child: Icon(Icons.lock_outline_rounded,
                    size: 20,
                    color: isDark
                        ? const Color(0xFF6B6B6B)
                        : const Color(0xFF8E8E93)),
              ),
              prefixIconConstraints: const BoxConstraints(minWidth: 0),
              suffixIcon: IconButton(
                icon: Icon(
                  obscure
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: isDark
                      ? const Color(0xFF6B6B6B)
                      : const Color(0xFF8E8E93),
                ),
                onPressed: onToggle,
                splashRadius: 20,
              ),
            ),
            onSubmitted: (_) => onSubmitted?.call(),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordStrength(bool isDark) {
    final colors = [
      const Color(0xFFFF3B30),
      const Color(0xFFFF9500),
      const Color(0xFFFFCC00),
      const Color(0xFF34C759),
    ];
    final labels = ['Weak', 'Fair', 'Good', 'Strong'];

    return Row(
      children: [
        Expanded(
          child: Row(
            children: List.generate(4, (index) {
              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(right: index < 3 ? 4 : 0),
                  decoration: BoxDecoration(
                    color: index < _passwordStrength
                        ? colors[_passwordStrength - 1]
                        : (isDark
                            ? const Color(0xFF2A2A2A)
                            : const Color(0xFFE5E5E5)),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              );
            }),
          ),
        ),
        if (_passwordStrength > 0) ...[
          const SizedBox(width: 12),
          Text(
            labels[_passwordStrength - 1],
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: colors[_passwordStrength - 1],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildTermsCheckbox(bool isDark) {
    return GestureDetector(
      onTap: () => setState(() => _acceptedTerms = !_acceptedTerms),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 20,
            height: 20,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              color: _acceptedTerms
                  ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: _acceptedTerms
                    ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                    : (isDark
                        ? const Color(0xFF4A4A4A)
                        : const Color(0xFFCCCCCC)),
                width: 1.5,
              ),
            ),
            child: _acceptedTerms
                ? Icon(Icons.check_rounded,
                    size: 14,
                    color: isDark ? const Color(0xFF1A1A1A) : Colors.white)
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: isDark
                      ? const Color(0xFFAAAAAA)
                      : const Color(0xFF6B6B6B),
                  height: 1.4,
                ),
                children: [
                  const TextSpan(text: 'I agree to the '),
                  TextSpan(
                    text: 'Terms of Service',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                    ),
                  ),
                  const TextSpan(text: ' and '),
                  TextSpan(
                    text: 'Privacy Policy',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSignUpButton(bool isDark) {
    final isEnabled = _acceptedTerms && !_isLoading;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isEnabled ? _handleSignUp : null,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 52,
          decoration: BoxDecoration(
            color: isEnabled
                ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                : (isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5)),
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
                          isDark ? const Color(0xFF1A1A1A) : Colors.white),
                    ),
                  )
                : Text(
                    'Create Account',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isEnabled
                          ? (isDark ? const Color(0xFF1A1A1A) : Colors.white)
                          : (isDark
                              ? const Color(0xFF6B6B6B)
                              : const Color(0xFF8E8E93)),
                    ),
                  ),
          ),
        ),
      ),
    );
  }

  Widget _buildDivider(bool isDark) {
    return Row(
      children: [
        Expanded(
          child: Container(
            height: 1,
            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'or',
            style: GoogleFonts.inter(
              fontSize: 14,
              color: isDark ? const Color(0xFF6B6B6B) : const Color(0xFF8E8E93),
            ),
          ),
        ),
        Expanded(
          child: Container(
            height: 1,
            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
          ),
        ),
      ],
    );
  }

  Widget _buildSocialButtons(bool isDark) {
    return Column(
      children: [
        _SocialButton(
          onTap: _isLoading ? null : _handleGoogleSignUp,
          icon: _GoogleIcon(),
          label: 'Continue with Google',
          isDark: isDark,
        ),
        const SizedBox(height: 12),
        _SocialButton(
          onTap: _isLoading ? null : _handleAppleSignUp,
          icon: Icon(Icons.apple,
              size: 22, color: isDark ? Colors.white : const Color(0xFF1A1A1A)),
          label: 'Continue with Apple',
          isDark: isDark,
        ),
      ],
    );
  }

  Widget _buildSignInLink(bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          'Already have an account? ',
          style: GoogleFonts.inter(
            fontSize: 15,
            color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
          ),
        ),
        GestureDetector(
          onTap: () => widget.onSignIn?.call(),
          child: Text(
            'Sign In',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
          ),
        ),
      ],
    );
  }
}

class _SocialButton extends StatelessWidget {
  final VoidCallback? onTap;
  final Widget icon;
  final String label;
  final bool isDark;

  const _SocialButton({
    required this.onTap,
    required this.icon,
    required this.label,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
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
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              icon,
              const SizedBox(width: 12),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GoogleIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 20,
      height: 20,
      child: CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;

    canvas.drawPath(
      Path()
        ..moveTo(w * 0.95, h * 0.5)
        ..arcToPoint(Offset(w * 0.5, h * 0.95),
            radius: Radius.circular(w * 0.45))
        ..lineTo(w * 0.5, h * 0.7)
        ..arcToPoint(Offset(w * 0.7, h * 0.5),
            radius: Radius.circular(w * 0.2), clockwise: false)
        ..close(),
      Paint()..color = const Color(0xFF4285F4),
    );

    canvas.drawPath(
      Path()
        ..moveTo(w * 0.5, h * 0.95)
        ..arcToPoint(Offset(w * 0.05, h * 0.5),
            radius: Radius.circular(w * 0.45))
        ..lineTo(w * 0.25, h * 0.5)
        ..arcToPoint(Offset(w * 0.5, h * 0.7),
            radius: Radius.circular(w * 0.25), clockwise: false)
        ..close(),
      Paint()..color = const Color(0xFF34A853),
    );

    canvas.drawPath(
      Path()
        ..moveTo(w * 0.05, h * 0.5)
        ..arcToPoint(Offset(w * 0.5, h * 0.05),
            radius: Radius.circular(w * 0.45))
        ..lineTo(w * 0.5, h * 0.3)
        ..arcToPoint(Offset(w * 0.25, h * 0.5),
            radius: Radius.circular(w * 0.25), clockwise: false)
        ..close(),
      Paint()..color = const Color(0xFFFBBC05),
    );

    canvas.drawPath(
      Path()
        ..moveTo(w * 0.5, h * 0.05)
        ..arcToPoint(Offset(w * 0.95, h * 0.5),
            radius: Radius.circular(w * 0.45))
        ..lineTo(w * 0.7, h * 0.5)
        ..arcToPoint(Offset(w * 0.5, h * 0.3),
            radius: Radius.circular(w * 0.2), clockwise: false)
        ..close(),
      Paint()..color = const Color(0xFFEA4335),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
