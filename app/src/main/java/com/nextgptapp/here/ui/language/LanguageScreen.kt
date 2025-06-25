package com.nextgptapp.here.ui.language

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun LanguageScreen(
    navigateToBack: () -> Unit, // ✅ Dodano
    viewModel: LanguageViewModel = viewModel()
) {
    val selectedLang by viewModel.selectedLanguage.collectAsState()
    val languageList = listOf("hr", "en", "de", "fr", "es")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("🌐 Odaberi jezik", style = MaterialTheme.typography.titleMedium)

        languageList.forEach { lang ->
            Button(
                onClick = { viewModel.setLanguage(lang) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedLang == lang) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Text(text = lang.uppercase())
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text("✅ Trenutno odabrano: ${selectedLang.uppercase()}")

        Spacer(modifier = Modifier.height(32.dp))

        Button(onClick = { navigateToBack() }) {
            Text("🔙 Natrag")
        }
    }
}

