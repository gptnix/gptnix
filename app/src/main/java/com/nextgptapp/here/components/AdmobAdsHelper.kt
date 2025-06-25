package com.nextgptapp.here.components

import android.app.Activity
import android.content.Context
import android.util.Log
import android.view.View
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.firebase.auth.FirebaseAuth
import com.nextgptapp.here.BuildConfig

private const val TAG = "AdmobAdsHelper"

var rewardedAd: RewardedAd? = null
private var interstitialAd: InterstitialAd? = null
private var adIsLoading: Boolean = false

// ✅ Provjera admina
fun isAdmin(): Boolean {
    // ⚠️ Stavi ovdje svoju provjeru (npr. prema e-mailu)
    return FirebaseAuth.getInstance().currentUser?.email == "ti@tvojemail.com"
}

// ✅ Banner Ad
fun showBannerAd(context: Context, adView: AdView) {
    if (BuildConfig.DEBUG || Constants.FORCE_ADMIN_NO_ADS || isAdmin()) {
        Log.d(TAG, "🛡️ Debug/admin - banner preskočen")
        adView.visibility = View.GONE
        return
    }

    adView.adListener = object : AdListener() {
        override fun onAdLoaded() {
            adView.visibility = View.VISIBLE
        }

        override fun onAdFailedToLoad(adError: LoadAdError) {
            adView.visibility = View.GONE
        }
    }

    val adRequest = AdRequest.Builder().build()
    adView.loadAd(adRequest)
}

// ✅ Rewarded Ad
fun loadRewarded(
    context: Context,
    onLoadedOrFailed: (errorMsg: String?) -> Unit,
    onRewarded: () -> Unit
) {
    if (BuildConfig.DEBUG || Constants.FORCE_ADMIN_NO_ADS || isAdmin()) {
        Log.d(TAG, "🛡️ Debug/admin - rewarded ad preskočen")
        onRewarded()
        return
    }

    RewardedAd.load(context, Constants.REWARDED_AD_UNIT_ID,
        AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
            override fun onAdLoaded(ad: RewardedAd) {
                Log.d(TAG, "🎯 Rewarded ad loaded.")
                rewardedAd = ad
                onLoadedOrFailed(null)
                showRewarded(context, onRewarded)
            }

            override fun onAdFailedToLoad(adError: LoadAdError) {
                Log.d(TAG, "❌ Rewarded ad failed: ${adError.message}")
                onLoadedOrFailed(adError.toString())
                rewardedAd = null
            }
        })
}

fun showRewarded(context: Context, onRewarded: () -> Unit) {
    val activity = context.findActivity()

    if (BuildConfig.DEBUG || Constants.FORCE_ADMIN_NO_ADS || isAdmin()) {
        Log.d(TAG, "🛡️ Debug/admin - rewarded ad show preskočen")
        onRewarded()
        return
    }

    if (rewardedAd != null && activity != null) {
        rewardedAd?.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdFailedToShowFullScreenContent(e: AdError) {
                rewardedAd = null
            }

            override fun onAdDismissedFullScreenContent() {
                rewardedAd = null
            }
        }

        rewardedAd?.show(activity) {
            Log.d(TAG, "🎁 Reward granted after ad")
            onRewarded()
        }
    } else {
        Log.d(TAG, "⚠️ Rewarded ad ili activity null, grantam reward direktno")
        onRewarded()
    }
}

// ✅ Interstitial Ad
fun loadAdInters(context: Context) {
    if (BuildConfig.DEBUG || Constants.FORCE_ADMIN_NO_ADS || isAdmin() || adIsLoading || interstitialAd != null) {
        Log.d(TAG, "🔄 Interstitial ad load preskočen (admin/debug/već učitano)")
        return
    }

    adIsLoading = true

    val adRequest = AdRequest.Builder().build()
    InterstitialAd.load(
        context,
        Constants.INTERSTITIAL_AD_UNIT_ID,
        adRequest,
        object : InterstitialAdLoadCallback() {
            override fun onAdFailedToLoad(adError: LoadAdError) {
                Log.d(TAG, "❌ Interstitial ad load fail: ${adError.message}")
                interstitialAd = null
                adIsLoading = false
            }

            override fun onAdLoaded(ad: InterstitialAd) {
                Log.d(TAG, "🎯 Interstitial ad loaded")
                interstitialAd = ad
                adIsLoading = false
            }
        }
    )
}

fun displayIntersAd(context: Context) {
    if (BuildConfig.DEBUG || Constants.FORCE_ADMIN_NO_ADS || isAdmin()) {
        Log.d(TAG, "🛡️ Debug/admin - interstitial preskočen")
        return
    }

    val activity = context.findActivity() ?: return

    if (interstitialAd != null) {
        interstitialAd?.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() {
                Log.d(TAG, "📴 Interstitial ad dismissed")
                interstitialAd = null
                loadAdInters(context)
            }

            override fun onAdFailedToShowFullScreenContent(adError: AdError) {
                Log.d(TAG, "❌ Interstitial ad failed: ${adError.message}")
                interstitialAd = null
            }

            override fun onAdShowedFullScreenContent() {
                Log.d(TAG, "✅ Interstitial ad prikazan")
            }
        }
        interstitialAd?.show(activity)
    } else {
        Log.d(TAG, "ℹ️ Interstitial ad nije spreman, pokušavam učitati")
        loadAdInters(context)
    }
}

fun destroyIntersAd() {
    interstitialAd = null
}
