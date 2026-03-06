import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'microphone_switch_model.dart';
export 'microphone_switch_model.dart';

class MicrophoneSwitchWidget extends StatefulWidget {
  const MicrophoneSwitchWidget({super.key});

  @override
  State<MicrophoneSwitchWidget> createState() => _MicrophoneSwitchWidgetState();
}

class _MicrophoneSwitchWidgetState extends State<MicrophoneSwitchWidget> {
  late MicrophoneSwitchModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => MicrophoneSwitchModel());
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Color(0x226A7CFF),
        shape: BoxShape.circle,
        border: Border.all(
          color: Color(0x2B476CFF),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.all(10.0),
        child: Container(
          decoration: BoxDecoration(
            color: Color(0x287D39EB),
            shape: BoxShape.circle,
          ),
          child: Builder(
            builder: (context) {
              if (_model.mute) {
                return Padding(
                  padding: EdgeInsets.all(10.0),
                  child: FlutterFlowIconButton(
                    borderRadius: 50.0,
                    buttonSize: 50.0,
                    fillColor: FlutterFlowTheme.of(context).primary,
                    icon: Icon(
                      FFIcons.kmicrophoneSlash42,
                      color: FlutterFlowTheme.of(context).info,
                      size: 30.0,
                    ),
                    onPressed: () async {
                      _model.mute = !_model.mute;
                      _model.updatePage(() {});
                    },
                  ),
                );
              } else {
                return Padding(
                  padding: EdgeInsets.all(10.0),
                  child: FlutterFlowIconButton(
                    borderRadius: 50.0,
                    buttonSize: 50.0,
                    fillColor: FlutterFlowTheme.of(context).primary,
                    icon: Icon(
                      FFIcons.kmicrophone241,
                      color: FlutterFlowTheme.of(context).info,
                      size: 30.0,
                    ),
                    onPressed: () async {
                      _model.mute = !_model.mute;
                      _model.updatePage(() {});
                    },
                  ),
                );
              }
            },
          ),
        ),
      ),
    );
  }
}
