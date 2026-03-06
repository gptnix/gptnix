import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class UserFactsRecord extends FirestoreRecord {
  UserFactsRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "user_id" field.
  String? _userId;
  String get userId => _userId ?? '';
  bool hasUserId() => _userId != null;

  // "fact_key" field.
  String? _factKey;
  String get factKey => _factKey ?? '';
  bool hasFactKey() => _factKey != null;

  // "status" field.
  String? _status;
  String get status => _status ?? '';
  bool hasStatus() => _status != null;

  // "count" field.
  int? _count;
  int get count => _count ?? 0;
  bool hasCount() => _count != null;

  // "timestamp" field.
  DateTime? _timestamp;
  DateTime? get timestamp => _timestamp;
  bool hasTimestamp() => _timestamp != null;

  // "last_updated" field.
  DateTime? _lastUpdated;
  DateTime? get lastUpdated => _lastUpdated;
  bool hasLastUpdated() => _lastUpdated != null;

  // "fact_value" field.
  String? _factValue;
  String get factValue => _factValue ?? '';
  bool hasFactValue() => _factValue != null;

  void _initializeFields() {
    _userId = snapshotData['user_id'] as String?;
    _factKey = snapshotData['fact_key'] as String?;
    _status = snapshotData['status'] as String?;
    _count = castToType<int>(snapshotData['count']);
    _timestamp = snapshotData['timestamp'] as DateTime?;
    _lastUpdated = snapshotData['last_updated'] as DateTime?;
    _factValue = snapshotData['fact_value'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('user_facts');

  static Stream<UserFactsRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => UserFactsRecord.fromSnapshot(s));

  static Future<UserFactsRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => UserFactsRecord.fromSnapshot(s));

  static UserFactsRecord fromSnapshot(DocumentSnapshot snapshot) =>
      UserFactsRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static UserFactsRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      UserFactsRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'UserFactsRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is UserFactsRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createUserFactsRecordData({
  String? userId,
  String? factKey,
  String? status,
  int? count,
  DateTime? timestamp,
  DateTime? lastUpdated,
  String? factValue,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'user_id': userId,
      'fact_key': factKey,
      'status': status,
      'count': count,
      'timestamp': timestamp,
      'last_updated': lastUpdated,
      'fact_value': factValue,
    }.withoutNulls,
  );

  return firestoreData;
}

class UserFactsRecordDocumentEquality implements Equality<UserFactsRecord> {
  const UserFactsRecordDocumentEquality();

  @override
  bool equals(UserFactsRecord? e1, UserFactsRecord? e2) {
    return e1?.userId == e2?.userId &&
        e1?.factKey == e2?.factKey &&
        e1?.status == e2?.status &&
        e1?.count == e2?.count &&
        e1?.timestamp == e2?.timestamp &&
        e1?.lastUpdated == e2?.lastUpdated &&
        e1?.factValue == e2?.factValue;
  }

  @override
  int hash(UserFactsRecord? e) => const ListEquality().hash([
        e?.userId,
        e?.factKey,
        e?.status,
        e?.count,
        e?.timestamp,
        e?.lastUpdated,
        e?.factValue
      ]);

  @override
  bool isValidKey(Object? o) => o is UserFactsRecord;
}
