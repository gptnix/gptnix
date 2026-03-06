import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'uploaded_image_item_model.dart';
export 'uploaded_image_item_model.dart';

class UploadedImageItemWidget extends StatefulWidget {
  const UploadedImageItemWidget({
    super.key,
    required this.img,
  });

  final String? img;

  @override
  State<UploadedImageItemWidget> createState() =>
      _UploadedImageItemWidgetState();
}

class _UploadedImageItemWidgetState extends State<UploadedImageItemWidget> {
  late UploadedImageItemModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => UploadedImageItemModel());
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 200.0,
      decoration: BoxDecoration(
        color: Color(0x11FFFFFF),
        borderRadius: BorderRadius.circular(10.0),
      ),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12.0),
            child: Image.network(
              widget!.img!,
              width: double.infinity,
              height: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
          Align(
            alignment: AlignmentDirectional(1.0, -1.0),
            child: Padding(
              padding: EdgeInsets.all(10.0),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: FlutterFlowTheme.of(context).accent4,
                      boxShadow: [
                        BoxShadow(
                          blurRadius: 0.0,
                          color: FlutterFlowTheme.of(context).alternate,
                          offset: Offset(
                            0.0,
                            -1.0,
                          ),
                          spreadRadius: 0.5,
                        )
                      ],
                      shape: BoxShape.circle,
                    ),
                    child: FlutterFlowIconButton(
                      borderRadius: 30.0,
                      buttonSize: 35.0,
                      icon: Icon(
                        FFIcons.kclose,
                        color: FlutterFlowTheme.of(context).info,
                        size: 18.0,
                      ),
                      onPressed: () {
                        print('Remove pressed ...');
                      },
                    ),
                  ),
                ].divide(SizedBox(width: 10.0)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
