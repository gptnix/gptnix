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

import '/custom_code/widgets/index.dart';
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

class GptnixSourceFaviconStrip extends StatelessWidget {
  const GptnixSourceFaviconStrip({
    super.key,
    this.width,
    this.height,
    this.sourcesJson,
    this.isDark,
    this.maxItems = 6,
    this.iconSize = 18,
    this.gap = 8,
  });

  final double? width;
  final double? height;

  /// Expected: Map { sources: [ {url,title,imageUrl...} ] } OR List of maps
  final dynamic sourcesJson;

  final bool? isDark;
  final int maxItems;
  final double iconSize;
  final double gap;

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

  String _faviconUrlFromPageUrl(String url) {
    // Google S2 favicon service
    return 'https://www.google.com/s2/favicons?sz=64&domain_url=' +
        Uri.encodeComponent(url);
  }

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final dark = isDark ?? (Theme.of(context).brightness == Brightness.dark);
    final border = dark ? Colors.white12 : Colors.black12;

    final list = _parse(sourcesJson);
    if (list.isEmpty) return const SizedBox.shrink();

    final items = list.take(maxItems.clamp(1, 12)).toList();

    return SizedBox(
      width: width,
      height: height,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: items.map((s) {
            final url = (s['url'] ?? s['link'] ?? '').toString().trim();
            if (url.isEmpty) return const SizedBox.shrink();

            final title = (s['title'] ?? s['name'] ?? _domain(url)).toString();

            return Padding(
              padding: EdgeInsets.only(right: gap),
              child: Tooltip(
                message: title,
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () => launchURL(url),
                  child: Container(
                    width: iconSize + 10,
                    height: iconSize + 10,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: border),
                      color: dark
                          ? Colors.white.withOpacity(0.04)
                          : Colors.black.withOpacity(0.03),
                    ),
                    alignment: Alignment.center,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Image.network(
                        _faviconUrlFromPageUrl(url),
                        width: iconSize,
                        height: iconSize,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Icon(
                          Icons.public,
                          size: iconSize,
                          color: theme.secondaryText,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}
