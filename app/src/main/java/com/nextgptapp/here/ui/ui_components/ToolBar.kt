package com.nextgptapp.here.ui.ui_components

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowDropDown
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nextgptapp.here.components.click
import com.nextgptapp.here.ui.theme.Barlow
import com.nextgptapp.here.ui.theme.CreditsTint
import com.nextgptapp.here.ui.theme.AIVisionTheme
import com.nextgptapp.here.R
import com.google.firebase.auth.FirebaseAuth

@Composable
fun ToolBar(
    onClickAction: () -> Unit,
    image: Int?,
    text: String,
    tint: Color,
    showDivider:Boolean = true,
    optionMenuItems: (@Composable () -> Unit)? = null
) {

    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center)
    {
        Text(
            text = text,
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp , end = 16.dp).align(Alignment.Center),
            color = MaterialTheme.colorScheme.onBackground,
            style = TextStyle(
                fontWeight = FontWeight.W600,
                fontSize = 17.sp,
                fontFamily = Barlow,
                textAlign = TextAlign.Center, platformStyle = PlatformTextStyle(includeFontPadding = false)
            )
        )

        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            image?.let {
                IconButton(
                    onClick = onClickAction,
                    modifier = Modifier
                        .width(27.dp)
                        .height(27.dp)
                ) {

                    Icon(
                        painter = painterResource(it),
                        contentDescription = "image",
                        tint = tint,
                        modifier = Modifier
                            .width(27.dp)
                            .height(27.dp)
                    )
                }
            }
            Spacer(modifier = Modifier
                .weight(1f)
                .height(25.dp))

            if (optionMenuItems != null) {
                optionMenuItems()
            }

        }

        if (showDivider)
        {   Divider(
            color = MaterialTheme.colorScheme.tertiary, thickness = 0.8.dp, modifier = Modifier.align(
                Alignment.BottomEnd)
        )
        }
    }


}

@Composable
fun ToolBarChat(
    onClickAction: () -> Unit,
    onStyleAction: () -> Unit,
    onModelClick: () -> Unit = {}, // Nova funkcija za model dropdown
    image: Int?,
    text: String,
    modelName: String = "Model", // Naziv trenutnog modela
    tint: Color,
    showDivider:Boolean = true,
    creditsCount:Int=0,
    isStyleMode:Boolean = true,
    isSubMode:Boolean = false,
    isPremium:Boolean = false
) {

    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center)
    {
        if (isStyleMode) {
            // Prikaz Style dropdown-a
            Row(
                Modifier
                    .fillMaxWidth()
                    .click { onStyleAction() },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {

                Text(
                    text = text,
                    color = MaterialTheme.colorScheme.onBackground,
                    style = TextStyle(
                        fontWeight = FontWeight.W700,
                        fontSize = 20.sp,
                        fontFamily = Barlow,
                        textAlign = TextAlign.Center
                    )
                )

                Icon(
                    imageVector = Icons.Outlined.ArrowDropDown,
                    contentDescription = "style picker",
                    tint = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier
                        .width(25.dp)
                        .height(25.dp)
                )
            }
        } else {
            // Prikaz Model dropdown-a
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .click { onModelClick() },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = modelName,
                    color = MaterialTheme.colorScheme.onBackground,
                    style = TextStyle(
                        fontWeight = FontWeight.W700,
                        fontSize = 20.sp,
                        fontFamily = Barlow,
                        textAlign = TextAlign.Center
                    )
                )

                Icon(
                    imageVector = Icons.Outlined.ArrowDropDown,
                    contentDescription = "model picker",
                    tint = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier
                        .width(25.dp)
                        .height(25.dp)
                )
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            image?.let {
                IconButton(
                    onClick = onClickAction,
                    modifier = Modifier
                        .width(27.dp)
                        .height(27.dp)
                ) {

                    Icon(
                        painter = painterResource(it),
                        contentDescription = "image",
                        tint = tint,
                        modifier = Modifier
                            .width(27.dp)
                            .height(27.dp)
                    )
                }
            }
            Spacer(modifier = Modifier
                .weight(1f)
                .height(27.dp))

        }

        // Credits/Premium indikator
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
                if (isSubMode && isPremium) {
                    Icon(
                        painter = painterResource(R.drawable.ic_crown),
                        contentDescription = "premium",
                        tint = CreditsTint,
                        modifier = Modifier
                            .width(27.dp)
                            .height(27.dp)
                            .padding(end = 5.dp)
                    )
                } else {
                    Icon(
                        painter = painterResource(R.drawable.outline_credit),
                        contentDescription = "credits",
                        tint = CreditsTint,
                        modifier = Modifier
                            .width(27.dp)
                            .height(27.dp)
                            .padding(end = 3.dp)
                    )
                    val isAdmin = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com"

                    if (!isAdmin) {
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

        }

        if (showDivider)
        {   Divider(
            color = MaterialTheme.colorScheme.tertiary, thickness = 0.8.dp, modifier = Modifier.align(
                Alignment.BottomEnd)
        )
        }
    }


}

@Preview(name = "Welcome light theme", uiMode = Configuration.UI_MODE_NIGHT_YES)
@Preview(name = "Welcome dark theme", uiMode = Configuration.UI_MODE_NIGHT_NO)
@Composable
fun AppBarPreview(){
    AIVisionTheme {
        Column {
            // Style mode preview
            ToolBarChat(
                onClickAction = {},
                onStyleAction = {},
                onModelClick = {},
                image = R.drawable.arrow_left,
                text = "Style : (None)",
                modelName = "GPT-4",
                tint = Color.DarkGray,
                showDivider = true,
                isStyleMode = true
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Model mode preview
            ToolBarChat(
                onClickAction = {},
                onStyleAction = {},
                onModelClick = {},
                image = R.drawable.arrow_left,
                text = "Style : (None)",
                modelName = "Claude Sonnet",
                tint = Color.DarkGray,
                showDivider = true,
                isStyleMode = false
            )
        }
    }
}