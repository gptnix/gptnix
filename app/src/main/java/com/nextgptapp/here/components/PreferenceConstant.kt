package com.nextgptapp.here.components

object PreferenceConstant {
    // ✅ POSTOJEĆI KLJUČEVI
    const val SHARED_PREF_NAME = "aivision_shared_pref"
    const val DARK_MODE = "dark_mode"
    const val GPT_DEFAULT_MODEL = "gpt_model"
    const val IS_GUEST_KEY = "is_guest"
    const val CREDITS_COUNT_KEY = "credits_key"
    const val IS_PREMIUM_KEY = "is_premium"
    const val FREE_CREDITS_KEY = "free_credits"
    const val IMAGE_GENERATION = "image_gen"
    const val LANGUAGE_CODE = "languageCode"
    const val LANGUAGE_NAME = "languageName"
    const val VISION_LIMIT = "vision_limit"
    const val GENERATION_LIMIT = "generation_limit"
    const val GPT4_LIMIT = "gpt4_limit"

    // ✅ NOVO: Clear Data detection ključevi
    const val APP_INITIALIZED = "app_initialized"
    const val APP_LAUNCH_COUNT = "app_launch_count"
    const val LAST_LAUNCH_TIME = "last_launch_time"
    const val LAST_KNOWN_UID = "last_known_uid"
    const val LAST_KNOWN_EMAIL = "last_known_email"
    const val LAST_LOGIN_TIME = "last_login_time"
    const val RECOVERY_ATTEMPTED = "recovery_attempted"
    const val LAST_SUCCESSFUL_CONNECTION = "last_successful_connection"

    // ✅ NOVO: Dodatni tracking ključevi
    const val FIRST_INSTALL_TIME = "first_install_time"
    const val APP_VERSION_CODE = "app_version_code"
    const val LAST_CLEAR_DATA_TIME = "last_clear_data_time"
    const val AUTO_RECOVERY_ENABLED = "auto_recovery_enabled"
    const val DEBUG_MODE_ENABLED = "debug_mode_enabled"
}