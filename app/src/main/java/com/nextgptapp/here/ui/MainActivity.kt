package com.nextgptapp.here.ui

import android.app.AlertDialog
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Surface
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import androidx.navigation.compose.rememberNavController
import com.nextgptapp.here.BuildConfig
import com.nextgptapp.here.components.ApiKeyHelpers
import com.nextgptapp.here.components.AppLogger
import com.nextgptapp.here.components.CreditHelpers
import com.nextgptapp.here.components.InAppPurchaseHelper
import com.nextgptapp.here.components.Utils
import com.nextgptapp.here.ui.drawer.AppDrawerContent
import com.nextgptapp.here.ui.navigation.NavigationGraph
import com.nextgptapp.here.ui.navigation.Screen
import com.nextgptapp.here.ui.theme.AIVisionTheme
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.scottyab.rootbeer.RootBeer
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject
import android.util.Log
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration

private const val TAG="MainActivity"

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject
    lateinit var apiKeyHelpers: ApiKeyHelpers
    @Inject
    lateinit var creditsKeyHelpers: CreditHelpers
    @Inject
    lateinit var inAppPurchaseHelper: InAppPurchaseHelper

    private val viewModel: MainActivityViewModel by viewModels()

    // ✅ NOVO: Recovery state tracking
    private var isRecoveryAttempted = false
    private var isAutoRecoveryInProgress = false
    private var lastRecoveryAttempt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppLogger.logE(TAG,"onCreate")

        // ✅ DEBUG LOGOVI
        Log.e(TAG, "🚨 === DEBUG POČETAK ===")
        val currentUser = FirebaseAuth.getInstance().currentUser
        Log.e(TAG, "👤 Firebase User: ${currentUser?.uid}")
        Log.e(TAG, "📧 Firebase Email: ${currentUser?.email}")

        val isGuest = viewModel.isGuestMode()
        Log.e(TAG, "🎭 Guest Mode: $isGuest")

        // Provjeri Clear Data detection
        try {
            val isClearData = viewModel.isFirstTimeAfterClearData()
            Log.e(TAG, "🔍 Clear Data detection: $isClearData")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Clear Data detection error: ${e.message}")
        }
        Log.e(TAG, "🚨 === DEBUG KRAJ ===")

        installSplashScreen().apply {
            setKeepOnScreenCondition {
                return@setKeepOnScreenCondition viewModel.isLoading.value
            }
        }

        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = android.graphics.Color.TRANSPARENT

        // ✅ Registracija testnog uređaja za AdMob
        val testDeviceIds = listOf("TEST_EMULATOR") // Zamijeni s pravim ID-em iz Logcata kad ga dobiješ
        val configuration = RequestConfiguration.Builder()
            .setTestDeviceIds(testDeviceIds)
            .build()
        MobileAds.setRequestConfiguration(configuration)

        // Setup koji ne ovisi o korisničkoj prijavi
        inAppPurchaseHelper.billingSetup()

        // ✅ GLAVNI FIX
        handleAppStateAfterClearData()

        val startDestination = determineStartDestination()
        Log.e(TAG, "🎯 Start destination: $startDestination")

        setContent {
            val darkTheme by viewModel.darkMode.collectAsState()
            viewModel.getCurrentLanguageCode()
            val currentLanguageCode by viewModel.currentLanguageCode.collectAsState()
            Utils.changeLanguage(this@MainActivity,currentLanguageCode)

            AIVisionTheme(darkTheme) {
                Surface(
                    modifier = Modifier.systemBarsPadding().fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
                    val scope = rememberCoroutineScope()
                    val navController = rememberNavController()

                    ModalNavigationDrawer(
                        drawerState = drawerState,
                        drawerContent = {
                            AppDrawerContent(
                                navigateLanguages = {
                                    navController.navigate(route = Screen.Language.route)
                                },
                                navigateSubscription = {
                                    navController.navigate(route = Screen.Subscription.route)
                                },
                                onLogout = {
                                    handleLogout(navController)
                                },
                                onCloseAction = {
                                    scope.launch { drawerState.close() }
                                },
                                inAppPurchaseHelper
                            )
                        },
                        gesturesEnabled = false
                    ) {
                        NavigationGraph(
                            navController = navController,
                            startDestination = startDestination,
                            drawerState,
                            inAppPurchaseHelper
                        )
                    }
                }
            }
        }

        // Root detection
        val rootBeer = RootBeer(this)
        if (rootBeer.isRooted && !BuildConfig.DEBUG) {
            showRootedAlert()
        }
    }


    // ✅ GLAVNA METODA - Clear Data check
    private fun handleAppStateAfterClearData() {
        Log.e(TAG, "🔍 === CLEAR DATA CHECK ===")

        val currentUser = FirebaseAuth.getInstance().currentUser
        val isGuestMode = viewModel.isGuestMode()

        Log.e(TAG, "👤 Current User: ${currentUser?.uid}")
        Log.e(TAG, "🎭 Guest Mode: $isGuestMode")

        when {
            currentUser != null -> {
                Log.e(TAG, "✅ User is logged in - setting up API keys")
                setupAuthenticatedUser()
            }
            isGuestMode -> {
                Log.e(TAG, "🎭 Guest mode active")
                // App je u guest mode, ne radi ništa dodatno
            }
            else -> {
                // Provjeri je li Clear Data i pokušaj auto-recovery samo jednom
                try {
                    val isClearData = viewModel.isFirstTimeAfterClearData()
                    if (isClearData && !isRecoveryAttempted) {
                        Log.e(TAG, "🔄 Clear Data detected - attempting auto-recovery...")
                        isRecoveryAttempted = true
                        attemptAutoRecovery()
                    } else {
                        Log.e(TAG, "📱 Normal startup - no recovery needed")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error checking Clear Data: ${e.message}")
                }
            }
        }
    }

    // ✅ POBOLJŠANO: Auto-recovery s boljim kontrolama
    private fun attemptAutoRecovery() {
        Log.e(TAG, "🔄 === AUTO RECOVERY START ===")

        // Provjeri je li recovery već u tijeku
        val currentTime = System.currentTimeMillis()
        if (isAutoRecoveryInProgress) {
            Log.e(TAG, "🔄 Auto-recovery već u tijeku, preskačem")
            return
        }

        if (currentTime - lastRecoveryAttempt < 30000) { // 30 sekundi
            Log.e(TAG, "🔄 Auto-recovery previše čest, preskačem")
            return
        }

        isAutoRecoveryInProgress = true
        lastRecoveryAttempt = currentTime

        try {
            val lastSignedInAccount = GoogleSignIn.getLastSignedInAccount(this)

            if (lastSignedInAccount?.idToken != null) {
                Log.e(TAG, "🔍 Found Google account: ${lastSignedInAccount.email}")

                val credential = GoogleAuthProvider.getCredential(lastSignedInAccount.idToken, null)
                FirebaseAuth.getInstance().signInWithCredential(credential)
                    .addOnCompleteListener { task ->
                        isAutoRecoveryInProgress = false // Reset flag

                        if (task.isSuccessful) {
                            val user = FirebaseAuth.getInstance().currentUser
                            Log.e(TAG, "✅ Auto-login SUCCESS: ${user?.uid}")

                            // Spremi korisnika za buduće reference
                            user?.let {
                                viewModel.saveLastKnownUser(it.uid, it.email)
                                viewModel.setAppInitialized(true)
                            }

                            setupAuthenticatedUser()
                        } else {
                            Log.e(TAG, "❌ Auto-login FAILED: ${task.exception?.message}")

                            // ✅ VAŽNO: Obriši cached Google account
                            clearGoogleSignInCache()
                            setupGuestModeBasic()
                        }
                    }
            } else {
                Log.e(TAG, "📱 No Google account available")
                isAutoRecoveryInProgress = false
                setupGuestModeBasic()
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Auto-recovery ERROR: ${e.message}")
            isAutoRecoveryInProgress = false

            // Obriši cached data ako je problem
            clearGoogleSignInCache()
            setupGuestModeBasic()
        }
    }

    // ✅ NOVO: Čišćenje Google Sign-In cache
    private fun clearGoogleSignInCache() {
        Log.e(TAG, "🧹 Čistim Google Sign-In cache...")

        try {
            GoogleSignIn.getClient(this, GoogleSignInOptions.DEFAULT_SIGN_IN)
                .signOut()
                .addOnCompleteListener {
                    Log.e(TAG, "✅ Google cache cleared")
                }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error clearing Google cache: ${e.message}")
        }
    }

    // ✅ Setup API ključeva za prijavljenog korisnika
    private fun setupAuthenticatedUser() {
        Log.e(TAG, "🔌 === SETTING UP API KEYS ===")

        try {
            apiKeyHelpers.testConnection()
            apiKeyHelpers.connect()
            creditsKeyHelpers.resetFreeCredits()
            creditsKeyHelpers.connect()

            Log.e(TAG, "✅ API key helpers connected successfully")

            // Test da vidimo što imamo nakon 3 sekunde
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                try {
                    val debugInfo = apiKeyHelpers.getDebugInfo()
                    Log.e(TAG, "🔑 API Keys Debug: $debugInfo")

                    val hasKeys = apiKeyHelpers.hasAnyApiKey()
                    Log.e(TAG, "🔍 Ima API ključeva: $hasKeys")

                    val providers = apiKeyHelpers.getAvailableProviders()
                    Log.e(TAG, "📋 Dostupni provideri: $providers")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Debug info error: ${e.message}")
                }
            }, 3000)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error setting up API helpers: ${e.message}")
        }
    }

    // ✅ Osnovni Guest Mode setup
    private fun setupGuestModeBasic() {
        Log.e(TAG, "🎭 Setting up basic Guest Mode...")

        try {
            viewModel.setGuestMode(true)
            viewModel.setAppInitialized(true)
            Log.e(TAG, "✅ Guest Mode postavljen")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error setting Guest Mode: ${e.message}")
        }
    }

    // ✅ Odredi start destination
    private fun determineStartDestination(): String {
        val currentUser = FirebaseAuth.getInstance().currentUser
        val isGuestMode = viewModel.isGuestMode()

        return when {
            currentUser != null -> {
                Log.e(TAG, "🎯 Authenticated user → RecentChats")
                Screen.RecentChats.route
            }
            isGuestMode -> {
                Log.e(TAG, "🎯 Guest mode → RecentChats")
                Screen.RecentChats.route
            }
            else -> {
                Log.e(TAG, "🎯 No auth → Welcome")
                Screen.Welcome.route
            }
        }
    }

    // ✅ NOVO: Reset recovery stanja
    fun resetRecoveryState() {
        Log.e(TAG, "🔄 Resetiram recovery state...")
        isAutoRecoveryInProgress = false
        isRecoveryAttempted = false
        lastRecoveryAttempt = 0L
    }

    // ✅ NOVO: Debug metoda za manual reset
    fun debugResetGoogleState() {
        Log.e(TAG, "🐛 DEBUG: Resetiram Google state...")

        resetRecoveryState()
        clearGoogleSignInCache()

        // Logout iz Firebase-a
        FirebaseAuth.getInstance().signOut()

        // Reset guest mode
        viewModel.resetGuestMode()

        Log.e(TAG, "✅ Google state resetovan - možeš se prijaviti")
    }

    // ✅ POSTOJEĆE METODE

    fun connectApiKeysAfterLogin() {
        Log.e(TAG, "🔌 connectApiKeysAfterLogin() pozvan")

        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser != null) {
            Log.e(TAG, "✅ Korisnik prijavljen, postavljam API key helpere")

            // Spremi korisnika
            viewModel.saveLastKnownUser(currentUser.uid, currentUser.email)
            viewModel.setAppInitialized(true)

            setupAuthenticatedUser()
        } else {
            Log.e(TAG, "❌ connectApiKeysAfterLogin: Korisnik nije prijavljen!")
        }
    }

    // ✅ POBOLJŠANO: Logout s čišćenjem recovery stanja
    private fun handleLogout(navController: androidx.navigation.NavController) {
        Log.e(TAG, "🚪 Logout proces započet")

        // Sign out Firebase
        if (FirebaseAuth.getInstance().currentUser != null) {
            Log.e(TAG, "🔥 Signing out Firebase user")
            FirebaseAuth.getInstance().signOut()
        }

        // Sign out Google i obriši cache
        GoogleSignIn.getClient(this, GoogleSignInOptions.DEFAULT_SIGN_IN)
            .signOut()
            .addOnCompleteListener {
                Log.e(TAG, "🔥 Google sign out complete")
            }

        // ✅ NOVO: Reset recovery stanja
        resetRecoveryState()

        // Reset stanja
        try {
            viewModel.resetGuestMode()
            viewModel.clearLastKnownUser()
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error resetting states: ${e.message}")
        }

        disconnectFireBaseHelpers()

        // Navigacija
        navController.navigate(Screen.Welcome.route) {
            popUpTo(Screen.RecentChats.route) {
                inclusive = true
            }
        }

        Log.e(TAG, "✅ Logout završen")
    }

    override fun onResume() {
        super.onResume()
        AppLogger.logE(TAG,"onResume")

        val currentUser = FirebaseAuth.getInstance().currentUser
        if (currentUser != null) {
            val currentApiKey = apiKeyHelpers.getApiKey()
            if (currentApiKey.isEmpty()) {
                Log.e(TAG, "🔄 onResume: API ključ prazan, pokušavam reconnect")
                connectApiKeysAfterLogin()
            }
        }
    }

    override fun onBackPressed() {
        super.onBackPressed()
        AppLogger.logE(TAG,"onBackPressed")
    }

    // ✅ POBOLJŠANO: onDestroy s reset recovery state
    override fun onDestroy() {
        super.onDestroy()
        Log.e(TAG, "💀 onDestroy - disconnecting helpers")

        // Reset recovery state
        resetRecoveryState()

        inAppPurchaseHelper.disconnect()
        apiKeyHelpers.disconnect()
        creditsKeyHelpers.disconnect()
    }

    fun disconnectFireBaseHelpers(){
        AppLogger.logE(TAG,"disconnectFireBaseHelpers")
        apiKeyHelpers.disconnect()
        creditsKeyHelpers.disconnect()
    }

    private fun showRootedAlert(){
        val builder: AlertDialog.Builder = AlertDialog.Builder(this)
        builder
            .setTitle("Can't Open App!")
            .setMessage("For security reason AI-Vision can't be opened on a rooted device")
            .setCancelable(false)
            .setNeutralButton("Ok"){d,w-> finish()}

        val dialog: AlertDialog = builder.create()
        dialog.show()
    }

    // ✅ NOVO: Debug metode za troubleshooting
    private fun logDebugInfo() {
        if (BuildConfig.DEBUG) {
            Log.e(TAG, "🐛 === DEBUG INFO ===")
            viewModel.logCurrentAppState()

            val apiDebugInfo = apiKeyHelpers.getDebugInfo()
            Log.e(TAG, "🔑 API Keys Debug: $apiDebugInfo")

            val hasAnyKey = apiKeyHelpers.hasAnyApiKey()
            Log.e(TAG, "🔍 Ima bilo koji API ključ: $hasAnyKey")

            val providers = apiKeyHelpers.getAvailableProviders()
            Log.e(TAG, "📋 Dostupni provideri: $providers")

            Log.e(TAG, "🐛 === END DEBUG ===")
        }
    }
}