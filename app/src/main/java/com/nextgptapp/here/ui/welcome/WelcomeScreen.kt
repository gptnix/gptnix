package com.nextgptapp.here.ui.welcome

import android.content.res.Configuration
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.nextgptapp.here.R
import com.nextgptapp.here.components.AuthResultContract
import com.nextgptapp.here.components.Constants
import com.nextgptapp.here.components.GoogleClient
import com.nextgptapp.here.components.SignInType
import com.nextgptapp.here.ui.theme.AIVisionTheme
import com.nextgptapp.here.ui.theme.Barlow
import com.nextgptapp.here.ui.theme.Montserrat
import com.nextgptapp.here.ui.theme.stronglyDeemphasizedAlpha
import com.nextgptapp.here.ui.ui_components.GoogleLoginButton
import com.nextgptapp.here.ui.ui_components.NormalLoginButton
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.common.api.ApiException

private const val TAG = "WelcomeScreen"

@Composable
fun WelcomeScreen(navigateToRecentChat: () -> Unit, viewModel: WelcomeViewModel = hiltViewModel()) {
    // ✅ ISPRAVKA: Koristi viewModel.authError direktno (jer je mutableStateOf)
    val loginError = viewModel.authError
    val googleClient: GoogleSignInClient = GoogleClient.get(context = LocalContext.current)
    val signInRequestCode = 1

    val authResultLauncher =
        rememberLauncherForActivityResult(contract = AuthResultContract(googleClient)) { task ->
            Log.e("GOOGLE_AUTH", "🎯 authResultLauncher callback pozvan")
            Log.e("GOOGLE_AUTH", "➡️ task: $task")

            if (task == null) {
                Log.e("GOOGLE_AUTH", "❌ task je null - korisnik je vjerovatno otkazao")
                viewModel.setAuthError(true)
                viewModel.updateProcessingState(false)
                return@rememberLauncherForActivityResult
            }

            try {
                Log.e("GOOGLE_AUTH", "🔍 Pozivam task.getResult()")
                val account = task.getResult(ApiException::class.java)
                Log.e("GOOGLE_AUTH", "➡️ account: ${account?.email}")
                Log.e("GOOGLE_AUTH", "➡️ displayName: ${account?.displayName}")
                Log.e("GOOGLE_AUTH", "➡️ idToken: ${account?.idToken?.take(20)}...") // Samo prvih 20 karaktera
                Log.e("GOOGLE_AUTH", "➡️ account je null: ${account == null}")
                Log.e("GOOGLE_AUTH", "➡️ idToken je null: ${account?.idToken == null}")

                if (account == null || account.idToken == null) {
                    Log.e("GOOGLE_AUTH", "❌ account ili idToken null")
                    viewModel.setAuthError(true)
                    viewModel.updateProcessingState(false)
                } else {
                    Log.e("GOOGLE_AUTH", "✅ Pokrećem Firebase login s tokenom")
                    viewModel.authenticateWithToken(account.idToken!!)
                }
            } catch (e: ApiException) {
                Log.e("GOOGLE_AUTH", "❌ ApiException - status code: ${e.statusCode}")
                Log.e("GOOGLE_AUTH", "❌ ApiException - message: ${e.message}")
                Log.e("GOOGLE_AUTH", "❌ ApiException - status: ${e.status}")
                viewModel.setAuthError(true)
                viewModel.updateProcessingState(false)
            } catch (e: Exception) {
                Log.e("GOOGLE_AUTH", "❌ Općenita greška: ${e.message}")
                Log.e("GOOGLE_AUTH", "❌ Stack trace: ${e.stackTrace.contentToString()}")
                viewModel.setAuthError(true)
                viewModel.updateProcessingState(false)
            }
        }

    val signInResult by viewModel.loginSuccess.collectAsState()

    LaunchedEffect(signInResult) {
        if (signInResult) {
            Log.e(TAG, "signin trigger with coroutine")
            navigateToRecentChat()
        }
    }

    WelcomeUI(
        onGoogleButtonClick = {
            if (!viewModel.isProcessing) {
                viewModel.resetAuthState()
                viewModel.updateProcessingState(true)
                authResultLauncher.launch(signInRequestCode)
            }
        },
        onNormalButtonClick = {
            if (!viewModel.isProcessing) {
                viewModel.resetAuthState()
                viewModel.updateProcessingState(true)
                viewModel.loginWithEmailAndPass()
            }
        },
        viewModel.isProcessing,
        loginError
    )
}

@Composable
fun WelcomeUI(onGoogleButtonClick: () -> Unit, onNormalButtonClick: () -> Unit, isProcessing: Boolean, isLoginError: Boolean) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(color = MaterialTheme.colorScheme.background)
    ) {

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 5.dp, bottom = 50.dp)
                .background(color = MaterialTheme.colorScheme.background)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {


            Image(
                painter = painterResource(R.drawable.app_icon),
                contentDescription = stringResource(R.string.app_name),
                modifier = Modifier
                    .padding(top = 20.dp)
                    .size(180.dp)
            )
            Spacer(modifier = Modifier.height(3.dp))

            Text(
                modifier = Modifier.padding(horizontal = 16.dp),
                text = stringResource(R.string.app_name),
                color = MaterialTheme.colorScheme.onBackground,
                fontFamily = Montserrat,
                fontWeight = FontWeight.Bold,
                fontSize = 50.sp,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Image(
                    imageVector = Icons.Outlined.Bolt,
                    contentDescription = "powered by icon",
                    colorFilter = ColorFilter.tint(
                        MaterialTheme.colorScheme.onBackground
                    )
                )
                Text(
                    text = stringResource(R.string.powered_by),
                    color = MaterialTheme.colorScheme.onBackground,
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center,
                    fontSize = 16.sp
                )

            }



            Spacer(modifier = Modifier.height(40.dp))
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally
            ) {

                if (Constants.SignInMode == SignInType.Both || Constants.SignInMode == SignInType.Gmail) {
                    Spacer(modifier = Modifier.height(25.dp))
                    GoogleLoginButton(
                        text = stringResource(id = R.string.sign_in_with_google),
                        onClick = onGoogleButtonClick
                    )
                }
                if (Constants.SignInMode == SignInType.Both) {
                    Spacer(modifier = Modifier.height(20.dp))
                    Text(
                        text = stringResource(id = R.string.or),
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = stronglyDeemphasizedAlpha),
                    )
                }

                if (Constants.SignInMode == SignInType.Both || Constants.SignInMode == SignInType.Guest) {
                    Spacer(modifier = Modifier.height(20.dp))
                    NormalLoginButton(
                        text = stringResource(if (Constants.SignInMode == SignInType.Guest) R.string.user_continue else R.string.continue_guest),
                        onClick = onNormalButtonClick
                    )
                }

                if (isProcessing) {
                    Spacer(modifier = Modifier.height(12.dp))
                    CircularProgressIndicator()
                }
                if (isLoginError) {
                    Spacer(modifier = Modifier.height(15.dp))
                    TextFieldError(textError = stringResource(id = R.string.google_signin_error))
                }
            }

        }

        Column(Modifier.align(Alignment.BottomEnd)) {
            Divider(
                modifier = Modifier
                    .padding(start = 4.dp)
                    .padding(end = 4.dp),
                color = MaterialTheme.colorScheme.tertiary, thickness = 1.dp,
            )
            PolicyText()
        }
    }
}

@Composable
fun PolicyText() {
    val uriHandler = LocalUriHandler.current
    val terms = stringResource(id = R.string.terms_service)
    val privacy = stringResource(id = R.string.privacy_policy)

    val annotatedString = buildAnnotatedString {
        append("${stringResource(id = R.string.policy_text)} ")
        withStyle(style = SpanStyle(MaterialTheme.colorScheme.primary, textDecoration = TextDecoration.Underline)) {
            pushStringAnnotation(tag = terms, annotation = terms)
            append(terms)
        }
        append(" & ")
        withStyle(style = SpanStyle(MaterialTheme.colorScheme.primary, textDecoration = TextDecoration.Underline)) {
            pushStringAnnotation(tag = privacy, annotation = privacy)
            append(privacy)
        }
    }
    ClickableText(text = annotatedString, style = TextStyle(
        fontFamily = Barlow,
        fontWeight = FontWeight.W400,
        fontSize = 14.sp,
        color = MaterialTheme.colorScheme.onSurface,
        textAlign = TextAlign.Center
    ), modifier = Modifier.padding(5.dp), onClick = { offset ->
        annotatedString.getStringAnnotations(offset, offset)
            .firstOrNull()?.let { span ->
                if (span.item.contentEquals(terms)) {
                    runCatching {
                        uriHandler.openUri(Constants.TERMS_SERVICE)
                    }.onFailure { it.printStackTrace() }
                } else {
                    runCatching {
                        uriHandler.openUri(Constants.PRIVACY_POLICY)
                    }.onFailure { it.printStackTrace() }
                }
            }
    })
}

@Composable
fun TextFieldError(textError: String) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = textError,
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.error,
            textAlign = TextAlign.Center
        )
    }
}

@Preview(name = "Welcome light theme", uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
fun WelcomePreview() {
    AIVisionTheme {
        WelcomeUI(
            onGoogleButtonClick = { },
            onNormalButtonClick = {},
            isProcessing = false,
            isLoginError = true
        )
    }
}