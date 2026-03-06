import 'package:flutter/material.dart';
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'flutter_flow/flutter_flow_util.dart';

class FFAppState extends ChangeNotifier {
  static FFAppState _instance = FFAppState._internal();

  factory FFAppState() {
    return _instance;
  }

  FFAppState._internal();

  static void reset() {
    _instance = FFAppState._internal();
  }

  Future initializePersistedState() async {
    prefs = await SharedPreferences.getInstance();
    _safeInit(() {
      _useWebSearch = prefs.getBool('ff_useWebSearch') ?? _useWebSearch;
    });
    _safeInit(() {
      _displayName = prefs.getString('ff_displayName') ?? _displayName;
    });
    _safeInit(() {
      _useHistory = prefs.getBool('ff_useHistory') ?? _useHistory;
    });
    _safeInit(() {
      _useMemory = prefs.getBool('ff_useMemory') ?? _useMemory;
    });
    _safeInit(() {
      _systemPromptContent = prefs.getString('ff_systemPromptContent')?.ref ??
          _systemPromptContent;
    });
    _safeInit(() {
      _selectedLanguage =
          prefs.getString('ff_selectedLanguage') ?? _selectedLanguage;
    });
  }

  void update(VoidCallback callback) {
    callback();
    notifyListeners();
  }

  late SharedPreferences prefs;

  String _selectedModel = 'deepseek-chat';
  String get selectedModel => _selectedModel;
  set selectedModel(String value) {
    _selectedModel = value;
  }

  DocumentReference? _activeConvRef;
  DocumentReference? get activeConvRef => _activeConvRef;
  set activeConvRef(DocumentReference? value) {
    _activeConvRef = value;
  }

  bool _useWebSearch = true;
  bool get useWebSearch => _useWebSearch;
  set useWebSearch(bool value) {
    _useWebSearch = value;
    prefs.setBool('ff_useWebSearch', value);
  }

  String _displayName = '';
  String get displayName => _displayName;
  set displayName(String value) {
    _displayName = value;
    prefs.setString('ff_displayName', value);
  }

  String _conversationId = '';
  String get conversationId => _conversationId;
  set conversationId(String value) {
    _conversationId = value;
  }

  bool _useHistory = true;
  bool get useHistory => _useHistory;
  set useHistory(bool value) {
    _useHistory = value;
    prefs.setBool('ff_useHistory', value);
  }

  bool _useMemory = true;
  bool get useMemory => _useMemory;
  set useMemory(bool value) {
    _useMemory = value;
    prefs.setBool('ff_useMemory', value);
  }

  DocumentReference? _systemPromptContent;
  DocumentReference? get systemPromptContent => _systemPromptContent;
  set systemPromptContent(DocumentReference? value) {
    _systemPromptContent = value;
    value != null
        ? prefs.setString('ff_systemPromptContent', value.path)
        : prefs.remove('ff_systemPromptContent');
  }

  String _systemPromptOverride = '';
  String get systemPromptOverride => _systemPromptOverride;
  set systemPromptOverride(String value) {
    _systemPromptOverride = value;
  }

  List<String> _availableModels = [
    'deepseek-chat',
    'gpt-4o-mini',
    'claude-3-5-sonnet',
    'gemini-2.0-flash',
    'Llama-3.3-70B'
  ];
  List<String> get availableModels => _availableModels;
  set availableModels(List<String> value) {
    _availableModels = value;
  }

  void addToAvailableModels(String value) {
    availableModels.add(value);
  }

  void removeFromAvailableModels(String value) {
    availableModels.remove(value);
  }

  void removeAtIndexFromAvailableModels(int index) {
    availableModels.removeAt(index);
  }

  void updateAvailableModelsAtIndex(
    int index,
    String Function(String) updateFn,
  ) {
    availableModels[index] = updateFn(_availableModels[index]);
  }

  void insertAtIndexInAvailableModels(int index, String value) {
    availableModels.insert(index, value);
  }

  bool _drawerOpen = false;
  bool get drawerOpen => _drawerOpen;
  set drawerOpen(bool value) {
    _drawerOpen = value;
  }

  String _selectedLanguage = 'en';
  String get selectedLanguage => _selectedLanguage;
  set selectedLanguage(String value) {
    _selectedLanguage = value;
    prefs.setString('ff_selectedLanguage', value);
  }
}

void _safeInit(Function() initializeField) {
  try {
    initializeField();
  } catch (_) {}
}

Future _safeInitAsync(Function() initializeField) async {
  try {
    await initializeField();
  } catch (_) {}
}
