package com.nextgptapp.here.ui.voiceai

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MicOff

import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.nextgptapp.here.R
import com.nextgptapp.here.components.click
import com.nextgptapp.here.ui.credits_info.NoCreditsInfoBottomSheet
import com.nextgptapp.here.ui.theme.Barlow
import com.nextgptapp.here.ui.theme.CreditsTint
import com.nextgptapp.here.ui.theme.ErrorColor
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.firebase.auth.FirebaseAuth


@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun VoiceScreen(chatId:String,navigateToBack: (conversationID:Long) -> Unit,
                navigateToPremium: () -> Unit,
                viewModel: VoiceViewModel = hiltViewModel()
){

    val isPremium by viewModel.isCreditsPurchased.collectAsState()
    val creditsCount by viewModel.creditsCount.collectAsState()
    val minCreditsRequired by viewModel.minCreditsRequired.collectAsState()
    val showNoCreditsBottomSheet by viewModel.showNoCreditsBottomSheet
    val status by viewModel.statusText
    val language by viewModel.voiceLanguage
    var listening by remember { mutableStateOf(true) }
    val shouldScale by viewModel.isActive

    val isAdmin = FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com"



    val microPhonePermissionState = rememberPermissionState(
        android.Manifest.permission.RECORD_AUDIO
    )

    LaunchedEffect(microPhonePermissionState.status.isGranted) {

        viewModel.setChatId(chatId)
        if (!microPhonePermissionState.status.isGranted) {
            microPhonePermissionState.launchPermissionRequest()
        }else{
            viewModel.startListening()
        }
    }

    BackHandler() {
        viewModel.stopSpeaking()
        viewModel.stopListening()
        navigateToBack(viewModel.conversationId)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(color = MaterialTheme.colorScheme.background)
    ) {
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart)
        {
        Text(
            text = "${stringResource(R.string.language)} : ${language.displayName}",
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp , end = 16.dp).align(Alignment.CenterStart),
            color = MaterialTheme.colorScheme.onBackground,
            style = TextStyle(
                fontWeight = FontWeight.W600,
                fontSize = 17.sp,
                fontFamily = Barlow,
                textAlign = TextAlign.Start, platformStyle = PlatformTextStyle(includeFontPadding = false)
            )
        )
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.weight(1f))
            Row(
                modifier = Modifier
                    .background(
                        MaterialTheme.colorScheme.onTertiary,
                        shape = RoundedCornerShape(90.dp)
                    )
                    .padding(horizontal = 9.dp, vertical = 3.dp)
                    .click {
                        //navigateToCredits()
                    }
            ) {
                if ( isPremium) {
                    Icon(
                        painter = painterResource(R.drawable.ic_crown),
                        contentDescription = "image",
                        tint = CreditsTint,
                        modifier = Modifier
                            .width(27.dp)
                            .height(27.dp)
                            .padding(end = 5.dp)
                    )
                } else {
                    Icon(
                        painter = painterResource(R.drawable.outline_credit),
                        contentDescription = "image",
                        tint = CreditsTint,
                        modifier = Modifier
                            .width(27.dp)
                            .height(27.dp)
                            .padding(end = 3.dp)
                    )
                    Text(
                        text = creditsCount.toString(),
                        color = MaterialTheme.colorScheme.primary,
                        style = TextStyle(
                            fontSize = 20.sp,
                            fontWeight = FontWeight.W600,
                            fontFamily = Barlow,
                            lineHeight = 25.sp
                        ),
                        textAlign = TextAlign.Center
                    )
                }
            }

        }


        Box(Modifier.fillMaxWidth().align(Alignment.Center),contentAlignment = Alignment.Center) {
        WaveSpeakingAnimation(shouldScale)
        }

        Row(
            modifier = Modifier.fillMaxWidth().align(Alignment.BottomCenter) // Align the Row at the bottom center of the Box
                .padding(vertical = 35.dp, horizontal = 24.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {

            IconButton(
                onClick = {
                    listening = !listening
                    viewModel.toggleListening(listening)
                }, modifier = Modifier
                    .size(50.dp)
                   .background(
                       /* if (isListening)*/ MaterialTheme.colorScheme.onTertiary /*else SemiTransparentRed*/,
                        shape = RoundedCornerShape(90.dp)
                    )

            ) {
                Icon(
                    imageVector=  if (listening) Icons.Rounded.Mic else Icons.Rounded.MicOff,
                    "mic",
                    modifier = Modifier.size(25.dp),
                    tint = if (listening) MaterialTheme.colorScheme.onBackground else ErrorColor,
                )
            }

            //Spacer(Modifier.weight(1f))
            Text(modifier = Modifier.weight(1f).padding(8.dp),color = if (status==StatusText.ERROR) Color.Red else Color.Green, textAlign = TextAlign.Center,text = status.text)
            IconButton(
                onClick = {
                    viewModel.stopSpeaking()
                    viewModel.stopListening()

                    navigateToBack(viewModel.conversationId)
                }, modifier = Modifier
                    .size(50.dp)
                    .background(
                        MaterialTheme.colorScheme.onTertiary,
                        shape = RoundedCornerShape(90.dp)
                    )

            ) {
                Icon(
                    imageVector=  Icons.Rounded.Clear ,
                    "mic",
                    modifier = Modifier.size(25.dp),
                    tint = MaterialTheme.colorScheme.onBackground,
                )
            }

        }

        if (!isAdmin) {
            NoCreditsInfoBottomSheet(
                showSheet = showNoCreditsBottomSheet ,
                minCreditsRequired = minCreditsRequired ,
                onDismiss = { viewModel.resetCreditsDialog() },
                onUpgrade = { navigateToPremium() }
            )
        }

    }

}

@Composable
fun WaveSpeakingAnimation(isScale:Boolean) {
    val infiniteTransition = rememberInfiniteTransition(label = "")

    // Scale animation for the circle
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ), label = ""
    )

    // Rotation animation
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ), label = ""
    )

    // Main circle with moving waves
    Box(
        modifier = Modifier
            .size(170.dp) // Base size of the circle
            .graphicsLayer {
                scaleX = if (isScale) scale else 1f
                scaleY = if (isScale) scale else 1f
                rotationZ = rotation
            }
            .background(
                brush = Brush.radialGradient(
                    colors = listOf(Color(0xFF2196F3), Color(0xFFBBDEFB)),
                    center = Offset(0f, 0f),
                    radius = 250f
                ),
                shape = CircleShape
            ),
        contentAlignment = Alignment.Center
    ) {
        // Inner circle or icon (optional)
        Box(
            modifier = Modifier
                .size(60.dp)
                .background(Color.White, shape = CircleShape)
        )
    }
}