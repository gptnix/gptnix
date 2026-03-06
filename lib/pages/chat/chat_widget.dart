import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/custom_code/widgets/index.dart' as custom_widgets;
import '/index.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'chat_model.dart';
export 'chat_model.dart';

class ChatWidget extends StatefulWidget {
  const ChatWidget({
    super.key,
    this.conversationRef,
    this.conversationId,
  });

  final DocumentReference? conversationRef;
  final String? conversationId;

  static String routeName = 'Chat';
  static String routePath = '/chat';

  @override
  State<ChatWidget> createState() => _ChatWidgetState();
}

class _ChatWidgetState extends State<ChatWidget> {
  late ChatModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => ChatModel());

    // On page load action.
    SchedulerBinding.instance.addPostFrameCallback((_) async {
      if (!(FFAppState().activeConvRef != null)) {
        _model.lastConvQuery = await queryConversationsRecordOnce(
          queryBuilder: (conversationsRecord) => conversationsRecord
              .where(
                'user_id',
                isEqualTo: currentUserUid,
              )
              .orderBy('updated_at', descending: true),
          limit: 1,
        );
        if (_model.lastConvQuery!.length > 0) {
          FFAppState().activeConvRef =
              _model.lastConvQuery?.lastOrNull?.reference;
        } else {
          var conversationsRecordReference =
              ConversationsRecord.collection.doc();
          await conversationsRecordReference.set(createConversationsRecordData(
            createdAt: getCurrentTimestamp,
            userId: currentUserUid,
            title: 'New Chat',
            updatedAt: getCurrentTimestamp,
          ));
          _model.createdDocReference = ConversationsRecord.getDocumentFromData(
              createConversationsRecordData(
                createdAt: getCurrentTimestamp,
                userId: currentUserUid,
                title: 'New Chat',
                updatedAt: getCurrentTimestamp,
              ),
              conversationsRecordReference);
          FFAppState().activeConvRef = _model.createdDocReference?.reference;
        }
      }
    });
  }

  @override
  void dispose() {
    _model.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<FFAppState>();

    return StreamBuilder<UsersRecord>(
      stream: UsersRecord.getDocument(currentUserReference!),
      builder: (context, snapshot) {
        // Customize what your widget looks like when it's loading.
        if (!snapshot.hasData) {
          return Scaffold(
            backgroundColor: FlutterFlowTheme.of(context).primary,
            body: Center(
              child: SizedBox(
                width: 50.0,
                height: 50.0,
                child: SpinKitThreeBounce(
                  color: FlutterFlowTheme.of(context).primary,
                  size: 50.0,
                ),
              ),
            ),
          );
        }

        final chatUsersRecord = snapshot.data!;

        return GestureDetector(
          onTap: () {
            FocusScope.of(context).unfocus();
            FocusManager.instance.primaryFocus?.unfocus();
          },
          child: Scaffold(
            key: scaffoldKey,
            resizeToAvoidBottomInset: false,
            backgroundColor: FlutterFlowTheme.of(context).primary,
            drawer: Container(
              width: MediaQuery.sizeOf(context).width * 0.8,
              child: Drawer(
                elevation: 16.0,
                child: Container(
                  width: double.infinity,
                  height: double.infinity,
                  child: custom_widgets.ModernDrawerWidget(
                    width: double.infinity,
                    height: double.infinity,
                    userId: currentUserUid,
                    userDoc: currentUserReference,
                    isDark: false,
                  ),
                ),
              ),
            ),
            appBar: AppBar(
              backgroundColor: FlutterFlowTheme.of(context).primaryBackground,
              iconTheme: IconThemeData(
                  color: FlutterFlowTheme.of(context).primaryText),
              automaticallyImplyLeading: true,
              actions: [],
              centerTitle: true,
              elevation: 0.0,
            ),
            body: SafeArea(
              top: true,
              child: Column(
                mainAxisSize: MainAxisSize.max,
                children: [
                  Expanded(
                    flex: 1,
                    child: Container(
                      decoration: BoxDecoration(
                        color: FlutterFlowTheme.of(context).secondaryBackground,
                      ),
                      child: custom_widgets.GptnixSseChat(
                        width: double.infinity,
                        height: double.infinity,
                        isDark: false,
                        backendUrl:
                            'https://gptnix-backend-496151959855.us-central1.run.app',
                        conversationRef: FFAppState().activeConvRef,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
