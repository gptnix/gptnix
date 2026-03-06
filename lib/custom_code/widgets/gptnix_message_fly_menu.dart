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

import 'package:flutter/services.dart';
import 'dart:ui'; // Za BackdropFilter

class GptnixMessageFlyMenu {
  static Future<void> show({
    required BuildContext context,
    required BuildContext anchorContext,
    required String messageText,
    VoidCallback? onCopy,
    VoidCallback? onEdit,
    VoidCallback? onReply,
    VoidCallback? onResend,
    VoidCallback? onDelete,
    bool? isDark,
  }) async {
    final overlay = Overlay.of(context);
    if (overlay == null) return;

    final dark = isDark ?? (Theme.of(context).brightness == Brightness.dark);
    final anchor = _getGlobalRect(anchorContext);
    if (anchor == Rect.zero) return;

    final media = MediaQuery.of(context);
    final screenW = media.size.width;
    final screenH = media.size.height;

    // Menu dimenzije
    const double itemSize = 44; // Malo veći tap target za premium feel
    const double padX = 8;
    const double gap = 4;
    final double menuW = (itemSize * 5) + (gap * 4) + (padX * 2);
    const double menuH = 52;

    // Smart pozicioniranje
    final bool canFitTop = anchor.top > (media.padding.top + menuH + 20);
    double top = canFitTop ? (anchor.top - menuH - 8) : (anchor.bottom + 8);

    // Clamp pozicije
    top = top.clamp(
        media.padding.top + 10, screenH - menuH - media.padding.bottom - 10);

    double left =
        anchor.right - (menuW * 0.8); // Poravnaj prema desnoj strani mjehurića
    left = left.clamp(12.0, screenW - menuW - 12.0);

    final bg = dark ? const Color(0xFF222222) : Colors.white;
    final br =
        dark ? Colors.white.withOpacity(0.1) : Colors.black.withOpacity(0.08);

    late OverlayEntry entry;

    void closeMenu() {
      entry.remove();
    }

    // ✅ Koristimo TweenAnimationBuilder za premium ulaz bez StatefulWidgeta
    entry = OverlayEntry(
      builder: (ctx) {
        return Stack(
          children: [
            // Barrier
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onTap: closeMenu,
                onPanDown: (_) => closeMenu(),
                child: Container(color: Colors.transparent),
              ),
            ),
            // Menu sa animacijom
            Positioned(
              left: left,
              top: top,
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.0, end: 1.0),
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOutBack, // Lagani "bounce" efekt
                builder: (context, value, child) {
                  return Transform.scale(
                    scale: 0.9 + (0.1 * value),
                    alignment:
                        canFitTop ? Alignment.bottomRight : Alignment.topRight,
                    child: Opacity(
                      opacity: value,
                      child: child,
                    ),
                  );
                },
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    width: menuW,
                    height: menuH,
                    padding: const EdgeInsets.symmetric(horizontal: padX),
                    decoration: BoxDecoration(
                      color: bg.withOpacity(dark ? 0.94 : 0.98),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: br, width: 1),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(dark ? 0.4 : 0.15),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: BackdropFilter(
                        // ✅ Suptilno zamućenje iza menija
                        filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _FlyIconButton(
                                dark: dark,
                                icon: Icons.copy_rounded,
                                tip: 'Copy',
                                onTap: () {
                                  onCopy?.call();
                                  closeMenu();
                                }),
                            _FlyIconButton(
                                dark: dark,
                                icon: Icons.edit_rounded,
                                tip: 'Edit',
                                onTap: () {
                                  onEdit?.call();
                                  closeMenu();
                                }),
                            _FlyIconButton(
                                dark: dark,
                                icon: Icons.reply_rounded,
                                tip: 'Reply',
                                onTap: () {
                                  onReply?.call();
                                  closeMenu();
                                }),
                            _FlyIconButton(
                                dark: dark,
                                icon: Icons.refresh_rounded,
                                tip: 'Resend',
                                onTap: () {
                                  onResend?.call();
                                  closeMenu();
                                }),
                            _FlyIconButton(
                                dark: dark,
                                icon: Icons.delete_outline_rounded,
                                tip: 'Delete',
                                danger: true,
                                onTap: () {
                                  onDelete?.call();
                                  closeMenu();
                                }),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );

    overlay.insert(entry);
    HapticFeedback.lightImpact(); // ✅ Lagana vibracija pri otvaranju
  }

  static Rect _getGlobalRect(BuildContext ctx) {
    final box = ctx.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return Rect.zero;
    final topLeft = box.localToGlobal(Offset.zero);
    return topLeft & box.size;
  }
}

class _FlyIconButton extends StatelessWidget {
  final bool dark;
  final IconData icon;
  final String tip;
  final VoidCallback onTap;
  final bool danger;

  const _FlyIconButton({
    required this.dark,
    required this.icon,
    required this.tip,
    required this.onTap,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    final defaultColor =
        dark ? Colors.white.withOpacity(0.9) : const Color(0xFF333333);
    final color =
        danger ? (dark ? Colors.redAccent : Colors.red) : defaultColor;

    return IconButton(
      icon: Icon(icon, size: 20, color: color),
      tooltip: tip,
      onPressed: () {
        HapticFeedback.mediumImpact(); // ✅ Vibracija pri odabiru akcije
        onTap();
      },
      splashRadius: 22,
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
    );
  }
}
