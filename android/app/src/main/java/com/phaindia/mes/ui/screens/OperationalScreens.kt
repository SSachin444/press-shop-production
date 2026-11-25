package com.phaindia.mes.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.phaindia.mes.domain.MetricsEngine
import com.phaindia.mes.model.Machine
import com.phaindia.mes.model.NavDestination
import com.phaindia.mes.model.RolePolicy
import com.phaindia.mes.ui.LoadState
import com.phaindia.mes.ui.MainUiState
import com.phaindia.mes.ui.theme.PhaColors
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.math.max

@Composable
fun StatusPill(status: String) {
    val (bg, fg) = when (status) {
        "Running", "Active", "Acknowledged", "Resolved", "Sync OK" -> PhaColors.StatusOkBg to PhaColors.StatusOkInk
        "Breakdown", "Disabled", "Error", "Failed" -> PhaColors.StatusErrBg to PhaColors.StatusErrInk
        else -> PhaColors.StatusWarnBg to PhaColors.StatusWarnInk
    }
    Surface(color = bg, shape = RoundedCornerShape(999.dp)) {
        Text(
            text = status,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
        )
    }
}

@Composable
fun CompactSelectorButton(label: String, selected: String, options: List<String>, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier = modifier) {
        OutlinedButton(onClick = { expanded = true }, shape = RoundedCornerShape(6.dp), modifier = Modifier.fillMaxWidth()) {
            Text("$label: $selected", fontSize = 12.sp, maxLines = 1)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { opt ->
                DropdownMenuItem(text = { Text(opt) }, onClick = { expanded = false; onSelect(opt) })
            }
        }
    }
}

@Composable
fun SectionCard(title: String, subtitle: String = "", trailing: @Composable () -> Unit = {}, content: @Composable () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = PhaColors.Surface),
        border = BorderStroke(1.dp, PhaColors.Border),
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = PhaColors.InkPrimary)
                    if (subtitle.isNotBlank()) Text(subtitle, fontSize = 12.sp, color = PhaColors.InkMuted)
                }
                trailing()
            }
            content()
        }
    }
}

@Composable
fun DashboardScreen(
    state: MainUiState,
    onFilterChange: (String?, String?, String?, String?) -> Unit,
    onRefresh: () -> Unit,
    onNavigate: (NavDestination) -> Unit,
) {
    val metrics = remember(state.records, state.machines, state.downtimes, state.selectedPlant, state.selectedDate, state.selectedShift, state.machineGroup) {
        MetricsEngine.computeMetrics(
            records = state.records,
            machines = state.machines,
            downtimes = state.downtimes,
            plant = state.selectedPlant,
            date = state.selectedDate,
            shift = state.selectedShift,
            machineGroup = state.machineGroup,
        )
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Plant | Date | Shift | Machine group", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = PhaColors.InkMuted)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        CompactSelectorButton("Plant", state.selectedPlant, MetricsEngine.PLANTS, { onFilterChange(it, null, null, null) }, Modifier.weight(1f))
                        CompactSelectorButton("Shift", state.selectedShift, listOf("ALL") + MetricsEngine.SHIFTS, { onFilterChange(null, null, it, null) }, Modifier.weight(1f))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = state.selectedDate,
                            onValueChange = { onFilterChange(null, it, null, null) },
                            label = { Text("Date (YYYY-MM-DD)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        CompactSelectorButton("Group", state.machineGroup, listOf("ALL", "NC", "Tandem"), { onFilterChange(null, null, null, it) }, Modifier.weight(1f))
                    }
                }
            }
        }

        if (!state.isOnline || state.pendingQueue.isNotEmpty()) {
            item {
                Surface(color = PhaColors.StatusWarnBg, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(
                        if (!state.isOnline) "Offline — displaying cached snapshot. Queued items: ${state.pendingQueue.size}"
                        else "${state.pendingQueue.size} production entry(s) waiting to sync.",
                        color = PhaColors.StatusWarnInk,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(10.dp),
                    )
                }
            }
        }

        if (state.dataState == LoadState.ERROR) {
            item {
                Surface(color = PhaColors.StatusErrBg, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(state.dataError.ifBlank { "Unable to load production data." }, color = PhaColors.StatusErrInk, fontSize = 12.sp, modifier = Modifier.weight(1f))
                        TextButton(onClick = onRefresh) { Text("Retry") }
                    }
                }
            }
        }

        if (state.dataState == LoadState.LOADING) {
            item {
                SectionCard("Loading Confirmed Cloud Data...") {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = PhaColors.Accent)
                }
            }
        } else {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        KpiBox(
                            label = "ACTUAL PRODUCTION",
                            value = "${metrics.totals.actual} pcs",
                            comparison = "Target ${metrics.totals.target} (${metrics.totals.achievementPct}%)",
                            modifier = Modifier.weight(1f),
                            onClick = { onNavigate(NavDestination.PRODUCTION) },
                        )
                        KpiBox(
                            label = "GOOD PARTS & SCRAP",
                            value = "${metrics.totals.good} good",
                            comparison = "Scrap ${metrics.totals.rejected} | Quality ${metrics.totals.qualityPct}%",
                            modifier = Modifier.weight(1f),
                            onClick = { onNavigate(NavDestination.REPORTS) },
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                        KpiBox(
                            label = "MACHINE STATUS",
                            value = "${metrics.machineCounts.running}/${metrics.machineCounts.total} Run",
                            comparison = "Stopped ${metrics.machineCounts.stopped} | Maint ${metrics.machineCounts.maintenance}",
                            modifier = Modifier.weight(1f),
                            onClick = { onNavigate(NavDestination.MACHINES) },
                        )
                        KpiBox(
                            label = "DOWNTIME",
                            value = "${metrics.totals.downtimeMinutes} min",
                            comparison = "${metrics.totals.machinesAffected} machine(s) affected",
                            modifier = Modifier.weight(1f),
                            onClick = { onNavigate(NavDestination.CELL_STATUS) },
                        )
                    }
                }
            }

            item {
                SectionCard("Hourly Actual vs Target", "Shift intervals (${state.selectedDate} • ${state.selectedShift})") {
                    val maxQty = max(100, metrics.hourlySeries.maxOfOrNull { max(it.actual, it.target) } ?: 100)
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        metrics.hourlySeries.forEach { slot ->
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(slot.shortLabel, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(36.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    LinearProgressIndicator(
                                        progress = { (slot.actual.toFloat() / maxQty.toFloat()).coerceIn(0f, 1f) },
                                        modifier = Modifier.fillMaxWidth().height(8.dp),
                                        color = PhaColors.Accent,
                                        trackColor = PhaColors.Subtle,
                                    )
                                }
                                Text("${slot.actual} / ${slot.target}", fontSize = 11.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.width(78.dp))
                            }
                        }
                    }
                }
            }

            item {
                SectionCard("Live Machine Status (${metrics.machines.size})", "Tap Machines for directory") {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        metrics.machines.take(12).forEach { row ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("${row.machine.machineNumber} (${row.machine.machineType})", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                                    Text(
                                        "Op: ${row.operator.ifBlank { "-" }} • DT: ${row.downtime}m",
                                        fontSize = 12.sp,
                                        color = PhaColors.InkMuted,
                                    )
                                }
                                Text("${row.actual} / ${row.target}", fontFamily = FontFamily.Monospace, fontSize = 12.sp, modifier = Modifier.padding(end = 8.dp))
                                StatusPill(row.status)
                            }
                            HorizontalDivider(color = PhaColors.Border)
                        }
                    }
                }
            }

            item {
                SectionCard("Recent Production Activity (${metrics.filteredRecords.size})") {
                    if (metrics.filteredRecords.isEmpty()) {
                        Text("No confirmed entries for selected date/shift.", fontSize = 13.sp, color = PhaColors.InkMuted)
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            metrics.filteredRecords.take(8).forEach { rec ->
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("${rec.machineOrLine} • ${rec.hourInterval}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                        Text("${rec.operatorName.ifBlank { "-" }} • Tool: ${rec.toolNumber.ifBlank { "-" }}", fontSize = 12.sp, color = PhaColors.InkMuted)
                                    }
                                    Text("${rec.actualQty} pcs", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.padding(end = 8.dp))
                                    StatusPill("Sync OK")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun KpiBox(label: String, value: String, comparison: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = PhaColors.Surface),
        border = BorderStroke(1.dp, PhaColors.Border),
        shape = RoundedCornerShape(10.dp),
        modifier = modifier.clickable(onClick = onClick),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PhaColors.InkMuted)
            Text(value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PhaColors.InkPrimary)
            Text(comparison, fontSize = 11.sp, color = PhaColors.InkSecondary)
        }
    }
}

@Composable
fun LiveCellStatusScreen(
    state: MainUiState,
    kioskMode: Boolean,
    clockText: String,
    onRefresh: () -> Unit,
    onExitKiosk: () -> Unit,
) {
    var group by remember { mutableStateOf("ALL") }
    val metrics = remember(state.records, state.machines, state.downtimes, state.selectedPlant, state.selectedDate, state.selectedShift, group) {
        MetricsEngine.computeMetrics(state.records, state.machines, state.downtimes, state.selectedPlant, state.selectedDate, state.selectedShift, group)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(PhaColors.Canvas).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (kioskMode) {
            item {
                SectionCard(
                    title = "PHA INDIA • Live Cell Status Display",
                    subtitle = "${state.selectedPlant} • ${state.selectedDate} • ${state.selectedShift} • Synced: ${state.lastSyncedAt.ifBlank { "-" }}",
                    trailing = {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            Surface(border = BorderStroke(1.dp, PhaColors.BorderStrong), shape = RoundedCornerShape(4.dp)) {
                                Text(clockText, fontFamily = FontFamily.Monospace, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp))
                            }
                            TextButton(onClick = onExitKiosk) { Text("Exit") }
                        }
                    },
                ) {
                    Text(
                        "Read-only shopfloor monitor • Actual: ${metrics.totals.actual} / Target: ${metrics.totals.target} (${metrics.totals.achievementPct}%) • Running: ${metrics.machineCounts.running}/${metrics.machineCounts.total}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                listOf("ALL", "NC", "Tandem").forEach { g ->
                    FilterChip(selected = group == g, onClick = { group = g }, label = { Text(g) })
                }
                Spacer(modifier = Modifier.weight(1f))
                OutlinedButton(onClick = onRefresh) { Text("Refresh") }
            }
        }

        items(metrics.machines, key = { it.machine.machineNumber }) { row ->
            Card(
                colors = CardDefaults.cardColors(containerColor = PhaColors.Surface),
                border = BorderStroke(1.dp, PhaColors.Border),
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${row.machine.machineNumber} (${row.machine.tonnage.toInt()}T ${row.machine.machineType})", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                        Text("Operator: ${row.operator.ifBlank { "Unassigned" }} | Tool: ${row.toolNumber.ifBlank { "-" }}", fontSize = 12.sp, color = PhaColors.InkMuted)
                        Text("Output: ${row.actual} / ${row.target} (${row.achievementPct}%) | Good: ${row.good} | DT: ${row.downtime}m", fontSize = 12.sp, color = PhaColors.InkSecondary)
                    }
                    StatusPill(row.status)
                }
            }
        }
    }
}

@Composable
fun HourlyEntryScreen(
    state: MainUiState,
    onDateShiftChange: (String?, String?) -> Unit,
    onSubmitEntry: suspend (
        machine: String, hour: String, operatorName: String, toolNumber: String,
        targetUph: Int, actualQty: Int, rejectedQty: Int, downtimeMins: Int,
        dtCode: String, dtReason: String, remarks: String, submissionId: String,
    ) -> Pair<Boolean, String>,
) {
    val machineNames = remember(state.machines) { state.machines.map { it.machineNumber }.ifEmpty { listOf("NC-01") } }
    var selectedMachine by remember(machineNames) { mutableStateOf(machineNames.first()) }
    var selectedHour by remember { mutableStateOf(MetricsEngine.HOUR_SLOTS.first().label) }
    var operatorName by remember(state.session) {
        mutableStateOf(if (state.session?.user?.role?.wireName == "Operator") state.session.user.fullName else "")
    }
    var toolNumber by remember { mutableStateOf("") }
    // Pure string numeric fields so user can select-all, clear to "", or type cleanly
    var uphText by remember { mutableStateOf("10") }
    var actualText by remember { mutableStateOf("") }
    var rejectedText by remember { mutableStateOf("") }
    var downtimeText by remember { mutableStateOf("") }
    var dtCode by remember { mutableStateOf(state.downtimeCodes.firstOrNull()?.code ?: "D01") }
    var remarks by remember { mutableStateOf("") }
    var pendingId by remember { mutableStateOf(UUID.randomUUID().toString()) }
    var feedback by remember { mutableStateOf<Pair<Boolean, String>?>(null) }
    var saving by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val dtMins = downtimeText.toIntOrNull() ?: 0
    val uphVal = uphText.toIntOrNull() ?: 0
    val actualVal = actualText.toIntOrNull() ?: 0
    val rejectedVal = rejectedText.toIntOrNull() ?: 0
    val computedTarget = uphVal * 60
    val computedGood = max(0, actualVal - rejectedVal)

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SectionCard("Log Hourly Press Production", "Plant: ${state.selectedPlant} • ${state.selectedDate} • ${state.selectedShift}") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                CompactSelectorButton("Machine", selectedMachine, machineNames, { selectedMachine = it }, Modifier.weight(1f))
                CompactSelectorButton("Shift", state.selectedShift, MetricsEngine.SHIFTS, { onDateShiftChange(null, it) }, Modifier.weight(1f))
            }
            CompactSelectorButton("Hour", selectedHour, MetricsEngine.HOUR_SLOTS.map { it.label }, { selectedHour = it })

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(value = operatorName, onValueChange = { operatorName = it }, label = { Text("Operator Name") }, singleLine = true, modifier = Modifier.weight(1f))
                OutlinedTextField(value = toolNumber, onValueChange = { toolNumber = it }, label = { Text("Tool / Die No") }, singleLine = true, modifier = Modifier.weight(1f))
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = uphText,
                    onValueChange = { if (it.isEmpty() || it.all(Char::isDigit)) uphText = it },
                    label = { Text("Target / Min (UPH)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = actualText,
                    onValueChange = { if (it.isEmpty() || it.all(Char::isDigit)) actualText = it },
                    label = { Text("Actual Produced") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = rejectedText,
                    onValueChange = { if (it.isEmpty() || it.all(Char::isDigit)) rejectedText = it },
                    label = { Text("Rejected / Scrap") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = downtimeText,
                    onValueChange = { if (it.isEmpty() || it.all(Char::isDigit)) downtimeText = it },
                    label = { Text("Downtime (min)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
            }

            if (dtMins > 0) {
                CompactSelectorButton(
                    label = "Downtime Code",
                    selected = dtCode,
                    options = state.downtimeCodes.map { "${it.code} - ${it.name}" },
                    onSelect = { dtCode = it.substringBefore(" -").trim() },
                )
            }

            OutlinedTextField(value = remarks, onValueChange = { remarks = it }, label = { Text("Remarks (Optional)") }, modifier = Modifier.fillMaxWidth())

            Surface(color = PhaColors.Subtle, shape = RoundedCornerShape(6.dp), modifier = Modifier.fillMaxWidth()) {
                Text(
                    "Hourly Target: $computedTarget pcs • Good Parts: $computedGood pcs",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(10.dp),
                )
            }

            feedback?.let { (ok, msg) ->
                Surface(color = if (ok) PhaColors.StatusOkBg else PhaColors.StatusWarnBg, shape = RoundedCornerShape(6.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(msg, color = if (ok) PhaColors.StatusOkInk else PhaColors.StatusWarnInk, fontSize = 13.sp, modifier = Modifier.padding(10.dp))
                }
            }

            Button(
                onClick = {
                    if (actualText.isBlank()) {
                        feedback = false to "Enter actual produced quantity."
                        return@Button
                    }
                    if (rejectedVal > actualVal) {
                        feedback = false to "Rejected quantity cannot exceed actual quantity."
                        return@Button
                    }
                    if (dtMins > 480) {
                        feedback = false to "Downtime minutes cannot exceed 480."
                        return@Button
                    }
                    scope.launch {
                        saving = true
                        val codeName = if (dtMins > 0) state.downtimeCodes.find { it.code == dtCode }?.name ?: dtCode else ""
                        val res = onSubmitEntry(selectedMachine, selectedHour, operatorName, toolNumber, uphVal, actualVal, rejectedVal, dtMins, if (dtMins > 0) dtCode else "", codeName, remarks, pendingId)
                        feedback = res
                        if (res.first) {
                            actualText = ""
                            rejectedText = ""
                            downtimeText = ""
                            remarks = ""
                            pendingId = UUID.randomUUID().toString()
                        }
                        saving = false
                    }
                },
                enabled = !saving,
                colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (saving) "Syncing Entry..." else "Submit Hourly Entry")
            }
        }
    }
}

@Composable
fun MachinesScreen(
    state: MainUiState,
    onSaveMachine: suspend (String, Machine, Int) -> String?,
    onCreateMachine: suspend (Machine) -> String?,
) {
    val role = state.session?.user?.role ?: return
    val canEdit = RolePolicy.capabilities(role).canEditMachines
    var editing by remember { mutableStateOf<Machine?>(null) }
    var isAdd by remember { mutableStateOf(false) }
    var confirmSave by remember { mutableStateOf(false) }
    var numField by remember { mutableStateOf("") }
    var typeField by remember { mutableStateOf("NC") }
    var tonField by remember { mutableStateOf("") }
    var targetField by remember { mutableStateOf("") }
    var statusField by remember { mutableStateOf("Idle") }
    var opField by remember { mutableStateOf("") }
    var errField by remember { mutableStateOf("") }
    var msgField by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LazyColumn(modifier = Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (!canEdit) {
            item {
                Surface(color = PhaColors.StatusWarnBg, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Text("View-Only Directory: Only Admin can modify machine names, tonnage, or configuration.", color = PhaColors.StatusWarnInk, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
                }
            }
        } else {
            item {
                Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = {
                            isAdd = true
                            editing = Machine("")
                            numField = ""; typeField = "NC"; tonField = "500"; targetField = "500"; statusField = "Idle"; opField = ""; errField = ""
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                    ) {
                        Text("+ Add Machine")
                    }
                }
            }
        }

        if (msgField.isNotBlank()) {
            item {
                Surface(color = PhaColors.StatusOkBg, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(msgField, color = PhaColors.StatusOkInk, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
                }
            }
        }

        items(state.machines, key = { it.machineNumber }) { m ->
            Card(colors = CardDefaults.cardColors(containerColor = PhaColors.Surface), border = BorderStroke(1.dp, PhaColors.Border)) {
                Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${m.machineNumber} (${m.machineType} • ${m.tonnage.toInt()}T)", fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                        Text("Target: ${m.productionTarget} pcs • Operator: ${m.assignedOperator.ifBlank { "-" }} • v${m.version}", fontSize = 12.sp, color = PhaColors.InkMuted)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        StatusPill(m.status)
                        if (canEdit) {
                            OutlinedButton(onClick = {
                                isAdd = false
                                editing = m
                                numField = m.machineNumber
                                typeField = m.machineType
                                tonField = m.tonnage.toInt().toString()
                                targetField = m.productionTarget.toString()
                                statusField = m.status
                                opField = m.assignedOperator
                                errField = ""
                            }) {
                                Text("Edit", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    editing?.let { original ->
        AlertDialog(
            onDismissRequest = { editing = null; confirmSave = false },
            title = { Text(if (isAdd) "Add Press Machine" else if (confirmSave) "Confirm Configuration Change" else "Edit ${original.machineNumber}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (errField.isNotBlank()) Text(errField, color = PhaColors.StatusErrInk, fontSize = 12.sp)
                    if (confirmSave) {
                        Text("Save updated settings for $numField ($typeField, ${tonField}T, Target $targetField, $statusField)? This change is audited.")
                    } else {
                        OutlinedTextField(value = numField, onValueChange = { numField = it.uppercase() }, label = { Text("Machine Name / ID") }, singleLine = true)
                        CompactSelectorButton("Type", typeField, listOf("NC", "Tandem"), { typeField = it })
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = tonField,
                                onValueChange = { if (it.isEmpty() || it.all(Char::isDigit)) tonField = it },
                                label = { Text("Tonnage (T)") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f),
                            )
                            OutlinedTextField(
                                value = targetField,
                                onValueChange = { if (it.isEmpty() || it.all(Char::isDigit)) targetField = it },
                                label = { Text("Shift Target") },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.weight(1f),
                            )
                        }
                        CompactSelectorButton("Status", statusField, listOf("Running", "Idle", "Maintenance", "Breakdown"), { statusField = it })
                        OutlinedTextField(value = opField, onValueChange = { opField = it }, label = { Text("Assigned Operator") }, singleLine = true)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val ton = tonField.toDoubleOrNull()
                        val tgt = targetField.toIntOrNull()
                        if (numField.isBlank() || ton == null || tgt == null || ton < 0 || tgt < 0) {
                            errField = "Valid machine name, tonnage, and target required."
                            return@Button
                        }
                        if (!confirmSave) {
                            confirmSave = true
                            errField = ""
                            return@Button
                        }
                        scope.launch {
                            val updated = original.copy(
                                machineNumber = numField.trim(),
                                machineType = typeField,
                                tonnage = ton,
                                productionTarget = tgt,
                                status = statusField,
                                assignedOperator = opField.trim(),
                            )
                            val res = if (isAdd) onCreateMachine(updated) else onSaveMachine(original.machineNumber, updated, original.version)
                            if (res != null) {
                                errField = res
                                confirmSave = false
                            } else {
                                msgField = "Saved machine ${updated.machineNumber}."
                                editing = null
                                confirmSave = false
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PhaColors.Accent),
                ) {
                    Text(if (confirmSave) "Confirm & Save" else "Review Changes")
                }
            },
            dismissButton = {
                TextButton(onClick = { editing = null; confirmSave = false }) { Text("Cancel") }
            },
        )
    }
}
