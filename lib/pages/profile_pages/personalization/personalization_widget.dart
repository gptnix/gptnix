import '/auth/firebase_auth/auth_util.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/custom_code/widgets/index.dart' as custom_widgets;
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'personalization_model.dart';
export 'personalization_model.dart';

class PersonalizationWidget extends StatefulWidget {
  const PersonalizationWidget({super.key});

  static String routeName = 'Personalization';
  static String routePath = '/personalization';

  @override
  State<PersonalizationWidget> createState() => _PersonalizationWidgetState();
}

class _PersonalizationWidgetState extends State<PersonalizationWidget> {
  late PersonalizationModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => PersonalizationModel());
  }

  @override
  void dispose() {
    _model.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        FocusScope.of(context).unfocus();
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: Scaffold(
        key: scaffoldKey,
        backgroundColor: FlutterFlowTheme.of(context).primaryBackground,
        body: Container(
          width: double.infinity,
          height: double.infinity,
          child: custom_widgets.ModernPersonalizationWidget(
            width: double.infinity,
            height: double.infinity,
            userDoc: currentUserReference!,
            onBack: () async {
              context.safePop();
            },
            onSave: () async {
              context.safePop();
            },
            onMemories: () async {},
          ),
        ),
      ),
    );
  }
}
