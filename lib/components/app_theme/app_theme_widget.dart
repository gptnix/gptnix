import '/flutter_flow/flutter_flow_radio_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/form_field_controller.dart';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'app_theme_model.dart';
export 'app_theme_model.dart';

class AppThemeWidget extends StatefulWidget {
  const AppThemeWidget({super.key});

  @override
  State<AppThemeWidget> createState() => _AppThemeWidgetState();
}

class _AppThemeWidgetState extends State<AppThemeWidget> {
  late AppThemeModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => AppThemeModel());
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional(0.0, 1.0),
      child: Padding(
        padding: EdgeInsets.all(10.0),
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: FlutterFlowTheme.of(context).secondaryBackground,
            boxShadow: [
              BoxShadow(
                blurRadius: 0.0,
                color: FlutterFlowTheme.of(context).alternate,
                offset: Offset(
                  0.0,
                  -1.0,
                ),
                spreadRadius: 0.8,
              )
            ],
            borderRadius: BorderRadius.circular(24.0),
          ),
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(20.0, 10.0, 20.0, 20.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 35.0,
                  height: 3.0,
                  decoration: BoxDecoration(
                    color: FlutterFlowTheme.of(context).alternate,
                    borderRadius: BorderRadius.circular(30.0),
                  ),
                ),
                Text(
                  FFLocalizations.of(context).getText(
                    'h7wpk8m3' /* App Theme */,
                  ),
                  style: FlutterFlowTheme.of(context).bodyMedium.override(
                        fontFamily:
                            FlutterFlowTheme.of(context).bodyMediumFamily,
                        fontSize: 18.0,
                        letterSpacing: 0.0,
                        fontWeight: FontWeight.bold,
                        useGoogleFonts:
                            !FlutterFlowTheme.of(context).bodyMediumIsCustom,
                      ),
                ),
                Align(
                  alignment: AlignmentDirectional(-1.0, -1.0),
                  child: FlutterFlowRadioButton(
                    options: [
                      FFLocalizations.of(context).getText(
                        'gn3oc233' /* System */,
                      ),
                      FFLocalizations.of(context).getText(
                        '7438j53k' /* Light */,
                      ),
                      FFLocalizations.of(context).getText(
                        '8f4m6mg2' /* Dark */,
                      )
                    ].toList(),
                    onChanged: (val) async {
                      safeSetState(() {});
                      if (_model.radioButtonValue == 'System') {
                        setDarkModeSetting(context, ThemeMode.system);
                      } else if (_model.radioButtonValue == 'Light') {
                        setDarkModeSetting(context, ThemeMode.light);
                      } else {
                        setDarkModeSetting(context, ThemeMode.dark);
                      }
                    },
                    controller: _model.radioButtonValueController ??=
                        FormFieldController<String>(
                            FFLocalizations.of(context).getText(
                      'q0wkn79t' /* System */,
                    )),
                    optionHeight: 45.0,
                    textStyle: FlutterFlowTheme.of(context)
                        .labelMedium
                        .override(
                          fontFamily:
                              FlutterFlowTheme.of(context).labelMediumFamily,
                          color: FlutterFlowTheme.of(context).primaryText,
                          fontSize: 16.0,
                          letterSpacing: 0.0,
                          fontWeight: FontWeight.bold,
                          useGoogleFonts:
                              !FlutterFlowTheme.of(context).labelMediumIsCustom,
                        ),
                    selectedTextStyle: FlutterFlowTheme.of(context)
                        .bodyMedium
                        .override(
                          fontFamily:
                              FlutterFlowTheme.of(context).bodyMediumFamily,
                          color: FlutterFlowTheme.of(context).primaryText,
                          fontSize: 16.0,
                          letterSpacing: 0.0,
                          fontWeight: FontWeight.bold,
                          useGoogleFonts:
                              !FlutterFlowTheme.of(context).bodyMediumIsCustom,
                        ),
                    textPadding:
                        EdgeInsetsDirectional.fromSTEB(10.0, 0.0, 0.0, 0.0),
                    buttonPosition: RadioButtonPosition.left,
                    direction: Axis.vertical,
                    radioButtonColor: FlutterFlowTheme.of(context).info,
                    inactiveRadioButtonColor:
                        FlutterFlowTheme.of(context).primary,
                    toggleable: false,
                    horizontalAlignment: WrapAlignment.start,
                    verticalAlignment: WrapCrossAlignment.start,
                  ),
                ),
              ].divide(SizedBox(height: 20.0)),
            ),
          ),
        ),
      ),
    );
  }
}
