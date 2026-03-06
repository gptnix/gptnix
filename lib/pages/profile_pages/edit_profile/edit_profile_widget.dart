import '/auth/firebase_auth/auth_util.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/flutter_flow/upload_data.dart';
import '/custom_code/widgets/index.dart' as custom_widgets;
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'edit_profile_model.dart';
export 'edit_profile_model.dart';

class EditProfileWidget extends StatefulWidget {
  const EditProfileWidget({super.key});

  static String routeName = 'EditProfile';
  static String routePath = '/editProfile';

  @override
  State<EditProfileWidget> createState() => _EditProfileWidgetState();
}

class _EditProfileWidgetState extends State<EditProfileWidget> {
  late EditProfileModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => EditProfileModel());
  }

  @override
  void dispose() {
    _model.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        FocusScope.of(context).unfocus();
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: Scaffold(
        key: scaffoldKey,
        backgroundColor: Colors.transparent,
        body: Container(
          width: double.infinity,
          height: double.infinity,
          child: custom_widgets.ModernEditProfileWidget(
            width: double.infinity,
            height: double.infinity,
            userDoc: currentUserReference!,
            onBack: () async {
              context.safePop();
            },
            onSave: () async {
              context.safePop();
            },
            onChangePhoto: () async {
              final selectedMedia = await selectMediaWithSourceBottomSheet(
                context: context,
                imageQuality: 85,
                allowPhoto: true,
              );
              if (selectedMedia != null &&
                  selectedMedia.every(
                      (m) => validateFileFormat(m.storagePath, context))) {
                safeSetState(() => _model.isDataUploading_uploadDataN6d = true);
                var selectedUploadedFiles = <FFUploadedFile>[];

                try {
                  selectedUploadedFiles = selectedMedia
                      .map((m) => FFUploadedFile(
                            name: m.storagePath.split('/').last,
                            bytes: m.bytes,
                            height: m.dimensions?.height,
                            width: m.dimensions?.width,
                            blurHash: m.blurHash,
                            originalFilename: m.originalFilename,
                          ))
                      .toList();
                } finally {
                  _model.isDataUploading_uploadDataN6d = false;
                }
                if (selectedUploadedFiles.length == selectedMedia.length) {
                  safeSetState(() {
                    _model.uploadedLocalFile_uploadDataN6d =
                        selectedUploadedFiles.first;
                  });
                } else {
                  safeSetState(() {});
                  return;
                }
              }
            },
          ),
        ),
      ),
    );
  }
}
