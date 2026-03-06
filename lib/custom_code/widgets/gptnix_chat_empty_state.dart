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

import 'index.dart'; // Imports other custom widgets

class GptnixChatEmptyState extends StatelessWidget {
  const GptnixChatEmptyState({
    super.key,
    this.width,
    this.height,
    this.title,
    this.subtitle,
    this.isDark,
    this.bg,
    this.textColor,
    this.subtext,
    this.iconColor,
    this.border,

    /// Optional: custom prompt suggestions (List<String> or Map{items:[...]})
    this.suggestionsJson,

    /// Optional: tap callback (npr. ubaci tekst u input)
    this.onSuggestionTap,
  });

  final double? width;
  final double? height;

  final String? title;
  final String? subtitle;

  final bool? isDark;
  final Color? bg;
  final Color? textColor;
  final Color? subtext;
  final Color? iconColor;
  final Color? border;

  final dynamic suggestionsJson;
  final Future Function(String)? onSuggestionTap;

  List<String> _parseSuggestions(dynamic raw) {
    // Accept:
    // - List<String>
    // - List<dynamic>
    // - Map{items:[...]} / Map{data:[...]} / Map{suggestions:[...]}
    if (raw == null) return const [];

    try {
      if (raw is List) {
        return raw
            .map((e) => e.toString())
            .where((s) => s.trim().isNotEmpty)
            .toList();
      }
      if (raw is Map) {
        final v = raw['items'] ?? raw['data'] ?? raw['suggestions'];
        if (v is List) {
          return v
              .map((e) => e.toString())
              .where((s) => s.trim().isNotEmpty)
              .toList();
        }
      }
    } catch (_) {}

    return const [];
  }

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);

    final bool dark =
        isDark ?? (Theme.of(context).brightness == Brightness.dark);

    // Colors (ChatGPT-ish: minimal surface + subtle borders)
    final Color surface = bg ?? theme.secondaryBackground;
    final Color tColor = textColor ?? theme.primaryText;
    final Color sColor = subtext ?? theme.secondaryText;
    final Color iColor = iconColor ?? theme.primaryText;
    final Color bColor = border ?? (dark ? Colors.white12 : Colors.black12);

    final String heading = title ?? 'Kako mogu pomoći?';
    final String sub = subtitle ?? 'Odaberi prijedlog ili napiši svoju poruku.';

    // Default “ChatGPT-style” prompt cards
    final defaultSuggestions = <_SuggestionItem>[
      _SuggestionItem(
        icon: Icons.lightbulb_outline_rounded,
        title: 'Ideja u 30 sekundi',
        prompt: 'Daj mi 10 ideja za objavu na Instagramu za moj biznis.',
      ),
      _SuggestionItem(
        icon: Icons.code_rounded,
        title: 'Popravi kod',
        prompt: 'Evo koda, ispravi bug i napiši clean verziju.',
      ),
      _SuggestionItem(
        icon: Icons.summarize_rounded,
        title: 'Sažmi tekst',
        prompt: 'Sažmi ovo u 5 bullet točaka i istakni ključne stvari.',
      ),
      _SuggestionItem(
        icon: Icons.shopping_bag_outlined,
        title: 'Analiza prodaje',
        prompt: 'Analiziraj promet i predloži 3 brze optimizacije marže.',
      ),
      _SuggestionItem(
        icon: Icons.photo_outlined,
        title: 'Prompt za sliku',
        prompt: 'Napiši premium prompt za banner 16:9 u retail stilu.',
      ),
      _SuggestionItem(
        icon: Icons.map_outlined,
        title: 'Planiraj nešto',
        prompt: 'Napravi mi plan puta za vikend s budžetom i rutom.',
      ),
    ];

    // If user provided suggestionsJson, we’ll convert them into cards too
    final parsed = _parseSuggestions(suggestionsJson);
    final List<_SuggestionItem> items = parsed.isNotEmpty
        ? parsed
            .take(10)
            .map((s) => _SuggestionItem(
                  icon: Icons.auto_awesome_rounded,
                  title: 'Prijedlog',
                  prompt: s,
                ))
            .toList()
        : defaultSuggestions;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: Container(
          width: width,
          height: height,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
          child: LayoutBuilder(
            builder: (context, c) {
              final w = c.maxWidth;
              final int cols = w < 520 ? 1 : 2;

              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Hero top
                  const SizedBox(height: 10),
                  Container(
                    width: 54,
                    height: 54,
                    decoration: BoxDecoration(
                      color: surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: bColor, width: 1),
                      boxShadow: [
                        BoxShadow(
                          color: dark ? Colors.black26 : Colors.black12,
                          blurRadius: 18,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.auto_awesome_rounded,
                      size: 26,
                      color: iColor,
                    ),
                  ),
                  const SizedBox(height: 14),

                  Text(
                    heading,
                    textAlign: TextAlign.center,
                    style: theme.headlineSmall.copyWith(
                      color: tColor,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    sub,
                    textAlign: TextAlign.center,
                    style: theme.bodyMedium.copyWith(
                      color: sColor,
                      height: 1.25,
                    ),
                  ),

                  const SizedBox(height: 18),

                  // Suggestion cards
                  _SuggestionsGrid(
                    items: items,
                    columns: cols,
                    surface: surface,
                    border: bColor,
                    titleColor: tColor,
                    subColor: sColor,
                    dark: dark,
                    onTap: (prompt) async {
                      if (onSuggestionTap != null) {
                        await onSuggestionTap!(prompt);
                      }
                    },
                  ),

                  const SizedBox(height: 12),

                  // Tiny helper line (ChatGPT-ish)
                  Opacity(
                    opacity: 0.9,
                    child: Text(
                      'Savjet: koristi jasne upute i napiši cilj + format (npr. bullet, tablica, koraci).',
                      textAlign: TextAlign.center,
                      style: theme.bodySmall.copyWith(
                        color: sColor,
                        height: 1.2,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

/// ------------------------------------------------------------
/// Suggestion grid (responsive) - ChatGPT vibe
/// ------------------------------------------------------------
class _SuggestionsGrid extends StatelessWidget {
  const _SuggestionsGrid({
    required this.items,
    required this.columns,
    required this.surface,
    required this.border,
    required this.titleColor,
    required this.subColor,
    required this.dark,
    required this.onTap,
  });

  final List<_SuggestionItem> items;
  final int columns;

  final Color surface;
  final Color border;
  final Color titleColor;
  final Color subColor;
  final bool dark;

  final Future Function(String prompt) onTap;

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);

    final double gap = 10;
    final double totalGap = gap * (columns - 1);
    final double cardW = (MediaQuery.of(context).size.width.isFinite)
        ? ((MediaQuery.of(context).size.width) * 0.0) // not used
        : 0;

    // We’ll build grid manually to keep it super stable in FlutterFlow
    final rows = <List<_SuggestionItem>>[];
    for (int i = 0; i < items.length; i += columns) {
      rows.add(items.sublist(i, (i + columns).clamp(0, items.length)));
    }

    return Column(
      children: [
        for (final row in rows) ...[
          Row(
            children: [
              for (int i = 0; i < row.length; i++) ...[
                Expanded(
                  child: _SuggestionCard(
                    item: row[i],
                    surface: surface,
                    border: border,
                    titleColor: titleColor,
                    subColor: subColor,
                    dark: dark,
                    onTap: () => onTap(row[i].prompt),
                  ),
                ),
                if (i != row.length - 1) SizedBox(width: gap),
              ],
            ],
          ),
          const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _SuggestionCard extends StatefulWidget {
  const _SuggestionCard({
    required this.item,
    required this.surface,
    required this.border,
    required this.titleColor,
    required this.subColor,
    required this.dark,
    required this.onTap,
  });

  final _SuggestionItem item;
  final Color surface;
  final Color border;
  final Color titleColor;
  final Color subColor;
  final bool dark;
  final VoidCallback onTap;

  @override
  State<_SuggestionCard> createState() => _SuggestionCardState();
}

class _SuggestionCardState extends State<_SuggestionCard> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final theme = FlutterFlowTheme.of(context);

    final Color fill = widget.dark
        ? (widget.surface.withOpacity(_hover ? 0.92 : 0.82))
        : (widget.surface.withOpacity(_hover ? 0.98 : 0.92));

    final Color brd = _hover
        ? (widget.dark ? Colors.white24 : Colors.black26)
        : widget.border;

    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: brd, width: 1),
            boxShadow: _hover
                ? [
                    BoxShadow(
                      color: widget.dark ? Colors.black26 : Colors.black12,
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : [],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: widget.dark ? Colors.white10 : Colors.black12,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  widget.item.icon,
                  size: 18,
                  color: widget.subColor,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodyMedium.copyWith(
                        color: widget.titleColor,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.item.prompt,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.bodySmall.copyWith(
                        color: widget.subColor,
                        fontSize: 12.5,
                        height: 1.2,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SuggestionItem {
  const _SuggestionItem({
    required this.icon,
    required this.title,
    required this.prompt,
  });

  final IconData icon;
  final String title;
  final String prompt;
}
