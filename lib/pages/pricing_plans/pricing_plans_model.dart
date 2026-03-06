import '/components/gradient_background_2/gradient_background2_widget.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'pricing_plans_widget.dart' show PricingPlansWidget;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class PricingPlansModel extends FlutterFlowModel<PricingPlansWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for GradientBackground-2 component.
  late GradientBackground2Model gradientBackground2Model;

  @override
  void initState(BuildContext context) {
    gradientBackground2Model =
        createModel(context, () => GradientBackground2Model());
  }

  @override
  void dispose() {
    gradientBackground2Model.dispose();
  }
}
