import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/custom_code/widgets/index.dart' as custom_widgets;
import '/index.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'profile_model.dart';
export 'profile_model.dart';

class ProfileWidget extends StatefulWidget {
  const ProfileWidget({super.key});

  static String routeName = 'Profile';
  static String routePath = '/profile';

  @override
  State<ProfileWidget> createState() => _ProfileWidgetState();
}

class _ProfileWidgetState extends State<ProfileWidget> {
  late ProfileModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => ProfileModel());
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
          child: custom_widgets.ModernProfileWidget(
            width: double.infinity,
            height: double.infinity,
            onBack: () async {
              context.safePop();
            },
            onEditProfile: () async {},
            onSubscription: () async {
              context.pushNamed(MySubscriptionWidget.routeName);
            },
            onPersonalization: () async {},
            onDataControl: () async {},
            onNotifications: () async {},
            onTerms: () async {},
            onPrivacy: () async {},
            onHelp: () async {},
            onFeedback: () async {},
            onLogout: () async {
              if (Navigator.of(context).canPop()) {
                context.pop();
              }
              context.pushNamed(SignInWidget.routeName);
            },
            onDeleteAccount: () async {
              context.pushNamed(SettingWidget.routeName);
            },
          ),
        ),
      ),
    );
  }
}
