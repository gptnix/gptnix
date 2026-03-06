import '/backend/schema/structs/index.dart';

class StreamGPTNiXCloudFunctionCallResponse {
  StreamGPTNiXCloudFunctionCallResponse({
    this.errorCode,
    this.succeeded,
    this.jsonBody,
  });
  String? errorCode;
  bool? succeeded;
  dynamic jsonBody;
}
