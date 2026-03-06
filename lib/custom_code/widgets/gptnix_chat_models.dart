// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'index.dart'; // Imports other custom widgets
import '/custom_code/actions/index.dart'; // Imports custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import '/custom_code/widgets/index.dart';
import '/custom_code/actions/index.dart';
import '/flutter_flow/custom_functions.dart';

import 'dart:typed_data';

class GptnixChatTheme {
  final bool isDark;
  final Color bg;
  final Color surface;
  final Color surface2;
  final Color border;
  final Color text;
  final Color subtext;
  final Color muted;
  final Color userGradA;
  final Color userGradB;
  final Color toastBg;
  final Color toastText;
  final Color icon;

  const GptnixChatTheme({
    required this.isDark,
    required this.bg,
    required this.surface,
    required this.surface2,
    required this.border,
    required this.text,
    required this.subtext,
    required this.muted,
    required this.userGradA,
    required this.userGradB,
    required this.toastBg,
    required this.toastText,
    required this.icon,
  });

  static GptnixChatTheme fromMode(bool isDark) =>
      isDark ? _darkPreset() : _lightPreset();

  static GptnixChatTheme _lightPreset() => const GptnixChatTheme(
        isDark: false,
        bg: Color(0xFFFFFFFF),
        surface: Color(0xFFF7F8FA),
        surface2: Color(0xFFFFFFFF),
        border: Color(0xFFE5E7EB),
        text: Color(0xFF111827),
        subtext: Color(0xFF6B7280),
        muted: Color(0xFF9CA3AF),
        userGradA: Color(0xFF2563EB),
        userGradB: Color(0xFF1D4ED8),
        toastBg: Color(0xE6111111),
        toastText: Color(0xFFFFFFFF),
        icon: Color(0xFF111827),
      );

  static GptnixChatTheme _darkPreset() => const GptnixChatTheme(
        isDark: true,
        bg: Color(0xFF0B1020),
        surface: Color(0xFF111827),
        surface2: Color(0xFF0F172A),
        border: Color(0xFF243041),
        text: Color(0xFFE5E7EB),
        subtext: Color(0xFF94A3B8),
        muted: Color(0xFF64748B),
        userGradA: Color(0xFF1D4ED8),
        userGradB: Color(0xFF1E40AF),
        toastBg: Color(0xEE0B1020),
        toastText: Color(0xFFE5E7EB),
        icon: Color(0xFFE5E7EB),
      );
}

class GptnixChatAttachment {
  final String name;
  final String ext;
  final Uint8List bytes;

  const GptnixChatAttachment({
    required this.name,
    required this.ext,
    required this.bytes,
  });

  bool get isImage =>
      const ['png', 'jpg', 'jpeg', 'webp', 'gif'].contains(ext.toLowerCase());
}

class GptnixWebSource {
  final String title;
  final String url;
  final String snippet;
  final String provider;
  final String? imageUrl;

  const GptnixWebSource({
    required this.title,
    required this.url,
    required this.snippet,
    required this.provider,
    this.imageUrl,
  });

  static GptnixWebSource? tryParse(dynamic x) {
    if (x is! Map) return null;

    final url = (x['url'] ?? x['link'] ?? '').toString().trim();
    if (url.isEmpty) return null;

    String? pickImage() {
      const keys = [
        'imageUrl',
        'image_url',
        'image',
        'thumbnail',
        'thumb',
        'img',
        'icon',
        'poster',
        'posterUrl',
        'poster_url',
        'backdrop',
        'backdropUrl',
        'backdrop_url',
        'photo',
        'photoUrl',
        'photo_url',
      ];

      for (final k in keys) {
        final v = x[k];
        if (v == null) continue;
        final s = v.toString().trim();
        if (s.isEmpty) continue;
        if (s.startsWith('http://') || s.startsWith('https://')) return s;
      }

      final posterPath = (x['poster_path'] ?? '').toString().trim();
      if (posterPath.isNotEmpty && posterPath.startsWith('/')) {
        return 'https://image.tmdb.org/t/p/w500$posterPath';
      }

      final backdropPath = (x['backdrop_path'] ?? '').toString().trim();
      if (backdropPath.isNotEmpty && backdropPath.startsWith('/')) {
        return 'https://image.tmdb.org/t/p/w780$backdropPath';
      }

      return null;
    }

    final img = pickImage();

    return GptnixWebSource(
      title: (x['title'] ?? x['name'] ?? url).toString().trim(),
      url: url,
      snippet: (x['snippet'] ?? x['content'] ?? x['description'] ?? '')
          .toString()
          .trim(),
      provider: (x['provider'] ?? x['source'] ?? '').toString().trim(),
      imageUrl: (img != null && img.isNotEmpty) ? img : null,
    );
  }
}
