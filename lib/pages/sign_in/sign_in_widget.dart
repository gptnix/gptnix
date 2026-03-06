import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/custom_code/widgets/index.dart' as custom_widgets;
import '/index.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'sign_in_model.dart';
export 'sign_in_model.dart';

class SignInWidget extends StatefulWidget {
  const SignInWidget({super.key});

  static String routeName = 'SignIn';
  static String routePath = '/signIn';

  @override
  State<SignInWidget> createState() => _SignInWidgetState();
}

class _SignInWidgetState extends State<SignInWidget> {
  late SignInModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => SignInModel());
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
          child: custom_widgets.ModernSignInWidget(
            width: double.infinity,
            height: double.infinity,
            onSignIn: () async {
              // Wait for AppStateNotifier to reflect logged-in state
              final appState = AppStateNotifier.instance;
              int waited = 0;
              while (!appState.loggedIn && waited < 5000) {
                await Future.delayed(const Duration(milliseconds: 100));
                waited += 100;
              }

              var conversationsRecordReference =
                  ConversationsRecord.collection.doc();
              await conversationsRecordReference
                  .set(createConversationsRecordData(
                createdAt: getCurrentTimestamp,
                userId: currentUserReference?.id,
              ));
              _model.loginConv = ConversationsRecord.getDocumentFromData(
                  createConversationsRecordData(
                    createdAt: getCurrentTimestamp,
                    userId: currentUserReference?.id,
                  ),
                  conversationsRecordReference);
              if (Navigator.of(context).canPop()) {
                context.pop();
              }
              context.pushNamed(
                ChatWidget.routeName,
                queryParameters: {
                  'conversationRef': serializeParam(
                    _model.loginConv?.reference,
                    ParamType.DocumentReference,
                  ),
                  'conversationId': serializeParam(
                    _model.loginConv?.reference.id,
                    ParamType.String,
                  ),
                }.withoutNulls,
              );

              safeSetState(() {});
            },
            onGoogleSignIn: () async {
              // Wait for AppStateNotifier to reflect logged-in state
              final appState = AppStateNotifier.instance;
              int waited = 0;
              while (!appState.loggedIn && waited < 5000) {
                await Future.delayed(const Duration(milliseconds: 100));
                waited += 100;
              }

              var conversationsRecordReference =
                  ConversationsRecord.collection.doc();
              await conversationsRecordReference
                  .set(createConversationsRecordData(
                createdAt: getCurrentTimestamp,
                userId: currentUserReference?.id,
              ));
              _model.loginConv1 = ConversationsRecord.getDocumentFromData(
                  createConversationsRecordData(
                    createdAt: getCurrentTimestamp,
                    userId: currentUserReference?.id,
                  ),
                  conversationsRecordReference);
              if (Navigator.of(context).canPop()) {
                context.pop();
              }
              context.pushNamed(
                ChatWidget.routeName,
                queryParameters: {
                  'conversationRef': serializeParam(
                    _model.loginConv?.reference,
                    ParamType.DocumentReference,
                  ),
                  'conversationId': serializeParam(
                    _model.loginConv?.reference.id,
                    ParamType.String,
                  ),
                }.withoutNulls,
              );

              safeSetState(() {});
            },
            onAppleSignIn: () async {},
            onForgotPassword: () async {
              context.pushNamed(ResetPasswordWidget.routeName);
            },
            onSignUp: () async {
              context.pushNamed(SignUpWidget.routeName);
            },
          ),
        ),
      ),
    );
  }
}
