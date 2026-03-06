import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class MessagesRecord extends FirestoreRecord {
  MessagesRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "text" field.
  String? _text;
  String get text => _text ?? '';
  bool hasText() => _text != null;

  // "role" field.
  String? _role;
  String get role => _role ?? '';
  bool hasRole() => _role != null;

  // "userId" field.
  String? _userId;
  String get userId => _userId ?? '';
  bool hasUserId() => _userId != null;

  // "created_at" field.
  DateTime? _createdAt;
  DateTime? get createdAt => _createdAt;
  bool hasCreatedAt() => _createdAt != null;

  // "is_streaming" field.
  bool? _isStreaming;
  bool get isStreaming => _isStreaming ?? false;
  bool hasIsStreaming() => _isStreaming != null;

  // "conversationId" field.
  String? _conversationId;
  String get conversationId => _conversationId ?? '';
  bool hasConversationId() => _conversationId != null;

  // "error" field.
  String? _error;
  String get error => _error ?? '';
  bool hasError() => _error != null;

  // "attachments" field.
  String? _attachments;
  String get attachments => _attachments ?? '';
  bool hasAttachments() => _attachments != null;

  // "user_ref" field.
  DocumentReference? _userRef;
  DocumentReference? get userRef => _userRef;
  bool hasUserRef() => _userRef != null;

  // "completed_at" field.
  DateTime? _completedAt;
  DateTime? get completedAt => _completedAt;
  bool hasCompletedAt() => _completedAt != null;

  // "conversation_ref" field.
  DocumentReference? _conversationRef;
  DocumentReference? get conversationRef => _conversationRef;
  bool hasConversationRef() => _conversationRef != null;

  // "user_msg_ref" field.
  DocumentReference? _userMsgRef;
  DocumentReference? get userMsgRef => _userMsgRef;
  bool hasUserMsgRef() => _userMsgRef != null;

  // "isSearchResult" field.
  bool? _isSearchResult;
  bool get isSearchResult => _isSearchResult ?? false;
  bool hasIsSearchResult() => _isSearchResult != null;

  // "type" field.
  String? _type;
  String get type => _type ?? '';
  bool hasType() => _type != null;

  // "content" field.
  String? _content;
  String get content => _content ?? '';
  bool hasContent() => _content != null;

  DocumentReference get parentReference => reference.parent.parent!;

  void _initializeFields() {
    _text = snapshotData['text'] as String?;
    _role = snapshotData['role'] as String?;
    _userId = snapshotData['userId'] as String?;
    _createdAt = snapshotData['created_at'] as DateTime?;
    _isStreaming = snapshotData['is_streaming'] as bool?;
    _conversationId = snapshotData['conversationId'] as String?;
    _error = snapshotData['error'] as String?;
    _attachments = snapshotData['attachments'] as String?;
    _userRef = snapshotData['user_ref'] as DocumentReference?;
    _completedAt = snapshotData['completed_at'] as DateTime?;
    _conversationRef = snapshotData['conversation_ref'] as DocumentReference?;
    _userMsgRef = snapshotData['user_msg_ref'] as DocumentReference?;
    _isSearchResult = snapshotData['isSearchResult'] as bool?;
    _type = snapshotData['type'] as String?;
    _content = snapshotData['content'] as String?;
  }

  static Query<Map<String, dynamic>> collection([DocumentReference? parent]) =>
      parent != null
          ? parent.collection('messages')
          : FirebaseFirestore.instance.collectionGroup('messages');

  static DocumentReference createDoc(DocumentReference parent, {String? id}) =>
      parent.collection('messages').doc(id);

  static Stream<MessagesRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => MessagesRecord.fromSnapshot(s));

  static Future<MessagesRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => MessagesRecord.fromSnapshot(s));

  static MessagesRecord fromSnapshot(DocumentSnapshot snapshot) =>
      MessagesRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static MessagesRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      MessagesRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'MessagesRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is MessagesRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createMessagesRecordData({
  String? text,
  String? role,
  String? userId,
  DateTime? createdAt,
  bool? isStreaming,
  String? conversationId,
  String? error,
  String? attachments,
  DocumentReference? userRef,
  DateTime? completedAt,
  DocumentReference? conversationRef,
  DocumentReference? userMsgRef,
  bool? isSearchResult,
  String? type,
  String? content,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'text': text,
      'role': role,
      'userId': userId,
      'created_at': createdAt,
      'is_streaming': isStreaming,
      'conversationId': conversationId,
      'error': error,
      'attachments': attachments,
      'user_ref': userRef,
      'completed_at': completedAt,
      'conversation_ref': conversationRef,
      'user_msg_ref': userMsgRef,
      'isSearchResult': isSearchResult,
      'type': type,
      'content': content,
    }.withoutNulls,
  );

  return firestoreData;
}

class MessagesRecordDocumentEquality implements Equality<MessagesRecord> {
  const MessagesRecordDocumentEquality();

  @override
  bool equals(MessagesRecord? e1, MessagesRecord? e2) {
    return e1?.text == e2?.text &&
        e1?.role == e2?.role &&
        e1?.userId == e2?.userId &&
        e1?.createdAt == e2?.createdAt &&
        e1?.isStreaming == e2?.isStreaming &&
        e1?.conversationId == e2?.conversationId &&
        e1?.error == e2?.error &&
        e1?.attachments == e2?.attachments &&
        e1?.userRef == e2?.userRef &&
        e1?.completedAt == e2?.completedAt &&
        e1?.conversationRef == e2?.conversationRef &&
        e1?.userMsgRef == e2?.userMsgRef &&
        e1?.isSearchResult == e2?.isSearchResult &&
        e1?.type == e2?.type &&
        e1?.content == e2?.content;
  }

  @override
  int hash(MessagesRecord? e) => const ListEquality().hash([
        e?.text,
        e?.role,
        e?.userId,
        e?.createdAt,
        e?.isStreaming,
        e?.conversationId,
        e?.error,
        e?.attachments,
        e?.userRef,
        e?.completedAt,
        e?.conversationRef,
        e?.userMsgRef,
        e?.isSearchResult,
        e?.type,
        e?.content
      ]);

  @override
  bool isValidKey(Object? o) => o is MessagesRecord;
}
