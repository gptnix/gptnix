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
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import 'modern_drawer_core.dart';

class ModernDrawerFullscreenGallery extends StatelessWidget {
  const ModernDrawerFullscreenGallery({
    super.key,
    required this.isDark,
    required this.controller,
    required this.onClose,
    required this.onCopyUrl,
  });

  final bool isDark;
  final PageController? controller;
  final VoidCallback onClose;
  final Future<void> Function(String url) onCopyUrl;

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<ModernDrawerNotifier>();
    final ctrl = controller;
    if (ctrl == null) return const SizedBox.shrink();

    return Positioned.fill(
      child: Material(
        color: Colors.black.withOpacity(0.95),
        child: SafeArea(
          child: Stack(
            children: [
              PageView.builder(
                controller: ctrl,
                itemCount: vm.recentImages.length,
                onPageChanged: (i) {
                  vm.galleryIndex = i;
                  vm.notifyListeners();
                },
                itemBuilder: (context, i) {
                  final it = vm.recentImages[i];
                  return Center(
                    child: InteractiveViewer(
                      minScale: 0.6,
                      maxScale: 4.0,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(
                          it.url,
                          fit: BoxFit.contain,
                          loadingBuilder: (context, child, progress) {
                            if (progress == null) return child;
                            return Container(
                              width: 240,
                              height: 240,
                              color: Colors.black,
                              child: const Center(
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                            );
                          },
                          errorBuilder: (_, __, ___) => Container(
                            width: 240,
                            height: 240,
                            color: Colors.black,
                            child: const Center(
                              child: Icon(Icons.broken_image_rounded,
                                  color: Colors.white54, size: 40),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
              Positioned(
                top: 10,
                left: 12,
                right: 12,
                child: Row(
                  children: [
                    ModernDrawerGalleryCircleBtn(
                      icon: Icons.arrow_back_rounded,
                      onTap: onClose,
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.55),
                        borderRadius: BorderRadius.circular(999),
                        border:
                            Border.all(color: Colors.white.withOpacity(0.12)),
                      ),
                      child: Text(
                        '${vm.galleryIndex + 1} / ${vm.recentImages.length}',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const Spacer(),
                    ModernDrawerGalleryCircleBtn(
                      icon: Icons.copy_rounded,
                      onTap: () =>
                          onCopyUrl(vm.recentImages[vm.galleryIndex].url),
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 12,
                right: 12,
                bottom: 12,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.55),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.12)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.swipe, color: Colors.white70, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          (vm.recentImages[vm.galleryIndex].prompt ?? '')
                                  .trim()
                                  .isNotEmpty
                              ? vm.recentImages[vm.galleryIndex].prompt!.trim()
                              : 'Swipe • pinch za zoom • copy link gore',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: Colors.white70,
                            height: 1.25,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ModernDrawerGalleryCircleBtn extends StatelessWidget {
  const ModernDrawerGalleryCircleBtn({
    super.key,
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.55),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withOpacity(0.12)),
        ),
        child: Icon(icon, color: Colors.white, size: 22),
      ),
    );
  }
}
