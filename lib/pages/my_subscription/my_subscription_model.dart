import '/components/gradient_background_3/gradient_background3_widget.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'my_subscription_widget.dart' show MySubscriptionWidget;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class MySubscriptionModel extends FlutterFlowModel<MySubscriptionWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for GradientBackground-3 component.
  late GradientBackground3Model gradientBackground3Model;

  @override
  void initState(BuildContext context) {
    gradientBackground3Model =
        createModel(context, () => GradientBackground3Model());
  }

  @override
  void dispose() {
    gradientBackground3Model.dispose();
  }
}
