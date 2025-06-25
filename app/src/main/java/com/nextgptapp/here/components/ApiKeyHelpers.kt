package com.nextgptapp.here.components

import android.util.Log
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.ktx.Firebase
import javax.inject.Inject
import com.nextgptapp.here.data.model.GPTModelInfo

private const val TAG = "ApiKeyHelpers"

class ApiKeyHelpers @Inject constructor(private val firestore: FirebaseFirestore) {
    private var apiKey: String = ""
    private var keyListener: ListenerRegistration? = null

    private var visionKey: String = ""
    private var visionkeyListener: ListenerRegistration? = null
    private val modelMap = mutableMapOf<String, ApiKeyModel>()

    private var groqKey: String = ""
    private var groqKeyListener: ListenerRegistration? = null

    private var togetherKey: String = ""
    private var togetherKeyListener: ListenerRegistration? = null

    private var stabilityKey: String = ""
    private var stabilitykeyListener: ListenerRegistration? = null

    private var deepseekKey: String = ""
    private var deepseekKeyListener: ListenerRegistration? = null

    private var geminiKey: String = ""
    private var geminiKeyListener: ListenerRegistration? = null

    // ✅ Test funkcija za dijagnostiku
    fun testConnection() {
        Log.d(TAG, "🧪 === POČETAK DIJAGNOSTIKE ===")

        val currentUser = Firebase.auth.currentUser
        Log.d(TAG, "👤 Korisnik status: ${if (currentUser != null) "PRIJAVLJEN" else "NIJE PRIJAVLJEN"}")

        if (currentUser != null) {
            Log.d(TAG, "👤 UID korisnika: ${currentUser.uid}")
            Log.d(TAG, "👤 Email korisnika: ${currentUser.email}")

            // Test direktnog čitanja
            testDirectFirebaseRead()
        } else {
            Log.e(TAG, "❌ PROBLEM: Korisnik nije prijavljen!")
            Log.e(TAG, "💡 RJEŠENJE: Prvo se prijavite, zatim pozovite connect()")
        }

        Log.d(TAG, "🧪 === KRAJ DIJAGNOSTIKE ===")
    }

    private fun testDirectFirebaseRead() {
        Log.d(TAG, "🔍 Testiram direktno čitanje iz Firebase...")

        val docPath = "${FirebaseConstant.API_KEY_COLLECTION}/${FirebaseConstant.API_KEY_DOCUMENT}"
        Log.d(TAG, "📍 Putanja dokumenta: $docPath")

        firestore.collection(FirebaseConstant.API_KEY_COLLECTION)
            .document(FirebaseConstant.API_KEY_DOCUMENT)
            .get()
            .addOnSuccessListener { document ->
                Log.d(TAG, "✅ Firebase odgovor uspješan")

                if (document.exists()) {
                    Log.d(TAG, "✅ Dokument postoji")

                    val data = document.data
                    Log.d(TAG, "📊 Sva polja u dokumentu: ${data?.keys}")

                    // Traži 'apiKey' umjesto 'key'
                    val key = document.getString("apiKey")
                    if (key != null && key.isNotEmpty()) {
                        Log.d(TAG, "✅ API Key pronađen: ${key.take(15)}... (duljina: ${key.length})")

                        if (key.startsWith("sk-")) {
                            Log.d(TAG, "✅ API Key ima ispravan format (sk-)")
                        } else {
                            Log.w(TAG, "⚠️ API Key NEMA ispravan format! Trebao bi počinjati s 'sk-'")
                        }
                    } else {
                        Log.e(TAG, "❌ PROBLEM: Polje 'apiKey' je prazno ili ne postoji!")
                        Log.e(TAG, "💡 RJEŠENJE: Dodajte polje 'apiKey' u Firebase dokument")
                    }
                } else {
                    Log.e(TAG, "❌ PROBLEM: Dokument '${FirebaseConstant.API_KEY_DOCUMENT}' ne postoji!")
                    Log.e(TAG, "💡 RJEŠENJE: Stvorite dokument u Firebase Console")
                }
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ PROBLEM: Firebase greška - ${e.message}")
                Log.e(TAG, "💡 RJEŠENJE: Provjerite internetsku vezu i Firebase pravila")
            }
    }

    fun connect() {
        Log.d(TAG, "🔌 === POKRETANJE CONNECT() ===")

        val currentUser = Firebase.auth.currentUser
        if (currentUser == null) {
            Log.e(TAG, "❌ KRITIČNA GREŠKA: Korisnik nije prijavljen!")
            Log.e(TAG, "💡 Pozovite Firebase.auth.signInWithEmailAndPassword() ili Google login prvo!")
            return
        }

        Log.d(TAG, "✅ Korisnik prijavljen: ${currentUser.uid}")
        Log.d(TAG, "📧 Email: ${currentUser.email}")

        // OpenAI API Key s detaljnim logovima
        setupOpenAIKey()

        // Ostali ključevi...
        setupOtherKeys()
    }

    private fun setupOpenAIKey() {
        Log.d(TAG, "🔑 === POSTAVLJANJE OPENAI KLJUČA ===")

        val docRef = firestore.collection(FirebaseConstant.API_KEY_COLLECTION)
            .document(FirebaseConstant.API_KEY_DOCUMENT)

        Log.d(TAG, "📍 Putanja: ${FirebaseConstant.API_KEY_COLLECTION}/${FirebaseConstant.API_KEY_DOCUMENT}")

        // Ukloni postojeći listener
        keyListener?.remove()

        keyListener = docRef.addSnapshotListener { snapshot, e ->
            if (e != null) {
                Log.e(TAG, "❌ OpenAI Listener greška: ${e.message}", e)
                Log.e(TAG, "🔧 Kod greške: ${e.code}")
                return@addSnapshotListener
            }

            Log.d(TAG, "📡 OpenAI Snapshot primljen")

            if (snapshot != null) {
                Log.d(TAG, "📄 Snapshot postoji: ${snapshot.exists()}")

                if (snapshot.exists()) {
                    Log.d(TAG, "✅ OpenAI dokument pronađen")

                    snapshot.data?.let { data ->
                        Log.d(TAG, "📊 Sva polja: ${data.keys}")

                        // Traži 'apiKey' umjesto 'key'
                        val newKey = data["apiKey"] as? String ?: ""

                        if (newKey.isNotEmpty()) {
                            apiKey = newKey
                            Log.d(TAG, "✅ OpenAI ključ uspješno učitan!")
                            Log.d(TAG, "🔑 Ključ: ${apiKey.take(15)}... (duljina: ${apiKey.length})")

                            if (apiKey.startsWith("sk-")) {
                                Log.d(TAG, "✅ Format ključa je ispravan")
                            } else {
                                Log.w(TAG, "⚠️ Format ključa možda nije ispravan!")
                            }
                        } else {
                            Log.e(TAG, "❌ PROBLEM: Polje 'apiKey' je prazno!")
                            apiKey = ""
                        }
                    } ?: run {
                        Log.e(TAG, "❌ PROBLEM: snapshot.data je null!")
                    }
                } else {
                    Log.e(TAG, "❌ PROBLEM: OpenAI dokument ne postoji!")
                    Log.e(TAG, "💡 Stvorite dokument 'openai_api' u kolekciji 'api_keys'")
                }
            } else {
                Log.e(TAG, "❌ PROBLEM: Snapshot je null!")
            }
        }
    }

    private fun setupOtherKeys() {
        // Vision API Key
        val visionDocRef = firestore.collection(FirebaseConstant.API_KEY_COLLECTION).document(FirebaseConstant.API_KEY_VISION_DOCUMENT)
        visionkeyListener?.remove()
        visionkeyListener = visionDocRef.addSnapshotListener { snapshot, e ->
            if (e != null) {
                Log.e(TAG, "❌ Vision listen failed: ${e.message}", e)
                return@addSnapshotListener
            }
            if (snapshot != null && snapshot.exists()) {
                snapshot.data?.let {
                    visionKey = it["key"] as? String ?: ""
                    Log.d(TAG, "✅ Vision key loaded: ${visionKey.take(10)}...")
                }
            } else {
                Log.e(TAG, "❌ Vision dokument ne postoji!")
            }
        }

        // Stability API Key
        val stabilityDocRef = firestore.collection(FirebaseConstant.API_KEY_COLLECTION).document(FirebaseConstant.API_KEY_STABILITY_DOCUMENT)
        stabilitykeyListener?.remove()
        stabilitykeyListener = stabilityDocRef.addSnapshotListener { snapshot, e ->
            if (e != null) {
                Log.e(TAG, "❌ Stability listen failed: ${e.message}", e)
                return@addSnapshotListener
            }
            if (snapshot != null && snapshot.exists()) {
                snapshot.data?.let {
                    stabilityKey = it["key"] as? String ?: ""
                    Log.d(TAG, "✅ Stability key loaded: ${stabilityKey.take(10)}...")
                }
            } else {
                Log.e(TAG, "❌ Stability dokument ne postoji!")
            }
        }

        // Groq API Key
        val groqDocRef = firestore.collection(FirebaseConstant.API_KEY_COLLECTION).document(FirebaseConstant.API_KEY_GROQ_DOCUMENT)
        Log.d(TAG, "🔍 Groq dokument path: ${FirebaseConstant.API_KEY_COLLECTION}/${FirebaseConstant.API_KEY_GROQ_DOCUMENT}")

        groqKeyListener?.remove()
        groqKeyListener = groqDocRef.addSnapshotListener { snapshot, e ->
            if (e != null) {
                Log.e(TAG, "❌ Groq listen failed: ${e.message}", e)
                return@addSnapshotListener
            }

            if (snapshot != null && snapshot.exists()) {
                Log.d(TAG, "✅ Groq dokument postoji")
                snapshot.data?.let { data ->
                    val key1 = data["apiKey"] as? String
                    val key2 = data["key"] as? String

                    groqKey = key1 ?: key2 ?: ""

                    if (groqKey.isNotEmpty()) {
                        Log.d(TAG, "✅ Groq key uspješno učitan: ${groqKey.take(15)}... (duljina: ${groqKey.length})")
                    } else {
                        Log.e(TAG, "❌ Groq key je prazan!")
                    }
                }
            } else {
                Log.e(TAG, "❌ Groq dokument ne postoji!")
            }
        }

        // Together API Key
        val togetherDocRef = firestore.collection(FirebaseConstant.API_KEY_COLLECTION).document(FirebaseConstant.API_KEY_TOGETHER_DOCUMENT)
        togetherKeyListener?.remove()
        togetherKeyListener = togetherDocRef.addSnapshotListener { snapshot, e ->
            if (e != null) {
                Log.e(TAG, "❌ Together listen failed: ${e.message}", e)
                return@addSnapshotListener
            }
            if (snapshot != null && snapshot.exists()) {
                snapshot.data?.let {
                    togetherKey = it["apiKey"] as? String ?: ""
                    Log.d(TAG, "✅ Together key loaded: ${togetherKey.take(10)}...")
                }
            } else {
                Log.e(TAG, "❌ Together dokument ne postoji!")
            }
        }

        // DeepSeek API Key
        val deepseekDocRef = firestore.collection(FirebaseConstant.API_KEY_COLLECTION).document(FirebaseConstant.API_KEY_DEEPSEEK_DOCUMENT)
        Log.d(TAG, "🔍 DeepSeek dokument path: ${FirebaseConstant.API_KEY_COLLECTION}/${FirebaseConstant.API_KEY_DEEPSEEK_DOCUMENT}")

        deepseekKeyListener?.remove()
        deepseekKeyListener = deepseekDocRef.addSnapshotListener { snapshot, e ->
            if (e != null) {
                Log.e(TAG, "❌ DeepSeek listen failed: ${e.message}", e)
                return@addSnapshotListener
            }

            if (snapshot != null && snapshot.exists()) {
                Log.d(TAG, "✅ DeepSeek dokument postoji")
                snapshot.data?.let { data ->
                    val key1 = data["apiKey"] as? String
                    val key2 = data["key"] as? String

                    deepseekKey = key1 ?: key2 ?: ""

                    if (deepseekKey.isNotEmpty()) {
                        Log.d(TAG, "✅ DeepSeek key učitan: ${deepseekKey.take(15)}... (duljina: ${deepseekKey.length})")
                    } else {
                        Log.e(TAG, "❌ DeepSeek key je prazan!")
                    }
                }
            } else {
                Log.e(TAG, "❌ DeepSeek dokument ne postoji!")
            }
        }

        // Gemini API Key
        val geminiDocRef = firestore.collection(FirebaseConstant.API_KEY_COLLECTION).document(FirebaseConstant.API_KEY_GEMINI_DOCUMENT)
        Log.d(TAG, "🔍 Gemini dokument path: ${FirebaseConstant.API_KEY_COLLECTION}/${FirebaseConstant.API_KEY_GEMINI_DOCUMENT}")

        geminiKeyListener?.remove()
        geminiKeyListener = geminiDocRef.addSnapshotListener { snapshot, e ->
            if (e != null) {
                Log.e(TAG, "❌ Gemini listen failed: ${e.message}", e)
                return@addSnapshotListener
            }

            if (snapshot != null && snapshot.exists()) {
                Log.d(TAG, "✅ Gemini dokument postoji")
                snapshot.data?.let { data ->
                    val key1 = data["apiKey"] as? String
                    val key2 = data["key"] as? String

                    geminiKey = key1 ?: key2 ?: ""

                    if (geminiKey.isNotEmpty()) {
                        Log.d(TAG, "✅ Gemini key učitan: ${geminiKey.take(15)}... (duljina: ${geminiKey.length})")
                    } else {
                        Log.e(TAG, "❌ Gemini key je prazan!")
                    }
                }
            } else {
                Log.e(TAG, "❌ Gemini dokument ne postoji!")
            }
        }
    }

    // ✅ POSTOJEĆE GETTER METODE (poboljšane s logovima)
    fun getApiKey(): String {
        val loggedIn = isLoggedIn()
        val result = if (loggedIn) apiKey else ""

        Log.d(TAG, "🔑 getApiKey() pozvan:")
        Log.d(TAG, "  - Korisnik prijavljen: $loggedIn")
        Log.d(TAG, "  - API ključ prazan: ${apiKey.isEmpty()}")
        Log.d(TAG, "  - Vraćam: ${result.take(15)}...")

        if (!loggedIn) {
            Log.w(TAG, "⚠️ Korisnik nije prijavljen - vraćam prazan ključ!")
        }

        if (loggedIn && apiKey.isEmpty()) {
            Log.w(TAG, "⚠️ Korisnik je prijavljen ali API ključ je prazan!")
            Log.w(TAG, "💡 Možda connect() nije pozvan ili Firebase dokument ne postoji")
        }

        return result
    }

    fun getVisionKey(): String {
        return if (isLoggedIn()) visionKey else ""
    }

    fun getStabilityKey(): String {
        return if (isLoggedIn()) stabilityKey else ""
    }

    fun getGroqKey(): String {
        return if (isLoggedIn()) groqKey else ""
    }
    fun getChutesKey(): String? {
        return getApiKey("deepseek-chat")
    }

    fun getChutesKeyType(): String {
        return getApiKeyType("deepseek-chat") ?: "Bearer"
    }

    fun getTogetherKey(): String {
        return if (isLoggedIn()) togetherKey else ""
    }

    fun getDeepSeekKey(): String {
        return if (isLoggedIn()) deepseekKey else ""
    }

    fun getGeminiKey(): String {
        return if (isLoggedIn()) geminiKey else ""
    }

    fun disconnect() {
        Log.d(TAG, "🔌 Disconnecting API key listeners")
        keyListener?.remove()
        visionkeyListener?.remove()
        stabilitykeyListener?.remove()
        groqKeyListener?.remove()
        togetherKeyListener?.remove()
        deepseekKeyListener?.remove()
        geminiKeyListener?.remove()
    }

    private fun isLoggedIn(): Boolean {
        val loggedIn = Firebase.auth.currentUser != null
        if (!loggedIn) {
            Log.w(TAG, "⚠️ Korisnik nije prijavljen - vraćam prazan ključ")
        }
        return loggedIn
    }

    fun fetchAllModelsFromFirestore(onComplete: (List<String>) -> Unit) {
        Log.d(TAG, "🎯 Dohvaćam modele iz Firestore...")

        val currentUser = Firebase.auth.currentUser
        if (currentUser == null) {
            Log.e(TAG, "❌ Ne mogu dohvatiti modele - korisnik nije prijavljen")
            onComplete(emptyList())
            return
        }

        firestore.collection("ai_models")
            .whereEqualTo("enabled", true)
            .get()
            .addOnSuccessListener { result ->
                Log.d(TAG, "✅ Firestore modeli response uspješan")

                val modelList = result.documents.mapNotNull { doc ->
                    val name = doc.getString("modelName") ?: return@mapNotNull null
                    val value = doc.getString("modelValue") ?: return@mapNotNull null
                    val source = doc.getString("modelSource") ?: "openai"
                    val apiEndpoint = doc.getString("apiEndpoint") ?: "https://api.openai.com/v1/"

                    GPTModelInfo(
                        name = name,
                        modelValue = value,
                        modelSource = source,
                        apiEndpoint = apiEndpoint
                    )
                }

                Log.d(TAG, "🎯 Dohvaćeno ${modelList.size} modela iz Firestore")
                onComplete(modelList.map { it.name }) // ili it.value ako koristiš to

            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Greška pri dohvaćanju modela: ${e.message}")
                Log.e(TAG, "🔧 Error code: ${e::class.simpleName}")

                // Fallback lista modela
                val fallbackModels = listOf("gpt-3.5-turbo", "gpt-4", "gemini-pro")
                Log.d(TAG, "🆘 Koristim fallback modele: $fallbackModels")

                onComplete(fallbackModels)
            }
    }

    // ✅ NOVO: Status provjera za Clear Data recovery
    fun hasAnyApiKey(): Boolean {
        val hasKeys = apiKey.isNotEmpty() ||
                visionKey.isNotEmpty() ||
                groqKey.isNotEmpty() ||
                togetherKey.isNotEmpty() ||
                stabilityKey.isNotEmpty() ||
                deepseekKey.isNotEmpty() ||
                geminiKey.isNotEmpty()

        Log.d(TAG, "🔍 Ima API ključeva: $hasKeys")
        return hasKeys
    }

    fun getAvailableProviders(): List<String> {
        val providers = mutableListOf<String>()
        if (apiKey.isNotEmpty()) providers.add("OpenAI")
        if (visionKey.isNotEmpty()) providers.add("Vision")
        if (groqKey.isNotEmpty()) providers.add("Groq")
        if (togetherKey.isNotEmpty()) providers.add("Together")
        if (stabilityKey.isNotEmpty()) providers.add("Stability")
        if (deepseekKey.isNotEmpty()) providers.add("DeepSeek")
        if (geminiKey.isNotEmpty()) providers.add("Gemini")

        Log.d(TAG, "📋 Dostupni provideri: $providers")
        return providers
    }

    // ✅ NOVO: Force reconnect za Clear Data recovery
    fun forceReconnect() {
        Log.d(TAG, "🔄 Force reconnect pokrenuto...")

        // Provjeri je li korisnik prijavljen
        val currentUser = Firebase.auth.currentUser
        if (currentUser == null) {
            Log.e(TAG, "❌ Ne mogu reconnect - korisnik nije prijavljen!")
            return
        }

        // Očisti postojeće ključeve
        apiKey = ""
        visionKey = ""
        groqKey = ""
        togetherKey = ""
        stabilityKey = ""
        deepseekKey = ""
        geminiKey = ""

        // Ukloni postojeće listenere
        disconnect()

        // Pokreni novi connect
        connect()
    }

    // ✅ NOVO: Setter metode za Guest Mode ili manual setup
    fun setManualApiKey(newApiKey: String) {
        apiKey = newApiKey
        Log.d(TAG, "🔑 OpenAI ključ ručno postavljen (${newApiKey.length} znakova)")
    }

    fun setManualVisionKey(newVisionKey: String) {
        visionKey = newVisionKey
        Log.d(TAG, "🔑 Vision ključ ručno postavljen (${newVisionKey.length} znakova)")
    }

    fun setManualGroqKey(newGroqKey: String) {
        groqKey = newGroqKey
        Log.d(TAG, "🔑 Groq ključ ručno postavljen (${newGroqKey.length} znakova)")
    }

    fun setManualTogetherKey(newTogetherKey: String) {
        togetherKey = newTogetherKey
        Log.d(TAG, "🔑 Together ključ ručno postavljen (${newTogetherKey.length} znakova)")
    }

    fun setManualStabilityKey(newStabilityKey: String) {
        stabilityKey = newStabilityKey
        Log.d(TAG, "🔑 Stability ključ ručno postavljen (${newStabilityKey.length} znakova)")
    }

    fun setManualDeepseekKey(newDeepseekKey: String) {
        deepseekKey = newDeepseekKey
        Log.d(TAG, "🔑 DeepSeek ključ ručno postavljen (${newDeepseekKey.length} znakova)")
    }

    fun setManualGeminiKey(newGeminiKey: String) {
        geminiKey = newGeminiKey
        Log.d(TAG, "🔑 Gemini ključ ručno postavljen (${newGeminiKey.length} znakova)")
    }

    // ✅ NOVO: Debug info za troubleshooting
    fun getDebugInfo(): Map<String, Any> {
        val currentUser = Firebase.auth.currentUser

        return mapOf(
            "userLoggedIn" to (currentUser != null),
            "userUid" to (currentUser?.uid ?: "null"),
            "userEmail" to (currentUser?.email ?: "null"),
            "hasOpenAI" to apiKey.isNotEmpty(),
            "hasVision" to visionKey.isNotEmpty(),
            "hasGroq" to groqKey.isNotEmpty(),
            "hasTogether" to togetherKey.isNotEmpty(),
            "hasStability" to stabilityKey.isNotEmpty(),
            "hasDeepSeek" to deepseekKey.isNotEmpty(),
            "hasGemini" to geminiKey.isNotEmpty(),
            "availableProviders" to getAvailableProviders(),
            "openAiKeyLength" to apiKey.length,
            "groqKeyLength" to groqKey.length,
            "geminiKeyLength" to geminiKey.length,
            "totalKeysCount" to getAvailableProviders().size
        )
    }

    // ✅ NOVO: Poboljšana disconnect metoda s čišćenjem
    fun disconnectAndClear() {
        Log.d(TAG, "🔌 Disconnecting API key listeners i čišćenje ključeva")

        // Ukloni listenere
        keyListener?.remove()
        visionkeyListener?.remove()
        stabilitykeyListener?.remove()
        groqKeyListener?.remove()
        togetherKeyListener?.remove()
        deepseekKeyListener?.remove()
        geminiKeyListener?.remove()

        // Očisti ključeve
        apiKey = ""
        visionKey = ""
        groqKey = ""
        togetherKey = ""
        stabilityKey = ""
        deepseekKey = ""
        geminiKey = ""

        Log.d(TAG, "✅ Svi API key helperi disconnected i očišćeni")
    }

    // ✅ NOVO: Enhanced fetchAllModelsFromFirestore s boljim error handling
    fun fetchAllModelsFromFirestoreEnhanced(onComplete: (List<String>) -> Unit) {
        Log.d(TAG, "🎯 Dohvaćam modele iz Firestore (enhanced)...")

        val currentUser = Firebase.auth.currentUser
        if (currentUser == null) {
            Log.e(TAG, "❌ Ne mogu dohvatiti modele - korisnik nije prijavljen")
            onComplete(emptyList())
            return
        }

        firestore.collection("ai_models")
            .whereEqualTo("enabled", true)
            .get()
            .addOnSuccessListener { result ->
                Log.d(TAG, "✅ Firestore modeli response uspješan")

                val modelList = result.documents.mapNotNull { doc ->
                    val modelName = doc.getString("modelName")
                    val modelValue = doc.getString("modelValue")
                    val modelSource = doc.getString("modelSource")

                    Log.d(TAG, "📋 Model: $modelName ($modelSource)")

                    // Možete vratiti modelName ili modelValue ovisno o potrebi
                    modelName ?: doc.id
                }

                Log.d(TAG, "🎯 Dohvaćeno ${modelList.size} modela iz Firestore")
                onComplete(modelList)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Greška pri dohvaćanju modela: ${e.message}")
                Log.e(TAG, "🔧 Error code: ${e::class.simpleName}")

                // Fallback lista modela
                val fallbackModels = listOf(
                    "gpt-3.5-turbo",
                    "gpt-4",
                    "gemini-pro",
                    "llama-2-70b-chat",
                    "deepseek-chat"
                )
                Log.d(TAG, "🆘 Koristim fallback modele: $fallbackModels")

                onComplete(fallbackModels)
            }
    }

    // ✅ NOVO: Test konekcije s detaljnijim izvještajem
    fun performConnectionDiagnostics(): Map<String, Any> {
        Log.d(TAG, "🔬 === DIJAGNOSTIKA KONEKCIJE ===")

        val currentUser = Firebase.auth.currentUser
        val diagnostics = mutableMapOf<String, Any>()

        // Osnovne informacije
        diagnostics["timestamp"] = System.currentTimeMillis()
        diagnostics["userLoggedIn"] = (currentUser != null)
        diagnostics["userUid"] = (currentUser?.uid ?: "null")
        diagnostics["userEmail"] = (currentUser?.email ?: "null")

        // API ključevi status
        diagnostics["totalApiKeys"] = getAvailableProviders().size
        diagnostics["hasAnyKey"] = hasAnyApiKey()
        diagnostics["availableProviders"] = getAvailableProviders()

        // Firestore pristup test
        if (currentUser != null) {
            try {
                firestore.collection(FirebaseConstant.API_KEY_COLLECTION)
                    .document(FirebaseConstant.API_KEY_DOCUMENT)
                    .get()
                    .addOnSuccessListener { document ->
                        diagnostics["firestoreAccess"] = "SUCCESS"
                        diagnostics["documentExists"] = document.exists()

                        if (document.exists()) {
                            diagnostics["documentFields"] = document.data?.keys?.toList() ?: emptyList<String>()
                        }

                        Log.d(TAG, "🔬 Dijagnostika završena: $diagnostics")
                    }
                    .addOnFailureListener { e ->
                        diagnostics["firestoreAccess"] = "FAILED"
                        diagnostics["firestoreError"] = e.message ?: "Unknown error"

                        Log.e(TAG, "🔬 Dijagnostika - Firestore greška: ${e.message}")
                    }
            } catch (e: Exception) {
                diagnostics["firestoreAccess"] = "EXCEPTION"
                diagnostics["exception"] = e.message ?: "Unknown exception"
            }
        } else {
            diagnostics["firestoreAccess"] = "NO_USER"
        }

        Log.d(TAG, "🔬 === DIJAGNOSTIKA ZAVRŠENA ===")
        return diagnostics
    }
    fun getOpenAiKey(model: String): String {
        return when (model.lowercase()) {
            "gpt-4o" -> getOpenAi4oKey()
            "gpt-4" -> getOpenAi4Key()
            "gpt-3" -> getOpenAi35Key()
            else -> getOpenAiDefaultKey()
        }
    }

    // I definiraj funkcije po potrebi, npr:
    fun getOpenAi4oKey(): String = "sk-4o...xyz"
    fun getOpenAi4Key(): String = "sk-4...xyz"
    fun getOpenAi35Key(): String = "sk-3...xyz"
    fun getOpenAiDefaultKey(): String = ""

    fun getBaseUrl(selectedModel: GPTModelInfo?): String {
        return selectedModel?.apiEndpoint ?: "https://api.openai.com/v1/" // fallback
    }
    fun getDefaultBaseUrl(): String {
        return "https://api.openai.com/v1/"
    }
    fun getApiKeyType(modelId: String): String? {
        return modelMap[modelId]?.apiKeyType
    }
    data class ApiKeyModel(
        val apiKey: String = "",
        val apiKeyType: String = "Bearer"
    )
    fun getApiKey(modelId: String): String? {
        return modelMap[modelId]?.apiKey
    }

}