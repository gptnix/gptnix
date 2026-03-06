import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'language_item_model.dart';
export 'language_item_model.dart';

class LanguageItemWidget extends StatefulWidget {
  const LanguageItemWidget({
    super.key,
    required this.flag,
    required this.name,
    required this.languageCode,
  });

  final String? flag;
  final String? name;
  final String? languageCode;

  @override
  State<LanguageItemWidget> createState() => _LanguageItemWidgetState();
}

class _LanguageItemWidgetState extends State<LanguageItemWidget> {
  late LanguageItemModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => LanguageItemModel());
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      splashColor: Colors.transparent,
      focusColor: Colors.transparent,
      hoverColor: Colors.transparent,
      highlightColor: Colors.transparent,
      onTap: () async {
        setAppLanguage(context, widget!.languageCode!);
      },
      child: Container(
        decoration: BoxDecoration(
          color: Color(0x12FFFFFF),
          borderRadius: BorderRadius.circular(16.0),
          border: Border.all(
            color: Colors.transparent,
          ),
        ),
        child: Padding(
          padding: EdgeInsetsDirectional.fromSTEB(15.0, 15.0, 12.0, 15.0),
          child: InkWell(
            splashColor: Colors.transparent,
            focusColor: Colors.transparent,
            hoverColor: Colors.transparent,
            highlightColor: Colors.transparent,
            onTap: () async {
              setAppLanguage(context, widget!.languageCode!);
            },
            child: Row(
              mainAxisSize: MainAxisSize.max,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: InkWell(
                    splashColor: Colors.transparent,
                    focusColor: Colors.transparent,
                    hoverColor: Colors.transparent,
                    highlightColor: Colors.transparent,
                    onTap: () async {
                      setAppLanguage(context, widget!.languageCode!);
                    },
                    child: Row(
                      mainAxisSize: MainAxisSize.max,
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            color: Color(0x25FFFFFF),
                            shape: BoxShape.circle,
                          ),
                          child: Container(
                            width: 35.0,
                            height: 35.0,
                            clipBehavior: Clip.antiAlias,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                            ),
                            child: Image.network(
                              widget!.flag!,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                        Flexible(
                          child: Text(
                            valueOrDefault<String>(
                              widget!.name,
                              'English (US)',
                            ),
                            style: FlutterFlowTheme.of(context)
                                .bodyMedium
                                .override(
                                  fontFamily: FlutterFlowTheme.of(context)
                                      .bodyMediumFamily,
                                  fontSize: 16.0,
                                  letterSpacing: 0.0,
                                  fontWeight: FontWeight.bold,
                                  useGoogleFonts: !FlutterFlowTheme.of(context)
                                      .bodyMediumIsCustom,
                                ),
                          ),
                        ),
                      ].divide(SizedBox(width: 20.0)),
                    ),
                  ),
                ),
                if (FFLocalizations.of(context).languageCode ==
                    widget!.languageCode)
                  Icon(
                    Icons.done_rounded,
                    color: FlutterFlowTheme.of(context).primaryText,
                    size: 24.0,
                  ),
              ].divide(SizedBox(width: 20.0)),
            ),
          ),
        ),
      ),
    );
  }
}
