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

/// Reply/Edit bar koji se prikazuje iznad input bara
/// Prikazuje preview poruke na koju se odgovara ili oznaku da se uređuje poruka
class GptnixReplyEditBar extends StatelessWidget {
  const GptnixReplyEditBar({
    super.key,
    required this.mode,
    required this.previewText,
    required this.onClose,
    this.isDark,
  });

  /// Mode: 'reply' ili 'edit'
  final String mode;

  /// Preview tekst (poruka na koju se odgovara ili "Uređivanje poruke")
  final String previewText;

  /// Callback za zatvaranje (X button)
  final Future Function() onClose;

  /// Dark mode (optional, detektuje iz theme-a ako nije zadano)
  final bool? isDark;

  bool _isDarkMode(BuildContext context) {
    return isDark ?? (Theme.of(context).brightness == Brightness.dark);
  }

  @override
  Widget build(BuildContext context) {
    final dark = _isDarkMode(context);
    final isEdit = mode == 'edit';

    final bg = dark ? const Color(0xFF111111) : const Color(0xFFF8FAFC);
    final border = dark ? const Color(0xFF2A2A2A) : const Color(0xFFE6E6E6);

    final iconColor = isEdit
        ? (dark ? Colors.amber.shade300 : Colors.orange.shade700)
        : (dark ? Colors.blue.shade300 : Colors.blue.shade700);

    final icon = isEdit ? Icons.edit_rounded : Icons.reply_rounded;
    final textColor = dark ? Colors.white70 : Colors.black87;

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: border, width: 1),
        ),
        child: Row(
          children: [
            // Icon (reply ili edit)
            Icon(icon, size: 18, color: iconColor),
            const SizedBox(width: 10),

            // Preview text
            Expanded(
              child: Text(
                previewText.isEmpty ? '(prazna poruka)' : previewText,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: textColor,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            ),

            // Close button
            InkWell(
              onTap: () async => await onClose(),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                child: Icon(
                  Icons.close_rounded,
                  size: 18,
                  color: dark ? Colors.white70 : Colors.black54,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
