// ignore_for_file: unnecessary_getters_setters

import 'package:cloud_firestore/cloud_firestore.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class SafeAreaUtilsStruct extends FFFirebaseStruct {
  SafeAreaUtilsStruct({
    double? top,
    double? bottom,
    double? right,
    double? left,
    FirestoreUtilData firestoreUtilData = const FirestoreUtilData(),
  })  : _top = top,
        _bottom = bottom,
        _right = right,
        _left = left,
        super(firestoreUtilData);

  // "top" field.
  double? _top;
  double get top => _top ?? 0.0;
  set top(double? val) => _top = val;

  void incrementTop(double amount) => top = top + amount;

  bool hasTop() => _top != null;

  // "bottom" field.
  double? _bottom;
  double get bottom => _bottom ?? 0.0;
  set bottom(double? val) => _bottom = val;

  void incrementBottom(double amount) => bottom = bottom + amount;

  bool hasBottom() => _bottom != null;

  // "right" field.
  double? _right;
  double get right => _right ?? 0.0;
  set right(double? val) => _right = val;

  void incrementRight(double amount) => right = right + amount;

  bool hasRight() => _right != null;

  // "left" field.
  double? _left;
  double get left => _left ?? 0.0;
  set left(double? val) => _left = val;

  void incrementLeft(double amount) => left = left + amount;

  bool hasLeft() => _left != null;

  static SafeAreaUtilsStruct fromMap(Map<String, dynamic> data) =>
      SafeAreaUtilsStruct(
        top: castToType<double>(data['top']),
        bottom: castToType<double>(data['bottom']),
        right: castToType<double>(data['right']),
        left: castToType<double>(data['left']),
      );

  static SafeAreaUtilsStruct? maybeFromMap(dynamic data) => data is Map
      ? SafeAreaUtilsStruct.fromMap(data.cast<String, dynamic>())
      : null;

  Map<String, dynamic> toMap() => {
        'top': _top,
        'bottom': _bottom,
        'right': _right,
        'left': _left,
      }.withoutNulls;

  @override
  Map<String, dynamic> toSerializableMap() => {
        'top': serializeParam(
          _top,
          ParamType.double,
        ),
        'bottom': serializeParam(
          _bottom,
          ParamType.double,
        ),
        'right': serializeParam(
          _right,
          ParamType.double,
        ),
        'left': serializeParam(
          _left,
          ParamType.double,
        ),
      }.withoutNulls;

  static SafeAreaUtilsStruct fromSerializableMap(Map<String, dynamic> data) =>
      SafeAreaUtilsStruct(
        top: deserializeParam(
          data['top'],
          ParamType.double,
          false,
        ),
        bottom: deserializeParam(
          data['bottom'],
          ParamType.double,
          false,
        ),
        right: deserializeParam(
          data['right'],
          ParamType.double,
          false,
        ),
        left: deserializeParam(
          data['left'],
          ParamType.double,
          false,
        ),
      );

  @override
  String toString() => 'SafeAreaUtilsStruct(${toMap()})';

  @override
  bool operator ==(Object other) {
    return other is SafeAreaUtilsStruct &&
        top == other.top &&
        bottom == other.bottom &&
        right == other.right &&
        left == other.left;
  }

  @override
  int get hashCode => const ListEquality().hash([top, bottom, right, left]);
}

SafeAreaUtilsStruct createSafeAreaUtilsStruct({
  double? top,
  double? bottom,
  double? right,
  double? left,
  Map<String, dynamic> fieldValues = const {},
  bool clearUnsetFields = true,
  bool create = false,
  bool delete = false,
}) =>
    SafeAreaUtilsStruct(
      top: top,
      bottom: bottom,
      right: right,
      left: left,
      firestoreUtilData: FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
        delete: delete,
        fieldValues: fieldValues,
      ),
    );

SafeAreaUtilsStruct? updateSafeAreaUtilsStruct(
  SafeAreaUtilsStruct? safeAreaUtils, {
  bool clearUnsetFields = true,
  bool create = false,
}) =>
    safeAreaUtils
      ?..firestoreUtilData = FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
      );

void addSafeAreaUtilsStructData(
  Map<String, dynamic> firestoreData,
  SafeAreaUtilsStruct? safeAreaUtils,
  String fieldName, [
  bool forFieldValue = false,
]) {
  firestoreData.remove(fieldName);
  if (safeAreaUtils == null) {
    return;
  }
  if (safeAreaUtils.firestoreUtilData.delete) {
    firestoreData[fieldName] = FieldValue.delete();
    return;
  }
  final clearFields =
      !forFieldValue && safeAreaUtils.firestoreUtilData.clearUnsetFields;
  if (clearFields) {
    firestoreData[fieldName] = <String, dynamic>{};
  }
  final safeAreaUtilsData =
      getSafeAreaUtilsFirestoreData(safeAreaUtils, forFieldValue);
  final nestedData =
      safeAreaUtilsData.map((k, v) => MapEntry('$fieldName.$k', v));

  final mergeFields = safeAreaUtils.firestoreUtilData.create || clearFields;
  firestoreData
      .addAll(mergeFields ? mergeNestedFields(nestedData) : nestedData);
}

Map<String, dynamic> getSafeAreaUtilsFirestoreData(
  SafeAreaUtilsStruct? safeAreaUtils, [
  bool forFieldValue = false,
]) {
  if (safeAreaUtils == null) {
    return {};
  }
  final firestoreData = mapToFirestore(safeAreaUtils.toMap());

  // Add any Firestore field values
  safeAreaUtils.firestoreUtilData.fieldValues
      .forEach((k, v) => firestoreData[k] = v);

  return forFieldValue ? mergeNestedFields(firestoreData) : firestoreData;
}

List<Map<String, dynamic>> getSafeAreaUtilsListFirestoreData(
  List<SafeAreaUtilsStruct>? safeAreaUtilss,
) =>
    safeAreaUtilss
        ?.map((e) => getSafeAreaUtilsFirestoreData(e, true))
        .toList() ??
    [];
