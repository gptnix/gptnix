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

import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import 'modern_drawer_core.dart';

class ModernDrawerRecentImagesStrip extends StatelessWidget {
  const ModernDrawerRecentImagesStrip({
    super.key,
    required this.isDark,
    required this.onOpenGalleryAt,
  });

  final bool isDark;
  final void Function(int index) onOpenGalleryAt;

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<ModernDrawerNotifier>();

    if (vm.imagesLoading && !vm.imagesLoadedOnce) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 2, 16, 10),
        child: Container(
          height: 92,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
                color:
                    isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5)),
          ),
          child: const Center(
            child: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      );
    }

    if (vm.recentImages.isEmpty) return const SizedBox.shrink();
    final showCount = vm.recentImages.length.clamp(0, 12);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 2, 16, 10),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color:
                  isDark ? const Color(0xFF2A2A2A) : const Color(0xFFE5E5E5)),
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
              child: Row(
                children: [
                  Icon(Icons.image_outlined,
                      size: 16,
                      color: isDark
                          ? const Color(0xFF8E8E93)
                          : const Color(0xFF6B6B6B)),
                  const SizedBox(width: 8),
                  Text(
                    'RECENT AI IMAGES',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                      color: isDark
                          ? const Color(0xFF6B6B6B)
                          : const Color(0xFF8E8E93),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${vm.recentImages.length}',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : const Color(0xFF1A1A1A),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 56,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                itemCount: showCount,
                itemBuilder: (context, i) {
                  final it = vm.recentImages[i];
                  return GestureDetector(
                    onTap: () => onOpenGalleryAt(i),
                    child: Container(
                      width: 56,
                      height: 56,
                      margin: const EdgeInsets.only(right: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: isDark
                                ? const Color(0xFF2A2A2A)
                                : const Color(0xFFE5E5E5)),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(11),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            Image.network(
                              it.url,
                              fit: BoxFit.cover,
                              loadingBuilder: (context, child, progress) {
                                if (progress == null) return child;
                                return Container(
                                  color: isDark
                                      ? const Color(0xFF0D0D0D)
                                      : const Color(0xFFF5F5F5),
                                  child: const Center(
                                    child: SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    ),
                                  ),
                                );
                              },
                              errorBuilder: (_, __, ___) => Container(
                                color: isDark
                                    ? const Color(0xFF0D0D0D)
                                    : const Color(0xFFF5F5F5),
                                child: Icon(Icons.broken_image_outlined,
                                    color: isDark
                                        ? const Color(0xFF4A4A4A)
                                        : const Color(0xFFAAAAAA),
                                    size: 18),
                              ),
                            ),
                            if (it.hasSources)
                              Positioned(
                                right: 4,
                                top: 4,
                                child: Container(
                                  padding: const EdgeInsets.all(3),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withOpacity(0.55),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Icon(Icons.public,
                                      size: 12, color: Colors.white),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
