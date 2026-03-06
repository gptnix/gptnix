import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/custom_code/widgets/index.dart' as custom_widgets;
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'app_languages_model.dart';
export 'app_languages_model.dart';

class AppLanguagesWidget extends StatefulWidget {
  const AppLanguagesWidget({super.key});

  static String routeName = 'AppLanguages';
  static String routePath = '/appLanguages';

  @override
  State<AppLanguagesWidget> createState() => _AppLanguagesWidgetState();
}

class _AppLanguagesWidgetState extends State<AppLanguagesWidget> {
  late AppLanguagesModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => AppLanguagesModel());
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
        body: Container(
          width: double.infinity,
          height: double.infinity,
          child: custom_widgets.ModernLanguageSelectorWidget(
            width: double.infinity,
            height: double.infinity,
            currentLanguage: FFAppState().selectedLanguage,
            onBack: () async {
              context.safePop();
            },
            onLanguageChanged: () async {},
          ),
        ),
      ),
    );
  }
}
