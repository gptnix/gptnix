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

class ModernTermsOfUseWidget extends StatelessWidget {
  const ModernTermsOfUseWidget({
    super.key,
    this.width,
    this.height,
    this.onBack,
    this.companyName,
    this.appName,
    this.effectiveDate,
    this.lastUpdated,
    this.contactEmail,
  });

  final double? width;
  final double? height;
  final Future Function()? onBack;

  /// Company name to display
  final String? companyName;

  /// App name to display
  final String? appName;

  /// Effective date of the terms
  final String? effectiveDate;

  /// Last updated date
  final String? lastUpdated;

  /// Contact email
  final String? contactEmail;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final company = companyName ?? 'GPTNiX';
    final app = appName ?? 'GPTNiX';
    final effective = effectiveDate ?? 'January 1, 2025';
    final updated = lastUpdated ?? 'January 1, 2025';
    final email = contactEmail ?? 'support@gptnix.com';

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
                    const SizedBox(height: 8),

                    // Date info card
                    _buildDateCard(isDark, effective, updated),
                    const SizedBox(height: 24),

                    // Introduction
                    _buildSection(
                      isDark,
                      null,
                      'Welcome to $app. By accessing or using our AI-powered services ("Services"), you agree to be bound by these Terms of Use. Please read them carefully.',
                    ),

                    // 1. Acceptance of Terms
                    _buildSection(
                      isDark,
                      '1. Acceptance of Terms',
                      'By creating an account or using our Services, you confirm that you have read, understood, and agree to these Terms of Use and our Privacy Policy. If you do not agree, please do not use our Services.',
                    ),

                    // 2. Eligibility
                    _buildSection(
                      isDark,
                      '2. Eligibility',
                      'You must be at least 13 years old (or the minimum age required in your jurisdiction) to use our Services. By using our Services, you represent that you meet this requirement.',
                    ),

                    // 3. Account Registration
                    _buildSection(
                      isDark,
                      '3. Account Registration',
                      'To access certain features, you may need to create an account. You agree to:',
                    ),
                    _buildBulletList(isDark, [
                      'Provide accurate and complete information',
                      'Keep your account credentials secure',
                      'Notify us immediately of any unauthorized access',
                      'Be responsible for all activities under your account',
                    ]),

                    // 4. Acceptable Use
                    _buildSection(
                      isDark,
                      '4. Acceptable Use',
                      'You agree not to:',
                    ),
                    _buildBulletList(isDark, [
                      'Use the Services for illegal or harmful purposes',
                      'Generate content that is abusive, harassing, or discriminatory',
                      'Attempt to reverse-engineer or exploit our AI systems',
                      'Violate intellectual property rights of others',
                      'Distribute malware or engage in phishing activities',
                      'Use automated systems to overload our Services',
                    ]),

                    // 5. AI-Generated Content
                    _buildSection(
                      isDark,
                      '5. AI-Generated Content',
                      'Our Services use artificial intelligence to generate responses. You acknowledge that:',
                    ),
                    _buildBulletList(isDark, [
                      'AI-generated content may not always be accurate',
                      'You are responsible for verifying information before relying on it',
                      'We do not guarantee the completeness or reliability of AI outputs',
                      'AI responses should not be considered professional advice (legal, medical, financial, etc.)',
                    ]),

                    // 6. Intellectual Property
                    _buildSection(
                      isDark,
                      '6. Intellectual Property',
                      '$company retains all rights to the Services, including software, designs, and AI models. You retain ownership of content you input, but grant us a license to process it for providing the Services.',
                    ),

                    // 7. Subscription & Payments
                    _buildSection(
                      isDark,
                      '7. Subscription & Payments',
                      'Some features may require a paid subscription. By subscribing, you agree to:',
                    ),
                    _buildBulletList(isDark, [
                      'Pay all applicable fees',
                      'Automatic renewal unless cancelled',
                      'No refunds for partial billing periods (unless required by law)',
                    ]),

                    // 8. Termination
                    _buildSection(
                      isDark,
                      '8. Termination',
                      'We reserve the right to suspend or terminate your account if you violate these Terms. You may also delete your account at any time through the app settings.',
                    ),

                    // 9. Disclaimers
                    _buildSection(
                      isDark,
                      '9. Disclaimers',
                      'THE SERVICES ARE PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.',
                    ),

                    // 10. Limitation of Liability
                    _buildSection(
                      isDark,
                      '10. Limitation of Liability',
                      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, $company SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICES.',
                    ),

                    // 11. Changes to Terms
                    _buildSection(
                      isDark,
                      '11. Changes to Terms',
                      'We may update these Terms from time to time. Continued use of the Services after changes constitutes acceptance of the new Terms.',
                    ),

                    // 12. Governing Law
                    _buildSection(
                      isDark,
                      '12. Governing Law',
                      'These Terms are governed by the laws of the jurisdiction where $company is registered, without regard to conflict of law principles.',
                    ),

                    // 13. Contact Us
                    _buildSection(
                      isDark,
                      '13. Contact Us',
                      'If you have any questions about these Terms, please contact us:',
                    ),
                    _buildContactCard(isDark, company, email),

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
            onTap: () => onBack?.call(),
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
              'Terms of Use',
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

  Widget _buildDateCard(bool isDark, String effective, String updated) {
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
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Effective Date',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? const Color(0xFF6B6B6B)
                        : const Color(0xFF8E8E93),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  effective,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Last Updated',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? const Color(0xFF6B6B6B)
                        : const Color(0xFF8E8E93),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  updated,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(bool isDark, String? title, String content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Text(
              title,
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : const Color(0xFF1A1A1A),
              ),
            ),
            const SizedBox(height: 8),
          ],
          Text(
            content,
            style: GoogleFonts.inter(
              fontSize: 14,
              height: 1.6,
              color: isDark ? const Color(0xFFAAAAAA) : const Color(0xFF4A4A4A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBulletList(bool isDark, List<String> items) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: items
            .map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 8, right: 12),
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF6B6B6B)
                              : const Color(0xFF8E8E93),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          item,
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            height: 1.5,
                            color: isDark
                                ? const Color(0xFFAAAAAA)
                                : const Color(0xFF4A4A4A),
                          ),
                        ),
                      ),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }

  Widget _buildContactCard(bool isDark, String company, String email) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF2A2A2A)
                      : const Color(0xFFF5F5F5),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.support_agent_outlined,
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
                      company,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Support Team',
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
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF0D0D0D) : const Color(0xFFF5F5F5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.email_outlined,
                  size: 18,
                  color: isDark
                      ? const Color(0xFF6B6B6B)
                      : const Color(0xFF8E8E93),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    email,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                    ),
                  ),
                ),
                Icon(
                  Icons.copy_outlined,
                  size: 18,
                  color: isDark
                      ? const Color(0xFF4A4A4A)
                      : const Color(0xFFCCCCCC),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
