package com.nextgptapp.here.ui.ui_components

import android.content.Intent
import android.content.res.Configuration
import android.util.Log
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Report
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.outlined.ZoomIn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.ClipboardManager
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.PopupProperties
import com.nextgptapp.here.R
import com.nextgptapp.here.components.AppLogger
import com.nextgptapp.here.components.ConversationType
import com.nextgptapp.here.components.DownloadStatusEnum
import com.nextgptapp.here.components.click
import com.nextgptapp.here.data.model.ChatMessage
import com.nextgptapp.here.data.model.GPTRole
import com.nextgptapp.here.data.model.MessageModel
import com.nextgptapp.here.ui.dialogs.ReportAIContentDialog
import com.nextgptapp.here.ui.theme.AIVisionTheme
import com.nextgptapp.here.ui.theme.Barlow
import com.nextgptapp.here.ui.theme.CodeBackground
import com.nextgptapp.here.ui.theme.OnSurfaceDark
import com.nextgptapp.here.ui.theme.White
import com.halilibo.richtext.markdown.Markdown
import com.halilibo.richtext.ui.CodeBlockStyle
import com.halilibo.richtext.ui.InfoPanelStyle
import com.halilibo.richtext.ui.RichTextStyle
import com.halilibo.richtext.ui.RichTextThemeIntegration
import com.halilibo.richtext.ui.TableStyle
import com.halilibo.richtext.ui.material3.Material3RichText
import com.skydoves.landscapist.ImageOptions
import com.skydoves.landscapist.glide.GlideImage
import java.util.Date
import androidx.compose.material.icons.filled.Public
import java.text.SimpleDateFormat
import java.util.*
import java.net.URI


@Composable
fun MessageBubble(message: ChatMessage,onImage:(String)->Unit,onReport:(ChatMessage,String,String)->Unit) {

    val isUSERMsg = message.role.contentEquals(GPTRole.USER.value)
    val topStart = if (message.url.isNotEmpty() || isUSERMsg) 12.dp else 0.dp
    val bottomEnd = if (isUSERMsg) 0.dp else 12.dp
    val sendIntent: Intent = Intent().apply {
        action = Intent.ACTION_SEND
        putExtra(Intent.EXTRA_TEXT, message.content.trimIndent())
        type = "text/plain"
    }
    val isImage = message.type.contentEquals(ConversationType.IMAGE.name)
    val shareIntent = Intent.createChooser(sendIntent, null)
    val context = LocalContext.current
    val clipboardManager: ClipboardManager = LocalClipboardManager.current
    var expanded by remember { mutableStateOf(false) }
    var showReportDialog by remember { mutableStateOf(false) } // State for report dialog

    Box(modifier = Modifier.fillMaxWidth())
    {

        Box(
            modifier = Modifier
                .align(if (isUSERMsg) Alignment.TopEnd else Alignment.TopStart)
                .widthIn(
                    0.dp, if (message.url.isNotEmpty()) {
                        if (message.url.contains("PDF")) 300.dp else 250.dp
                    } else Dp.Unspecified
                )
                .padding(end = if (isUSERMsg) 0.dp else 10.dp)
                .padding(start = if (isUSERMsg) 10.dp else 0.dp)
                .padding(vertical = 8.dp)
                .background(
                    if (isUSERMsg) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    shape = RoundedCornerShape(
                        topEnd = 12.dp,
                        topStart = topStart,
                        bottomEnd = bottomEnd,
                        bottomStart = 12.dp
                    )
                )
                .pointerInput(Unit) {
                    if (isImage.not() || isUSERMsg) {
                        detectTapGestures(
                            onLongPress = {
                                expanded = true
                            }
                        )
                    }
                }
            ,
        ) {
            Log.e("List","Item:${message.id}")
            if (isUSERMsg){
                Column {
                    if (message.url.isNotEmpty()) {
                        if (message.url.contains("PDF"))
                        {
                            val parts = message.url.split("::")
                            var fileName = "PDF File"
                            var pageSize = "1"
                            if (parts.size>1)
                            {
                                 fileName = parts[0]
                                 pageSize = parts[1]
                            }

                            Row {
                                Image(painter = painterResource(R.drawable.ic_pdf), contentDescription = null,
                                    Modifier
                                        .size(100.dp)
                                        .padding(10.dp))
                                Column(modifier = Modifier
                                    .weight(1f)
                                    .align(Alignment.CenterVertically)) {
                                    Text(
                                        text = fileName,
                                        color = MaterialTheme.colorScheme.onSurface,
                                        style = TextStyle(
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.W500,
                                            fontFamily = Barlow
                                        ),
                                        overflow = TextOverflow.Ellipsis
                                        ,
                                        maxLines = 1,
                                        textAlign = TextAlign.Start,
                                        modifier = Modifier
                                            .padding(0.dp)
                                            .fillMaxWidth()
                                            .padding(end = 16.dp),


                                        )
                                    Text(
                                        text = stringResource(id = R.string.page_count,pageSize),
                                        color = MaterialTheme.colorScheme.onSurface,
                                        style = TextStyle(
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.W500,
                                            fontFamily = Barlow
                                        ),
                                        overflow = TextOverflow.Ellipsis,
                                        maxLines = 1,
                                        textAlign = TextAlign.Start,
                                        modifier = Modifier
                                            .padding(0.dp)
                                            .fillMaxWidth()
                                            .padding(end = 16.dp),


                                        )
                                }
                            }

                        }else {
                            Box(modifier = Modifier
                                    .size(250.dp) ){
                                GlideImage(
                                imageModel = { message.url },
                                imageOptions = ImageOptions(
                                    contentScale = ContentScale.Crop
                                ),
                                modifier = Modifier
                                    .size(250.dp)
                                    .clip(
                                        RoundedCornerShape(
                                            topStart = 10.dp,
                                            topEnd = 10.dp,
                                            bottomStart = 0.dp,
                                            bottomEnd = 0.dp
                                        )
                                    )
                            )
                                if (message.isVid){
                                    Image(modifier=Modifier.size(50.dp).align(alignment = Alignment.Center),
                                        painter = painterResource(id = R.drawable.ic_np_video_play),
                                        contentDescription = "Play icon"
                                    )
                                }
                            }
                        }
                        //Spacer(modifier = Modifier.height(2.dp))
                    }
                    Text(
                        text = message.content,
                        color = White,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        textAlign = TextAlign.Start,
                        style = MaterialTheme.typography.bodyLarge
                    )
                }
            }else {

                CompositionLocalProvider(
                    LocalTextStyle provides MaterialTheme.typography.bodyLarge.copy(
                        color = MaterialTheme.colorScheme.onBackground
                    )
                ) {
                    Material3RichText(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        style = RichTextStyle(
                            codeBlockStyle = CodeBlockStyle(
                                textStyle = TextStyle(
                                    fontFamily = Barlow,
                                    fontSize = 14.sp,
                                    color = White
                                ),
                                wordWrap = true,
                                modifier = Modifier.background(
                                    shape = RoundedCornerShape(6.dp),
                                    color = CodeBackground
                                )
                            ),
                            tableStyle = TableStyle(borderColor = MaterialTheme.colorScheme.onBackground),
                            infoPanelStyle = InfoPanelStyle(textStyle = { TextStyle(color = MaterialTheme.colorScheme.primary) })
                        )
                    ) {
                        Markdown(
                            content = message.content.trimIndent()
                        )

                        if (message.fromWeb) {
                            WebIndicatorTag()
                        }
                    }
                }





                if (message.url.isNotEmpty() && isImage) {
                    Spacer(modifier = Modifier
                        .size(250.dp))

                    if (message.status == DownloadStatusEnum.COMPLETED.value) {
                        GlideImage(
                            imageModel = { message.url },
                            imageOptions = ImageOptions(
                                contentScale = ContentScale.Crop
                            ),
                            modifier = Modifier
                                .size(250.dp)
                                .padding(2.dp)
                                .clip(
                                    RoundedCornerShape(
                                        topStart = 10.dp,
                                        topEnd = 10.dp,
                                        bottomStart = 10.dp,
                                        bottomEnd = 10.dp
                                    )
                                )
                        )


                        Image(imageVector = Icons.Outlined.ZoomIn, contentDescription = null,
                            Modifier
                                .padding(5.dp)
                                .align(Alignment.TopEnd)
                                .background(OnSurfaceDark, RoundedCornerShape(8.dp))
                                .padding(start = 8.dp, top = 2.dp, bottom = 2.dp, end = 8.dp)
                                .click {
                                    onImage(message.url)
                                })
                    }
                    if (message.status == DownloadStatusEnum.DOWNLOADING.value)
                    {
                        CircularProgressIndicator(modifier = Modifier
                            .then(Modifier.size(32.dp))
                            .align(Alignment.Center),
                            color = MaterialTheme.colorScheme.primary)
                    }

                }

            }

            MaterialTheme(
                colorScheme = MaterialTheme.colorScheme.copy(surface = MaterialTheme.colorScheme.background),
                shapes = MaterialTheme.shapes.copy(medium = RoundedCornerShape(8))
            ) {
                DropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false },
                    modifier = Modifier
                        .background(MaterialTheme.colorScheme.onSecondary, RoundedCornerShape(8.dp))
                        .border(
                            1.dp,
                            MaterialTheme.colorScheme.onTertiary,
                            RoundedCornerShape(8.dp)
                        ),
                    properties = PopupProperties(focusable = false)
                ) {
                    DropdownMenuItem(
                        onClick = {
                            clipboardManager.setText(AnnotatedString((message.content.trimIndent())))
                            expanded = false
                        }, text = {
                            Text(
                                text = stringResource(R.string.copy),
                                color = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.padding(horizontal = 10.dp),
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }, leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                "DeleteConversation",
                                modifier = Modifier.size(25.dp),
                                tint = MaterialTheme.colorScheme.onBackground,
                            )
                        }
                    )
                    Divider(
                        color = MaterialTheme.colorScheme.tertiary, thickness = 1.dp,
                    )
                    DropdownMenuItem(
                        onClick = {
                            context.startActivity(shareIntent)
                            expanded = false
                        }
                        , text = {
                            Text(
                                text = stringResource(R.string.share),
                                color = MaterialTheme.colorScheme.onBackground,
                                modifier = Modifier.padding(horizontal = 10.dp),
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }, leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Share,
                                "share Icon",
                                modifier = Modifier.size(25.dp),
                                tint = MaterialTheme.colorScheme.onBackground,
                            )
                        }
                    )

                    if (isUSERMsg.not()) {
                        Divider(
                            color = MaterialTheme.colorScheme.tertiary, thickness = 1.dp,
                        )
                        DropdownMenuItem(
                            onClick = {
                                showReportDialog =true
                                expanded = false
                            }, text = {
                                Text(
                                    text = stringResource(R.string.report_content),
                                    color = MaterialTheme.colorScheme.onBackground,
                                    modifier = Modifier.padding(horizontal = 11.dp),
                                    style = MaterialTheme.typography.bodyLarge
                                )
                            }, leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Report,
                                    "Report Icon",
                                    modifier = Modifier.size(22.dp),
                                    tint = MaterialTheme.colorScheme.onBackground,
                                )
                            }
                        )
                    }

                }
            }
        }

    }

    if (showReportDialog) {
        ReportAIContentDialog(
            onDismissRequest = { showReportDialog = false },
            onSubmitReport = { reason , extraDetails->
                // Handle the reporting action here
                AppLogger.logE("MessageBubble","Reason:${reason}, detail:${extraDetails}")
                showReportDialog = false
                onReport(message,reason,extraDetails)
            }
        )
    }
}

fun getFormattedTime(timestamp: Long?): String {
    if (timestamp == null) return "?"
    val date = Date(timestamp)
    val format = SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault())
    return format.format(date)
}


@Composable
 fun SetupMaterial3RText(
    child: @Composable () -> Unit
) {
    val isApplied = LocalMaterialThemingApplied.current

    if (!isApplied) {
        RichTextThemeIntegration(
            textStyle = { LocalTextStyle.current },
            contentColor = { LocalContentColor.current  },
            ProvideTextStyle = { textStyle, content ->
                ProvideTextStyle(textStyle, content)
            },
            ProvideContentColor = { color, content ->
                //CompositionLocalProvider(LocalContentColor provides androidx.compose.ui.graphics.Color.Red) {
                    content()
                //}
            }
        ) {
            //CompositionLocalProvider(LocalMaterialThemingApplied provides true) {
                child()
            //}
        }
    } else {
        child()
    }
}

private val LocalMaterialThemingApplied = compositionLocalOf { false }

@Preview(widthDp = 300, showBackground = true, uiMode =  Configuration.UI_MODE_NIGHT_YES )
@Composable
fun messagePreview(){
    AIVisionTheme {
 val messages = mutableListOf<MessageModel>()
       /* for (i in 1..5)
        {

            messages.add(MessageModel(conversationId = Date().time.toString(), question = "Question ${i}", createdAt = Date().time.toString()))
        }*/

        val chatMessage = ChatMessage(recentChatId = 1, role = "user", content = "Hello, today wather forcast ")
        //MessageList(messages = messages)
        val message = MessageModel(conversationId = Date().time.toString(), question = "Hello, today wather forcast ", createdAt = Date().time.toString())
        Column {

            MessageBubble(message = chatMessage, onImage = {} ,onReport = { _, _, _ ->})

        }
    }
}
@Composable
fun WebIndicatorTag(
    sourceUrl: String? = null,
    timestamp: Long? = null
) {
    val formatter = remember { SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault()) }
    val displayTime = timestamp?.let { formatter.format(Date(it)) }

    Row(
        modifier = Modifier
            .padding(top = 6.dp, start = 12.dp)
            .background(
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                shape = RoundedCornerShape(8.dp)
            )
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Public,
            contentDescription = "Web Icon",
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Column {
            Text(
                text = "Informacije s interneta",
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.labelSmall
            )

            if (sourceUrl != null) {
                val domain = try {
                    URI(sourceUrl).host.replaceFirst("www.", "")
                } catch (_: Exception) {
                    sourceUrl
                }
                Text(
                    text = "Izvor: $domain",
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
                    style = MaterialTheme.typography.labelSmall
                )
            }

            if (displayTime != null) {
                Text(
                    text = "Vrijeme: $displayTime",
                    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

