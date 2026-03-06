import '/auth/firebase_auth/auth_util.dart';
import '/backend/backend.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import 'dart:ui';
import '/custom_code/widgets/index.dart' as custom_widgets;
import '/index.dart';
import 'chat_widget.dart' show ChatWidget;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

class ChatModel extends FlutterFlowModel<ChatWidget> {
  ///  Local state fields for this page.

  bool isGenerating = false;

  bool attach = false;

  bool viewChat = false;

  bool uploadedMedia = false;

  String aiReply = ' ';

  List<dynamic> extractedFacts = [];
  void addToExtractedFacts(dynamic item) => extractedFacts.add(item);
  void removeFromExtractedFacts(dynamic item) => extractedFacts.remove(item);
  void removeAtIndexFromExtractedFacts(int index) =>
      extractedFacts.removeAt(index);
  void insertAtIndexInExtractedFacts(int index, dynamic item) =>
      extractedFacts.insert(index, item);
  void updateExtractedFactsAtIndex(int index, Function(dynamic) updateFn) =>
      extractedFacts[index] = updateFn(extractedFacts[index]);

  bool showScrollButton = false;

  /// scrollOffset
  double? scrollOffset;

  double? scrollMax;

  String userPrompt = '\'\'';

  String predictionId = '\'\'';

  bool isLoading = true;

  String aiFullResponse = '\"\"';

  String aiDisplayedResponse = '\"\"';

  bool isStreaming = false;

  bool systemPromptLoaded = true;

  DocumentReference? systemPromptContent;

  String systemPromptNew = 'systemPromptNew';

  String tempUserPromptString = 'tempUserPromptString';

  bool isTyping = false;

  String conversationId = 'conversationId';

  bool isGeneratingImage = false;

  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Firestore Query - Query a collection] action in Chat widget.
  List<ConversationsRecord>? lastConvQuery;
  // Stores action output result for [Backend Call - Create Document] action in Chat widget.
  ConversationsRecord? createdDocReference;
  // Stores action output result for [Backend Call - Create Document] action in ModernDrawerWidget widget.
  ConversationsRecord? newchatoutput;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
