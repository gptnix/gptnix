package com.nextgptapp.here.ui.welcome

import android.app.Application
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nextgptapp.here.components.ApiKeyHelpers
import com.nextgptapp.here.components.AppLogger
import com.nextgptapp.here.components.Constants
import com.nextgptapp.here.components.CreditHelpers
import com.nextgptapp.here.components.JavaUtils
import com.nextgptapp.here.data.repository.FirebaseRepository
import com.nextgptapp.here.data.repository.PreferenceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import android.util.Log

@HiltViewModel
class WelcomeViewModel @Inject constructor(
    private val app: Application,
    private val firebaseRepository: FirebaseRepository,
    private val apiKeyHelpers: ApiKeyHelpers,
    private val creditHelpers: CreditHelpers,
    private val preferenceRepository: PreferenceRepository
) : ViewModel() {

    private var _isProcessing = mutableStateOf(false)
    val isProcessing: Boolean
        get() = _isProcessing.value

    private val _loginSuccess = MutableStateFlow(false)
    val loginSuccess = _loginSuccess.asStateFlow()

    private var _authError = mutableStateOf(false)
    val authError: Boolean get() = _authError.value

    // ✅ DODANO: Admin status
    private val _isAdminUser = MutableStateFlow(false)
    val isAdminUser = _isAdminUser.asStateFlow()

    fun updateProcessingState(isProcessing: Boolean) {
        _isProcessing.value = isProcessing
    }

    fun authenticateWithToken(token: String) = viewModelScope.launch {
        Log.e("LOGIN_FLOW", "🎟️ Primljen token: $token")

        val authResult = firebaseRepository.loginToFirebase(token)
        Log.e("LOGIN_FLOW", "✅ loginToFirebase rezultat: $authResult")

        if (authResult) {
            try {
                firebaseRepository.setUpAccount()
                Log.e("LOGIN_FLOW", "✅ setUpAccount uspješan")

                try {
                    apiKeyHelpers.connect()
                    Log.e("LOGIN_FLOW", "✅ apiKeyHelpers.connect uspješan")
                } catch (e: Exception) {
                    Log.e("LOGIN_FLOW", "❌ apiKeyHelpers.connect pukao: ${e.message}")
                }

                firebaseRepository.checkAdminStatus()
                _isAdminUser.value = firebaseRepository.isAdminUser()
                Log.e("LOGIN_FLOW", "👑 Admin status: ${_isAdminUser.value}")

                _loginSuccess.value = true
                Log.e("LOGIN_FLOW", "🏁 loginSuccess.value = true")

                delay(400)
                creditHelpers.connect()
            } catch (e: Exception) {
                Log.e("LOGIN_FLOW", "❌ Greška unutar if grane: ${e.message}")
            }
        } else {
            _authError.value = true
            _isProcessing.value = false
            Log.e("LOGIN_FLOW", "❌ Login nije uspio – authResult je false")
        }
    }



    fun loginWithEmailAndPass() = viewModelScope.launch {
        val id = JavaUtils.generateDeviceId().replace("-", "_")
        val pass = JavaUtils.computeMD5Hash(id)
        val email = "$id${Constants.EMAIL_DOMAIN}"
        AppLogger.logE("WelcomeViewModel", "email:${email.trim()}")
        val authResult = firebaseRepository.loginToFirebase(email.trim(), pass)

        if (authResult) {
            firebaseRepository.setUpAccount()
            apiKeyHelpers.connect()

            // ✅ DODANO: Provjeri admin status i za guest login
            firebaseRepository.checkAdminStatus()
            _isAdminUser.value = firebaseRepository.isAdminUser()
            AppLogger.logE("WelcomeViewModel", "👑 Guest Admin status: ${_isAdminUser.value}")

            _loginSuccess.value = true
            preferenceRepository.setIsGuest(true)
            delay(400) // let the config load first
            creditHelpers.connect()
        } else {
            _authError.value = true
            _isProcessing.value = false
        }
    }

    // ✅ DODANO: Helper metoda za provjeru admin statusa
    fun checkAdminStatus() = viewModelScope.launch {
        if (firebaseRepository.isLoggedIn()) {
            firebaseRepository.checkAdminStatus()
            _isAdminUser.value = firebaseRepository.isAdminUser()
            AppLogger.logE("WelcomeViewModel", "👑 Refreshed admin status: ${_isAdminUser.value}")
        }
    }
    fun resetAuthState() {
        _authError.value = false
    }
    fun setAuthError(hasError: Boolean) {
        _authError.value = hasError
    }
    // ✅ DODANO: Getter za trenutni admin status
    fun isAdmin(): Boolean = firebaseRepository.isAdminUser()
}