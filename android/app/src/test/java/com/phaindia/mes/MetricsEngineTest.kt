package com.phaindia.mes

import com.phaindia.mes.domain.MetricsEngine
import com.phaindia.mes.model.Machine
import com.phaindia.mes.model.ProductionRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MetricsEngineTest {
    @Test
    fun `computes target from filtered production records consistently without machine config skew`() {
        val machines = listOf(
            Machine(machineNumber = "NC-01", machineType = "NC", tonnage = 1000.0, productionTarget = 600, status = "Running"),
            Machine(machineNumber = "NC-02", machineType = "NC", tonnage = 800.0, productionTarget = 550, status = "Idle"),
        )
        val records = listOf(
            ProductionRecord(
                id = 1L,
                date = "2026-11-25",
                shift = "Shift A",
                machineOrLine = "NC-01",
                productionType = "NC",
                hourInterval = "Hour 1 (08:00 - 09:00)",
                actualQty = 1350,
                targetQty = 1920,
                goodQty = 1340,
                rejectedQty = 10,
                downtimeMinutes = 15,
            ),
            ProductionRecord(
                id = 2L,
                date = "2026-11-25",
                shift = "Shift A",
                machineOrLine = "NC-01",
                productionType = "NC",
                hourInterval = "Hour 2 (09:00 - 10:00)",
                actualQty = 1500,
                targetQty = 1920,
                goodQty = 1495,
                rejectedQty = 5,
                downtimeMinutes = 0,
            ),
        )

        val metrics = MetricsEngine.computeMetrics(
            records = records,
            machines = machines,
            date = "2026-11-25",
            shift = "Shift A",
            machineGroup = "ALL",
        )

        assertEquals(2850, metrics.totals.actual)
        assertEquals(3840, metrics.totals.target)
        assertEquals(74.2, metrics.totals.achievementPct, 0.05)
        assertEquals(2835, metrics.totals.good)
        assertEquals(15, metrics.totals.rejected)
        assertEquals(15, metrics.totals.downtimeMinutes)
        assertEquals(1, metrics.totals.machinesAffected)
    }

    @Test
    fun `csv export escapes quotes and includes summary row matching filtered totals`() {
        val rows = listOf(
            ProductionRecord(
                date = "2026-11-25",
                shift = "Shift A",
                machineOrLine = "NC-01",
                productionType = "NC",
                hourInterval = "Hour 1",
                operatorName = "Ramesh \"R\"",
                targetQty = 600,
                actualQty = 550,
                goodQty = 540,
                rejectedQty = 10,
                downtimeMinutes = 5,
            )
        )
        val csv = MetricsEngine.buildCsvDocument(rows)
        assertTrue(csv.contains("\"Ramesh \"\"R\"\"\""))
        assertTrue(csv.contains("\"TOTAL\""))
        assertTrue(csv.contains("\"550\""))
        assertTrue(csv.contains("\"600\""))
    }
}
