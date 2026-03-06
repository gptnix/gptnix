// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'index.dart'; // Imports other custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom action code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import '/auth/firebase_auth/auth_util.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
// DO NOT REMOVE ABOVE

Future<DocumentReference?> ensureConversation() async {
  try {
    if (currentUserReference == null) {
      print('❌ No user logged in → cannot create conversation.');
      return null;
    }

    final convRef =
        FirebaseFirestore.instance.collection('conversations').doc();

    await convRef.set({
      'title': 'Novi razgovor',
      'user_ref': currentUserReference,
      'user_id': currentUserUid,
      'created_at': FieldValue.serverTimestamp(),
      'updated_at': FieldValue.serverTimestamp(),
      'last_message': null,
    });

    print("✅ Conversation created: ${convRef.id}");
    return convRef;
  } catch (e) {
    print("❌ Error creating conversation: $e");
    return null;
  }
}
