package com.nextgptapp.here.ui.ui_components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nextgptapp.here.R
import com.nextgptapp.here.ui.theme.Barlow
import com.google.firebase.auth.FirebaseAuth

@Composable
fun NoCreditsErrorMessage(modifier: Modifier, minReq:Int) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {

        val isAdmin = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com"

        if (!isAdmin) {
            Column {
                Text(
                    text = stringResource(R.string.you_reach_free_message_limit, minReq),
                    color = MaterialTheme.colorScheme.onSurface,
                    style = TextStyle(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.W600,
                        fontFamily = Barlow,
                    ),
                    textAlign = TextAlign.Justify,
                    modifier = Modifier
                        .background(
                            color = MaterialTheme.colorScheme.onSecondary,
                            shape = RoundedCornerShape(16.dp)
                        )
                        .padding(10.dp)
                        .fillMaxWidth()
                )
            }
        }



    }
}