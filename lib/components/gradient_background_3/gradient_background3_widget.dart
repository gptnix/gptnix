import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'gradient_background3_model.dart';
export 'gradient_background3_model.dart';

class GradientBackground3Widget extends StatefulWidget {
  const GradientBackground3Widget({super.key});

  @override
  State<GradientBackground3Widget> createState() =>
      _GradientBackground3WidgetState();
}

class _GradientBackground3WidgetState extends State<GradientBackground3Widget> {
  late GradientBackground3Model _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => GradientBackground3Model());
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            FlutterFlowTheme.of(context).primaryBackground,
            FlutterFlowTheme.of(context).primaryBackground,
            FlutterFlowTheme.of(context).primaryBackground,
            FlutterFlowTheme.of(context).primaryBackground
          ],
          stops: [0.0, 0.45, 0.65, 1.0],
          begin: AlignmentDirectional(1.0, -0.87),
          end: AlignmentDirectional(-1.0, 0.87),
        ),
      ),
    );
  }
}
