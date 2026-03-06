import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class ConversationsRecord extends FirestoreRecord {
  ConversationsRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "created_at" field.
  DateTime? _createdAt;
  DateTime? get createdAt => _createdAt;
  bool hasCreatedAt() => _createdAt != null;

  // "user_id" field.
  String? _userId;
  String get userId => _userId ?? '';
  bool hasUserId() => _userId != null;

  // "title" field.
  String? _title;
  String get title => _title ?? '';
  bool hasTitle() => _title != null;

  // "user_ref" field.
  DocumentReference? _userRef;
  DocumentReference? get userRef => _userRef;
  bool hasUserRef() => _userRef != null;

  // "last_message" field.
  String? _lastMessage;
  String get lastMessage => _lastMessage ?? '';
  bool hasLastMessage() => _lastMessage != null;

  // "last_message_at" field.
  DateTime? _lastMessageAt;
  DateTime? get lastMessageAt => _lastMessageAt;
  bool hasLastMessageAt() => _lastMessageAt != null;

  // "message_count" field.
  int? _messageCount;
  int get messageCount => _messageCount ?? 0;
  bool hasMessageCount() => _messageCount != null;

  // "completed_at" field.
  DateTime? _completedAt;
  DateTime? get completedAt => _completedAt;
  bool hasCompletedAt() => _completedAt != null;

  // "updated_at" field.
  DateTime? _updatedAt;
  DateTime? get updatedAt => _updatedAt;
  bool hasUpdatedAt() => _updatedAt != null;

  // "pinned" field.
  bool? _pinned;
  bool get pinned => _pinned ?? false;
  bool hasPinned() => _pinned != null;

  void _initializeFields() {
    _createdAt = snapshotData['created_at'] as DateTime?;
    _userId = snapshotData['user_id'] as String?;
    _title = snapshotData['title'] as String?;
    _userRef = snapshotData['user_ref'] as DocumentReference?;
    _lastMessage = snapshotData['last_message'] as String?;
    _lastMessageAt = snapshotData['last_message_at'] as DateTime?;
    _messageCount = castToType<int>(snapshotData['message_count']);
    _completedAt = snapshotData['completed_at'] as DateTime?;
    _updatedAt = snapshotData['updated_at'] as DateTime?;
    _pinned = snapshotData['pinned'] as bool?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('conversations');

  static Stream<ConversationsRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => ConversationsRecord.fromSnapshot(s));

  static Future<ConversationsRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => ConversationsRecord.fromSnapshot(s));

  static ConversationsRecord fromSnapshot(DocumentSnapshot snapshot) =>
      ConversationsRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static ConversationsRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      ConversationsRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'ConversationsRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is ConversationsRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createConversationsRecordData({
  DateTime? createdAt,
  String? userId,
  String? title,
  DocumentReference? userRef,
  String? lastMessage,
  DateTime? lastMessageAt,
  int? messageCount,
  DateTime? completedAt,
  DateTime? updatedAt,
  bool? pinned,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'created_at': createdAt,
      'user_id': userId,
      'title': title,
      'user_ref': userRef,
      'last_message': lastMessage,
      'last_message_at': lastMessageAt,
      'message_count': messageCount,
      'completed_at': completedAt,
      'updated_at': updatedAt,
      'pinned': pinned,
    }.withoutNulls,
  );

  return firestoreData;
}

class ConversationsRecordDocumentEquality
    implements Equality<ConversationsRecord> {
  const ConversationsRecordDocumentEquality();

  @override
  bool equals(ConversationsRecord? e1, ConversationsRecord? e2) {
    return e1?.createdAt == e2?.createdAt &&
        e1?.userId == e2?.userId &&
        e1?.title == e2?.title &&
        e1?.userRef == e2?.userRef &&
        e1?.lastMessage == e2?.lastMessage &&
        e1?.lastMessageAt == e2?.lastMessageAt &&
        e1?.messageCount == e2?.messageCount &&
        e1?.completedAt == e2?.completedAt &&
        e1?.updatedAt == e2?.updatedAt &&
        e1?.pinned == e2?.pinned;
  }

  @override
  int hash(ConversationsRecord? e) => const ListEquality().hash([
        e?.createdAt,
        e?.userId,
        e?.title,
        e?.userRef,
        e?.lastMessage,
        e?.lastMessageAt,
        e?.messageCount,
        e?.completedAt,
        e?.updatedAt,
        e?.pinned
      ]);

  @override
  bool isValidKey(Object? o) => o is ConversationsRecord;
}
