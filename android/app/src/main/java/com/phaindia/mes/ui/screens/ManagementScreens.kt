package com.phaindia.mes.ui.screens

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.phaindia.mes.domain.MetricsEngine
import com.phaindia.mes.model.AppRole
import com.phaindia.mes.model.RolePolicy
import com.phaindia.mes.model.ShiftHandover
import com.phaindia.mes.model.ToolPlan
import com.phaindia.mes.ui.MainUiState
import com.phaindia.mes.ui.theme.PhaColors
import kotlinx.coroutines.launch

@Composable
fun ProductionOverviewScreen(
    state: MainUiState,
    onSavePlan: (ToolPlan) -> Unit,
) {
    val nc = remember(state.records, state.machines, state.downtimes, state.selectedPlant, state.selectedDate, state.selectedShift) {
        MetricsEngine.computeMetrics(state.records, state.machines, state.downtimes, state.selectedPlant, state.selectedDate, state.selectedShift, "NC")
    }
    val tandem = remember(state.records, state.machines, state.downtimes, state.selectedPlant, state.selectedDate, state.selectedShift) {
        MetricsEngine.computeMetrics(state.records, state.machines, state.downtimes, state.selectedPlant, state.selectedDate, state.selectedShift, "Tandem")
    }
    var planMachine by remember { mutableStateOf(state.machines.firstOrNull()?.machineNumber ?: "NC-01") }
    var planTool by remember { mutableStateOf("") }
    var planQty by remember { mutableStateOf("") }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            SectionCard("NC vs Tandem Production", "${state.selectedDate} • ${state.selectedShift}") {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("NC Units (${nc.machineCounts.total})", fontWeight = FontWeight.Bold)
                        Text("${nc.totals.actual} / ${nc.totals.target} (${nc.totals.achievementPct}%)", fontSize = 13.sp, color = PhaColors.InkSecondary)
                    }
                    Column {
                        Text("Tandem Lines (${tandem.machineCounts.total})", fontWeight = FontWeight.Bold)
                        Text("${tandem.totals.actual} / ${tandem.totals.target} (${tandem.totals.achievementPct}%)", fontSize = 13.sp, color = PhaColors.InkSecondary)
                    }
                }
            }
        }

        item {
            SectionCard("3-Shift Summary (${state.selectedDate})") {
                MetricsEngine.SHIFTS.forEach { s ->
                    val sm = MetricsEngine.computeMetrics(state.records, state.machines, state.downtimes, state.selectedPlant, state.selectedDate, s, "ALL")
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(s, fontWeight = FontWeight.SemiBold)
                        Text("${sm.totals.actual} / ${sm.totals.target} (${sm.totals.achievementPct}%) | DT ${sm.totals.downtimeMinutes}m", fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    }
                }
            }
        }

        item {
            SectionCard("Assign Tool Plan") {
                val names = state.machines.map { it.machineNumber }.ifEmpty { listOf("NC-01") }
                CompactSelectorButton("Machine", planMachine, names, { planMachine = it })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(value = planTool, onValueChange = { planTool = it }, label = { Text("Tool / Die No") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = planQty, onValueChange = { if (it.isEmpty() || it.all(Char::isDigit)) planQty = it }, label = { Text("Plan Qty") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.weight(1f))
                }
                Button(
                    onClick = {
                        if (planTool.isNotBlank()) {
                            onSavePlan(ToolPlan(machineNumber = planMachine, toolNumber = planTool.trim(), planQuantity = planQty.toIntOrNull() ?: 0, status = "Active"))
                            planTool = ""; planQty = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                ) {
                    Text("Save Tool Plan")
                }
            }
        }

        items(state.plans) { p ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("${p.machineNumber} • Tool ${p.toolNumber}", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                        Text("Slot #${p.planIndex} • Plan Qty: ${p.planQuantity}", fontSize = 12.sp, color = PhaColors.InkMuted)
                    }
                    StatusPill(p.status)
                }
            }
        }
    }
}

@Composable
fun ManpowerScreen(state: MainUiState) {
    val canSeePersonal = RolePolicy.capabilities(state.session?.user?.role ?: AppRole.OPERATOR).canViewPersonalEmployeeFields
    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!canSeePersonal) {
            item {
                Surface(color = PhaColors.StatusWarnBg, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Text("Operational roster only: personal contact details are hidden for Supervisor.", color = PhaColors.StatusWarnInk, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
                }
            }
        }
        items(state.employees, key = { it.empId }) { emp ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${emp.empId} — ${emp.name}", fontWeight = FontWeight.Bold)
                        Text("${emp.department} • ${emp.designation} • ${emp.shift} • Machine: ${emp.assignedMachine.ifBlank { "-" }}", fontSize = 12.sp, color = PhaColors.InkSecondary)
                        if (canSeePersonal && (emp.phone.isNotBlank() || emp.email.isNotBlank())) {
                            Text("Phone: ${emp.phone.ifBlank { "-" }} • Email: ${emp.email.ifBlank { "-" }}", fontSize = 11.sp, color = PhaColors.InkMuted)
                        }
                    }
                    StatusPill(emp.status)
                }
            }
        }
    }
}

@Composable
fun AttendanceScreen(
    state: MainUiState,
    onDateShiftChange: (String?, String?) -> Unit,
    onSaveAttendance: (Map<String, String>) -> Unit,
) {
    val localMarks = remember(state.attendanceMarks) { mutableStateMapOf<String, String>().apply { putAll(state.attendanceMarks) } }
    val statuses = listOf("Present", "Absent", "Late", "Half-Day", "On-Duty", "Week-Off")

    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            SectionCard("Shift Attendance (${state.selectedDate} • ${state.selectedShift})") {
                CompactSelectorButton("Shift", state.selectedShift, MetricsEngine.SHIFTS, { onDateShiftChange(null, it) })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(
                        onClick = { state.employees.forEach { if (!localMarks.containsKey(it.empId)) localMarks[it.empId] = "Present" } },
                        modifier = Modifier.weight(1f),
                    ) { Text("Mark Unset Present", fontSize = 12.sp) }
                    Button(
                        onClick = { onSaveAttendance(localMarks.toMap()) },
                        colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                        modifier = Modifier.weight(1f),
                    ) { Text("Save Attendance", fontSize = 12.sp) }
                }
            }
        }

        items(state.employees, key = { it.empId }) { emp ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${emp.empId} — ${emp.name}", fontWeight = FontWeight.Bold)
                        Text("${emp.department} • ${emp.assignedMachine.ifBlank { "-" }}", fontSize = 12.sp, color = PhaColors.InkMuted)
                    }
                    CompactSelectorButton("Status", localMarks[emp.empId] ?: "Unset", statuses, { localMarks[emp.empId] = it })
                }
            }
        }
    }
}

@Composable
fun HandoversScreen(
    state: MainUiState,
    onSaveHandover: (ShiftHandover) -> Unit,
) {
    var summary by remember { mutableStateOf("") }
    var issues by remember { mutableStateOf("") }
    var toShift by remember { mutableStateOf("Shift B") }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            SectionCard("Log Shift Handover") {
                CompactSelectorButton("To Shift", toShift, MetricsEngine.SHIFTS, { toShift = it })
                OutlinedTextField(value = summary, onValueChange = { summary = it }, label = { Text("Machine & Output Summary") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = issues, onValueChange = { issues = it }, label = { Text("Pending Issues / Notes") }, modifier = Modifier.fillMaxWidth())
                Button(
                    onClick = {
                        if (summary.isNotBlank() || issues.isNotBlank()) {
                            onSaveHandover(ShiftHandover(date = state.selectedDate, fromShift = state.selectedShift, toShift = toShift, machineSummary = summary, pendingIssues = issues, status = "Open"))
                            summary = ""; issues = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                ) { Text("Submit Handover") }
            }
        }

        items(state.handovers) { h ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${h.date} • ${h.fromShift} -> ${h.toShift}", fontWeight = FontWeight.Bold)
                        StatusPill(h.status)
                    }
                    if (h.machineSummary.isNotBlank()) Text("Summary: ${h.machineSummary}", fontSize = 13.sp)
                    if (h.pendingIssues.isNotBlank()) Text("Pending: ${h.pendingIssues}", fontSize = 13.sp, color = PhaColors.InkSecondary)
                    if (h.status == "Open") {
                        TextButton(onClick = { onSaveHandover(h.copy(status = "Acknowledged")) }) { Text("Acknowledge") }
                    }
                }
            }
        }
    }
}

@Composable
fun ReportsScreen(state: MainUiState) {
    val ctx = LocalContext.current
    var fromDate by remember { mutableStateOf(state.selectedDate) }
    var toDate by remember { mutableStateOf(state.selectedDate) }
    var shift by remember { mutableStateOf("ALL") }
    var group by remember { mutableStateOf("ALL") }

    val source = state.allRecords.ifEmpty { state.records }
    val rows = remember(source, state.selectedPlant, fromDate, toDate, shift, group) {
        MetricsEngine.filterRecords(source, plant = state.selectedPlant, fromDate = fromDate, toDate = toDate, shift = shift, machineGroup = group)
    }
    val totalActual = rows.sumOf { it.actualQty }
    val totalTarget = rows.sumOf { it.targetQty }
    val totalGood = rows.sumOf { it.goodQty }
    val totalDt = rows.sumOf { it.downtimeMinutes }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            SectionCard("Production Report Filters") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = fromDate, onValueChange = { fromDate = it }, label = { Text("From") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(value = toDate, onValueChange = { toDate = it }, label = { Text("To") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CompactSelectorButton("Shift", shift, listOf("ALL") + MetricsEngine.SHIFTS, { shift = it }, Modifier.weight(1f))
                    CompactSelectorButton("Group", group, listOf("ALL", "NC", "Tandem"), { group = it }, Modifier.weight(1f))
                }
                Text("Entries: ${rows.size} • Actual: $totalActual • Target: $totalTarget • Good: $totalGood • Downtime: ${totalDt}m", fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                Button(
                    onClick = {
                        val csv = MetricsEngine.buildCsvDocument(rows)
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/csv"
                            putExtra(Intent.EXTRA_SUBJECT, "PHA_PressShop_Report_${fromDate}_to_${toDate}.csv")
                            putExtra(Intent.EXTRA_TEXT, csv)
                        }
                        ctx.startActivity(Intent.createChooser(intent, "Share Production CSV Report"))
                    },
                    enabled = rows.isNotEmpty(),
                    colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                ) {
                    Text("Share / Export CSV (${rows.size} rows)")
                }
            }
        }

        items(rows) { r ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${r.date} • ${r.machineOrLine} (${r.shift})", fontWeight = FontWeight.Bold)
                        Text("${r.hourInterval} • ${r.operatorName.ifBlank { "-" }} • Tool ${r.toolNumber.ifBlank { "-" }}", fontSize = 12.sp, color = PhaColors.InkMuted)
                    }
                    Text("${r.actualQty}/${r.targetQty}", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun UsersScreen(state: MainUiState, onCreateUser: (String, String, AppRole, String) -> Unit) {
    if (state.session?.user?.role != AppRole.ADMIN) {
        Text("Admin access required.", color = PhaColors.StatusErrInk, modifier = Modifier.padding(16.dp))
        return
    }
    var username by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var role by remember { mutableStateOf(AppRole.SUPERVISOR) }
    var pw by remember { mutableStateOf("") }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            SectionCard("Create Admin / Supervisor Account") {
                OutlinedTextField(value = username, onValueChange = { username = it.trim().lowercase() }, label = { Text("Username") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Full Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                CompactSelectorButton("Role", role.title, listOf("Supervisor", "Admin"), { role = if (it == "Admin") AppRole.ADMIN else AppRole.SUPERVISOR })
                OutlinedTextField(value = pw, onValueChange = { pw = it }, label = { Text("Temporary Password (min 10 chars)") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
                Button(
                    onClick = {
                        if (username.isNotBlank() && pw.length >= 10) {
                            onCreateUser(username, fullName, role, pw)
                            username = ""; fullName = ""; pw = ""
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                ) { Text("Create Account") }
            }
        }
        items(state.users, key = { it.username }) { u ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("${u.username} (${u.role})", fontWeight = FontWeight.Bold)
                        Text("${u.fullName.ifBlank { "-" }} • Recovery: ${u.recoveryEmail.ifBlank { "Not set" }}", fontSize = 12.sp, color = PhaColors.InkMuted)
                    }
                    StatusPill(if (u.isActive) "Active" else "Disabled")
                }
            }
        }
    }
}

@Composable
fun AuditLogScreen(state: MainUiState) {
    if (state.session?.user?.role != AppRole.ADMIN) {
        Text("Admin access required.", color = PhaColors.StatusErrInk, modifier = Modifier.padding(16.dp))
        return
    }
    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("Operational & Machine Config Changes (${state.auditLogs.size})", fontWeight = FontWeight.Bold) }
        items(state.auditLogs) { l ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${l.userName} • ${l.recordType} ${l.recordId}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        StatusPill(l.action)
                    }
                    Text(l.details, fontSize = 12.sp)
                    Text(l.createdAt, fontSize = 11.sp, color = PhaColors.InkMuted)
                }
            }
        }
        item {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text("Auth & Password Recovery Events (${state.recoveryLogs.size})", fontWeight = FontWeight.Bold)
        }
        items(state.recoveryLogs) { r ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${r.targetRole} • ${r.eventType}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        StatusPill(if (r.success) "Sync OK" else "Failed")
                    }
                    Text("${r.email}: ${r.detail}", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
fun SettingsScreen(
    state: MainUiState,
    cloudHost: String,
    usesRest: Boolean,
    onRunDiagnostics: () -> Unit,
    onSaveRecoveryEmail: suspend (String) -> String,
    onVerifyRecoveryEmail: suspend (String) -> String?,
    onOpenChangePassword: () -> Unit,
) {
    if (state.session?.user?.role != AppRole.ADMIN) {
        Text("Admin access required.", color = PhaColors.StatusErrInk, modifier = Modifier.padding(16.dp))
        return
    }
    var recEmail by remember(state.session) { mutableStateOf(state.session.user.recoveryEmail) }
    var verifyCode by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            SectionCard("Admin Security & Recovery Email") {
                OutlinedButton(onClick = onOpenChangePassword) { Text("Change Admin Password") }
                OutlinedTextField(value = recEmail, onValueChange = { recEmail = it }, label = { Text("Recovery Email") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Button(
                    onClick = { scope.launch { msg = onSaveRecoveryEmail(recEmail) } },
                    colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                ) { Text("Send Recovery Verification Code") }
                OutlinedTextField(value = verifyCode, onValueChange = { verifyCode = it }, label = { Text("Verification Code") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth())
                Button(
                    onClick = { scope.launch { msg = onVerifyRecoveryEmail(verifyCode) ?: "Recovery email verified." } },
                    colors = ButtonDefaults.buttonColors(containerColor = PhaColors.InkPrimary),
                ) { Text("Verify Email Code") }
                if (msg.isNotBlank()) Text(msg, fontSize = 12.sp, color = PhaColors.InkSecondary)
            }
        }

        item {
            SectionCard("Cloud Sync Diagnostics (Admin Only)", "Build-configured endpoint (never exposed to non-Admin roles)") {
                Text("Mode: ${if (usesRest) "REST API" else "Supabase Cloud"}", fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                Text("Host: $cloudHost", fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                Button(onClick = onRunDiagnostics, colors = ButtonDefaults.buttonColors(containerColor = PhaColors.InkPrimary)) {
                    Text("Test Cloud Connection")
                }
                state.diagnostic?.let { d ->
                    Surface(color = if (d.ok) PhaColors.StatusOkBg else PhaColors.StatusErrBg, shape = RoundedCornerShape(6.dp), modifier = Modifier.fillMaxWidth()) {
                        Text(d.detail, color = if (d.ok) PhaColors.StatusOkInk else PhaColors.StatusErrInk, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
                    }
                }
            }
        }
    }
}
