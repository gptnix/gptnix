import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'lat_lng.dart';
import 'place.dart';
import 'uploaded_file.dart';
import '/backend/backend.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '/backend/schema/structs/index.dart';
import '/auth/firebase_auth/auth_util.dart';

String detectImageIntent(String message) {
  final raw = (message).trim();
  if (raw.isEmpty) {
    return jsonEncode({
      "isImage": false,
      "score": 0.0,
      "prompt": "",
      "reason": "empty",
    });
  }

  // ---------------------------
  // 1) Normalize (lower + trim + basic diacritics)
  // ---------------------------
  String t = raw.toLowerCase().trim();

  // basic diacritics normalize (keep it stable & small)
  const Map<String, String> di = {
    'č': 'c',
    'ć': 'c',
    'đ': 'd',
    'š': 's',
    'ž': 'z',
    'á': 'a',
    'à': 'a',
    'â': 'a',
    'ä': 'a',
    'ã': 'a',
    'å': 'a',
    'é': 'e',
    'è': 'e',
    'ê': 'e',
    'ë': 'e',
    'í': 'i',
    'ì': 'i',
    'î': 'i',
    'ï': 'i',
    'ó': 'o',
    'ò': 'o',
    'ô': 'o',
    'ö': 'o',
    'õ': 'o',
    'ú': 'u',
    'ù': 'u',
    'û': 'u',
    'ü': 'u',
    'ý': 'y',
    'ÿ': 'y',
    'ñ': 'n',
    'ç': 'c',
    'ß': 'ss',
  };

  for (final e in di.entries) {
    t = t.replaceAll(e.key, e.value);
  }
  t = t.replaceAll(RegExp(r'\s+'), ' ');

  bool containsAny(String text, List<String> needles) {
    for (final n in needles) {
      if (n.isEmpty) continue;
      if (text.contains(n)) return true;
    }
    return false;
  }

  // ---------------------------
  // 2) Emoji triggers (instant)
  // ---------------------------
  const emojiList = ['🎨', '🖼', '🖌', '✏', '🖍', '📷', '📸', '🏞', '🌄', '🌅'];
  for (final e in emojiList) {
    if (raw.contains(e)) {
      final cleaned =
          raw.replaceAll(RegExp(r'[🎨🖼️🖌️✏️🖍️📷📸🏞️🌄🌅]'), '').trim();
      return jsonEncode({
        "isImage": true,
        "score": 0.98,
        "prompt": cleaned.isEmpty ? raw : cleaned,
        "reason": "emoji",
      });
    }
  }

  // ---------------------------
  // 3) Question detection (downrank)
  // ---------------------------
  bool isQuestion = false;
  if (t.endsWith('?')) {
    isQuestion = true;
  } else {
    const qStarts = [
      // HR/BS/SR (normalized)
      'kako ',
      'sta ',
      'sto ',
      'zasto ',
      'zasto?',
      'kada ',
      'gdje ',
      'tko ',
      'ciji ',
      'koliko ',
      // EN
      'how ',
      'what ',
      'why ',
      'when ',
      'where ',
      'which ',
      'who ',
    ];
    for (final w in qStarts) {
      if (t.startsWith(w)) {
        isQuestion = true;
        break;
      }
    }
  }

  // ---------------------------
  // 4) Slash/! commands (100%)
  // ---------------------------
  const cmds = [
    '/img',
    '/image',
    '/imagine',
    '/gen',
    '/generate',
    '/draw',
    '/paint',
    '!img',
    '!image',
    '!imagine',
    '!gen',
    '!draw',
  ];

  for (final c in cmds) {
    if (t.startsWith(c)) {
      final stripped =
          raw.replaceFirst(RegExp(r'^\s*[/!]\w+\s*[:\-]?\s*'), '').trim();
      return jsonEncode({
        "isImage": true,
        "score": 1.0,
        "prompt": stripped.isEmpty ? raw : stripped,
        "reason": "command",
      });
    }
  }

  // ---------------------------
  // 5) Strong phrases (high confidence)
  // ---------------------------
  const strongPhrases = [
    // HR/BS/SR (normalized)
    'generiraj sliku',
    'napravi sliku',
    'kreiraj sliku',
    'nacrtaj',
    'crtaj',
    'oslikaj',
    'ilustriraj',
    // EN
    'generate image',
    'create image',
    'make an image',
    'draw ',
    'paint ',
    'illustrate',
    'render',
    'imagine ',
    'visualize',
    'visualise',
    // common labels
    'slika:',
    'image:',
    'prompt:',
    'midjourney',
    'stable diffusion',
    'dall-e',
    'dalle',
  ];

  bool hasStrong = containsAny(t, strongPhrases);

  // ---------------------------
  // 6) Style/long prompt heuristic
  // ---------------------------
  final words = t.split(' ').where((w) => w.trim().isNotEmpty).toList();
  final longDesc = words.length >= 12;

  const styleWords = [
    'photoreal',
    'photorealistic',
    'realistic',
    'cinematic',
    'dramatic',
    'hdr',
    '8k',
    '4k',
    'highly detailed',
    'ultra detailed',
    'bokeh',
    'depth of field',
    'dof',
    'lens flare',
    'wide angle',
    'macro',
    // bhs/hr
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    'realistican',
    // (namjerno ostavljeno minimalno; ovo gore možeš obrisati, ali ne smeta)
    'realistican',
    'detaljno',
    'kinematografski',
    'visoka rezolucija',
    'stil',
    'osvjetljenje',
  ];

  int styleCount = 0;
  for (final sw in styleWords) {
    if (sw.isEmpty) continue;
    if (t.contains(sw)) styleCount++;
    if (styleCount >= 2) break;
  }

  // ---------------------------
  // 7) Negative signals (force chat)
  // ---------------------------
  const negSignals = [
    'explain',
    'describe',
    'tell me',
    'what is',
    'who is',
    'define',
    'meaning',
    'objasni',
    'razlozi',
    'reci mi',
    'sta je',
    'sto je',
  ];

  final hasNeg = containsAny(t, negSignals);
  if (hasNeg && !hasStrong) {
    return jsonEncode({
      "isImage": false,
      "score": 0.0,
      "prompt": "",
      "reason": "negative_signal",
    });
  }

  // ---------------------------
  // 8) Score logic
  // ---------------------------
  double score = 0.0;
  String reason = "no_match";

  if (hasStrong) {
    score = 0.95;
    reason = "strong";
  } else if (longDesc && styleCount >= 2) {
    score = 0.78;
    reason = "longdesc_style";
  } else if (longDesc && !isQuestion) {
    score = 0.68;
    reason = "longdesc";
  } else if (containsAny(
          t, ['slika', 'image', 'picture', 'photo', 'drawing']) &&
      words.length >= 8 &&
      !isQuestion) {
    score = 0.65;
    reason = "image_noun";
  }

  // downrank questions unless it's super-strong
  if (isQuestion && score < 0.93) {
    score *= 0.35;
    reason = "question_downgrade";
  }

  final isImage = score >= 0.75;

  // ---------------------------
  // 9) Prompt extraction (simple, stable)
  // ---------------------------
  String promptOut = raw;

  // if "slika:" / "image:" / "prompt:" take text after colon
  final idx = raw.indexOf(':');
  if (idx > 0 && idx < raw.length - 1) {
    final head = raw.substring(0, idx).toLowerCase().trim();
    if (head == 'slika' || head == 'image' || head == 'prompt') {
      final after = raw.substring(idx + 1).trim();
      if (after.isNotEmpty) promptOut = after;
    }
  }

  // strip common directives at the start
  if (hasStrong) {
    promptOut = promptOut.replaceFirst(
        RegExp(
          r'^\s*(generiraj|izgeneriraj|napravi|kreiraj|nacrtaj|crtaj|oslikaj|ilustriraj)\s+(sliku|slika)?\s*[:,\-]?\s*',
          caseSensitive: false,
        ),
        '');
    promptOut = promptOut.replaceFirst(
        RegExp(
          r'^\s*(create|generate|make)\s+(an?\s+)?(image|picture|photo)\s*[:,\-]?\s*',
          caseSensitive: false,
        ),
        '');
    promptOut = promptOut.replaceFirst(
        RegExp(
            r'^\s*(draw|paint|illustrate|render|imagine|visualize)\s*[:,\-]?\s*',
            caseSensitive: false),
        '');
    promptOut = promptOut.trim();
  }

  if (promptOut.isEmpty) promptOut = raw;

  return jsonEncode({
    "isImage": isImage,
    "score": double.parse(score.toStringAsFixed(2)),
    "prompt": promptOut,
    "reason": reason,
  });
}
