import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/flutter_flow_widgets.dart';
import '/custom_code/widgets/index.dart' as custom_widgets;
import '/index.dart';
import 'package:flutter/material.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'sign_up_model.dart';
export 'sign_up_model.dart';

class SignUpWidget extends StatefulWidget {
  const SignUpWidget({super.key});

  static String routeName = 'SignUp';
  static String routePath = '/signUp';

  @override
  State<SignUpWidget> createState() => _SignUpWidgetState();
}

class _SignUpWidgetState extends State<SignUpWidget> {
  late SignUpModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => SignUpModel());
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
          child: custom_widgets.ModernSignUpWidget(
            width: double.infinity,
            height: double.infinity,
            onSignUp: () async {
              if (Navigator.of(context).canPop()) {
                context.pop();
              }
              context.pushNamed(SignInWidget.routeName);
            },
            onGoogleSignUp: () async {
              if (Navigator.of(context).canPop()) {
                context.pop();
              }
              context.pushNamed(SignInWidget.routeName);
            },
            onAppleSignUp: () async {
              if (Navigator.of(context).canPop()) {
                context.pop();
              }
              context.pushNamed(SignInWidget.routeName);
            },
            onSignIn: () async {
              context.pushNamed(SignInWidget.routeName);
            },
          ),
        ),
      ),
    );
  }
}
