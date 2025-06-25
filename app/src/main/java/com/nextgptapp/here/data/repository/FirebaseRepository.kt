package com.nextgptapp.here.data.repository

import com.nextgptapp.here.components.AppLogger
import com.nextgptapp.here.components.FirebaseConstant
import com.nextgptapp.here.components.FirebaseConstant.REPORTED_MESSAGES
import com.nextgptapp.here.data.model.ReportContent
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.ktx.Firebase
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Calendar
import javax.inject.Inject
import kotlin.coroutines.resume
import com.nextgptapp.here.data.model.GPTModelInfo
import android.util.Log
import com.google.firebase.auth.FirebaseAuth

interface FirebaseRepository {
    suspend fun loginToFirebase(token: String): Boolean
    suspend fun loginToFirebase(email: String, password: String): Boolean
    suspend fun getAllEnabledModels(): List<GPTModelInfo>
    fun isLoggedIn(): Boolean
    suspend fun setUpAccount()
    suspend fun decrementCredits(amount: Int)
    suspend fun incrementCredits(amount: Int)
    suspend fun updateCreditPurchasedStatus(status: Boolean)
    suspend fun updateFreeCreditDate(date: String)
    suspend fun deleteAccount(): Boolean
    suspend fun updateServerTS()
    suspend fun getCreditBalance(): Int
    suspend fun reportContent(msgId: String, reportContent: ReportContent)

    // ✅ DODANO: Admin funkcionalnost
    fun isAdminUser(): Boolean
    suspend fun checkAdminStatus()
}

class FirebaseRepositoryImpl @Inject constructor(private val firestore: FirebaseFirestore) :
    FirebaseRepository {

    // ✅ DODANO: Admin status varijabla
    private var isAdmin: Boolean = false

    override fun isLoggedIn(): Boolean = Firebase.auth.currentUser != null

    // ✅ AŽURIRANO: Admin provjera kod login-a
    override suspend fun loginToFirebase(token: String): Boolean = suspendCancellableCoroutine { cont ->
        Log.d("FirebaseRepository", "🎯 loginToFirebase(token) pokrenut")
        val firebaseCredential = GoogleAuthProvider.getCredential(token, null)
        Log.d("FirebaseRepository", "📩 Firebase credential kreiran")

        Firebase.auth.signInWithCredential(firebaseCredential)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val uid = Firebase.auth.currentUser?.uid
                    Log.d("FirebaseRepository", "✅ Firebase login uspješan, UID: $uid")
                    if (uid != null) {
                        firestore.collection(FirebaseConstant.USERS_COLLECTION)
                            .document(uid)
                            .get()
                            .addOnSuccessListener { document ->
                                isAdmin = document.getBoolean("isAdmin") ?: false
                                Log.d("FirebaseRepository", "👑 Admin status: $isAdmin")
                                cont.resume(true)
                            }
                            .addOnFailureListener { e ->
                                Log.e("FirebaseRepository", "❌ Ne mogu dohvatiti admin status: ${e.message}")
                                isAdmin = false
                                cont.resume(true)
                            }
                    } else {
                        Log.e("FirebaseRepository", "❌ UID je null nakon uspješnog login-a?!")
                        cont.resume(false)
                    }
                } else {
                    Log.e("FirebaseRepository", "❌ Firebase login NIJE uspješan: ${task.exception?.message}")
                    task.exception?.printStackTrace()
                    cont.resume(false)
                }
            }
    }


    override suspend fun getCreditBalance(): Int {
        if (!isLoggedIn()) return 0
        return try {
            val uid = Firebase.auth.currentUser!!.uid
            val doc = firestore.collection(FirebaseConstant.USERS_COLLECTION).document(uid).get().await()
            doc.getLong(FirebaseConstant.CREDIT_BALANCE_NODE)?.toInt() ?: 0
        } catch (e: Exception) {
            Log.e("FirebaseRepository", "❌ Ne mogu dohvatiti broj kredita: ${e.message}")
            0
        }
    }

    override suspend fun loginToFirebase(email: String, password: String): Boolean = suspendCancellableCoroutine {
        Firebase.auth.createUserWithEmailAndPassword(email, password).addOnCompleteListener { task ->
            if (task.isSuccessful) {
                // Provjeri admin status i nakon email/password login-a
                checkAdminStatusAsync()
                it.resume(true)
            } else {
                Firebase.auth.signInWithEmailAndPassword(email, password).addOnCompleteListener { etask ->
                    if (etask.isSuccessful) {
                        checkAdminStatusAsync()
                    }
                    it.resume(etask.isSuccessful)
                }
            }
        }
    }

    override suspend fun setUpAccount() {
        runCatching {
            val uid = Firebase.auth.currentUser!!.uid
            val email = Firebase.auth.currentUser!!.email
            val docRef = firestore.collection(FirebaseConstant.USERS_COLLECTION).document(uid)
            val snapshot = docRef.get().await()
            if (snapshot == null || !snapshot.exists()) {
                var date = "${System.currentTimeMillis()}"
                runCatching {
                    val time = Calendar.getInstance().time
                    val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm")
                    date = formatter.format(time)
                }
                val data = hashMapOf(
                    FirebaseConstant.IS_ANY_BUNDLE_PURCHASED to false,
                    "email" to email,
                    "date" to date,
                    "platform" to "gemini",
                    "isAdmin" to false // ✅ DODANO: Default admin status
                )
                docRef.set(data).await()
            }

            // Provjeri admin status nakon setup-a
            checkAdminStatus()
        }
    }

    override suspend fun decrementCredits(amount: Int) {
        if (!isLoggedIn()) return
        runCatching {
            val uid = Firebase.auth.currentUser!!.uid
            val docRef = firestore.collection(FirebaseConstant.USERS_COLLECTION).document(uid)
            docRef.update(FirebaseConstant.CREDIT_BALANCE_NODE, FieldValue.increment(-amount.toLong())).await()
        }
    }

    override suspend fun incrementCredits(amount: Int) {
        decrementCredits(-amount)
    }

    override suspend fun updateCreditPurchasedStatus(status: Boolean) {
        if (!isLoggedIn()) return
        runCatching {
            val uid = Firebase.auth.currentUser!!.uid
            val docRef = firestore.collection(FirebaseConstant.USERS_COLLECTION).document(uid)
            docRef.update(FirebaseConstant.IS_ANY_BUNDLE_PURCHASED, status).await()
        }
    }

    override suspend fun updateFreeCreditDate(date: String) {
        if (!isLoggedIn()) return
        runCatching {
            val uid = Firebase.auth.currentUser!!.uid
            val docRef = firestore.collection(FirebaseConstant.USERS_COLLECTION).document(uid)
            docRef.update(FirebaseConstant.FREE_CREDITS_DATE, date).await()
        }
    }

    override suspend fun deleteAccount(): Boolean {
        if (!isLoggedIn()) return false
        return runCatching {
            val uid = Firebase.auth.currentUser!!.uid
            firestore.collection(FirebaseConstant.USERS_COLLECTION).document(uid).delete().await()
            Firebase.auth.currentUser!!.delete().await()
            true
        }.getOrElse {
            it.printStackTrace()
            false
        }
    }

    override suspend fun updateServerTS() {
        runCatching {
            val uid = Firebase.auth.currentUser!!.uid
            firestore.collection(FirebaseConstant.USERS_COLLECTION).document(uid)
                .update(FirebaseConstant.SEVER_TIME_STAMP, FieldValue.serverTimestamp()).await()
        }
    }

    override suspend fun reportContent(msgId: String, reportContent: ReportContent) {
        if (!isLoggedIn()) return
        runCatching {
            val uid = Firebase.auth.currentUser!!.uid
            firestore.collection(FirebaseConstant.REPORTED_CONTENT)
                .document(uid)
                .collection(REPORTED_MESSAGES)
                .document(msgId)
                .set(reportContent)
                .await()
            AppLogger.logE("FirebaseRepo", "Reported successfully")
        }
    }

    override suspend fun getAllEnabledModels(): List<GPTModelInfo> {
        return try {
            val snapshot = firestore.collection("ai_models")
                .whereEqualTo("enabled", true)
                .get()
                .await()

            Log.d("MODEL_DEBUG", "📥 Ukupno dokumenata u Firestore: ${snapshot.size()}")

            val modeli = snapshot.documents.mapNotNull { doc ->
                try {
                    val model = GPTModelInfo(
                        id = doc.getString("id") ?: doc.id,
                        name = doc.getString("name") ?: doc.getString("modelName") ?: return@mapNotNull null,
                        model = doc.getString("model") ?: doc.getString("modelValue") ?: return@mapNotNull null,
                        modelId = doc.getString("modelId") ?: doc.getString("model") ?: doc.getString("modelValue") ?: "",
                        modelValue = doc.getString("modelValue") ?: return@mapNotNull null,
                        modelName = doc.getString("modelName") ?: doc.getString("name") ?: "",
                        modelSource = doc.getString("modelSource") ?: "unknown",
                        provider = doc.getString("provider") ?: "openai",
                        apiKey = doc.getString("apiKey") ?: "",
                        apiKeyType = doc.getString("apiKeyType") ?: "Bearer",
                        apiEndpoint = doc.getString("apiEndpoint") ?: "https://api.openai.com/v1/",
                        authType = doc.getString("authType") ?: "Bearer",
                        defaultPrompt = doc.getString("defaultPrompt") ?: "",
                        systemPrompt = doc.getString("systemPrompt") ?: "",
                        isActive = doc.getBoolean("isActive") ?: true,
                        enabled = doc.getBoolean("enabled") ?: true,
                        supportsStreaming = doc.getBoolean("supportsStreaming") ?: true,
                        costPerMTokenIn = doc.getDouble("costPerMTokenIn") ?: 0.0,
                        costPerMTokenOut = doc.getDouble("costPerMTokenOut") ?: 0.0,
                        maxTokens = (doc.getLong("maxTokens") ?: 4096L).toInt(),
                        fallbackModel = doc.getString("fallbackModel"),
                        languageSupport = doc.get("languageSupport") as? List<String> ?: emptyList(),
                        strengths = doc.get("strengths") as? List<String> ?: emptyList(),

                        // ✅ GPT-4o DODANO:
                        requiresBrowsing = doc.getBoolean("requiresBrowsing") ?: false
                    )

                    Log.d("MODEL_PARSE", "✅ Parsed model: ${model.id} | browsing=${model.requiresBrowsing}")
                    model
                } catch (e: Exception) {
                    Log.e("MODEL_PARSE", "❌ Greška kod parsiranja modela: ${e.message}")
                    null
                }
            }

            val filtrirani = modeli.filter { it.enabled && it.isActive }
            Log.d("MODEL_FINAL", "🎯 Filtrirani modeli: ${filtrirani.map { "${it.id}(browsing=${it.requiresBrowsing})" }}")

            return filtrirani
        } catch (e: Exception) {
            Log.e("FirebaseRepository", "❌ Ne mogu dohvatiti modele: ${e.message}")
            return emptyList()
        }
    }




    // ✅ DODANO: Admin funkcionalnost
    override fun isAdminUser(): Boolean {
        return isAdmin
    }

    override suspend fun checkAdminStatus() {
        if (!isLoggedIn()) {
            isAdmin = false
            return
        }

        try {
            val uid = Firebase.auth.currentUser!!.uid
            val document = firestore.collection(FirebaseConstant.USERS_COLLECTION)
                .document(uid)
                .get()
                .await()

            isAdmin = document.getBoolean("isAdmin") ?: false
            Log.d("FirebaseRepository", "👑 Admin status provjeren: $isAdmin")
        } catch (e: Exception) {
            Log.e("FirebaseRepository", "❌ Greška pri provjeri admin statusa: ${e.message}")
            isAdmin = false
        }
    }

    // Helper metoda za async admin provjeru
    private fun checkAdminStatusAsync() {
        if (!isLoggedIn()) return

        val uid = Firebase.auth.currentUser?.uid ?: return
        firestore.collection(FirebaseConstant.USERS_COLLECTION)
            .document(uid)
            .get()
            .addOnSuccessListener { document ->
                isAdmin = document.getBoolean("isAdmin") ?: false
                Log.d("FirebaseRepository", "👑 Admin status (async): $isAdmin")
            }
            .addOnFailureListener { e ->
                Log.e("FirebaseRepository", "❌ Async admin provjera failed: ${e.message}")
                isAdmin = false
            }
    }
}