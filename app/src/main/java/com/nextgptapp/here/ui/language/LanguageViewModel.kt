package com.nextgptapp.here.ui.language

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

class LanguageViewModel : ViewModel() {

    // Početni jezik iz sustava (npr. "hr", "en", "de")
    private val _selectedLanguage = MutableStateFlow(Locale.getDefault().language)
    val selectedLanguage: StateFlow<String> = _selectedLanguage.asStateFlow()

    fun setLanguage(languageCode: String) {
        _selectedLanguage.value = languageCode
        // TODO: trajna pohrana ako želiš (npr. DataStore)
    }
}
