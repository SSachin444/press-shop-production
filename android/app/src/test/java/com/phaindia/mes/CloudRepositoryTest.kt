package com.phaindia.mes

import com.phaindia.mes.data.ApiException
import com.phaindia.mes.data.CloudRepository
import com.phaindia.mes.model.AppRole
import com.phaindia.mes.model.AuthSession
import com.phaindia.mes.model.Machine
import com.phaindia.mes.model.PendingSubmission
import com.phaindia.mes.model.UserProfile
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class CloudRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var repo: CloudRepository

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        repo = CloudRepository(
            supabaseUrl = "",
            supabaseAnonKey = "",
            apiBaseUrl = server.url("/").toString().trimEnd('/'),
        )
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun `rejects non-admin machine update locally without making api call`() = runBlocking {
        val supSession = AuthSession(user = UserProfile(username = "sup", role = AppRole.SUPERVISOR), token = "tok")
        try {
            repo.updateMachineConfig(supSession, "NC-01", Machine("NC-01", productionTarget = 700), 1)
            fail("Expected 403 ApiException")
        } catch (e: ApiException) {
            assertEquals(403, e.statusCode)
            assertEquals(0, server.requestCount)
        }
    }

    @Test
    fun `propagates 409 version conflict on stale admin machine config update`() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(409).setBody("""{"error":"Conflict: stale version","conflict":true}"""))
        val adminSession = AuthSession(user = UserProfile(username = "admin", role = AppRole.ADMIN), token = "tok")
        try {
            repo.updateMachineConfig(adminSession, "NC-01", Machine("NC-01", productionTarget = 700, version = 1), 1)
            fail("Expected conflict exception")
        } catch (e: ApiException) {
            assertTrue(e.isConflict)
            assertEquals(409, e.statusCode)
        }
    }

    @Test
    fun `transmits unique client_submission_id for idempotent hourly production submission`() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"success":true,"deduplicated":false}"""))
        val opSession = AuthSession(user = UserProfile(username = "operator", role = AppRole.OPERATOR), token = "tok")
        val sub = PendingSubmission(
            clientSubmissionId = "cid-android-123",
            plantId = "Plant 1",
            date = "2026-11-25",
            shift = "Shift A",
            machineOrLine = "NC-01",
            toolNumber = "DIE-1",
            operatorName = "Ramesh",
            hourInterval = "Hour 1 (08:00 - 09:00)",
            targetUph = 10,
            actualQty = 580,
            rejectedQty = 5,
            downtimeMinutes = 10,
            downtimeCode = "D01",
            downtimeReason = "Die check",
            remarks = "",
            queuedAt = "2026-11-25",
        )
        val res = repo.submitProductionEntry(opSession, sub)
        assertTrue(res.getBoolean("success"))
        val recorded = server.takeRequest()
        assertEquals("/api/production/hourly", recorded.path)
        assertTrue(recorded.body.readUtf8().contains("cid-android-123"))
    }
}
