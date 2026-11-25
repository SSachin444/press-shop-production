package com.phaindia.mes.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.phaindia.mes.data.CloudRepository
import com.phaindia.mes.model.AppRole
import com.phaindia.mes.model.UserProfile
import com.phaindia.mes.ui.theme.PhaColors
import kotlinx.coroutines.launch

@Composable
fun RoleGatewayScreen(
    repo: CloudRepository,
    onPasswordLogin: suspend (AppRole, String, String) -> String?,
    onUnauthenticatedEnter: (AppRole, String) -> Unit,
) {
    var selectedRole by remember { mutableStateOf(AppRole.OPERATOR) }
    var username by remember { mutableStateOf("operator") }
    var password by remember { mutableStateOf("") }
    var operatorName by remember { mutableStateOf("") }
    var errorMsg by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    var recoveryMode by remember { mutableStateOf(false) }
    var recEmail by remember { mutableStateOf("") }
    var recCode by remember { mutableStateOf("") }
    var recNewPw by remember { mutableStateOf("") }
    var recStepConfirm by remember { mutableStateOf(false) }
    var recMessage by remember { mutableStateOf("") }

    val scope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PhaColors.Canvas)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = PhaColors.Surface),
            border = BorderStroke(1.dp, PhaColors.Border),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Surface(
                        color = PhaColors.Accent,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.size(42.dp),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("PHA", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                    Column {
                        Text("PHA INDIA PVT. LTD.", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PhaColors.InkMuted)
                        Text("Press Shop Production System", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PhaColors.InkPrimary)
                    }
                }

                Text("Select your workspace role to continue:", fontSize = 13.sp, color = PhaColors.InkSecondary)

                // Exact 4 role choices in mandated order
                AppRole.entries.forEach { role ->
                    val isSelected = selectedRole == role
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSelected) PhaColors.AccentTint else PhaColors.Surface,
                        ),
                        border = BorderStroke(if (isSelected) 2.dp else 1.dp, if (isSelected) PhaColors.Accent else PhaColors.Border),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selectedRole = role
                                errorMsg = ""
                                recoveryMode = false
                                recMessage = ""
                                username = when (role) {
                                    AppRole.ADMIN -> "admin"
                                    AppRole.SUPERVISOR -> "supervisor"
                                    else -> ""
                                }
                            },
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                Text(role.title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = PhaColors.InkPrimary)
                                Text(
                                    if (role.requiresPassword) "Password Required" else "Direct Entry",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (role.requiresPassword) PhaColors.InkSecondary else PhaColors.StatusOkInk,
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(role.description, fontSize = 12.sp, color = PhaColors.InkSecondary)
                        }
                    }
                }

                if (errorMsg.isNotBlank()) {
                    Surface(color = PhaColors.StatusErrBg, shape = RoundedCornerShape(6.dp), modifier = Modifier.fillMaxWidth()) {
                        Text(errorMsg, color = PhaColors.StatusErrInk, fontSize = 13.sp, modifier = Modifier.padding(10.dp))
                    }
                }

                if (selectedRole.requiresPassword && !recoveryMode) {
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text("${selectedRole.title} Username or Email") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        TextButton(onClick = { recoveryMode = true; recStepConfirm = false; errorMsg = "" }) {
                            Text("Forgot password?", color = PhaColors.InkSecondary)
                        }
                        Button(
                            onClick = {
                                scope.launch {
                                    busy = true
                                    errorMsg = ""
                                    val err = onPasswordLogin(selectedRole, username, password)
                                    if (err != null) errorMsg = err
                                    busy = false
                                }
                            },
                            enabled = !busy && username.isNotBlank() && password.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                        ) {
                            if (busy) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            else Text("Sign In as ${selectedRole.title}")
                        }
                    }
                } else if (selectedRole.requiresPassword && recoveryMode) {
                    Text("Password Recovery (${selectedRole.title})", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    if (recMessage.isNotBlank()) {
                        Surface(color = PhaColors.StatusOkBg, shape = RoundedCornerShape(6.dp), modifier = Modifier.fillMaxWidth()) {
                            Text(recMessage, color = PhaColors.StatusOkInk, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
                        }
                    }
                    OutlinedTextField(
                        value = recEmail,
                        onValueChange = { recEmail = it },
                        label = { Text("Verified Recovery Email") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (recStepConfirm) {
                        OutlinedTextField(
                            value = recCode,
                            onValueChange = { recCode = it },
                            label = { Text("6-Digit Reset Code") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        OutlinedTextField(
                            value = recNewPw,
                            onValueChange = { recNewPw = it },
                            label = { Text("New Strong Password (min 10 chars)") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { recoveryMode = false; errorMsg = "" }) {
                            Text("Back")
                        }
                        Button(
                            onClick = {
                                scope.launch {
                                    busy = true
                                    errorMsg = ""
                                    try {
                                        if (!recStepConfirm) {
                                            recMessage = repo.requestPasswordReset(selectedRole, recEmail)
                                            recStepConfirm = true
                                        } else {
                                            recMessage = repo.confirmPasswordReset(selectedRole, recEmail, recCode, recNewPw)
                                            recoveryMode = false
                                        }
                                    } catch (e: Exception) {
                                        errorMsg = e.message ?: "Recovery failed."
                                    } finally {
                                        busy = false
                                    }
                                }
                            },
                            enabled = !busy && recEmail.isNotBlank(),
                            colors = ButtonDefaults.buttonColors(containerColor = PhaColors.InkPrimary),
                        ) {
                            Text(if (!recStepConfirm) "Send Reset Code" else "Reset Password")
                        }
                    }
                } else {
                    if (selectedRole == AppRole.OPERATOR) {
                        OutlinedTextField(
                            value = operatorName,
                            onValueChange = { operatorName = it },
                            label = { Text("Operator Name (Optional)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Button(
                        onClick = { onUnauthenticatedEnter(selectedRole, operatorName) },
                        colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (selectedRole == AppRole.DASHBOARD) "Launch Live Cell Display" else "Enter Operator Workspace")
                    }
                }
            }
        }
    }
}

@Composable
fun ForcedPasswordChangeDialog(
    user: UserProfile,
    onSubmit: suspend (String, String) -> String?,
    onSignOut: () -> Unit,
) {
    var currentPw by remember { mutableStateOf("") }
    var newPw by remember { mutableStateOf("") }
    var confirmPw by remember { mutableStateOf("") }
    var errorMsg by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = {},
        title = { Text("Replace Temporary Password", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "${user.fullName.ifBlank { user.username }} (${user.role.title}): Replace your initial password with a strong password (min 10 chars, upper, lower, number).",
                    fontSize = 13.sp,
                )
                if (errorMsg.isNotBlank()) {
                    Text(errorMsg, color = PhaColors.StatusErrInk, fontSize = 12.sp)
                }
                OutlinedTextField(
                    value = currentPw,
                    onValueChange = { currentPw = it },
                    label = { Text("Current Temporary Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = newPw,
                    onValueChange = { newPw = it },
                    label = { Text("New Strong Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = confirmPw,
                    onValueChange = { confirmPw = it },
                    label = { Text("Confirm New Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (newPw != confirmPw) {
                        errorMsg = "Passwords do not match."
                        return@Button
                    }
                    if (newPw.length < 10 || !newPw.any { it.isUpperCase() } || !newPw.any { it.isLowerCase() } || !newPw.any { it.isDigit() }) {
                        errorMsg = "Minimum 10 characters with upper, lower, and digit required."
                        return@Button
                    }
                    scope.launch {
                        busy = true
                        errorMsg = ""
                        val err = onSubmit(currentPw, newPw)
                        if (err != null) errorMsg = err
                        busy = false
                    }
                },
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
            ) {
                Text(if (busy) "Saving..." else "Update Password")
            }
        },
        dismissButton = {
            TextButton(onClick = onSignOut) {
                Text("Sign Out")
            }
        },
    )
}
