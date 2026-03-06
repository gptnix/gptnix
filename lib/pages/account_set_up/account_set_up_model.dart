import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/components/choice_item/choice_item_widget.dart';
import '/components/gradient_background_1/gradient_background1_widget.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'account_set_up_widget.dart' show AccountSetUpWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class AccountSetUpModel extends FlutterFlowModel<AccountSetUpWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for GradientBackground-1 component.
  late GradientBackground1Model gradientBackground1Model;
  // Stores action output result for [Backend Call - Create Document] action in Button widget.
  ConversationsRecord? createdConversationLogin;
  // State field(s) for PageView widget.
  PageController? pageViewController;

  int get pageViewCurrentIndex => pageViewController != null &&
          pageViewController!.hasClients &&
          pageViewController!.page != null
      ? pageViewController!.page!.round()
      : 0;
  // Model for ChoiceItem component.
  late ChoiceItemModel choiceItemModel1;
  // Model for ChoiceItem component.
  late ChoiceItemModel choiceItemModel2;
  // Model for ChoiceItem component.
  late ChoiceItemModel choiceItemModel3;
  // Model for ChoiceItem component.
  late ChoiceItemModel choiceItemModel4;

  @override
  void initState(BuildContext context) {
    gradientBackground1Model =
        createModel(context, () => GradientBackground1Model());
    choiceItemModel1 = createModel(context, () => ChoiceItemModel());
    choiceItemModel2 = createModel(context, () => ChoiceItemModel());
    choiceItemModel3 = createModel(context, () => ChoiceItemModel());
    choiceItemModel4 = createModel(context, () => ChoiceItemModel());
  }

  @override
  void dispose() {
    gradientBackground1Model.dispose();
    choiceItemModel1.dispose();
    choiceItemModel2.dispose();
    choiceItemModel3.dispose();
    choiceItemModel4.dispose();
  }
}
