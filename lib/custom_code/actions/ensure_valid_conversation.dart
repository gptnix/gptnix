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

import '/custom_code/actions/index.dart';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// ✅ HELPER ACTION: Osigurava da postoji validan conversation Pozovi ovu
/// akciju PRIJE navigacije na chat page!
///
/// Vraća DocumentReference na validan conversation: - Ako activeConvRef
/// postoji i validan je → vraća ga - Ako je null ili invalid → kreira novi i
/// vraća ga
///
/// KAKO KORISTITI: 1. FlutterFlow → Custom Actions → Add Action 2. Copy/paste
/// ovaj kod 3. Action Name: ensureValidConversation 4. Return Type:
/// DocumentReference 5. Na chat page button → Actions → Add Action → Custom →
/// ensureValidConversation 6. Set FFAppState().activeConvRef =
/// [ensureValidConversation result] 7. Navigate to chat page
Future<DocumentReference?> ensureValidConversation() async {
  try {
    print('🔧 [ENSURE] Checking activeConvRef...');

    // ✅ Provjeri da li postoji activeConvRef u App State
    final currentRef = FFAppState().activeConvRef;

    if (currentRef != null) {
      // ✅ Provjeri da li dokument postoji
      try {
        final doc = await currentRef.get();
        if (doc.exists) {
          print('🔧 [ENSURE] activeConvRef is VALID ✅');
          return currentRef;
        } else {
          print('🔧 [ENSURE] activeConvRef document does NOT exist');
        }
      } catch (e) {
        print('🔧 [ENSURE] activeConvRef is INVALID: $e');
      }
    } else {
      print('🔧 [ENSURE] activeConvRef is NULL');
    }

    // ✅ Kreiraj novi conversation
    print('🔧 [ENSURE] Creating NEW conversation...');

    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) {
      print('❌ [ENSURE] User not logged in!');
      return null;
    }

    final newConvRef =
        await FirebaseFirestore.instance.collection('conversations').add({
      'user_id': userId,
      'created_at': FieldValue.serverTimestamp(),
      'updated_at': FieldValue.serverTimestamp(),
      'title': 'Novi razgovor',
      'thread_summary': '',
      'thread_summary_updatedAt': '',
    });

    print('🔧 [ENSURE] Created NEW conversation: ${newConvRef.id} ✅');

    // ✅ Ažuriraj App State
    FFAppState().update(() {
      FFAppState().activeConvRef = newConvRef;
    });

    return newConvRef;
  } catch (e) {
    print('❌ [ENSURE] Error: $e');
    return null;
  }
}

// Set your action name, define your arguments and return parameter,
// and then add the boilerplate code using the green button on the right!
