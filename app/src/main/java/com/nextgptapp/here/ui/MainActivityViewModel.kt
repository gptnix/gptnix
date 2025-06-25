package com.nextgptapp.here.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nextgptapp.here.data.repository.PreferenceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MainActivityViewModel @Inject constructor(
    private val preferenceRepository: PreferenceRepository
) : ViewModel() {

    private val TAG = "MainActivityViewModel"

    private val _isLoading = MutableStateFlow(true)
    val isLoading = _isLoading.asStateFlow()

    private val _darkMode = MutableStateFlow(true)
    val darkMode get() = _darkMode.asStateFlow()

    private val _shouldDrawerUpdate = MutableStateFlow(false)
    val shouldDrawerUpdate get() = _shouldDrawerUpdate.asStateFlow()

    private val _isImageGeneration = MutableStateFlow(false)
    val isImageGeneration get() = _isImageGeneration.asStateFlow()

    private val _currentLanguageCode = MutableStateFlow<String>("en")
    val currentLanguageCode get() = _currentLanguageCode.asStateFlow()

    // ✅ NOVO: Clear Data detection state
    private val _isClearDataDetected = MutableStateFlow(false)
    val isClearDataDetected get() = _isClearDataDetected.asStateFlow()

    // ✅ NOVO: App state tracking
    private val _appState = MutableStateFlow(AppState.INITIALIZING)
    val appState get() = _appState.asStateFlow()

    init {
        viewModelScope.launch {
            // ✅ Prvo provjeri je li Clear Data
            checkForClearData()

            delay(1000)
            _isLoading.value = false
        }
        getDarkMode()
        getIsImageGen()
        Log.e(TAG,"init called....")
    }

    // ✅ NOVO: Detektuj Clear Data
    private fun checkForClearData() {
        val isFirstTime = isFirstTimeAfterClearData()
        _isClearDataDetected.value = isFirstTime

        if (isFirstTime) {
            Log.w(TAG, "🔄 Clear Data detektovan!")
            _appState.value = AppState.CLEAR_DATA_DETECTED
        } else {
            _appState.value = AppState.NORMAL
        }
    }

    // ✅ NOVO: Clear Data detection
    fun isFirstTimeAfterClearData(): Boolean {
        return preferenceRepository.isFirstTimeAfterClearData()
    }

    // ✅ NOVO: App initialization
    fun setAppInitialized(initialized: Boolean) = viewModelScope.launch {
        preferenceRepository.setAppInitialized(initialized)
        Log.d(TAG, "🏁 App Initialized postavljen na: $initialized")

        if (initialized) {
            _appState.value = AppState.INITIALIZED
        }
    }

    // ✅ NOVO: User tracking za recovery
    fun saveLastKnownUser(uid: String, email: String?) = viewModelScope.launch {
        preferenceRepository.setLastKnownUser(uid, email)
        Log.d(TAG, "👤 Korisnik spremljen: $email")
        _appState.value = AppState.AUTHENTICATED
    }

    fun getLastKnownUser(): Pair<String?, String?> {
        return preferenceRepository.getLastKnownUser()
    }

    fun clearLastKnownUser() = viewModelScope.launch {
        preferenceRepository.clearLastKnownUser()
        Log.d(TAG, "👤 Zadnji poznati korisnik obrisan")
    }

    // ✅ POSTOJEĆE METODE (poboljšane)

    private fun getDarkMode() = viewModelScope.launch {
        _darkMode.value = preferenceRepository.getDarkMode()
    }

    fun setDarkMode(isDarkMode: Boolean) = viewModelScope.launch {
        preferenceRepository.setDarkMode(isDarkMode)
        getDarkMode()
    }

    // ✅ POBOLJŠANO: Guest Mode s dodatnim logovima
    fun isGuestMode() = preferenceRepository.getIsGuest()

    fun setGuestMode(isGuest: Boolean) = viewModelScope.launch {
        preferenceRepository.setIsGuest(isGuest)
        Log.d(TAG, "🎭 Guest Mode postavljen na: $isGuest")

        if (isGuest) {
            setAppInitialized(true)
            _appState.value = AppState.GUEST_MODE
        }
    }

    fun resetGuestMode() = viewModelScope.launch {
        preferenceRepository.setIsGuest(false)
        Log.d(TAG, "🎭 Guest Mode resetovan")
        _appState.value = AppState.UNAUTHENTICATED
    }

    // ✅ POSTOJEĆE METODE

    fun resetDrawer(){
        _shouldDrawerUpdate.value = !_shouldDrawerUpdate.value
    }

    private fun getIsImageGen() = viewModelScope.launch {
        _isImageGeneration.value = preferenceRepository.getIsImageGen()
    }

    fun enableImageGenerations(isEnabled: Boolean) = viewModelScope.launch {
        preferenceRepository.setIsImageGen(isEnabled)
        getIsImageGen()
    }

    fun getCurrentLanguageCode() = viewModelScope.launch {
        _currentLanguageCode.value = preferenceRepository.getCurrentLanguageCode()
    }

    // ✅ NOVO: Debug i maintenance metode

    fun logCurrentAppState() {
        val currentUser = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser
        val (lastUid, lastEmail) = getLastKnownUser()

        Log.d(TAG, "📊 === TRENUTNO STANJE APLIKACIJE ===")
        Log.d(TAG, "🔥 Firebase User: ${currentUser?.uid}")
        Log.d(TAG, "📧 Firebase Email: ${currentUser?.email}")
        Log.d(TAG, "👤 Guest Mode: ${isGuestMode()}")
        Log.d(TAG, "🏁 App Initialized: ${preferenceRepository.getAppInitialized()}")
        Log.d(TAG, "📊 Launch Count: ${preferenceRepository.getAppLaunchCount()}")
        Log.d(TAG, "🌍 Language: ${preferenceRepository.getCurrentLanguageCode()}")
        Log.d(TAG, "🌙 Dark Mode: ${preferenceRepository.getDarkMode()}")
        Log.d(TAG, "🔄 Clear Data detected: ${isFirstTimeAfterClearData()}")
        Log.d(TAG, "💾 Last Known User: $lastEmail ($lastUid)")
        Log.d(TAG, "📱 App State: ${_appState.value}")
        Log.d(TAG, "📊 === KRAJ STANJA ===")
    }

    fun forceRefreshAppState() = viewModelScope.launch {
        Log.d(TAG, "🔄 Force refresh app state...")

        getDarkMode()
        getIsImageGen()
        getCurrentLanguageCode()
        checkForClearData()

        Log.d(TAG, "✅ App state refreshan")
        logCurrentAppState()
    }

    // ✅ NOVO: App State management
    fun setAppState(state: AppState) {
        _appState.value = state
        Log.d(TAG, "🔄 App State promijenjen na: ${state.name}")
    }

    // ✅ NOVO: Reset svih postavki (za testing ili potpuni reset)
    fun resetAllSettings() = viewModelScope.launch {
        Log.w(TAG, "🗑️ RESETIRAM SVE POSTAVKE!")

        // Ovo je opasna operacija - koristi samo za testing
        if (com.nextgptapp.here.BuildConfig.DEBUG) {
            preferenceRepository.resetAllPreferences()

            // Reset local state
            _darkMode.value = true
            _isImageGeneration.value = false
            _currentLanguageCode.value = "en"
            _appState.value = AppState.RESET

            Log.w(TAG, "✅ Sve postavke resetovane (DEBUG MODE)")
        } else {
            Log.e(TAG, "❌ Reset postavki nije dozvoljen u produkciji!")
        }
    }

    // ✅ NOVO: Provjeri konzistentnost stanja
    fun validateAppState(): Boolean {
        val currentUser = com.google.firebase.auth.FirebaseAuth.getInstance().currentUser
        val isGuest = isGuestMode()
        val isInitialized = preferenceRepository.getAppInitialized()

        val isConsistent = when {
            currentUser != null && !isGuest && isInitialized -> true // OK - authenticated
            currentUser == null && isGuest && isInitialized -> true // OK - guest mode
            currentUser == null && !isGuest && !isInitialized -> true // OK - first time
            else -> false // Inconsistent state
        }

        Log.d(TAG, "🔍 App State Validation:")
        Log.d(TAG, "  - Firebase User: ${currentUser != null}")
        Log.d(TAG, "  - Guest Mode: $isGuest")
        Log.d(TAG, "  - Initialized: $isInitialized")
        Log.d(TAG, "  - Consistent: $isConsistent")

        if (!isConsistent) {
            Log.w(TAG, "⚠️ INCONSISTENT APP STATE DETECTED!")
            _appState.value = AppState.ERROR
        }

        return isConsistent
    }
}

// ✅ NOVO: App State enum za bolje praćenje stanja
enum class AppState {
    INITIALIZING,
    NORMAL,
    CLEAR_DATA_DETECTED,
    AUTHENTICATED,
    GUEST_MODE,
    UNAUTHENTICATED,
    INITIALIZED,
    ERROR,
    RESET
}