package com.nextgptapp.here.ui.ui_components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nextgptapp.here.R
import com.nextgptapp.here.ui.theme.AIVisionTheme
import com.nextgptapp.here.ui.theme.Barlow
import com.google.firebase.auth.FirebaseAuth

@Composable
fun AdsButton(
    modifier: Modifier = Modifier,
    resourceId: Int = R.drawable.video,
    buttonText: String = stringResource(id = R.string.watch_ad),
    isAdLoading: Boolean,
    showCreditText: Boolean = true,
    onClickWatchAd: () -> Unit
) {
    val isAdmin = FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com"
    if (isAdmin) return

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(5.dp),
        horizontalAlignment = Alignment.End
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.CenterHorizontally)
        ) {
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(5.dp))
                    .clickable(onClick = onClickWatchAd)
                    .background(
                        shape = RoundedCornerShape(5.dp),
                        color = MaterialTheme.colorScheme.onSecondary
                    )
                    .border(
                        0.6.dp,
                        color = MaterialTheme.colorScheme.onTertiary,
                        shape = RoundedCornerShape(5.dp)
                    )
                    .padding(vertical = 7.dp, horizontal = 7.dp)
            ) {
                Icon(
                    painter = painterResource(resourceId),
                    contentDescription = stringResource(R.string.app_name),
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = buttonText,
                    color = if (isAdLoading) MaterialTheme.colorScheme.onSecondary else MaterialTheme.colorScheme.onBackground,
                    style = TextStyle(
                        fontSize = 13.sp,
                        fontWeight = FontWeight.W600,
                        fontFamily = Barlow,
                        lineHeight = 20.sp
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            if (isAdLoading) {
                CircularProgressIndicator(
                    modifier = Modifier
                        .size(16.dp)
                        .align(Alignment.Center),
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        if (showCreditText) {
            Spacer(modifier = Modifier.heightIn(3.dp))
            Text(
                text = stringResource(R.string.free_credits),
                color = MaterialTheme.colorScheme.onSurface,
                style = TextStyle(
                    fontSize = 13.sp,
                    fontWeight = FontWeight.W500,
                    fontFamily = Barlow,
                    lineHeight = 20.sp
                ),
                textAlign = TextAlign.Center,
                modifier = Modifier
            )
        }
    }
}

@Preview
@Composable
fun adsPreview() {
    AIVisionTheme {
        AdsButton(isAdLoading = false, resourceId = R.drawable.video) {}
    }
}
