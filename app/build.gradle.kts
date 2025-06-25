@Suppress("DSL_SCOPE_VIOLATION") // TODO: Remove once KTIJ-19369 is fixed
plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.kotlinAndroid)
    alias(libs.plugins.daggerHilt)
    alias(libs.plugins.kotlinKapt)
    alias(libs.plugins.playServices)
    alias(libs.plugins.crashlytics)
}

android {
    namespace = "com.nextgptapp.here"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.nextgptapp.here"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.0.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    composeOptions {
        kotlinCompilerExtensionVersion = "1.4.3"
    }
    kapt {
        correctErrorTypes = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    bundle {
        language {

            enableSplit = false
        }
    }
}

dependencies {

    implementation(libs.core.ktx)
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.activity.compose)
    implementation(platform(libs.compose.bom))
    implementation(libs.ui)
    implementation(libs.ui.graphics)
    implementation(libs.ui.tooling.preview)
    implementation(libs.material3)
    implementation(libs.material.icons)
    implementation(libs.appcompat)

// Web scraping i HTTP
    implementation("org.jsoup:jsoup:1.15.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

// JSON
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")


    // navigation
    implementation(libs.navigation.compose)
    // hilt
    implementation(libs.hilt.android)
    kapt(libs.hilt.compiler)
    implementation(libs.navigation.hilt)

    //Room Database
    implementation (libs.room.runtime)
    implementation (libs.room.ktx)
    kapt (libs.room.compiler)
    annotationProcessor (libs.room.compiler)

    // JSON Parsing
    implementation (libs.google.gson)

    // Retrofit
    implementation (libs.retrofit)
    implementation (libs.retrofit.convertor)
    implementation (libs.okhttp)
    implementation (libs.okhttp.logging)

    // Coroutines
    implementation (libs.coroutines.core)
    implementation (libs.coroutines.android)
    implementation (libs.coroutines.play.service)


    // ViewModel
    implementation (libs.lifecycle.viewmodel)
    implementation (libs.activity.compose.ktx)

    // LiveData
    implementation (libs.lifecycle.livedata)


    implementation (libs.ritchtext.common)
    implementation (libs.ritchtext.ui.material)
    implementation (libs.ritchtext.ui.material3)

    // In-App Purchase
    implementation (libs.billing.client)
    implementation (libs.billing.client.ktx)

    // AdMob
    implementation (libs.play.services.admob)
    implementation (libs.play.services.admob.lite)
    // Glide
    implementation (libs.glide)

    // Firebase
    implementation (platform(libs.firebase.bom))
    implementation (libs.firebase.auth){
        exclude( "com.google.android.gms", "play-services-safetynet")
    }
    implementation (libs.firebase.firestore)
    implementation (libs.play.services.auth)

    //splash
    implementation (libs.splash.api)

    // pdf
    implementation (libs.itext.android)

    // root detection
    implementation(libs.rootbeer.lib)

    implementation("com.google.accompanist:accompanist-permissions:0.32.0")
    implementation(libs.firebase.crashlytics)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.espresso.core)
    androidTestImplementation(platform(libs.compose.bom))
    androidTestImplementation(libs.ui.test.junit4)
    debugImplementation(libs.ui.tooling)
    debugImplementation(libs.ui.test.manifest)
    // Na dno build.gradle.kts:
    apply(plugin = "com.google.gms.google-services")
}