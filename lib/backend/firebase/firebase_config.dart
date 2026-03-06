import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

Future initFirebase() async {
  if (kIsWeb) {
    await Firebase.initializeApp(
        options: FirebaseOptions(
            apiKey: "AIzaSyCp1jP5wKDPTE7aWY9c6dvJJLxVQYB2tis",
            authDomain: "gptnix-390f1.firebaseapp.com",
            projectId: "gptnix-390f1",
            storageBucket: "gptnix-390f1.firebasestorage.app",
            messagingSenderId: "496151959855",
            appId: "1:496151959855:web:b1756243e0482dbb69a9da",
            measurementId: "G-DY4Z5L0CCW"));
  } else {
    await Firebase.initializeApp();
  }
}
