package com.phaindia.mes.domain

import com.phaindia.mes.model.DowntimeCode
import com.phaindia.mes.model.HourlySlotMetric
import com.phaindia.mes.model.Machine
import com.phaindia.mes.model.MachineCounts
import com.phaindia.mes.model.MachineDowntime
import com.phaindia.mes.model.MachineMetricRow
import com.phaindia.mes.model.MetricTotals
import com.phaindia.mes.model.ProductionRecord
import com.phaindia.mes.model.UnifiedMetrics
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

data class HourSlotDef(val key: String, val span: String, val label: String, val shortLabel: String)

object MetricsEngine {
    val PLANTS = listOf("Plant 1")
    val SHIFTS = listOf("Shift A", "Shift B", "Shift C")

    val HOUR_SLOTS = listOf(
        HourSlotDef("Hour 1", "08:00 - 09:00", "Hour 1 (08:00 - 09:00)", "Hr 1"),
        HourSlotDef("Hour 2", "09:00 - 10:00", "Hour 2 (09:00 - 10:00)", "Hr 2"),
        HourSlotDef("Hour 3", "10:00 - 11:00", "Hour 3 (10:00 - 11:00)", "Hr 3"),
        HourSlotDef("Hour 4", "11:00 - 12:00", "Hour 4 (11:00 - 12:00)", "Hr 4"),
        HourSlotDef("Hour 5", "12:30 - 13:30", "Hour 5 (12:30 - 13:30)", "Hr 5"),
        HourSlotDef("Hour 6", "13:30 - 14:30", "Hour 6 (13:30 - 14:30)", "Hr 6"),
        HourSlotDef("Hour 7", "14:30 - 15:30", "Hour 7 (14:30 - 15:30)", "Hr 7"),
        HourSlotDef("Hour 8", "15:30 - 16:30", "Hour 8 (15:30 - 16:30)", "Hr 8"),
    )

    val DEFAULT_DOWNTIME_CODES = listOf(
        DowntimeCode("D01", "Machine Breakdown", "Mechanical or electrical failure", 1),
        DowntimeCode("D02", "Tool Problem", "Tool wear, breakage, or die alignment", 2),
        DowntimeCode("D03", "Material Shortage", "Raw material, blank, or coil unavailability", 3),
        DowntimeCode("D04", "Power Failure", "Electrical grid or generator fault", 4),
        DowntimeCode("D05", "Quality Problem", "Defects, burr, crack, or dimensional issues", 5),
        DowntimeCode("D06", "Other Issues", "Maintenance, safety, or miscellaneous", 6),
    )

    fun currentShiftName(now: Date = Date()): String {
        val hhmm = SimpleDateFormat("HH:mm", Locale.US).format(now)
        return when {
            hhmm >= "08:00" && hhmm < "16:30" -> "Shift A"
            hhmm >= "16:30" || hhmm < "01:00" -> "Shift B"
            else -> "Shift C"
        }
    }

    fun todayIso(now: Date = Date()): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(now)

    fun normalizeRecord(raw: ProductionRecord): ProductionRecord {
        val actual = max(0, raw.actualQty)
        val rejected = max(0, raw.rejectedQty)
        val good = if (raw.goodQty > 0 || actual == 0) max(0, raw.goodQty) else max(0, actual - rejected)
        val target = max(0, raw.targetQty)
        val dt = max(0, raw.downtimeMinutes)
        val machine = raw.machineOrLine.trim().uppercase(Locale.US)
        val type = raw.productionType.ifBlank {
            if (machine.startsWith("LP") || machine.startsWith("HP")) "Tandem" else "NC"
        }
        return raw.copy(
            plantId = raw.plantId.ifBlank { "Plant 1" },
            machineOrLine = machine,
            productionType = type,
            actualQty = actual,
            targetQty = target,
            rejectedQty = rejected,
            goodQty = good,
            downtimeMinutes = dt,
        )
    }

    fun filterRecords(
        records: List<ProductionRecord>,
        plant: String = "ALL",
        date: String = "",
        fromDate: String = "",
        toDate: String = "",
        shift: String = "ALL",
        machineGroup: String = "ALL",
        machine: String = "",
        operator: String = "",
        search: String = "",
    ): List<ProductionRecord> {
        val groupUpper = machineGroup.uppercase(Locale.US)
        val machineUpper = machine.trim().uppercase(Locale.US)
        val opLower = operator.trim().lowercase(Locale.US)
        val qLower = search.trim().lowercase(Locale.US)

        return records.asSequence()
            .map(::normalizeRecord)
            .filter { r ->
                if (plant.isNotBlank() && plant != "ALL" && r.plantId != plant) return@filter false
                if (date.isNotBlank() && r.date != date) return@filter false
                if (fromDate.isNotBlank() && r.date < fromDate) return@filter false
                if (toDate.isNotBlank() && r.date > toDate) return@filter false
                if (shift.isNotBlank() && shift != "ALL" && r.shift != shift) return@filter false
                if (groupUpper != "ALL" && r.productionType.uppercase(Locale.US) != groupUpper) return@filter false
                if (machineUpper.isNotBlank() && machineUpper != "ALL" && r.machineOrLine != machineUpper) return@filter false
                if (opLower.isNotBlank() && !r.operatorName.lowercase(Locale.US).contains(opLower)) return@filter false
                if (qLower.isNotBlank()) {
                    val hay = listOf(r.date, r.shift, r.machineOrLine, r.toolNumber, r.operatorName, r.hourInterval, r.downtimeReason, r.remarks)
                        .joinToString(" ").lowercase(Locale.US)
                    if (!hay.contains(qLower)) return@filter false
                }
                true
            }
            .toList()
    }

    private fun pct(num: Int, den: Int): Double =
        if (den <= 0) 0.0 else ((num.toDouble() / den.toDouble()) * 1000.0).roundToInt() / 10.0

    fun computeMetrics(
        records: List<ProductionRecord>,
        machines: List<Machine>,
        downtimes: List<MachineDowntime> = emptyList(),
        plant: String = "Plant 1",
        date: String = "",
        shift: String = "ALL",
        machineGroup: String = "ALL",
    ): UnifiedMetrics {
        val groupUpper = machineGroup.uppercase(Locale.US)
        val scopedMachines = machines.filter { m ->
            val plantOk = plant == "ALL" || m.plantId.ifBlank { "Plant 1" } == plant
            val groupOk = groupUpper == "ALL" || m.machineType.uppercase(Locale.US) == groupUpper
            plantOk && groupOk
        }

        val filtered = filterRecords(
            records = records,
            plant = plant,
            date = date,
            shift = shift,
            machineGroup = groupUpper,
        )

        val openDowntimes = downtimes.filter { it.status == "Open" }
        val totalActual = filtered.sumOf { it.actualQty }
        val totalTarget = filtered.sumOf { it.targetQty }
        val totalGood = filtered.sumOf { it.goodQty }
        val totalRejected = filtered.sumOf { it.rejectedQty }
        val totalDt = filtered.sumOf { it.downtimeMinutes }

        val affected = mutableSetOf<String>()
        filtered.forEach { if (it.downtimeMinutes > 0) affected += it.machineOrLine }
        openDowntimes.forEach { d ->
            if (scopedMachines.any { it.machineNumber.equals(d.machineNumber, ignoreCase = true) }) {
                affected += d.machineNumber.uppercase(Locale.US)
            }
        }

        var running = 0
        var maintenance = 0
        var stopped = 0

        val rows = scopedMachines.map { m ->
            val mNum = m.machineNumber.uppercase(Locale.US)
            val mRecs = filtered.filter { it.machineOrLine == mNum }
                .sortedWith(compareBy<ProductionRecord> { it.hourInterval }.thenBy { it.id })
            val actual = mRecs.sumOf { it.actualQty }
            val target = mRecs.sumOf { it.targetQty }
            val good = mRecs.sumOf { it.goodQty }
            val rej = mRecs.sumOf { it.rejectedQty }
            val dt = mRecs.sumOf { it.downtimeMinutes }

            val activeDt = openDowntimes.find { it.machineNumber.equals(mNum, ignoreCase = true) }
            val effStatus = when {
                activeDt != null -> "Breakdown"
                m.status.isNotBlank() -> m.status
                mRecs.isNotEmpty() -> "Running"
                else -> "Idle"
            }

            when (effStatus) {
                "Running" -> running++
                "Maintenance" -> maintenance++
                else -> stopped++
            }

            val latest = mRecs.lastOrNull()
            MachineMetricRow(
                machine = m,
                status = effStatus,
                actual = actual,
                target = target,
                good = good,
                rejected = rej,
                downtime = dt,
                achievementPct = pct(actual, target),
                operator = latest?.operatorName?.ifBlank { m.assignedOperator } ?: m.assignedOperator,
                toolNumber = latest?.toolNumber ?: "",
                recordsCount = mRecs.size,
            )
        }

        val hourlySeries = HOUR_SLOTS.map { slot ->
            val slotRecs = filtered.filter {
                it.hourInterval.contains(slot.key) || it.hourInterval.contains(slot.span)
            }
            HourlySlotMetric(
                key = slot.key,
                shortLabel = slot.shortLabel,
                label = slot.label,
                actual = slotRecs.sumOf { it.actualQty },
                target = slotRecs.sumOf { it.targetQty },
            )
        }

        return UnifiedMetrics(
            totals = MetricTotals(
                actual = totalActual,
                target = totalTarget,
                good = totalGood,
                rejected = totalRejected,
                downtimeMinutes = totalDt,
                achievementPct = pct(totalActual, totalTarget),
                qualityPct = pct(totalGood, totalActual),
                scrapPct = pct(totalRejected, totalActual),
                machinesAffected = affected.size,
                recordCount = filtered.size,
            ),
            machineCounts = MachineCounts(
                total = scopedMachines.size,
                running = running,
                maintenance = maintenance,
                stopped = stopped,
            ),
            machines = rows,
            hourlySeries = hourlySeries,
            filteredRecords = filtered,
        )
    }

    fun escapeCsvCell(value: String): String = "\"${value.replace("\"", "\"\"")}\""

    fun buildCsvDocument(rows: List<ProductionRecord>): String {
        val sb = StringBuilder("\uFEFF")
        val headers = listOf("Date", "Shift", "Machine", "Group", "Hour", "Tool No", "Operator", "Target", "Actual", "Good", "Scrap", "Downtime (min)", "Reason")
        sb.appendLine(headers.joinToString(",") { escapeCsvCell(it) })
        rows.forEach { r ->
            val cols = listOf(
                r.date, r.shift, r.machineOrLine, r.productionType, r.hourInterval,
                r.toolNumber, r.operatorName, r.targetQty.toString(), r.actualQty.toString(),
                r.goodQty.toString(), r.rejectedQty.toString(), r.downtimeMinutes.toString(), r.downtimeReason,
            )
            sb.appendLine(cols.joinToString(",") { escapeCsvCell(it) })
        }
        val totals = listOf(
            "TOTAL", "", "${rows.size} entries", "", "", "", "",
            rows.sumOf { it.targetQty }.toString(),
            rows.sumOf { it.actualQty }.toString(),
            rows.sumOf { it.goodQty }.toString(),
            rows.sumOf { it.rejectedQty }.toString(),
            rows.sumOf { it.downtimeMinutes }.toString(),
            "",
        )
        sb.appendLine(totals.joinToString(",") { escapeCsvCell(it) })
        return sb.toString()
    }
}
