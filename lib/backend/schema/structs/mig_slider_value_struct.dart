// ignore_for_file: unnecessary_getters_setters

import 'package:cloud_firestore/cloud_firestore.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class MigSliderValueStruct extends FFFirebaseStruct {
  MigSliderValueStruct({
    double? minSelected,
    double? maxSelected,
    FirestoreUtilData firestoreUtilData = const FirestoreUtilData(),
  })  : _minSelected = minSelected,
        _maxSelected = maxSelected,
        super(firestoreUtilData);

  // "minSelected" field.
  double? _minSelected;
  double get minSelected => _minSelected ?? 0.0;
  set minSelected(double? val) => _minSelected = val;

  void incrementMinSelected(double amount) =>
      minSelected = minSelected + amount;

  bool hasMinSelected() => _minSelected != null;

  // "maxSelected" field.
  double? _maxSelected;
  double get maxSelected => _maxSelected ?? 0.0;
  set maxSelected(double? val) => _maxSelected = val;

  void incrementMaxSelected(double amount) =>
      maxSelected = maxSelected + amount;

  bool hasMaxSelected() => _maxSelected != null;

  static MigSliderValueStruct fromMap(Map<String, dynamic> data) =>
      MigSliderValueStruct(
        minSelected: castToType<double>(data['minSelected']),
        maxSelected: castToType<double>(data['maxSelected']),
      );

  static MigSliderValueStruct? maybeFromMap(dynamic data) => data is Map
      ? MigSliderValueStruct.fromMap(data.cast<String, dynamic>())
      : null;

  Map<String, dynamic> toMap() => {
        'minSelected': _minSelected,
        'maxSelected': _maxSelected,
      }.withoutNulls;

  @override
  Map<String, dynamic> toSerializableMap() => {
        'minSelected': serializeParam(
          _minSelected,
          ParamType.double,
        ),
        'maxSelected': serializeParam(
          _maxSelected,
          ParamType.double,
        ),
      }.withoutNulls;

  static MigSliderValueStruct fromSerializableMap(Map<String, dynamic> data) =>
      MigSliderValueStruct(
        minSelected: deserializeParam(
          data['minSelected'],
          ParamType.double,
          false,
        ),
        maxSelected: deserializeParam(
          data['maxSelected'],
          ParamType.double,
          false,
        ),
      );

  @override
  String toString() => 'MigSliderValueStruct(${toMap()})';

  @override
  bool operator ==(Object other) {
    return other is MigSliderValueStruct &&
        minSelected == other.minSelected &&
        maxSelected == other.maxSelected;
  }

  @override
  int get hashCode => const ListEquality().hash([minSelected, maxSelected]);
}

MigSliderValueStruct createMigSliderValueStruct({
  double? minSelected,
  double? maxSelected,
  Map<String, dynamic> fieldValues = const {},
  bool clearUnsetFields = true,
  bool create = false,
  bool delete = false,
}) =>
    MigSliderValueStruct(
      minSelected: minSelected,
      maxSelected: maxSelected,
      firestoreUtilData: FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
        delete: delete,
        fieldValues: fieldValues,
      ),
    );

MigSliderValueStruct? updateMigSliderValueStruct(
  MigSliderValueStruct? migSliderValue, {
  bool clearUnsetFields = true,
  bool create = false,
}) =>
    migSliderValue
      ?..firestoreUtilData = FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
      );

void addMigSliderValueStructData(
  Map<String, dynamic> firestoreData,
  MigSliderValueStruct? migSliderValue,
  String fieldName, [
  bool forFieldValue = false,
]) {
  firestoreData.remove(fieldName);
  if (migSliderValue == null) {
    return;
  }
  if (migSliderValue.firestoreUtilData.delete) {
    firestoreData[fieldName] = FieldValue.delete();
    return;
  }
  final clearFields =
      !forFieldValue && migSliderValue.firestoreUtilData.clearUnsetFields;
  if (clearFields) {
    firestoreData[fieldName] = <String, dynamic>{};
  }
  final migSliderValueData =
      getMigSliderValueFirestoreData(migSliderValue, forFieldValue);
  final nestedData =
      migSliderValueData.map((k, v) => MapEntry('$fieldName.$k', v));

  final mergeFields = migSliderValue.firestoreUtilData.create || clearFields;
  firestoreData
      .addAll(mergeFields ? mergeNestedFields(nestedData) : nestedData);
}

Map<String, dynamic> getMigSliderValueFirestoreData(
  MigSliderValueStruct? migSliderValue, [
  bool forFieldValue = false,
]) {
  if (migSliderValue == null) {
    return {};
  }
  final firestoreData = mapToFirestore(migSliderValue.toMap());

  // Add any Firestore field values
  migSliderValue.firestoreUtilData.fieldValues
      .forEach((k, v) => firestoreData[k] = v);

  return forFieldValue ? mergeNestedFields(firestoreData) : firestoreData;
}

List<Map<String, dynamic>> getMigSliderValueListFirestoreData(
  List<MigSliderValueStruct>? migSliderValues,
) =>
    migSliderValues
        ?.map((e) => getMigSliderValueFirestoreData(e, true))
        .toList() ??
    [];
