import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class UsersRecord extends FirestoreRecord {
  UsersRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "email" field.
  String? _email;
  String get email => _email ?? '';
  bool hasEmail() => _email != null;

  // "display_name" field.
  String? _displayName;
  String get displayName => _displayName ?? '';
  bool hasDisplayName() => _displayName != null;

  // "photo_url" field.
  String? _photoUrl;
  String get photoUrl => _photoUrl ?? '';
  bool hasPhotoUrl() => _photoUrl != null;

  // "uid" field.
  String? _uid;
  String get uid => _uid ?? '';
  bool hasUid() => _uid != null;

  // "created_time" field.
  DateTime? _createdTime;
  DateTime? get createdTime => _createdTime;
  bool hasCreatedTime() => _createdTime != null;

  // "phone_number" field.
  String? _phoneNumber;
  String get phoneNumber => _phoneNumber ?? '';
  bool hasPhoneNumber() => _phoneNumber != null;

  // "isAdmin" field.
  bool? _isAdmin;
  bool get isAdmin => _isAdmin ?? false;
  bool hasIsAdmin() => _isAdmin != null;

  // "isAnyBundlePurchased" field.
  bool? _isAnyBundlePurchased;
  bool get isAnyBundlePurchased => _isAnyBundlePurchased ?? false;
  bool hasIsAnyBundlePurchased() => _isAnyBundlePurchased != null;

  // "isPremiumUser" field.
  bool? _isPremiumUser;
  bool get isPremiumUser => _isPremiumUser ?? false;
  bool hasIsPremiumUser() => _isPremiumUser != null;

  // "platform" field.
  String? _platform;
  String get platform => _platform ?? '';
  bool hasPlatform() => _platform != null;

  // "createdAt" field.
  DateTime? _createdAt;
  DateTime? get createdAt => _createdAt;
  bool hasCreatedAt() => _createdAt != null;

  // "freeCreditsDate" field.
  DateTime? _freeCreditsDate;
  DateTime? get freeCreditsDate => _freeCreditsDate;
  bool hasFreeCreditsDate() => _freeCreditsDate != null;

  // "lastLogin" field.
  DateTime? _lastLogin;
  DateTime? get lastLogin => _lastLogin;
  bool hasLastLogin() => _lastLogin != null;

  // "serverTimeStamp" field.
  DateTime? _serverTimeStamp;
  DateTime? get serverTimeStamp => _serverTimeStamp;
  bool hasServerTimeStamp() => _serverTimeStamp != null;

  // "creditBalance" field.
  int? _creditBalance;
  int get creditBalance => _creditBalance ?? 0;
  bool hasCreditBalance() => _creditBalance != null;

  // "remainingMessageCount" field.
  int? _remainingMessageCount;
  int get remainingMessageCount => _remainingMessageCount ?? 0;
  bool hasRemainingMessageCount() => _remainingMessageCount != null;

  void _initializeFields() {
    _email = snapshotData['email'] as String?;
    _displayName = snapshotData['display_name'] as String?;
    _photoUrl = snapshotData['photo_url'] as String?;
    _uid = snapshotData['uid'] as String?;
    _createdTime = snapshotData['created_time'] as DateTime?;
    _phoneNumber = snapshotData['phone_number'] as String?;
    _isAdmin = snapshotData['isAdmin'] as bool?;
    _isAnyBundlePurchased = snapshotData['isAnyBundlePurchased'] as bool?;
    _isPremiumUser = snapshotData['isPremiumUser'] as bool?;
    _platform = snapshotData['platform'] as String?;
    _createdAt = snapshotData['createdAt'] as DateTime?;
    _freeCreditsDate = snapshotData['freeCreditsDate'] as DateTime?;
    _lastLogin = snapshotData['lastLogin'] as DateTime?;
    _serverTimeStamp = snapshotData['serverTimeStamp'] as DateTime?;
    _creditBalance = castToType<int>(snapshotData['creditBalance']);
    _remainingMessageCount =
        castToType<int>(snapshotData['remainingMessageCount']);
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('users');

  static Stream<UsersRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => UsersRecord.fromSnapshot(s));

  static Future<UsersRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => UsersRecord.fromSnapshot(s));

  static UsersRecord fromSnapshot(DocumentSnapshot snapshot) => UsersRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static UsersRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      UsersRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'UsersRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is UsersRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createUsersRecordData({
  String? email,
  String? displayName,
  String? photoUrl,
  String? uid,
  DateTime? createdTime,
  String? phoneNumber,
  bool? isAdmin,
  bool? isAnyBundlePurchased,
  bool? isPremiumUser,
  String? platform,
  DateTime? createdAt,
  DateTime? freeCreditsDate,
  DateTime? lastLogin,
  DateTime? serverTimeStamp,
  int? creditBalance,
  int? remainingMessageCount,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'email': email,
      'display_name': displayName,
      'photo_url': photoUrl,
      'uid': uid,
      'created_time': createdTime,
      'phone_number': phoneNumber,
      'isAdmin': isAdmin,
      'isAnyBundlePurchased': isAnyBundlePurchased,
      'isPremiumUser': isPremiumUser,
      'platform': platform,
      'createdAt': createdAt,
      'freeCreditsDate': freeCreditsDate,
      'lastLogin': lastLogin,
      'serverTimeStamp': serverTimeStamp,
      'creditBalance': creditBalance,
      'remainingMessageCount': remainingMessageCount,
    }.withoutNulls,
  );

  return firestoreData;
}

class UsersRecordDocumentEquality implements Equality<UsersRecord> {
  const UsersRecordDocumentEquality();

  @override
  bool equals(UsersRecord? e1, UsersRecord? e2) {
    return e1?.email == e2?.email &&
        e1?.displayName == e2?.displayName &&
        e1?.photoUrl == e2?.photoUrl &&
        e1?.uid == e2?.uid &&
        e1?.createdTime == e2?.createdTime &&
        e1?.phoneNumber == e2?.phoneNumber &&
        e1?.isAdmin == e2?.isAdmin &&
        e1?.isAnyBundlePurchased == e2?.isAnyBundlePurchased &&
        e1?.isPremiumUser == e2?.isPremiumUser &&
        e1?.platform == e2?.platform &&
        e1?.createdAt == e2?.createdAt &&
        e1?.freeCreditsDate == e2?.freeCreditsDate &&
        e1?.lastLogin == e2?.lastLogin &&
        e1?.serverTimeStamp == e2?.serverTimeStamp &&
        e1?.creditBalance == e2?.creditBalance &&
        e1?.remainingMessageCount == e2?.remainingMessageCount;
  }

  @override
  int hash(UsersRecord? e) => const ListEquality().hash([
        e?.email,
        e?.displayName,
        e?.photoUrl,
        e?.uid,
        e?.createdTime,
        e?.phoneNumber,
        e?.isAdmin,
        e?.isAnyBundlePurchased,
        e?.isPremiumUser,
        e?.platform,
        e?.createdAt,
        e?.freeCreditsDate,
        e?.lastLogin,
        e?.serverTimeStamp,
        e?.creditBalance,
        e?.remainingMessageCount
      ]);

  @override
  bool isValidKey(Object? o) => o is UsersRecord;
}
