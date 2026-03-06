import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class AiModelsRecord extends FirestoreRecord {
  AiModelsRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "apiEndpoint" field.
  String? _apiEndpoint;
  String get apiEndpoint => _apiEndpoint ?? '';
  bool hasApiEndpoint() => _apiEndpoint != null;

  // "apiKey" field.
  String? _apiKey;
  String get apiKey => _apiKey ?? '';
  bool hasApiKey() => _apiKey != null;

  // "defaultPrompt" field.
  String? _defaultPrompt;
  String get defaultPrompt => _defaultPrompt ?? '';
  bool hasDefaultPrompt() => _defaultPrompt != null;

  // "displayName" field.
  String? _displayName;
  String get displayName => _displayName ?? '';
  bool hasDisplayName() => _displayName != null;

  // "provider" field.
  String? _provider;
  String get provider => _provider ?? '';
  bool hasProvider() => _provider != null;

  // "isActive" field.
  bool? _isActive;
  bool get isActive => _isActive ?? false;
  bool hasIsActive() => _isActive != null;

  // "iconUrl" field.
  String? _iconUrl;
  String get iconUrl => _iconUrl ?? '';
  bool hasIconUrl() => _iconUrl != null;

  // "disableEmpathy" field.
  bool? _disableEmpathy;
  bool get disableEmpathy => _disableEmpathy ?? false;
  bool hasDisableEmpathy() => _disableEmpathy != null;

  // "enabled" field.
  bool? _enabled;
  bool get enabled => _enabled ?? false;
  bool hasEnabled() => _enabled != null;

  // "fallbackModel" field.
  String? _fallbackModel;
  String get fallbackModel => _fallbackModel ?? '';
  bool hasFallbackModel() => _fallbackModel != null;

  // "id" field.
  String? _id;
  String get id => _id ?? '';
  bool hasId() => _id != null;

  // "modelName" field.
  String? _modelName;
  String get modelName => _modelName ?? '';
  bool hasModelName() => _modelName != null;

  // "modelSource" field.
  String? _modelSource;
  String get modelSource => _modelSource ?? '';
  bool hasModelSource() => _modelSource != null;

  // "modelValue" field.
  String? _modelValue;
  String get modelValue => _modelValue ?? '';
  bool hasModelValue() => _modelValue != null;

  // "name" field.
  String? _name;
  String get name => _name ?? '';
  bool hasName() => _name != null;

  // "persona" field.
  String? _persona;
  String get persona => _persona ?? '';
  bool hasPersona() => _persona != null;

  // "requiresBrowsing" field.
  bool? _requiresBrowsing;
  bool get requiresBrowsing => _requiresBrowsing ?? false;
  bool hasRequiresBrowsing() => _requiresBrowsing != null;

  // "stylePrompt" field.
  String? _stylePrompt;
  String get stylePrompt => _stylePrompt ?? '';
  bool hasStylePrompt() => _stylePrompt != null;

  // "supportsStreaming" field.
  bool? _supportsStreaming;
  bool get supportsStreaming => _supportsStreaming ?? false;
  bool hasSupportsStreaming() => _supportsStreaming != null;

  // "title" field.
  String? _title;
  String get title => _title ?? '';
  bool hasTitle() => _title != null;

  // "tone" field.
  bool? _tone;
  bool get tone => _tone ?? false;
  bool hasTone() => _tone != null;

  void _initializeFields() {
    _apiEndpoint = snapshotData['apiEndpoint'] as String?;
    _apiKey = snapshotData['apiKey'] as String?;
    _defaultPrompt = snapshotData['defaultPrompt'] as String?;
    _displayName = snapshotData['displayName'] as String?;
    _provider = snapshotData['provider'] as String?;
    _isActive = snapshotData['isActive'] as bool?;
    _iconUrl = snapshotData['iconUrl'] as String?;
    _disableEmpathy = snapshotData['disableEmpathy'] as bool?;
    _enabled = snapshotData['enabled'] as bool?;
    _fallbackModel = snapshotData['fallbackModel'] as String?;
    _id = snapshotData['id'] as String?;
    _modelName = snapshotData['modelName'] as String?;
    _modelSource = snapshotData['modelSource'] as String?;
    _modelValue = snapshotData['modelValue'] as String?;
    _name = snapshotData['name'] as String?;
    _persona = snapshotData['persona'] as String?;
    _requiresBrowsing = snapshotData['requiresBrowsing'] as bool?;
    _stylePrompt = snapshotData['stylePrompt'] as String?;
    _supportsStreaming = snapshotData['supportsStreaming'] as bool?;
    _title = snapshotData['title'] as String?;
    _tone = snapshotData['tone'] as bool?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('ai_models');

  static Stream<AiModelsRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => AiModelsRecord.fromSnapshot(s));

  static Future<AiModelsRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => AiModelsRecord.fromSnapshot(s));

  static AiModelsRecord fromSnapshot(DocumentSnapshot snapshot) =>
      AiModelsRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static AiModelsRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      AiModelsRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'AiModelsRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is AiModelsRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createAiModelsRecordData({
  String? apiEndpoint,
  String? apiKey,
  String? defaultPrompt,
  String? displayName,
  String? provider,
  bool? isActive,
  String? iconUrl,
  bool? disableEmpathy,
  bool? enabled,
  String? fallbackModel,
  String? id,
  String? modelName,
  String? modelSource,
  String? modelValue,
  String? name,
  String? persona,
  bool? requiresBrowsing,
  String? stylePrompt,
  bool? supportsStreaming,
  String? title,
  bool? tone,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'apiEndpoint': apiEndpoint,
      'apiKey': apiKey,
      'defaultPrompt': defaultPrompt,
      'displayName': displayName,
      'provider': provider,
      'isActive': isActive,
      'iconUrl': iconUrl,
      'disableEmpathy': disableEmpathy,
      'enabled': enabled,
      'fallbackModel': fallbackModel,
      'id': id,
      'modelName': modelName,
      'modelSource': modelSource,
      'modelValue': modelValue,
      'name': name,
      'persona': persona,
      'requiresBrowsing': requiresBrowsing,
      'stylePrompt': stylePrompt,
      'supportsStreaming': supportsStreaming,
      'title': title,
      'tone': tone,
    }.withoutNulls,
  );

  return firestoreData;
}

class AiModelsRecordDocumentEquality implements Equality<AiModelsRecord> {
  const AiModelsRecordDocumentEquality();

  @override
  bool equals(AiModelsRecord? e1, AiModelsRecord? e2) {
    return e1?.apiEndpoint == e2?.apiEndpoint &&
        e1?.apiKey == e2?.apiKey &&
        e1?.defaultPrompt == e2?.defaultPrompt &&
        e1?.displayName == e2?.displayName &&
        e1?.provider == e2?.provider &&
        e1?.isActive == e2?.isActive &&
        e1?.iconUrl == e2?.iconUrl &&
        e1?.disableEmpathy == e2?.disableEmpathy &&
        e1?.enabled == e2?.enabled &&
        e1?.fallbackModel == e2?.fallbackModel &&
        e1?.id == e2?.id &&
        e1?.modelName == e2?.modelName &&
        e1?.modelSource == e2?.modelSource &&
        e1?.modelValue == e2?.modelValue &&
        e1?.name == e2?.name &&
        e1?.persona == e2?.persona &&
        e1?.requiresBrowsing == e2?.requiresBrowsing &&
        e1?.stylePrompt == e2?.stylePrompt &&
        e1?.supportsStreaming == e2?.supportsStreaming &&
        e1?.title == e2?.title &&
        e1?.tone == e2?.tone;
  }

  @override
  int hash(AiModelsRecord? e) => const ListEquality().hash([
        e?.apiEndpoint,
        e?.apiKey,
        e?.defaultPrompt,
        e?.displayName,
        e?.provider,
        e?.isActive,
        e?.iconUrl,
        e?.disableEmpathy,
        e?.enabled,
        e?.fallbackModel,
        e?.id,
        e?.modelName,
        e?.modelSource,
        e?.modelValue,
        e?.name,
        e?.persona,
        e?.requiresBrowsing,
        e?.stylePrompt,
        e?.supportsStreaming,
        e?.title,
        e?.tone
      ]);

  @override
  bool isValidKey(Object? o) => o is AiModelsRecord;
}
