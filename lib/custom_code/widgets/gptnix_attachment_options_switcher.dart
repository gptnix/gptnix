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

class GptnixAttachmentOptionsSwitcher extends StatelessWidget {
  const GptnixAttachmentOptionsSwitcher({
    super.key,
    required this.show,
    required this.child,

    // optional polish
    this.durationMs = 200,
    this.slideDy = 0.06,
  });

  final bool show;
  final Widget child;

  final int durationMs;
  final double slideDy;

  @override
  Widget build(BuildContext context) {
    final d = Duration(milliseconds: durationMs);

    return IgnorePointer(
      ignoring: !show, // ✅ kad je skriveno, ne hvata klikove
      child: AnimatedSwitcher(
        duration: d,
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        layoutBuilder: (currentChild, previousChildren) {
          // ✅ stabilno: ne skače layout naglo
          return Stack(
            alignment: Alignment.topCenter,
            children: [
              ...previousChildren,
              if (currentChild != null) currentChild,
            ],
          );
        },
        transitionBuilder: (child, anim) {
          // ✅ ChatGPT-ish: fade + slide + expand
          final fade =
              CurvedAnimation(parent: anim, curve: Curves.easeOutCubic);
          final slide = Tween<Offset>(
            begin: Offset(0, slideDy),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic));

          return FadeTransition(
            opacity: fade,
            child: SlideTransition(
              position: slide,
              child: SizeTransition(
                sizeFactor: fade,
                axisAlignment: -1, // expand from top
                child: child,
              ),
            ),
          );
        },
        child: show
            ? KeyedSubtree(
                // ✅ stabilan key: ne resetira state child-a
                key: const ValueKey('attach_on'),
                child: child,
              )
            : const SizedBox(
                key: ValueKey('attach_off'),
                height: 0,
                width: 0,
              ),
      ),
    );
  }
}
