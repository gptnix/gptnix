import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'choice_item_model.dart';
export 'choice_item_model.dart';

class ChoiceItemWidget extends StatefulWidget {
  const ChoiceItemWidget({
    super.key,
    required this.text,
  });

  final String? text;

  @override
  State<ChoiceItemWidget> createState() => _ChoiceItemWidgetState();
}

class _ChoiceItemWidgetState extends State<ChoiceItemWidget> {
  late ChoiceItemModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => ChoiceItemModel());
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(3.0),
      child: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          color: valueOrDefault<Color>(
            _model.isSelected
                ? FlutterFlowTheme.of(context).primary
                : FlutterFlowTheme.of(context).secondaryBackground,
            FlutterFlowTheme.of(context).secondaryBackground,
          ),
          boxShadow: [
            BoxShadow(
              blurRadius: 0.0,
              color: valueOrDefault<Color>(
                _model.isSelected
                    ? FlutterFlowTheme.of(context).accent1
                    : FlutterFlowTheme.of(context).alternate,
                FlutterFlowTheme.of(context).alternate,
              ),
              offset: Offset(
                0.0,
                -1.0,
              ),
              spreadRadius: 0.8,
            )
          ],
          borderRadius: BorderRadius.circular(14.0),
          shape: BoxShape.rectangle,
        ),
        child: FFButtonWidget(
          onPressed: () async {
            _model.isSelected = !_model.isSelected;
            _model.updatePage(() {});
          },
          text: widget!.text!,
          options: FFButtonOptions(
            height: 40.0,
            padding: EdgeInsetsDirectional.fromSTEB(16.0, 0.0, 16.0, 0.0),
            iconPadding: EdgeInsetsDirectional.fromSTEB(0.0, 0.0, 0.0, 0.0),
            color: FlutterFlowTheme.of(context).info,
            textStyle: FlutterFlowTheme.of(context).titleSmall.override(
                  fontFamily: FlutterFlowTheme.of(context).titleSmallFamily,
                  color: Colors.white,
                  letterSpacing: 0.0,
                  useGoogleFonts:
                      !FlutterFlowTheme.of(context).titleSmallIsCustom,
                ),
            elevation: 0.0,
            borderRadius: BorderRadius.circular(14.0),
          ),
        ),
      ),
    );
  }
}
