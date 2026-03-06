import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/components/choice_item/choice_item_widget.dart';
import '/components/gradient_background_1/gradient_background1_widget.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/index.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'account_set_up_model.dart';
export 'account_set_up_model.dart';

class AccountSetUpWidget extends StatefulWidget {
  const AccountSetUpWidget({super.key});

  static String routeName = 'AccountSetUp';
  static String routePath = '/accountSetUp';

  @override
  State<AccountSetUpWidget> createState() => _AccountSetUpWidgetState();
}

class _AccountSetUpWidgetState extends State<AccountSetUpWidget> {
  late AccountSetUpModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => AccountSetUpModel());
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
        body: Stack(
          children: [
            wrapWithModel(
              model: _model.gradientBackground1Model,
              updateCallback: () => safeSetState(() {}),
              child: GradientBackground1Widget(),
            ),
            SafeArea(
              child: Container(
                decoration: BoxDecoration(),
                child: Column(
                  mainAxisSize: MainAxisSize.max,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding:
                          EdgeInsetsDirectional.fromSTEB(20.0, 0.0, 20.0, 10.0),
                      child: Row(
                        mainAxisSize: MainAxisSize.max,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(0.0),
                            child: Image.asset(
                              'assets/images/GPTNIX_LOGO_TRANSPARENT.png',
                              width: 79.98,
                              height: 27.3,
                              fit: BoxFit.fitHeight,
                              alignment: Alignment(0.0, 0.0),
                            ),
                          ),
                          FFButtonWidget(
                            onPressed: () async {
                              GoRouter.of(context).prepareAuthEvent();
                              final user =
                                  await authManager.signInWithGoogle(context);
                              if (user == null) {
                                return;
                              }
                              await Future.delayed(
                                Duration(
                                  milliseconds: 300,
                                ),
                              );

                              var conversationsRecordReference =
                                  ConversationsRecord.collection.doc();
                              await conversationsRecordReference
                                  .set(createConversationsRecordData(
                                createdAt: getCurrentTimestamp,
                                title: 'new chat',
                                userRef: currentUserReference,
                              ));
                              _model.createdConversationLogin =
                                  ConversationsRecord.getDocumentFromData(
                                      createConversationsRecordData(
                                        createdAt: getCurrentTimestamp,
                                        title: 'new chat',
                                        userRef: currentUserReference,
                                      ),
                                      conversationsRecordReference);

                              context.pushNamedAuth(
                                ChatWidget.routeName,
                                context.mounted,
                                queryParameters: {
                                  'conversationRef': serializeParam(
                                    _model.createdConversationLogin?.reference,
                                    ParamType.DocumentReference,
                                  ),
                                }.withoutNulls,
                              );

                              safeSetState(() {});
                            },
                            text: FFLocalizations.of(context).getText(
                              'ws5l1br6' /* Skip */,
                            ),
                            options: FFButtonOptions(
                              padding: EdgeInsetsDirectional.fromSTEB(
                                  10.0, 0.0, 10.0, 0.0),
                              iconPadding: EdgeInsetsDirectional.fromSTEB(
                                  0.0, 0.0, 0.0, 0.0),
                              color: Colors.transparent,
                              textStyle: FlutterFlowTheme.of(context)
                                  .titleSmall
                                  .override(
                                    fontFamily: FlutterFlowTheme.of(context)
                                        .titleSmallFamily,
                                    color: FlutterFlowTheme.of(context).info,
                                    letterSpacing: 0.0,
                                    fontWeight: FontWeight.bold,
                                    useGoogleFonts:
                                        !FlutterFlowTheme.of(context)
                                            .titleSmallIsCustom,
                                  ),
                              elevation: 0.0,
                              borderRadius: BorderRadius.circular(30.0),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Add Many Personalization Here In row
                    Expanded(
                      child: Container(
                        width: double.infinity,
                        child: PageView(
                          physics: const NeverScrollableScrollPhysics(),
                          controller: _model.pageViewController ??=
                              PageController(initialPage: 0),
                          onPageChanged: (_) => safeSetState(() {}),
                          scrollDirection: Axis.horizontal,
                          children: [
                            Padding(
                              padding: EdgeInsetsDirectional.fromSTEB(
                                  20.0, 0.0, 20.0, 20.0),
                              child: Column(
                                mainAxisSize: MainAxisSize.max,
                                mainAxisAlignment: MainAxisAlignment.start,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Align(
                                      alignment:
                                          AlignmentDirectional(0.0, -1.0),
                                      child: SingleChildScrollView(
                                        child: Column(
                                          mainAxisSize: MainAxisSize.max,
                                          crossAxisAlignment:
                                              CrossAxisAlignment.center,
                                          children: [
                                            Align(
                                              alignment: AlignmentDirectional(
                                                  0.0, -1.0),
                                              child: Container(
                                                width: 200.0,
                                                height: 200.0,
                                                decoration: BoxDecoration(
                                                  color: Color(0x131F43FF),
                                                  shape: BoxShape.circle,
                                                  border: Border.all(
                                                    color: Color(0x330020FF),
                                                  ),
                                                ),
                                                child: Align(
                                                  alignment:
                                                      AlignmentDirectional(
                                                          0.0, 0.0),
                                                  child: Padding(
                                                    padding:
                                                        EdgeInsets.all(30.0),
                                                    child: Container(
                                                      decoration: BoxDecoration(
                                                        color:
                                                            Color(0x215271FF),
                                                        shape: BoxShape.circle,
                                                        border: Border.all(
                                                          color:
                                                              Color(0xFF3E84F8),
                                                        ),
                                                      ),
                                                      child: Align(
                                                        alignment:
                                                            AlignmentDirectional(
                                                                0.0, 0.0),
                                                        child: Padding(
                                                          padding:
                                                              EdgeInsets.all(
                                                                  30.0),
                                                          child: Icon(
                                                            FFIcons
                                                                .kvoiceSquare45,
                                                            color: FlutterFlowTheme
                                                                    .of(context)
                                                                .info,
                                                            size: 70.0,
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ),
                                            Align(
                                              alignment: AlignmentDirectional(
                                                  0.0, -1.0),
                                              child: Text(
                                                FFLocalizations.of(context)
                                                    .getText(
                                                  'rht7z3if' /* Set Voice */,
                                                ),
                                                textAlign: TextAlign.center,
                                                style:
                                                    FlutterFlowTheme.of(context)
                                                        .bodyMedium
                                                        .override(
                                                          fontFamily:
                                                              FlutterFlowTheme.of(
                                                                      context)
                                                                  .bodyMediumFamily,
                                                          fontSize: 20.0,
                                                          letterSpacing: 0.0,
                                                          fontWeight:
                                                              FontWeight.w600,
                                                          useGoogleFonts:
                                                              !FlutterFlowTheme
                                                                      .of(context)
                                                                  .bodyMediumIsCustom,
                                                        ),
                                              ),
                                            ),
                                            Text(
                                              FFLocalizations.of(context)
                                                  .getText(
                                                'bzyzy795' /* Discover the Power of Your Voi... */,
                                              ),
                                              textAlign: TextAlign.center,
                                              style: FlutterFlowTheme.of(
                                                      context)
                                                  .bodyMedium
                                                  .override(
                                                    fontFamily:
                                                        FlutterFlowTheme.of(
                                                                context)
                                                            .bodyMediumFamily,
                                                    color: FlutterFlowTheme.of(
                                                            context)
                                                        .info,
                                                    fontSize: 20.0,
                                                    letterSpacing: 0.0,
                                                    fontWeight: FontWeight.w600,
                                                    lineHeight: 1.2,
                                                    useGoogleFonts:
                                                        !FlutterFlowTheme.of(
                                                                context)
                                                            .bodyMediumIsCustom,
                                                  ),
                                            ),
                                            GridView(
                                              padding: EdgeInsets.zero,
                                              gridDelegate:
                                                  SliverGridDelegateWithFixedCrossAxisCount(
                                                crossAxisCount: 2,
                                                crossAxisSpacing: 10.0,
                                                mainAxisSpacing: 10.0,
                                                childAspectRatio: 2.0,
                                              ),
                                              primary: false,
                                              shrinkWrap: true,
                                              scrollDirection: Axis.vertical,
                                              children: [
                                                wrapWithModel(
                                                  model:
                                                      _model.choiceItemModel1,
                                                  updateCallback: () =>
                                                      safeSetState(() {}),
                                                  child: ChoiceItemWidget(
                                                    text: FFLocalizations.of(
                                                            context)
                                                        .getText(
                                                      '5sbgobyi' /* Wave */,
                                                    ),
                                                  ),
                                                ),
                                                wrapWithModel(
                                                  model:
                                                      _model.choiceItemModel2,
                                                  updateCallback: () =>
                                                      safeSetState(() {}),
                                                  child: ChoiceItemWidget(
                                                    text: 'Grove',
                                                  ),
                                                ),
                                                wrapWithModel(
                                                  model:
                                                      _model.choiceItemModel3,
                                                  updateCallback: () =>
                                                      safeSetState(() {}),
                                                  child: ChoiceItemWidget(
                                                    text: FFLocalizations.of(
                                                            context)
                                                        .getText(
                                                      '7vbvj62q' /* Canyon */,
                                                    ),
                                                  ),
                                                ),
                                                wrapWithModel(
                                                  model:
                                                      _model.choiceItemModel4,
                                                  updateCallback: () =>
                                                      safeSetState(() {}),
                                                  child: ChoiceItemWidget(
                                                    text: FFLocalizations.of(
                                                            context)
                                                        .getText(
                                                      '2ptee342' /* Meadow */,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ]
                                              .divide(SizedBox(height: 20.0))
                                              .addToStart(
                                                  SizedBox(height: 20.0))
                                              .addToEnd(SizedBox(height: 20.0)),
                                        ),
                                      ),
                                    ),
                                  ),
                                  FFButtonWidget(
                                    onPressed: () async {
                                      context.pushNamed(
                                        ChatWidget.routeName,
                                        queryParameters: {
                                          'conversationRef': serializeParam(
                                            _model.createdConversationLogin
                                                ?.reference,
                                            ParamType.DocumentReference,
                                          ),
                                        }.withoutNulls,
                                        extra: <String, dynamic>{
                                          '__transition_info__': TransitionInfo(
                                            hasTransition: true,
                                            transitionType:
                                                PageTransitionType.fade,
                                          ),
                                        },
                                      );
                                    },
                                    text: FFLocalizations.of(context).getText(
                                      'a5mgwwgr' /* Continue */,
                                    ),
                                    icon: Icon(
                                      FFIcons.karrowCircleRight36,
                                      size: 20.0,
                                    ),
                                    options: FFButtonOptions(
                                      width: double.infinity,
                                      height: 50.0,
                                      padding: EdgeInsetsDirectional.fromSTEB(
                                          16.0, 0.0, 16.0, 0.0),
                                      iconAlignment: IconAlignment.end,
                                      iconPadding:
                                          EdgeInsetsDirectional.fromSTEB(
                                              0.0, 0.0, 0.0, 0.0),
                                      color:
                                          FlutterFlowTheme.of(context).primary,
                                      textStyle: FlutterFlowTheme.of(context)
                                          .titleSmall
                                          .override(
                                            fontFamily:
                                                FlutterFlowTheme.of(context)
                                                    .titleSmallFamily,
                                            color: Colors.white,
                                            letterSpacing: 0.0,
                                            useGoogleFonts:
                                                !FlutterFlowTheme.of(context)
                                                    .titleSmallIsCustom,
                                          ),
                                      elevation: 0.0,
                                      borderRadius: BorderRadius.circular(30.0),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ].addToStart(SizedBox(height: 10.0)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
