package com.nextgptapp.here.ui.ui_components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nextgptapp.here.data.model.GPTModelInfo
import kotlinx.coroutines.launch

@Composable
fun ModelDropdownSelector(
    models: List<GPTModelInfo>,
    selectedModelId: String?,
    onModelSelected: (GPTModelInfo) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedModel = models.find { it.id == selectedModelId }

    Column(modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp)) {
        Text("Odaberi AI model", style = MaterialTheme.typography.labelLarge)
        Spacer(modifier = Modifier.height(6.dp))
        Box {
            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                Text(text = selectedModel?.name ?: "Odaberi model...")
            }

            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier.fillMaxWidth()
            ) {
                models.forEach { model ->
                    DropdownMenuItem(
                        text = { Text(model.name) },
                        onClick = {
                            onModelSelected(model)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}
