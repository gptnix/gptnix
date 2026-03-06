import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'copy_model.dart';
export 'copy_model.dart';

class CopyWidget extends StatefulWidget {
  const CopyWidget({
    super.key,
    required this.text,
    required this.copyIcon,
    required this.copiedIcon,
  });

  final String? text;
  final Widget? copyIcon;
  final Widget? copiedIcon;

  @override
  State<CopyWidget> createState() => _CopyWidgetState();
}

class _CopyWidgetState extends State<CopyWidget> {
  late CopyModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => CopyModel());
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FlutterFlowIconButton(
      borderRadius: 30.0,
      buttonSize: 35.0,
      icon: _model.isCopied ? widget!.copiedIcon! : widget!.copyIcon!,
      onPressed: _model.isCopied
          ? null
          : () async {
              await Clipboard.setData(ClipboardData(text: widget!.text!));
              _model.isCopied = !_model.isCopied;
              _model.updatePage(() {});
              await Future.delayed(
                Duration(
                  milliseconds: 2000,
                ),
              );
              _model.isCopied = false;
              _model.updatePage(() {});
            },
    );
  }
}
