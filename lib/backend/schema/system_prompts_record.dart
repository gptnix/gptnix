import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class SystemPromptsRecord extends FirestoreRecord {
  SystemPromptsRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "content" field.
  String? _content;
  String get content => _content ?? '';
  bool hasContent() => _content != null;

  // "name" field.
  String? _name;
  String get name => _name ?? '';
  bool hasName() => _name != null;

  void _initializeFields() {
    _content = snapshotData['content'] as String?;
    _name = snapshotData['name'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('system_prompts');

  static Stream<SystemPromptsRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => SystemPromptsRecord.fromSnapshot(s));

  static Future<SystemPromptsRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => SystemPromptsRecord.fromSnapshot(s));

  static SystemPromptsRecord fromSnapshot(DocumentSnapshot snapshot) =>
      SystemPromptsRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static SystemPromptsRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      SystemPromptsRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'SystemPromptsRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is SystemPromptsRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createSystemPromptsRecordData({
  String? content,
  String? name,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'content': content,
      'name': name,
    }.withoutNulls,
  );

  return firestoreData;
}

class SystemPromptsRecordDocumentEquality
    implements Equality<SystemPromptsRecord> {
  const SystemPromptsRecordDocumentEquality();

  @override
  bool equals(SystemPromptsRecord? e1, SystemPromptsRecord? e2) {
    return e1?.content == e2?.content && e1?.name == e2?.name;
  }

  @override
  int hash(SystemPromptsRecord? e) =>
      const ListEquality().hash([e?.content, e?.name]);

  @override
  bool isValidKey(Object? o) => o is SystemPromptsRecord;
}
