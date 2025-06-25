package com.nextgptapp.here.components

import android.content.Context
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.nextgptapp.here.R

object GoogleClient {

    fun get(context: Context): GoogleSignInClient {
        val signInOptions = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(context.getString(R.string.default_web_client_id)) // ✅ koristi iz google-services.json
            .requestEmail()
            .build()

        return GoogleSignIn.getClient(context, signInOptions)
    }
}
