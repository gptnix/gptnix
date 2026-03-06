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

class GptnixWebImagePreviewRow extends StatelessWidget {
  const GptnixWebImagePreviewRow({
    super.key,
    this.width,
    this.height,
    this.sourcesJson,
    this.isDark,
    this.maxItems = 6,
    this.cardW = 140,
    this.cardH = 92,
    this.radius = 14,
  });

  final double? width;
  final double? height;
  final dynamic sourcesJson;

  final bool? isDark;
  final int maxItems;

  final double cardW;
  final double cardH;
  final double radius;

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

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);
    final dark = isDark ?? (Theme.of(context).brightness == Brightness.dark);

    final border = dark ? Colors.white12 : Colors.black12;
    final mut = dark ? Colors.white60 : Colors.black54;

    final list = _parse(sourcesJson);

    // uzmi samo one koji imaju imageUrl i url
    final imgs = <Map<String, dynamic>>[];
    for (final s in list) {
      final url = (s['url'] ?? s['link'] ?? '').toString().trim();
      final imageUrl = (s['imageUrl'] ?? s['image_url'] ?? s['image'] ?? '')
          .toString()
          .trim();

      if (url.isEmpty) continue;
      if (!imageUrl.startsWith('http')) continue;

      imgs.add({
        'url': url,
        'imageUrl': imageUrl,
        'title': (s['title'] ?? s['name'] ?? '').toString().trim(),
      });
    }

    if (imgs.isEmpty) return const SizedBox.shrink();

    final take = imgs.take(maxItems.clamp(1, 12)).toList();

    return SizedBox(
      width: width,
      height: height ?? (cardH + 8),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 0),
        itemCount: take.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final item = take[i];
          final url = item['url'] as String;
          final imageUrl = item['imageUrl'] as String;
          final title = item['title'] as String;

          return InkWell(
            borderRadius: BorderRadius.circular(radius),
            onTap: () => launchURL(url),
            child: Container(
              width: cardW,
              height: cardH,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(radius),
                border: Border.all(color: border),
              ),
              clipBehavior: Clip.antiAlias,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: border,
                      alignment: Alignment.center,
                      child: Icon(Icons.image_not_supported, color: mut),
                    ),
                  ),
                  // lagani gradient + naslov (ako ima)
                  if (title.isNotEmpty)
                    Align(
                      alignment: Alignment.bottomLeft,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withOpacity(0.0),
                              Colors.black.withOpacity(0.55),
                            ],
                          ),
                        ),
                        child: Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.bodySmall.copyWith(
                            color: Colors.white,
                            fontSize: 12.2,
                            fontWeight: FontWeight.w700,
                            height: 1.1,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
