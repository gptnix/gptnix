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

import '/custom_code/actions/index.dart'; // Imports other custom actions

class GptnixWebSourcesRow extends StatelessWidget {
  const GptnixWebSourcesRow({
    super.key,
    this.width,
    this.height,
    this.sourcesJson,
    this.isDark,
    this.cardBg,
    this.cardBorder,
    this.text,
    this.subtext,
    this.muted,
    this.maxItems,
  });

  final double? width;
  final double? height;

  /// Expected:
  /// Map { sources: [ {title,url,snippet,provider,imageUrl} ] }
  /// OR List of source maps.
  final dynamic sourcesJson;

  final bool? isDark;
  final Color? cardBg;
  final Color? cardBorder;
  final Color? text;
  final Color? subtext;
  final Color? muted;

  final int? maxItems;

  List<Map<String, dynamic>> _parse(dynamic json) {
    if (json == null) return [];
    if (json is List) {
      return json
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    if (json is Map) {
      final s = json['sources'] ?? json['items'] ?? json['data'];
      if (s is List) {
        return s
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
    }
    return [];
  }

  String _domain(String url) {
    try {
      return Uri.parse(url).host.replaceFirst('www.', '');
    } catch (_) {
      return url;
    }
  }

  String _faviconUrl(String url) {
    return 'https://www.google.com/s2/favicons?sz=64&domain_url=' +
        Uri.encodeComponent(url);
  }

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final dark = isDark ?? (Theme.of(context).brightness == Brightness.dark);

    final bg = cardBg ?? theme.secondaryBackground;
    final br = cardBorder ?? (dark ? Colors.white12 : Colors.black12);
    final tx = text ?? theme.primaryText;
    final sub = subtext ?? theme.secondaryText;
    final mut = muted ?? (dark ? Colors.white54 : Colors.black54);

    final list = _parse(sourcesJson);
    if (list.isEmpty) return const SizedBox.shrink();

    final takeN = (maxItems ?? 6).clamp(1, 12);
    final items = list.take(takeN).toList();

    return SizedBox(
      width: width,
      height: height,
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: items.map((s) {
          final url = (s['url'] ?? s['link'] ?? '').toString().trim();
          if (url.isEmpty) return const SizedBox.shrink();

          final title =
              (s['title'] ?? s['name'] ?? _domain(url)).toString().trim();
          final snippet =
              (s['snippet'] ?? s['content'] ?? s['description'] ?? '')
                  .toString()
                  .trim();

          final imageUrl = (s['imageUrl'] ?? s['image_url'] ?? s['image'] ?? '')
              .toString()
              .trim();

          final hasImg = imageUrl.startsWith('http');

          return InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => launchURL(url),
            child: Container(
              width: 310,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: br),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(dark ? 0.25 : 0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.network(
                          _faviconUrl(url),
                          width: 20,
                          height: 20,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 20,
                            height: 20,
                            color: br,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.bodyMedium.copyWith(
                            color: tx,
                            fontSize: 13.5,
                            fontWeight: FontWeight.w800,
                            height: 1.15,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _domain(url),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.bodySmall.copyWith(
                      color: mut,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (snippet.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      snippet,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodySmall.copyWith(
                        color: sub,
                        fontSize: 12.5,
                        height: 1.25,
                      ),
                    ),
                  ],
                  if (hasImg) ...[
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: AspectRatio(
                        aspectRatio: 16 / 9,
                        child: Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            color: br,
                            alignment: Alignment.center,
                            child: Icon(Icons.image_not_supported, color: mut),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
