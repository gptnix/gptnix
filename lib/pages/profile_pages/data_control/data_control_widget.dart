import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/custom_code/widgets/index.dart' as custom_widgets;
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'data_control_model.dart';
export 'data_control_model.dart';

class DataControlWidget extends StatefulWidget {
  const DataControlWidget({super.key});

  static String routeName = 'DataControl';
  static String routePath = '/dataControl';

  @override
  State<DataControlWidget> createState() => _DataControlWidgetState();
}

class _DataControlWidgetState extends State<DataControlWidget> {
  late DataControlModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => DataControlModel());
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
        backgroundColor: Colors.transparent,
        body: Container(
          width: double.infinity,
          height: double.infinity,
          child: custom_widgets.ModernDataControlWidget(
            width: double.infinity,
            height: double.infinity,
            useContentForTraining: true,
            onBack: () async {
              context.safePop();
            },
            onArchivedChats: () async {},
            onClearChatHistory: () async {},
            onExportData: () async {},
          ),
        ),
      ),
    );
  }
}
