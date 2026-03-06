import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'chat_tool_item_model.dart';
export 'chat_tool_item_model.dart';

class ChatToolItemWidget extends StatefulWidget {
  const ChatToolItemWidget({
    super.key,
    required this.title,
    required this.icon,
  });

  final String? title;
  final Widget? icon;

  @override
  State<ChatToolItemWidget> createState() => _ChatToolItemWidgetState();
}

class _ChatToolItemWidgetState extends State<ChatToolItemWidget> {
  late ChatToolItemModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => ChatToolItemModel());
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
        _model.isSelected = !_model.isSelected;
        _model.updatePage(() {});
      },
      child: Container(
        height: 40.0,
        decoration: BoxDecoration(
          color: _model.isSelected
              ? FlutterFlowTheme.of(context).primary
              : FlutterFlowTheme.of(context).secondaryBackground,
          borderRadius: BorderRadius.circular(30.0),
        ),
        child: Padding(
          padding: EdgeInsetsDirectional.fromSTEB(10.0, 0.0, 13.0, 0.0),
          child: Row(
            mainAxisSize: MainAxisSize.max,
            children: [
              widget!.icon!,
              Text(
                valueOrDefault<String>(
                  widget!.title,
                  'Deep Think (R1)',
                ),
                style: FlutterFlowTheme.of(context).bodyMedium.override(
                      fontFamily: FlutterFlowTheme.of(context).bodyMediumFamily,
                      color: _model.isSelected
                          ? FlutterFlowTheme.of(context).info
                          : FlutterFlowTheme.of(context).secondaryText,
                      letterSpacing: 0.0,
                      useGoogleFonts:
                          !FlutterFlowTheme.of(context).bodyMediumIsCustom,
                    ),
              ),
            ].divide(SizedBox(width: 10.0)),
          ),
        ),
      ),
    );
  }
}
