package com.nextgptapp.here.ui.navigation

import android.app.Activity
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.core.tween
import androidx.compose.material3.DrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.nextgptapp.here.components.AppLogger
import com.nextgptapp.here.components.InAppPurchaseHelper
import com.nextgptapp.here.ui.chats.ChatBoardScreen
import com.nextgptapp.here.ui.chats.ChatData
import com.nextgptapp.here.ui.language.LanguageScreen
import com.nextgptapp.here.ui.recents.RecentChatsScreen
import com.nextgptapp.here.ui.subscription.SubscriptionScreen
import com.nextgptapp.here.ui.voiceai.VoiceScreen
import com.nextgptapp.here.ui.welcome.WelcomeScreen
import com.google.gson.Gson
import kotlinx.coroutines.launch

private const val ANIM_DUR =350
@Composable
fun NavigationGraph (navController:NavHostController, startDestination:String, drawerState:DrawerState, inAppPurchaseHelper: InAppPurchaseHelper){
    val scope = rememberCoroutineScope()
    val activity = LocalContext.current as Activity
    NavHost(navController = navController, startDestination =startDestination  ){

        composable(
            route = Screen.Welcome.route
        ) {
            WelcomeScreen(navigateToRecentChat = {
                navController.navigate(Screen.RecentChats.route) {
                    popUpTo(Screen.Welcome.route) {
                        inclusive = true
                    }
                }
            })
        }

        composable(route = Screen.RecentChats.route){
           /* RecentChats(openDrawer = {scope.launch {
                drawerState.open()
            }}){
                navController.navigate(Screen.Chat.route)
            }*/
            RecentChatsScreen(
                navigateToChat = {id,type->
                    val data = ChatData(chatId =  id, conversationType = type)
                    val json = Gson().toJson(data,ChatData::class.java)
                    navController.navigate("${Screen.Chat.route}?data=$json")
                },
                navigateToSubscription = { navController.navigate(route = Screen.Subscription.route) },
                openDrawer = {
                    scope.launch {
                        drawerState.open()
                    }
                })
        }
        composable(route = "${Screen.Chat.route}?data={data}",
            enterTransition = {
                slideIntoContainer(
                    towards = AnimatedContentTransitionScope.SlideDirection.Companion.Up,
                    animationSpec = tween(ANIM_DUR)
                )
            },
            exitTransition = {
                slideOutOfContainer(towards = AnimatedContentTransitionScope.SlideDirection.Companion.Down, animationSpec = tween(ANIM_DUR))
            })
        {
            /*ChatBoard(){
                naveController.popBackStack()
            }*/
            var data = ChatData()
            it.arguments?.getString("data")?.let {json->
                if (json.isNotEmpty())
                {
                    data = Gson().fromJson(json,ChatData::class.java)
                }
            }
            ChatBoardScreen(navController,navigateToBack = {  if (!navController.popBackStack()){
                activity.finish()
            } }, navigateToPremium ={ navController.navigate(route = Screen.Subscription.route)}, navigateToVoiceScreen = { chatId->
                // navController.navigate("${Screen.VoiceScreen.route}?chatId=chatId")
                navController.navigate("${Screen.VoiceScreen.route}?chatId=$chatId")
            } , data = data,savedStateHandle = navController.currentBackStackEntry
                ?.savedStateHandle )
        }

        composable(route = Screen.Subscription.route, enterTransition = {
            slideIntoContainer(
                towards = AnimatedContentTransitionScope.SlideDirection.Companion.Up, animationSpec = tween(ANIM_DUR)
            )
        }, exitTransition = {
            slideOutOfContainer(towards = AnimatedContentTransitionScope.SlideDirection.Companion.Down, animationSpec = tween(ANIM_DUR))
        }){
            SubscriptionScreen(inAppPurchaseHelper =inAppPurchaseHelper, navigateBack =   {
                navController.popBackStack()
            })
        }

        composable(route = Screen.Language.route, enterTransition = {
            slideIntoContainer(
                towards = AnimatedContentTransitionScope.SlideDirection.Companion.Left,
                animationSpec = tween(ANIM_DUR)
            )
        },
            exitTransition = {
                slideOutOfContainer(towards = AnimatedContentTransitionScope.SlideDirection.Companion.Right, animationSpec = tween(ANIM_DUR))
            }){
            LanguageScreen(
                navigateToBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(route = "${Screen.VoiceScreen.route}?chatId={chatId}",enterTransition = {
            slideIntoContainer(
                towards = AnimatedContentTransitionScope.SlideDirection.Companion.Up, animationSpec = tween(ANIM_DUR)
            )
        }, exitTransition = {
            slideOutOfContainer(towards = AnimatedContentTransitionScope.SlideDirection.Companion.Down, animationSpec = tween(ANIM_DUR))
        }){
            var  chatId =""
            it.arguments?.getString("chatId")?.let {
                chatId = it
            }
            VoiceScreen(chatId = chatId,
                navigateToBack = { conversationId->
                    AppLogger.logE("conversationId:Value","$conversationId")
                    navController.previousBackStackEntry
                        ?.savedStateHandle
                        ?.set("conversationId", conversationId)
                    navController.popBackStack()
                }, navigateToPremium = {
                    navController.navigate(route = Screen.Subscription.route)
                }
            )
        }
    }
}