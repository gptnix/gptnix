package com.nextgptapp.here.ui.subscription

import androidx.lifecycle.ViewModel
import com.nextgptapp.here.data.repository.PreferenceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class SubscriptionViewModel@Inject constructor(private val preferenceRepository: PreferenceRepository):ViewModel() {
    fun getCurrentLanguageCode() = preferenceRepository.getCurrentLanguageCode()
}