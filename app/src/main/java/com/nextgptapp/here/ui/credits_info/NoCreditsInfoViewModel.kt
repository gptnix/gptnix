package com.nextgptapp.here.ui.credits_info

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nextgptapp.here.components.CreditHelpers
import com.nextgptapp.here.data.repository.FirebaseRepository
import com.nextgptapp.here.data.repository.PreferenceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NoCreditsInfoViewModel @Inject constructor(private val firebaseRepository: FirebaseRepository,
                                                 private val creditHelpers: CreditHelpers,private val preferenceRepository: PreferenceRepository
):ViewModel(){


    val creditsCount get() = creditHelpers.credits
    fun giveAdReward() = viewModelScope.launch {
        firebaseRepository.incrementCredits(1)
       /* if (firebaseRepository.isLoggedIn().not())
        {
            preferenceRepository.updateCredits(creditsCount.value+1)
        }
        else{
            firebaseRepository.incrementCredits(1)
        }*/
    }

}