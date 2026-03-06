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

/// GptnixAssistantMessageTile
///
/// Renders a single persisted assistant message — identičan layout kao što je
/// bio inline u GptnixSseChat._buildMessageItem, samo izvučen u zaseban widget.
///
/// Sadrži:
///   - GptnixImageMessage     (ako ima images)
///   - GptnixAssistantMessageBody
///   - GptnixMessageActionRow
///   - GptnixWebSourcesRow    (ako ima sources)
class GptnixAssistantMessageTile extends StatelessWidget {
  const GptnixAssistantMessageTile({
    super.key,
    required this.stableId,
    required this.content,
    required this.isDark,
    this.imagesJson,
    this.sourcesJson,
    required this.onCopy,
    required this.onShare,
  });

  final String stableId;
  final String content;
  final bool isDark;

  /// Može biti List<dynamic> ili null.
  final dynamic imagesJson;

  /// Može biti List<dynamic> ili null.
  final dynamic sourcesJson;

  final Future<void> Function() onCopy;
  final Future<void> Function() onShare;

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final border = isDark ? Colors.white12 : Colors.black12;

    final hasImages = imagesJson is List && (imagesJson as List).isNotEmpty;
    final hasSources = sourcesJson is List && (sourcesJson as List).isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hasImages)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GptnixImageMessage(
                dataJson: {
                  'urls': imagesJson,
                  'imageUrl': (imagesJson as List).isNotEmpty
                      ? (imagesJson as List)[0]
                      : '',
                  'prompt': 'Generated image',
                },
              ),
            ),
          GptnixAssistantMessageBody(
            rawText: content,
            isTyping: false,
            stableId: stableId,
            isDark: isDark,
          ),
          const SizedBox(height: 10),
          GptnixMessageActionRow(
            rawText: content,
            onCopy: () async => await onCopy(),
            onShare: () async => await onShare(),
          ),
          if (hasSources) ...[
            const SizedBox(height: 10),
            GptnixWebSourcesRow(
              sourcesJson: {'sources': sourcesJson},
              isDark: isDark,
              maxItems: 6,
              cardBg: isDark
                  ? Colors.white.withOpacity(0.06)
                  : theme.secondaryBackground,
              cardBorder: border,
              text: theme.primaryText,
              subtext: theme.secondaryText,
              muted: theme.secondaryText,
            ),
          ],
        ],
      ),
    );
  }
}
