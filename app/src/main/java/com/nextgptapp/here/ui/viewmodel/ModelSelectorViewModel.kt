package com.nextgptapp.here.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nextgptapp.here.data.model.AIModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class ModelSelectorViewModel : ViewModel() {

    private val _selectedModel = MutableStateFlow<AIModel?>(null)
    val selectedModel: StateFlow<AIModel?> = _selectedModel

    fun selectModel(model: AIModel) {
        viewModelScope.launch {
            _selectedModel.emit(model)
        }
    }
}
