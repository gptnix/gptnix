package com.nextgptapp.here.ui.chats

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.navigation.NavHostController
import com.nextgptapp.here.R
import com.nextgptapp.here.components.Constants
import com.nextgptapp.here.components.ConversationType
import com.nextgptapp.here.components.Utils
import com.nextgptapp.here.components.displayIntersAd
import com.nextgptapp.here.components.loadAdInters
import com.nextgptapp.here.data.model.GPTModel
import com.nextgptapp.here.data.model.GenerationModel
import com.nextgptapp.here.data.model.ImagePromptType
import com.nextgptapp.here.data.model.ImageUri
import com.nextgptapp.here.ui.credits_info.NoCreditsInfoBottomSheet
import com.nextgptapp.here.ui.dialogs.ConfirmationDialog
import com.nextgptapp.here.ui.prompts.AiPromptsSheet
import com.nextgptapp.here.ui.styles.StylesSheet
import com.nextgptapp.here.ui.theme.Barlow
import com.nextgptapp.here.ui.theme.CreditsTint
import com.nextgptapp.here.ui.ui_components.BannerAdView
import com.nextgptapp.here.ui.ui_components.EditTextField
import com.nextgptapp.here.ui.ui_components.Examples
import com.nextgptapp.here.ui.ui_components.ImageExamples
import com.nextgptapp.here.ui.ui_components.ImageInputCard
import com.nextgptapp.here.ui.ui_components.MessageBubble
import com.nextgptapp.here.ui.ui_components.PDFInputCard
import com.nextgptapp.here.ui.ui_components.StopGenerateButton
import com.nextgptapp.here.ui.ui_components.ToolBarChat
import kotlinx.coroutines.launch
import androidx.compose.ui.zIndex
import com.nextgptapp.here.ui.ui_components.ModelDropdownSelector
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate


private const val ANIMATION_DURATION = 50

@Composable
fun ChatBoardScreen(
    navController: NavHostController,
    navigateToBack: () -> Unit,
    navigateToPremium: () -> Unit,
    navigateToVoiceScreen: (chatId: String) -> Unit,
    data: ChatData,
    viewModel: ChatBoardViewModel = hiltViewModel(),
    savedStateHandle: SavedStateHandle? = null
) {

    val isAdmin = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com"
    val toastMessage by viewModel.toastMessage.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val creditsCount by viewModel.creditsCount.collectAsState()
    val isAiProcessing by viewModel.isAiProcessing.collectAsState()
    val minCreditsRequired by viewModel.minCreditsRequired.collectAsState()
    val conversationType by viewModel.currentConversationType.collectAsState()
    val isPremium by viewModel.isCreditsPurchased.collectAsState()
    val displayMode by viewModel.displayType.collectAsState()
    val examples by viewModel.examples.collectAsState()
    val uploadProgress by viewModel.uploadProgress.collectAsState()
    val isSubMode = true
    val title = viewModel.title.value
    val context = LocalContext.current
    val isImageInput by viewModel.isImageSelected
    val isVideoSelected by viewModel.isVideoSelected
    val imageUri by viewModel.imageUri
    val pdfUri by viewModel.pdfUri
    //val videoUri by viewModel.videoUri
    val selectedStyle by viewModel.selectedStyle.collectAsState()

    // Model dropdown state
    var showModelSelector by remember { mutableStateOf(false) }
    val allModels by viewModel.allEnabledModels.collectAsState()
    val selectedModel by viewModel.selectedModel.collectAsState()

    // UI state variables
    val isImageLoadingFailed = remember { mutableStateOf(false) }
    var inputText by remember { mutableStateOf("") }
    var showNoCreditsBottomSheet by remember { mutableStateOf(false) }
    var showPromptSheet by remember { mutableStateOf(false) }
    var showMediaSourceSheet by remember { mutableStateOf(false) }
    var linkInputDialog by remember { mutableStateOf(false) }
    var showStylesSheet by remember { mutableStateOf(false) }
    var showImageDetailSheet by remember { mutableStateOf(false) }
    var imageUrlForDetail by remember { mutableStateOf("") }
    var conversationDialog by remember { mutableStateOf(false) }
    var videdDuration by remember { mutableLongStateOf(0) }
    val scope = rememberCoroutineScope()

    val result = navController.currentBackStackEntry
        ?.savedStateHandle
        ?.getLiveData<Long>("conversationId") // Observe result

    // Observe the result and update UI or state
    result?.observe(LocalLifecycleOwner.current) { resultValue ->
        if (resultValue>0)
        {
            viewModel.reloadMessages(resultValue)
            navController.currentBackStackEntry
                ?.savedStateHandle
                ?.set("conversationId", 0L)
        }
        println("Reload ConversationId: $resultValue")
    }
    LaunchedEffect(toastMessage) {
        toastMessage?.let {
            Toast.makeText(context, it, Toast.LENGTH_SHORT).show()
            viewModel.clearToast() // Clear message to prevent multiple toasts
        }
    }
    LaunchedEffect(Unit){
        viewModel.initWithArg(data)
        if (isPremium.not())
        {
            loadAdInters(context)
        }
    }

  /*  val lifecycleOwner = LocalLifecycleOwner.current
    // Access the current lifecycle
    val currentLifecycle = rememberUpdatedState(lifecycleOwner.lifecycle)
    LaunchedEffect(key1 = lifecycleOwner) {
        currentLifecycle.value.addObserver(object : LifecycleEventObserver {
            override fun onStateChanged(source: LifecycleOwner, event: Lifecycle.Event) {
                if (event == Lifecycle.Event.ON_RESUME) {
                    viewModel.reloadMessages()
                }
            }
        })
    }*/


    val pickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { imageURI ->
        if (imageURI != null) {
            viewModel.setInputImage(ImageUri(imageURI))
            if (isVideoSelected)
            {
              scope.launch {
                videdDuration = Utils.getVideoDuration(context,imageURI)/1000
              }
            }
        }
    }

    val pdfPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { pdfUri ->
        if (pdfUri != null) {
            viewModel.setInputPDF(ImageUri(pdfUri))
        }
    }

    val cameraLauncher =
        rememberLauncherForActivityResult(contract = ActivityResultContracts.TakePicture()) {
            if (it) {
               viewModel.cameraUri?.let {
                viewModel.setInputImage(it)
               }
            }
        }


    if (linkInputDialog)
    {
        URLInputDialog(onContinue = {
            linkInputDialog=false
            viewModel.setInputImage(ImageUri(Uri.parse(it), link = it))
        }) {
            linkInputDialog = false
        }
    }

    if (conversationDialog)
    {
        ConfirmationDialog(title = stringResource(R.string.confirmation), message = stringResource(R.string.are_you_sure_cancel_generation), onCancel = {
            conversationDialog = false
        }) {
            viewModel.stopAIContentGeneration()
            conversationDialog=false

            if (viewModel.showAds.value && isPremium.not())
            {
                displayIntersAd(context)
            }
            viewModel.cancelMessageJob()

            navigateToBack()
        }
    }

    BackHandler() {

        if (isAiProcessing)
        {
            conversationDialog = true
        }
        else {
            if (viewModel.showAds.value && isPremium.not())
            {
                displayIntersAd(context)
            }
            viewModel.cancelMessageJob()
            navigateToBack()
        }
    }

    val listBottomPadding = animateDpAsState(
            if (isAiProcessing) {
                135.dp
            } else {
                0.dp
            },
            animationSpec = tween(ANIMATION_DURATION), label = ""
        )

    Column(
        Modifier
            .fillMaxSize()
            .background(color = MaterialTheme.colorScheme.background)
    ) {
        // toolbar
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            ToolBarChat(
                onClickAction = {
                    if (isAiProcessing) {
                        conversationDialog = true
                    } else {
                        if (viewModel.showAds.value && isPremium.not()) {
                            displayIntersAd(context)
                        }
                        viewModel.cancelMessageJob()
                        navigateToBack()
                    }
                },
                onStyleAction = {
                    if (conversationType == ConversationType.IMAGE) {
                        showStylesSheet = true
                    }
                },
                onModelClick = {
                    showModelSelector = !showModelSelector
                },
                image = R.drawable.round_arrow_back_24,
                text = if (conversationType == ConversationType.TEXT) {
                    stringResource(R.string.generate_text)
                } else {
                    if (Constants.ImageGenerationPlatform == GenerationModel.STABILITY)
                        stringResource(R.string.default_style, selectedStyle.name)
                    else
                        stringResource(R.string.generate_image)
                },
                modelName = selectedModel?.modelName ?: "Odaberi model",
                tint = MaterialTheme.colorScheme.onBackground,
                creditsCount = creditsCount,
                isStyleMode = conversationType == ConversationType.IMAGE && Constants.ImageGenerationPlatform == GenerationModel.STABILITY,
                isPremium = isPremium,
                isSubMode = isSubMode
            )

            // 🔽 Prikaz Dropdown izbornika ako je aktiviran
            if (showModelSelector) {
                ModelDropdownSelector(
                    models = allModels,
                    selectedModelId = selectedModel?.id,
                    onModelSelected = { model ->
                        viewModel.selectModel(model)
                        showModelSelector = false
                    }
                )
            }
        }


        if (isImageInput.not()) {
            Box(
                modifier = Modifier
                    .weight(1f)
            ) {

                if (displayMode == DisplayType.EXAMPLE) {
                    if (isPremium.not()) {
                        BannerAdView(Constants.BANNER_AD_UNIT_ID2)
                    }
                    if (conversationType == ConversationType.TEXT) {
                        Examples(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 16.dp),
                            examples = examples,
                            image = viewModel.examplesImage,
                            inputText = if (title.isEmpty()) stringResource(id = R.string.examples) else title,
                            onInput = { inputText = it }) {
                            showPromptSheet = true
                        }
                    } else {

                        ImageExamples(inputText = stringResource(id = R.string.image_inspirations), onInput ={inputText=it} )
                    }
                } else {


                    val lazyListState = rememberLazyListState()
                    LaunchedEffect(messages.size) {
                        lazyListState.scrollToItem(0)
                    }
                    LazyColumn(
                        modifier = Modifier
                            .padding(horizontal = 12.dp)
                            .padding(bottom = listBottomPadding.value)
                            .fillMaxSize(),
                        contentPadding = PaddingValues(top = 120.dp, bottom = 8.dp),
                        reverseLayout = true,
                        state = lazyListState
                    ) {
                        items(items = messages,
                            key = { message -> message.id }) { message ->
                            MessageBubble(message = message, onImage = {
                                imageUrlForDetail = it
                                showImageDetailSheet = true
                            }, onReport = { msg,reason,details->

                                viewModel.reportContent(msg,reason,details)
                            })
                        }
                    }


                }

                Column(
                    Modifier
                        .fillMaxHeight()
                ) {

                    Spacer(modifier = Modifier.weight(1f))
                    AnimatedVisibility(
                        visible = isAiProcessing,
                        enter = slideInVertically(
                            initialOffsetY = { it },
                            animationSpec = tween(ANIMATION_DURATION)
                        ),
                        exit = slideOutVertically(
                            targetOffsetY = { it },
                            animationSpec = tween(ANIMATION_DURATION)
                        ),
                        content = {
                            Column {
                                if (uploadProgress>=0){
                                CircularProgressIndicator(
                                    progress = (uploadProgress.toFloat()/100), // Set the progress to 50%
                                    modifier = Modifier
                                        .size(35.dp)
                                        .align(Alignment.CenterHorizontally) // Size of the circular progress indicator
                                        .clip(RoundedCornerShape(24.dp)), // Optional: Adds rounded edges
                                    color = MaterialTheme.colorScheme.primary, // Progress color
                                    trackColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.3f) // Background track color
                                )
                                }
                            StopGenerateButton(
                                modifier = Modifier
                                    .fillMaxWidth(),
                                isImageGen = false
                            ) {
                                viewModel.stopAIContentGeneration()
                            }

                            }
                        })
                }

                if (pdfUri.uri != Uri.EMPTY) {
                    Column(
                        Modifier
                            .fillMaxHeight().background(Color.Black.copy(alpha = 0.6f))
                    ) {
                        Spacer(modifier = Modifier.weight(1f))
                        PDFInputCard(pdfUri = pdfUri.uri, onPromptSelected = {
                            inputText = it
                        }) {
                            viewModel.resetPDFInput()
                        }
                    }
                }


            }
        }else{

            ImageInputCard( modifier = Modifier
                .weight(1f),imageUri = imageUri.uri,isVideoSelected,videdDuration,isImageLoadingFailed, onPromptSelected ={
               /* if (it.contentEquals(context.getString(R.string.image_input_p2), ignoreCase = true) && isPremium.not())
                {
                    navigateToPremium()
                    return@ImageInputCard
                }*/
                inputText = it
            } , onCancel = {
                isImageLoadingFailed.value = false
                viewModel.resetImageInput()
            })

        }




        NoCreditsInfoBottomSheet(
                    showSheet = showNoCreditsBottomSheet ,
                    minCreditsRequired = minCreditsRequired ,
                    onDismiss = { showNoCreditsBottomSheet=false },
                    onUpgrade = { navigateToPremium()
                    })

        AiPromptsSheet(showSheet = showPromptSheet, onDismiss = { showPromptSheet=false }, selectedPrompt ={ title, type, list, img->
                showPromptSheet=false
                viewModel.updateAssistantsExamples(title,list,img)
            } )

        MediaSourceBottomSheet(
                showSheet = showMediaSourceSheet,
                onCameraAction = { showMediaSourceSheet=false
                    viewModel.createCameraUri(context)
                    scope.launch {  cameraLauncher.launch(viewModel.cameraUri!!.uri) }},
                onGalleryAction = { showMediaSourceSheet=false
                    scope.launch {
                        pickerLauncher.launch("image/*")
                    }
                                  },
                onLink = { showMediaSourceSheet=false
                    linkInputDialog=true
                } ) { showMediaSourceSheet = false }


        StylesSheet(selectedId = selectedStyle.id, showSheet = showStylesSheet, onDismiss = { showStylesSheet=false }, onSelected ={
            showStylesSheet = false
            viewModel.selectStyleWithId(it.id)
        } )

        ImageDetailSheet(mediaPath = imageUrlForDetail, showSheet = showImageDetailSheet, onDismiss = {
            showImageDetailSheet = false
            imageUrlForDetail=""
           if (isPremium.not())
           {
               displayIntersAd(context)
           }
        })

        if (isSubMode && isPremium.not()) {

            val currentUserEmail = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email
            val isAdmin = currentUserEmail == "nboskic@gmail.com"

            if (!isAdmin) {
                val text = if (isImageInput.not()) {
                    stringResource(
                        id = R.string.usage_message,
                        Constants.CHAT_MESSAGE_COST,
                        Constants.WORDS_PER_MESSAGES
                    )
                } else {
                    if (isVideoSelected)
                        stringResource(id = R.string.usage_video, Constants.VIDEO_VISION_COST)
                    else
                        stringResource(id = R.string.usage_image, Constants.IMAGE_VISION_COST)
                }

                Text(
                    text = text,
                    color = CreditsTint,
                    style = TextStyle(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.W500,
                        fontFamily = Barlow,
                    ),
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(bottom = 1.dp)
                )
            }
        }



        EditTextField(inputText = inputText,conversationType=conversationType.name, onTextChange = {
            inputText = it
        }, onSendClick = {
                userText->
            if (userText.isNotEmpty()) {

                if (Utils.isConnectedToNetwork(context).not()) {
                    Toast.makeText(context,context.getString(R.string.no_conection_try_again),
                        Toast.LENGTH_LONG).show()
                    return@EditTextField
                }

                if (isImageLoadingFailed.value)
                {
                    Toast.makeText(context,context.getString(R.string.image_load_failed),Toast.LENGTH_LONG).show()
                    return@EditTextField
                }

                if (isImageInput && Constants.IS_VISION_PAID && isPremium.not())
                {
                    navigateToPremium()
                    return@EditTextField
                }

                if (isAiProcessing.not()) {
                    if (isPremium)
                    {
                        if (isImageInput && viewModel.isVisionDailyLimitReach())
                        {
                            Toast.makeText(context,context.getString(R.string.vision_limit),Toast.LENGTH_LONG).show()
                            return@EditTextField
                        }

                        if (conversationType==ConversationType.IMAGE && viewModel.isGenerationDailyLimitReach())
                        {
                            Toast.makeText(context,context.getString(R.string.generation_limit),Toast.LENGTH_LONG).show()
                            return@EditTextField
                        }

                        if (conversationType==ConversationType.TEXT && isImageInput.not() && viewModel.getGPTModel() == GPTModel.gpt4 && viewModel.isGpt4DailyLimitReach())
                        {
                            Toast.makeText(context,context.getString(R.string.gpt4_limit),Toast.LENGTH_LONG).show()
                            return@EditTextField
                        }
                    }



                    if (isVideoSelected && videdDuration >Constants.VIDEO_DURATION_LIMIT)
                    {
                        Toast.makeText(context,context.getString(R.string.vidoe_limit,Constants.VIDEO_DURATION_LIMIT.toString()),Toast.LENGTH_LONG).show()
                        return@EditTextField
                    }

                    var minCred = minCreditsRequired
                    if (conversationType==ConversationType.TEXT)
                    {
                        minCred = if (isImageInput) {
                            viewModel.calculateMinRequiredCreditsVision(isVideoSelected)
                        } else {
                            viewModel.calculateMinRequiredCredits(userText)
                        }
                    }
                    if (userText.isNotBlank()) {

                        val isAdmin = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.email == "nboskic@gmail.com"

                        if (creditsCount < minCred && !isAdmin) {
                            // Ako nisi admin i nemaš dovoljno kredita, prikaži dijalog
                            if (isImageInput) {
                                // viewModel.resetImageInput()
                            }
                            showNoCreditsBottomSheet = true
                            return@EditTextField
                        }

                        if (isImageInput) {
                            val promptType = when(userText) {
                                context.getString(R.string.image_input_p1) -> ImagePromptType.Caption
                                context.getString(R.string.image_input_p2) -> ImagePromptType.Describe
                                context.getString(R.string.image_input_p3) -> ImagePromptType.Tags
                                context.getString(R.string.image_input_p4) -> ImagePromptType.Objects
                                else -> ImagePromptType.Custom
                            }

                            if (isVideoSelected) {
                                viewModel.sendVideoPrompt(userText)
                            } else {
                                viewModel.sendImagePrompt(userText, promptType)
                            }
                        } else if (pdfUri.uri != Uri.EMPTY) {
                            viewModel.sendPDFPrompt(userText)
                        } else {
                            viewModel.sendMessage(userText)
                        }

                        inputText = ""
                    }
                }
            }
        }, onCameraClick = {showMediaSourceSheet = true}, onVideoClick = {scope.launch { /*videoPickerLauncher.launch("application/pdf")*/ scope.launch {
            pickerLauncher.launch("video/*")
            viewModel.setIsVideo(true)
        } }}, onPDFClick = {scope.launch { pdfPickerLauncher.launch("application/pdf") }},
            onVoiceClick = {
                navigateToVoiceScreen(viewModel.recentConversationId.toString())
            })
    }
}
