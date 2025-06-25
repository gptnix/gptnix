package com.nextgptapp.here.di

import com.nextgptapp.here.components.ApiKeyHelpers
import com.nextgptapp.here.components.CreditHelpers
import com.nextgptapp.here.data.repository.FirebaseRepository
import com.nextgptapp.here.data.repository.PreferenceRepository
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppFirebaseModule {
    @Singleton
    @Provides
    fun firestoreInstance(): FirebaseFirestore = Firebase.firestore

    @Singleton
    @Provides
    fun keyHelperInstance( firebaseFirestore: FirebaseFirestore): ApiKeyHelpers = ApiKeyHelpers(firebaseFirestore)

    @Singleton
    @Provides
    fun creditsHelperInstance ( firebaseFirestore: FirebaseFirestore,firebaseRepository: FirebaseRepository,preferenceRepository: PreferenceRepository) : CreditHelpers = CreditHelpers(firebaseFirestore,firebaseRepository,preferenceRepository)
}