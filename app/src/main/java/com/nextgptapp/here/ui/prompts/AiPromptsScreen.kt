package com.nextgptapp.here.ui.prompts

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.nextgptapp.here.ui.theme.*
import com.nextgptapp.here.ui.ui_components.ChipItem
import com.nextgptapp.here.ui.ui_components.PromptCard
import com.nextgptapp.here.R

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiPromptsSheet(showSheet:Boolean, onDismiss:()->Unit,
                   selectedPrompt: (String, String, List<String>,Int) -> Unit,
                   viewModel: AiPromptsViewModel = hiltViewModel()
) {
    val coroutineScope = rememberCoroutineScope()
    val prompts by viewModel.promptsList.collectAsState()
    val categories by viewModel.categories.collectAsState()
    /*LaunchedEffect(Unit){
        delay(300)
        viewModel.loadPrompts()
    }*/
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = false)
if (showSheet)
{
    ModalBottomSheet(
        modifier = Modifier, sheetState = sheetState, onDismissRequest = {
            onDismiss()
        }, shape = RoundedCornerShape(
            topStart = 10.dp,
            topEnd = 10.dp
        ), dragHandle = {
            Spacer(
            modifier = Modifier
                .padding(top = 8.dp)
                .width(40.dp)
                .height(4.dp)
                .background(MaterialTheme.colorScheme.onTertiary, RoundedCornerShape(90.dp))
        )
        }, containerColor = MaterialTheme.colorScheme.onSecondary
    ) {

        Box(
            Modifier
                .fillMaxSize()
                .padding(bottom = 56.dp)
        ) {
            Column(Modifier.fillMaxSize()) {
               Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text =  stringResource(R.string.ai_assistants),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    color = MaterialTheme.colorScheme.onBackground,
                    style = TextStyle(
                        fontWeight = FontWeight.W600,
                        fontSize = 18.sp,
                        fontFamily = Barlow,
                        textAlign = TextAlign.Center, platformStyle = PlatformTextStyle(includeFontPadding = false)
                    )
                )
                Spacer(modifier = Modifier.height(8.dp))

                Divider(color = MaterialTheme.colorScheme.tertiary, thickness = 0.8.dp)

                val lazyListState = rememberLazyListState()
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp, start = 10.dp), state = lazyListState
                )
                {
                    items(categories) {
                        ChipItem(
                            text = it,
                            selected = viewModel.isSelected(it),
                            onClick = {
                                viewModel.filterByCategory(it)
                            }
                        )
                    }
                }

                if (prompts.size == 1) {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 10.dp, end = 10.dp, top = 10.dp)
                    ) {
                        items(prompts[0].prompts)
                        {
                            PromptCard(
                                image = it.image,
                                name = it.title,
                                description = it.summery,
                                onClick = { selectedPrompt(it.title, it.type, it.examplesList,it.image) }
                            )

                        }
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 10.dp)
                    ) {
                        items(prompts)
                        { aiAssistantList ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 5.dp, top = 15.dp)
                            ) {
                                Text(
                                    text = aiAssistantList.categoryTitle,
                                    color = MaterialTheme.colorScheme.onBackground,
                                    style = TextStyle(
                                        fontSize = 25.sp,
                                        fontWeight = FontWeight.W700,
                                        fontFamily = Barlow,
                                        lineHeight = 25.sp
                                    ), modifier = Modifier.weight(1f)
                                )

                             /*   IconButton(
                                    onClick = {
                                        viewModel.filterByCategory(aiAssistantList.categoryTitle)
                                        coroutineScope.launch {
                                            lazyListState.animateScrollToItem(viewModel.selectedIndex)
                                        }
                                    },
                                    modifier = Modifier
                                        .padding(end = 10.dp)
                                        .size(30.dp)
                                ) {

                                    Icon(
                                        imageVector = Icons.Rounded.East,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                }*/


                            }

                            Spacer(modifier = Modifier.height(15.dp))

                            LazyRow(
                                modifier = Modifier
                                    .fillMaxWidth()
                            ) {
                                items(aiAssistantList.prompts) {
                                    PromptCard(
                                        image = it.image,
                                        name = it.title,
                                        description = it.summery,
                                        onClick = {
                                            selectedPrompt(
                                                it.title,
                                                it.type,
                                                it.examplesList,it.image
                                            )
                                        }
                                    )

                                }

                            }
                        }
                    }

                }


            }

            if (prompts.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator()
                }
            }
        }
    }

}

}
