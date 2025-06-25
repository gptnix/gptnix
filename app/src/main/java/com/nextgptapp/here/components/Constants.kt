package com.nextgptapp.here.components

import com.nextgptapp.here.data.model.GenerationModel
import com.nextgptapp.here.data.model.VisionGenerationType

object Constants {
    const val BASE_URL = "https://generativelanguage.googleapis.com/v1beta/"
    const val WEB_CLIENT_ID = "496151959855-ra3uff8goif66b8l4lvn1d1jgusjfonn.apps.googleusercontent.com"  // GPTNiX official client ID

    // 🎯 Google Ads (PRODUKCIJSKI ID-ovi)
    const val REWARDED_AD_UNIT_ID = "ca-app-pub-7416057401649878/4288389860"
    const val BANNER_AD_UNIT_ID = "ca-app-pub-7416057401649878/7109994328"
    const val BANNER_AD_UNIT_ID2 = "ca-app-pub-7416057401649878/7109994328"
    const val INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-7416057401649878/3170749315"
    const val FORCE_ADMIN_NO_ADS = true // ako želiš ručno isključiti sve reklame

    // 🧠 Koji modeli se koriste
    val VisionPlatform = VisionGenerationType.OPENAI
    val ImageGenerationPlatform = GenerationModel.DALL_E

    // 💰 Troškovi
    const val CHAT_MESSAGE_GPT4_COST = 2
    const val BASE_IMAGE_GEN_COST = 2
    const val MESSAGES_WORDS_GPT4 = 150
    const val CHAT_MESSAGE_COST = 1
    const val WORDS_PER_MESSAGES = 500
    const val IMAGE_VISION_COST = 2
    const val VIDEO_VISION_COST = 4

    // 🧾 Planovi pretplate
    const val SUBSCRIPTION_PRODUCT_ID = "gptnix_sub"
    const val WEEKLY_PLAN_ID = "gptnix_sub_weekly"
    const val MONTHLY_PLAN_ID = "gptnix_sub_monthly"
    const val YEARLY_PLAN_ID = "gptnix_sub_yearly"

    // 🎁 Besplatni krediti i limite
    const val DAILY_FREE_CREDITS = 5
    const val IS_VISION_PAID = false
    const val ENABLED_PDF_FEATURE = true
    const val MAX_PDF_PAGES_PER_FILE = 30

    // 📈 Dnevni limiti korištenja
    const val MAX_VISION_LIMIT_PER_DAY = 50
    const val MAX_IMAGE_GEN_LIMIT_PER_DAY = 50
    const val MAX_MESSAGE_LIMIT_PER_DAY = 100
    const val VIDEO_DURATION_LIMIT = 60 // sekundi

    // 🔒 Pravne stvari
    const val PRIVACY_POLICY = "https://gptnix.com/privacy"
    const val TERMS_SERVICE = "https://gptnix.com/terms"

    // 📧 Guest korisnici
    const val EMAIL_DOMAIN = "@gptnix.com"

    // 🔔 Login način (Google + Guest)
    val SignInMode = SignInType.Both

    // 🚨 Razlozi prijave sadržaja
    val REPORT_REASONS = listOf(
        "Inappropriate Content",
        "Incorrect Information",
        "Inappropriate Adult Content",
        "Harmful Advice",
        "Hate Speech or Harassment",
        "Sexually Explicit Content",
        "Obscene or Offensive Material",
        "Other"
    )
}
