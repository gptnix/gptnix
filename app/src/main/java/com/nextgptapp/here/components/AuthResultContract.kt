package com.nextgptapp.here.components

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.activity.result.contract.ActivityResultContract
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.tasks.Task

class AuthResultContract(private val googleClient: GoogleSignInClient) :
    ActivityResultContract<Int, Task<GoogleSignInAccount>?>() {

    override fun createIntent(context: Context, input: Int): Intent {
        Log.e("AUTH_CONTRACT", "🚀 createIntent called - generišem Google Sign-In Intent")
        val intent = googleClient.signInIntent
        Log.e("AUTH_CONTRACT", "✅ Intent kreiran: $intent")
        return intent
    }

    override fun parseResult(resultCode: Int, intent: Intent?): Task<GoogleSignInAccount>? {
        Log.e("AUTH_CONTRACT", "📨 parseResult called")
        Log.e("AUTH_CONTRACT", "➡️ resultCode: $resultCode")
        Log.e("AUTH_CONTRACT", "➡️ intent: $intent")
        Log.e("AUTH_CONTRACT", "➡️ intent extras: ${intent?.extras}")

        return when (resultCode) {
            Activity.RESULT_OK -> {
                Log.e("AUTH_CONTRACT", "✅ RESULT_OK - korisnik je završio sign-in")
                try {
                    val task = GoogleSignIn.getSignedInAccountFromIntent(intent)
                    Log.e("AUTH_CONTRACT", "✅ GoogleSignIn task kreiran: $task")
                    task
                } catch (e: Exception) {
                    Log.e("AUTH_CONTRACT", "❌ Greška pri kreiranju task-a: ${e.message}")
                    null
                }
            }
            Activity.RESULT_CANCELED -> {
                Log.e("AUTH_CONTRACT", "❌ RESULT_CANCELED - korisnik je otkazao sign-in")
                null
            }
            else -> {
                Log.e("AUTH_CONTRACT", "❌ Neočekivan result code: $resultCode")
                null
            }
        }
    }
}