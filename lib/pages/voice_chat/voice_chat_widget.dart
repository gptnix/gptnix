import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/custom_code/widgets/index.dart' as custom_widgets;
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'voice_chat_model.dart';
export 'voice_chat_model.dart';

class VoiceChatWidget extends StatefulWidget {
  const VoiceChatWidget({super.key});

  static String routeName = 'VoiceChat';
  static String routePath = '/voiceChat';

  @override
  State<VoiceChatWidget> createState() => _VoiceChatWidgetState();
}

class _VoiceChatWidgetState extends State<VoiceChatWidget> {
  late VoiceChatModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => VoiceChatModel());
  }

  @override
  void dispose() {
    _model.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<FFAppState>();

    return GestureDetector(
      onTap: () {
        FocusScope.of(context).unfocus();
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: Scaffold(
        key: scaffoldKey,
        backgroundColor: Colors.transparent,
        body: Stack(
          children: [
            Align(
              alignment: AlignmentDirectional(0.0, 0.0),
              child: Container(
                width: MediaQuery.sizeOf(context).width * 1.0,
                height: MediaQuery.sizeOf(context).height * 1.0,
                child: custom_widgets.GptnixVoiceChatPage(
                  width: MediaQuery.sizeOf(context).width * 1.0,
                  height: MediaQuery.sizeOf(context).height * 1.0,
                  backendUrl:
                      'https://gptnix-backend-496151959855.us-central1.run.app',
                  model: 'gpt-4o-mini-tts',
                  autoStart: true,
                  alwaysListening: true,
                  conversationRef: FFAppState().activeConvRef,
                  voicePath: '/voice/chat',
                  autoPlay: true,
                  bargeIn: true,
                  vadThresholdDb: -38.0,
                  vadMarginDb: 6.0,
                  vadCalibrateMs: 900,
                  endSilenceMs: 1100,
                  minSpeechMs: 450,
                  maxIdleRecordMs: 60000,
                  maxTotalRecordMs: 120000,
                  sampleRate: 16000,
                  showTranscript: true,
                  historyMaxMessages: 12,
                  orbSize: 64.0,
                  restartDelayMs: 350,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
