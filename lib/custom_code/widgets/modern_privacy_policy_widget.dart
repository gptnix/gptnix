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

class ModernPrivacyPolicyWidget extends StatelessWidget {
  const ModernPrivacyPolicyWidget({
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

  /// Company name to display in policy
  final String? companyName;

  /// App name to display in policy
  final String? appName;

  /// Effective date of the policy
  final String? effectiveDate;

  /// Last updated date
  final String? lastUpdated;

  /// Contact email for privacy inquiries
  final String? contactEmail;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final company = companyName ?? 'GPTNiX';
    final app = appName ?? 'GPTNiX';
    final effective = effectiveDate ?? 'January 1, 2025';
    final updated = lastUpdated ?? 'January 1, 2025';
    final email = contactEmail ?? 'privacy@gptnix.com';

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
                      'At $company ("we", "our", or "us"), we value your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal data when you use our AI-powered services, including our website, mobile application, or APIs ("Services").',
                    ),

                    // 1. Information We Collect
                    _buildSection(
                      isDark,
                      '1. Information We Collect',
                      'We may collect the following types of information:',
                    ),
                    _buildSubSection(isDark, 'a. Personal Information', [
                      'Name, email address, and phone number',
                      'Account login details (if registration is required)',
                      'Billing/payment information (if applicable)',
                    ]),
                    _buildSubSection(isDark, 'b. Usage Data', [
                      'Queries, prompts, and interactions with our AI',
                      'Device information (e.g., IP address, browser type, operating system)',
                      'Log data and analytics',
                    ]),
                    _buildSubSection(
                        isDark, 'c. Cookies & Tracking Technologies', [
                      'We use cookies and similar technologies to enhance user experience and analyze usage patterns.',
                    ]),

                    // 2. How We Use Your Information
                    _buildSection(
                      isDark,
                      '2. How We Use Your Information',
                      'We use your data to:',
                    ),
                    _buildBulletList(isDark, [
                      'Provide and improve our AI services',
                      'Personalize your experience',
                      'Process transactions and send related information',
                      'Communicate with you about updates, security alerts, and support',
                      'Analyze usage trends to enhance functionality',
                      'Comply with legal obligations',
                    ]),

                    // 3. Data Sharing & Disclosure
                    _buildSection(
                      isDark,
                      '3. Data Sharing & Disclosure',
                      'We do not sell your personal data. However, we may share information with:',
                    ),
                    _buildBulletList(isDark, [
                      'Service providers who assist in operating our platform',
                      'Legal authorities when required by law',
                      'Business partners (only with your consent)',
                    ]),

                    // 4. Data Retention
                    _buildSection(
                      isDark,
                      '4. Data Retention',
                      'We retain your data only as long as necessary to fulfill the purposes outlined in this policy or as required by law. You may request deletion of your data at any time.',
                    ),

                    // 5. Data Security
                    _buildSection(
                      isDark,
                      '5. Data Security',
                      'We implement industry-standard security measures to protect your data, including encryption, access controls, and regular security audits. However, no method of transmission over the Internet is 100% secure.',
                    ),

                    // 6. Your Rights
                    _buildSection(
                      isDark,
                      '6. Your Rights',
                      'Depending on your location, you may have the following rights:',
                    ),
                    _buildBulletList(isDark, [
                      'Access – Request a copy of your data',
                      'Correction – Update inaccurate information',
                      'Deletion – Request removal of your data',
                      'Portability – Receive your data in a portable format',
                      'Objection – Opt out of certain data processing activities',
                    ]),

                    // 7. Third-Party Services
                    _buildSection(
                      isDark,
                      '7. Third-Party Services',
                      'Our services may integrate with third-party AI providers, analytics tools, or payment processors. These third parties have their own privacy policies, and we encourage you to review them.',
                    ),

                    // 8. Children's Privacy
                    _buildSection(
                      isDark,
                      '8. Children\'s Privacy',
                      'Our services are not intended for children under 13 (or the applicable age in your jurisdiction). We do not knowingly collect data from minors.',
                    ),

                    // 9. Changes to This Policy
                    _buildSection(
                      isDark,
                      '9. Changes to This Policy',
                      'We may update this Privacy Policy from time to time. We will notify you of significant changes via email or through our platform.',
                    ),

                    // 10. Contact Us
                    _buildSection(
                      isDark,
                      '10. Contact Us',
                      'If you have any questions about this Privacy Policy, please contact us at:',
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
              'Privacy Policy',
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

  Widget _buildSubSection(bool isDark, String title, List<String> items) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.white : const Color(0xFF1A1A1A),
            ),
          ),
          const SizedBox(height: 8),
          ...items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
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
              )),
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
                  Icons.business_outlined,
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
                      'Privacy Team',
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
