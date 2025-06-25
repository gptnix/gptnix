package com.nextgptapp.here.data.repository

import android.app.Application
import android.content.SharedPreferences
import android.util.Log
import com.nextgptapp.here.components.PreferenceConstant
import com.nextgptapp.here.data.model.GPTModel
import java.util.Locale
import javax.inject.Inject

interface PreferenceRepository {
    fun getDefaultPreference():SharedPreferences
    fun setDarkMode(isDarkMode: Boolean)
    fun getDarkMode(): Boolean
    fun getIsGuest(): Boolean
    fun setIsGuest(isGuest:Boolean)
    fun getGPTModel(): String
    fun setGPTModel(modelName: String)
    fun setIsImageGen(enabled: Boolean)
    fun getIsImageGen(): Boolean
    fun setCurrentLanguage(language: String)
    fun getCurrentLanguage(): String
    fun setCurrentLanguageCode(language: String)
    fun getCurrentLanguageCode(): String
    fun getSelectedLanguageCode(): String?
    fun setVisionDailyCount(count: Int)
    fun getVisionDailyCount(): Int
    fun setGenerationDailyCount(count: Int)
    fun getGenerationDailyCount(): Int
    fun setGPT4DailyCount(count: Int)
    fun getGPT4DailyCount(): Int

    // ✅ NOVO: Clear Data detection metode
    fun setAppInitialized(initialized: Boolean)
    fun getAppInitialized(): Boolean
    fun getAppLaunchCount(): Int
    fun isFirstTimeAfterClearData(): Boolean
    fun setLastKnownUser(uid: String, email: String?)
    fun getLastKnownUser(): Pair<String?, String?>
    fun clearLastKnownUser()
    fun resetAllPreferences()
}

class PreferenceRepositoryImpl @Inject constructor(
    private val sharedPreferences: SharedPreferences,
    private val app: Application
) : PreferenceRepository {

    private val TAG = "PreferenceRepository"

    override fun getDefaultPreference(): SharedPreferences = sharedPreferences

    override fun setDarkMode(isDarkMode: Boolean) {
        sharedPreferences.edit().putBoolean(PreferenceConstant.DARK_MODE, isDarkMode).apply()
        Log.d(TAG, "🌙 Dark Mode postavljen na: $isDarkMode")
    }

    override fun getDarkMode(): Boolean {
        val darkMode = sharedPreferences.getBoolean(PreferenceConstant.DARK_MODE, true)
        Log.d(TAG, "🌙 Dark Mode dohvaćen: $darkMode")
        return darkMode
    }

    override fun getGPTModel(): String {
        return sharedPreferences.getString(PreferenceConstant.GPT_DEFAULT_MODEL,null)?: GPTModel.gpt35Turbo.name
    }

    override fun setGPTModel(modelName: String) {
        sharedPreferences.edit().putString(PreferenceConstant.GPT_DEFAULT_MODEL, modelName).apply()
    }

    override fun getIsGuest(): Boolean {
        val isGuest = sharedPreferences.getBoolean(PreferenceConstant.IS_GUEST_KEY, false)
        Log.d(TAG, "👤 Guest Mode dohvaćen: $isGuest")
        return isGuest
    }

    override fun setIsGuest(isGuest: Boolean) {
        sharedPreferences.edit().putBoolean(PreferenceConstant.IS_GUEST_KEY, isGuest).commit()
        Log.d(TAG, "👤 Guest Mode postavljen na: $isGuest")
    }

    override fun setIsImageGen(enabled: Boolean) {
        sharedPreferences.edit().putBoolean(PreferenceConstant.IMAGE_GENERATION, enabled).apply()
        Log.d(TAG, "🖼️ Image Generation postavljen na: $enabled")
    }

    override fun getIsImageGen(): Boolean {
        val isImageGen = sharedPreferences.getBoolean(PreferenceConstant.IMAGE_GENERATION, false)
        Log.d(TAG, "🖼️ Image Generation dohvaćen: $isImageGen")
        return isImageGen
    }

    override fun setCurrentLanguage(language: String) {
        sharedPreferences.edit().putString(PreferenceConstant.LANGUAGE_NAME, language).apply()
        Log.d(TAG, "🌍 Language Name postavljen na: $language")
    }

    override fun getCurrentLanguage(): String =
        sharedPreferences.getString(
            PreferenceConstant.LANGUAGE_NAME,
            Locale.getDefault().displayLanguage
        ) ?: Locale.getDefault().displayLanguage

    override fun setCurrentLanguageCode(language: String) {
        sharedPreferences.edit().putString(PreferenceConstant.LANGUAGE_CODE, language).apply()
        Log.d(TAG, "🌍 Language Code postavljen na: $language")
    }

    override fun getCurrentLanguageCode(): String {
        val languageCode = sharedPreferences.getString(
            PreferenceConstant.LANGUAGE_CODE,
            Locale.getDefault().language
        ) ?: Locale.getDefault().language
        Log.d(TAG, "🌍 Language Code dohvaćen: $languageCode")
        return languageCode
    }

    override fun setVisionDailyCount(count: Int) {
        sharedPreferences.edit().putInt(PreferenceConstant.VISION_LIMIT, count).apply()
    }

    override fun getVisionDailyCount(): Int {
        return sharedPreferences.getInt(PreferenceConstant.VISION_LIMIT, 0)
    }

    override fun setGenerationDailyCount(count: Int) {
        sharedPreferences.edit().putInt(PreferenceConstant.GENERATION_LIMIT, count).apply()
    }

    override fun getGenerationDailyCount(): Int {
        return sharedPreferences.getInt(PreferenceConstant.GENERATION_LIMIT, 0)
    }

    override fun setGPT4DailyCount(count: Int) {
        sharedPreferences.edit().putInt(PreferenceConstant.GPT4_LIMIT, count).apply()
    }

    override fun getGPT4DailyCount(): Int {
        return sharedPreferences.getInt(PreferenceConstant.GPT4_LIMIT, 0)
    }

    // ✅ NOVO: Clear Data detection implementacija

    override fun setAppInitialized(initialized: Boolean) {
        val editor = sharedPreferences.edit()
        editor.putBoolean(PreferenceConstant.APP_INITIALIZED, initialized)

        // Povećaj launch count
        val currentCount = getAppLaunchCount()
        editor.putInt(PreferenceConstant.APP_LAUNCH_COUNT, currentCount + 1)

        // Dodaj timestamp
        editor.putLong(PreferenceConstant.LAST_LAUNCH_TIME, System.currentTimeMillis())

        editor.apply()

        Log.d(TAG, "🏁 App Initialized postavljen na: $initialized (launch #${currentCount + 1})")
    }

    override fun getAppInitialized(): Boolean {
        val initialized = sharedPreferences.getBoolean(PreferenceConstant.APP_INITIALIZED, false)
        Log.d(TAG, "🏁 App Initialized dohvaćen: $initialized")
        return initialized
    }

    override fun getAppLaunchCount(): Int {
        val count = sharedPreferences.getInt(PreferenceConstant.APP_LAUNCH_COUNT, 0)
        Log.d(TAG, "📊 App Launch Count: $count")
        return count
    }

    override fun isFirstTimeAfterClearData(): Boolean {
        // Provjeri je li sve u default stanju
        val currentLanguage = getCurrentLanguageCode()
        val defaultLanguage = Locale.getDefault().language

        val isLanguageDefault = currentLanguage == defaultLanguage || currentLanguage == "en"
        val isGuestDefault = !getIsGuest()
        val isDarkModeDefault = getDarkMode() == true // ako je true default
        val isNotInitialized = !getAppInitialized()
        val isFirstLaunch = getAppLaunchCount() == 0

        val isClearData = isLanguageDefault &&
                isGuestDefault &&
                isDarkModeDefault &&
                isNotInitialized &&
                isFirstLaunch

        Log.d(TAG, "🔍 Clear Data provjera:")
        Log.d(TAG, "  - Language: $currentLanguage (default: $isLanguageDefault)")
        Log.d(TAG, "  - Is Guest: ${getIsGuest()} (default: $isGuestDefault)")
        Log.d(TAG, "  - Dark Mode: ${getDarkMode()} (default: $isDarkModeDefault)")
        Log.d(TAG, "  - App Initialized: ${getAppInitialized()} (default: $isNotInitialized)")
        Log.d(TAG, "  - Launch Count: ${getAppLaunchCount()} (default: $isFirstLaunch)")
        Log.d(TAG, "  - Je Clear Data: $isClearData")

        return isClearData
    }

    override fun setLastKnownUser(uid: String, email: String?) {
        val editor = sharedPreferences.edit()
        editor.putString(PreferenceConstant.LAST_KNOWN_UID, uid)
        if (email != null) {
            editor.putString(PreferenceConstant.LAST_KNOWN_EMAIL, email)
        }
        editor.putLong(PreferenceConstant.LAST_LOGIN_TIME, System.currentTimeMillis())
        editor.apply()

        Log.d(TAG, "👤 Zadnji poznati korisnik spremljen: $email ($uid)")
    }

    override fun getLastKnownUser(): Pair<String?, String?> {
        val uid = sharedPreferences.getString(PreferenceConstant.LAST_KNOWN_UID, null)
        val email = sharedPreferences.getString(PreferenceConstant.LAST_KNOWN_EMAIL, null)

        Log.d(TAG, "👤 Zadnji poznati korisnik dohvaćen: $email ($uid)")
        return Pair(uid, email)
    }

    override fun clearLastKnownUser() {
        sharedPreferences.edit()
            .remove(PreferenceConstant.LAST_KNOWN_UID)
            .remove(PreferenceConstant.LAST_KNOWN_EMAIL)
            .remove(PreferenceConstant.LAST_LOGIN_TIME)
            .apply()

        Log.d(TAG, "👤 Zadnji poznati korisnik obrisan")
    }

    override fun resetAllPreferences() {
        Log.w(TAG, "🗑️ RESETIRAM SVE PREFERENCE!")
        sharedPreferences.edit().clear().apply()
    }

    // ✅ NOVO: Dodatne helper metode

    fun getLastLaunchTime(): Long {
        return sharedPreferences.getLong(PreferenceConstant.LAST_LAUNCH_TIME, 0)
    }

    fun setRecoveryAttempted(attempted: Boolean) {
        sharedPreferences.edit().putBoolean(PreferenceConstant.RECOVERY_ATTEMPTED, attempted).apply()
        Log.d(TAG, "🔄 Recovery Attempted postavljen na: $attempted")
    }

    fun getRecoveryAttempted(): Boolean {
        return sharedPreferences.getBoolean(PreferenceConstant.RECOVERY_ATTEMPTED, false)
    }

    fun setLastSuccessfulConnection(timestamp: Long) {
        sharedPreferences.edit().putLong(PreferenceConstant.LAST_SUCCESSFUL_CONNECTION, timestamp).apply()
        Log.d(TAG, "✅ Zadnja uspješna konekcija spremljena: $timestamp")
    }

    fun getLastSuccessfulConnection(): Long {
        return sharedPreferences.getLong(PreferenceConstant.LAST_SUCCESSFUL_CONNECTION, 0)
    }

    fun getAllPreferences(): Map<String, Any> {
        val allPrefs = sharedPreferences.all
        Log.d(TAG, "📋 Sve preference: $allPrefs")
        return allPrefs.mapValues { it.value ?: "null" }
    }

    fun resetRecoveryState() {
        val editor = sharedPreferences.edit()
        editor.remove(PreferenceConstant.RECOVERY_ATTEMPTED)
        editor.remove(PreferenceConstant.LAST_SUCCESSFUL_CONNECTION)
        editor.apply()

        Log.d(TAG, "🔄 Recovery state resetovan")
    }

    // ✅ NOVO: Validacija konzistentnosti podataka
    fun validatePreferences(): Boolean {
        try {
            val allPrefs = getAllPreferences()
            var isValid = true

            // Provjeri osnovne preference
            val darkMode = getDarkMode()
            val language = getCurrentLanguageCode()
            val isGuest = getIsGuest()
            val launchCount = getAppLaunchCount()

            Log.d(TAG, "🔍 Validacija preference:")
            Log.d(TAG, "  - Dark Mode: $darkMode")
            Log.d(TAG, "  - Language: $language")
            Log.d(TAG, "  - Is Guest: $isGuest")
            Log.d(TAG, "  - Launch Count: $launchCount")

            // Provjeri logičke greške
            if (launchCount < 0) {
                Log.e(TAG, "❌ Launch count je negativan!")
                isValid = false
            }

            if (language.isEmpty()) {
                Log.e(TAG, "❌ Language code je prazan!")
                isValid = false
            }

            Log.d(TAG, "✅ Preference validacija: $isValid")
            return isValid

        } catch (e: Exception) {
            Log.e(TAG, "❌ Greška pri validaciji preference: ${e.message}")
            return false
        }
    }
    override fun getSelectedLanguageCode(): String? {
        return sharedPreferences.getString("selected_language_code", null)
    }

}