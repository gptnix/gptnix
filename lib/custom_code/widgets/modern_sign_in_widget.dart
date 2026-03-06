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

// ✅ FIX: direktno Firebase Auth
import 'package:firebase_auth/firebase_auth.dart';

// ✅ Google sign-in
import 'package:google_sign_in/google_sign_in.dart';

// ✅ Apple sign-in
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

class ModernSignInWidget extends StatefulWidget {
  const ModernSignInWidget({
    super.key,
    this.width,
    this.height,
    this.onSignIn,
    this.onGoogleSignIn,
    this.onAppleSignIn,
    this.onForgotPassword,
    this.onSignUp,
  });

  /// Widget dimensions (required by FlutterFlow)
  final double? width;
  final double? height;

  /// Called after successful email/password sign in - use for navigation
  final Future Function()? onSignIn;

  /// Called after successful Google sign in - use for navigation
  final Future Function()? onGoogleSignIn;

  /// Called after successful Apple sign in - use for navigation
  final Future Function()? onAppleSignIn;

  /// Called when user taps "Forgot Password" - navigate to reset page
  final Future Function()? onForgotPassword;

  /// Called when user taps "Sign Up" link - navigate to sign up page
  final Future Function()? onSignUp;

  @override
  State<ModernSignInWidget> createState() => _ModernSignInWidgetState();
}

class _ModernSignInWidgetState extends State<ModernSignInWidget>
    with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailFocusNode = FocusNode();
  final _passwordFocusNode = FocusNode();

  bool _obscurePassword = true;
  bool _isLoading = false;
  bool _rememberMe = false;
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
    _passwordFocusNode.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocusNode.dispose();
    _passwordFocusNode.dispose();
    _animationController.dispose();
    super.dispose();
  }

  String _friendlyAuthError(Object e) {
    if (e is FirebaseAuthException) {
      switch (e.code) {
        case 'invalid-email':
          return 'Neispravan email.';
        case 'user-disabled':
          return 'Korisnički račun je onemogućen.';
        case 'user-not-found':
        case 'wrong-password':
        case 'invalid-credential':
          return 'Neispravan email ili lozinka.';
        case 'too-many-requests':
          return 'Previše pokušaja. Probaj kasnije.';
        case 'network-request-failed':
          return 'Nema mreže ili je veza loša.';
        default:
          return 'Prijava nije uspjela. Pokušaj ponovno.';
      }
    }
    return 'Prijava nije uspjela. Pokušaj ponovno.';
  }

  Future<void> _handleSignIn() async {
    final email = _emailController.text.trim();
    final pass = _passwordController.text;

    if (email.isEmpty || pass.isEmpty) {
      setState(() => _errorMessage = 'Unesi email i lozinku.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email,
        password: pass,
      );

      // (Optional) rememberMe logika - ostavio UI, ali bez “čudnih” side effecta
      // Ako želiš, mogu ti spremiti email u local storage / FFAppState.

      await widget.onSignIn?.call();
    } catch (e) {
      setState(() => _errorMessage = _friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        // user cancelled
        return;
      }

      final googleAuth = await googleUser.authentication;

      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      await FirebaseAuth.instance.signInWithCredential(credential);

      await widget.onGoogleSignIn?.call();
    } catch (e) {
      setState(() => _errorMessage = _friendlyAuthError(e));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleAppleSignIn() async {
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

      await FirebaseAuth.instance.signInWithCredential(oauthCredential);

      await widget.onAppleSignIn?.call();
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
                        const SizedBox(height: 48),
                        _buildWelcomeText(isDark),
                        const SizedBox(height: 40),
                        if (_errorMessage != null) ...[
                          _buildErrorMessage(),
                          const SizedBox(height: 16),
                        ],
                        _buildEmailField(isDark),
                        const SizedBox(height: 16),
                        _buildPasswordField(isDark),
                        const SizedBox(height: 12),
                        _buildOptionsRow(isDark),
                        const SizedBox(height: 24),
                        _buildSignInButton(isDark),
                        const SizedBox(height: 32),
                        _buildDivider(isDark),
                        const SizedBox(height: 32),
                        _buildSocialButtons(isDark),
                        const SizedBox(height: 40),
                        _buildSignUpLink(isDark),
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
          'Welcome back',
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
          'Sign in to continue',
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
            textInputAction: TextInputAction.next,
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
            onChanged: (_) => setState(() {}),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordField(bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Password',
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
              color: _passwordFocusNode.hasFocus
                  ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                  : (isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFE5E5E5)),
              width: _passwordFocusNode.hasFocus ? 1.5 : 1,
            ),
          ),
          child: TextField(
            controller: _passwordController,
            focusNode: _passwordFocusNode,
            obscureText: _obscurePassword,
            textInputAction: TextInputAction.done,
            style: GoogleFonts.inter(
              fontSize: 16,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
            decoration: InputDecoration(
              hintText: '••••••••',
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
                  Icons.lock_outline_rounded,
                  size: 20,
                  color: isDark
                      ? const Color(0xFF6B6B6B)
                      : const Color(0xFF8E8E93),
                ),
              ),
              prefixIconConstraints: const BoxConstraints(minWidth: 0),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  size: 20,
                  color: isDark
                      ? const Color(0xFF6B6B6B)
                      : const Color(0xFF8E8E93),
                ),
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
                splashRadius: 20,
              ),
            ),
            onSubmitted: (_) => _handleSignIn(),
          ),
        ),
      ],
    );
  }

  Widget _buildOptionsRow(bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        GestureDetector(
          onTap: () => setState(() => _rememberMe = !_rememberMe),
          child: Row(
            children: [
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: _rememberMe
                      ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: _rememberMe
                        ? (isDark ? Colors.white : const Color(0xFF1A1A1A))
                        : (isDark
                            ? const Color(0xFF4A4A4A)
                            : const Color(0xFFCCCCCC)),
                    width: 1.5,
                  ),
                ),
                child: _rememberMe
                    ? Icon(Icons.check_rounded,
                        size: 14,
                        color: isDark ? const Color(0xFF1A1A1A) : Colors.white)
                    : null,
              ),
              const SizedBox(width: 8),
              Text(
                'Remember me',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: isDark
                      ? const Color(0xFFAAAAAA)
                      : const Color(0xFF6B6B6B),
                ),
              ),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => widget.onForgotPassword?.call(),
          child: Text(
            'Forgot password?',
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

  Widget _buildSignInButton(bool isDark) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _isLoading ? null : _handleSignIn,
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
                          isDark ? const Color(0xFF1A1A1A) : Colors.white),
                    ),
                  )
                : Text(
                    'Sign In',
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
          onTap: _isLoading ? null : _handleGoogleSignIn,
          icon: _GoogleIcon(),
          label: 'Continue with Google',
          isDark: isDark,
        ),
        const SizedBox(height: 12),
        _SocialButton(
          onTap: _isLoading ? null : _handleAppleSignIn,
          icon: Icon(Icons.apple,
              size: 22, color: isDark ? Colors.white : const Color(0xFF1A1A1A)),
          label: 'Continue with Apple',
          isDark: isDark,
        ),
      ],
    );
  }

  Widget _buildSignUpLink(bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          "Don't have an account? ",
          style: GoogleFonts.inter(
            fontSize: 15,
            color: isDark ? const Color(0xFF8E8E93) : const Color(0xFF6B6B6B),
          ),
        ),
        GestureDetector(
          onTap: () => widget.onSignUp?.call(),
          child: Text(
            'Sign Up',
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
