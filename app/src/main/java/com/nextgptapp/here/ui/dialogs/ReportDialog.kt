package com.nextgptapp.here.ui.dialogs

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.nextgptapp.here.R
import com.nextgptapp.here.components.Constants
import com.nextgptapp.here.components.click

@Composable
fun ReportAIContentDialog(
    onDismissRequest: () -> Unit,
    onSubmitReport: (String, String) -> Unit
) {
    var selectedReason by remember { mutableStateOf("") }
    var additionalDetails by remember { mutableStateOf("") }
    val context = LocalContext.current
    Dialog(onDismissRequest = { onDismissRequest() }) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.background, shape = RoundedCornerShape(12.dp))
                .padding(16.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = stringResource(R.string.report_content),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                // Reason Selection Dropdown
                Text(
                    text = "Reason",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                DropdownMenuExample(
                    options = Constants.REPORT_REASONS,
                    selectedOption = selectedReason,
                    onOptionSelected = { selectedReason = it }
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Additional Details
                Text(
                    text = "Additional Details (Optional)",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
                BasicTextField(
                    value = additionalDetails,
                    onValueChange = { additionalDetails = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp)
                        .background(MaterialTheme.colorScheme.onTertiary, RoundedCornerShape(8.dp))
                        .padding(8.dp),
                    textStyle = TextStyle(fontSize = 14.sp, color = MaterialTheme.colorScheme.onBackground),
                    cursorBrush = SolidColor(MaterialTheme.colorScheme.onBackground)
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = { onDismissRequest() }) {
                        Text("Cancel",color = MaterialTheme.colorScheme.onBackground)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(
                        onClick = {
                            if (selectedReason.isNotBlank()) {
                                onSubmitReport(selectedReason, additionalDetails)
                                onDismissRequest()
                            } else {
                                Toast.makeText(context, "Please select a reason", Toast.LENGTH_SHORT).show()
                                // Show some feedback that reason is required
                            }
                        }
                    ) {
                        Text("Submit",color = MaterialTheme.colorScheme.onBackground)
                    }
                }
            }
        }
    }
}

@Composable
fun DropdownMenuExample(
    options: List<String>,
    selectedOption: String,
    onOptionSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .click { expanded = !expanded }
                .background(MaterialTheme.colorScheme.onTertiary, shape = RoundedCornerShape(8.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Text(
                text = selectedOption.ifEmpty { "Select Reason" },
                color = MaterialTheme.colorScheme.onBackground,
                style = MaterialTheme.typography.bodyLarge
            )
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.onSecondary, RoundedCornerShape(8.dp))
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option, color = MaterialTheme.colorScheme.onBackground) },
                    onClick = {
                        onOptionSelected(option)
                        expanded = false
                    }
                )
            }
        }
    }
}