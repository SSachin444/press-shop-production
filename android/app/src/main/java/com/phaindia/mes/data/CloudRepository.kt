package com.phaindia.mes.data

import com.phaindia.mes.BuildConfig
import com.phaindia.mes.domain.MetricsEngine
import com.phaindia.mes.model.AppRole
import com.phaindia.mes.model.AttendanceMark
import com.phaindia.mes.model.AuditLogRow
import com.phaindia.mes.model.AuthSession
import com.phaindia.mes.model.ConnectionDiagnostic
import com.phaindia.mes.model.DowntimeCode
import com.phaindia.mes.model.Employee
import com.phaindia.mes.model.Machine
import com.phaindia.mes.model.MachineDowntime
import com.phaindia.mes.model.PendingSubmission
import com.phaindia.mes.model.ProductionRecord
import com.phaindia.mes.model.RecoveryAuditRow
import com.phaindia.mes.model.RolePolicy
import com.phaindia.mes.model.ShiftHandover
import com.phaindia.mes.model.ToolPlan
import com.phaindia.mes.model.UserAccountRow
import com.phaindia.mes.model.UserProfile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class ApiException(val statusCode: Int, message: String, val isConflict: Boolean = false) : Exception(message)

data class OperationalBundle(
    val machines: List<Machine>,
    val records: List<ProductionRecord>,
    val downtimes: List<MachineDowntime>,
    val downtimeCodes: List<DowntimeCode>,
)

class CloudRepository(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build(),
    private val supabaseUrl: String = BuildConfig.SUPABASE_URL.trim().trimEnd('/'),
    private val supabaseAnonKey: String = BuildConfig.SUPABASE_ANON_KEY.trim(),
    private val apiBaseUrl: String = BuildConfig.API_BASE_URL.trim().trimEnd('/'),
) {
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()
    val usesRestBackend: Boolean get() = apiBaseUrl.isNotBlank()
    val isSupabaseConfigured: Boolean
        get() = supabaseUrl.startsWith("https://") && supabaseUrl.contains(".supabase.co") && supabaseAnonKey.length > 20

    fun configuredHostDisplay(): String =
        if (usesRestBackend) apiBaseUrl else if (isSupabaseConfigured) supabaseUrl.removePrefix("https://") else "Not configured"

    private fun mapAuthEmail(username: String): String {
        val clean = username.trim().lowercase()
        return if (clean.contains("@")) clean else "$clean@phaindia.internal"
    }

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    private fun executeJson(request: Request): Pair<Int, String> {
        client.newCall(request).execute().use { resp ->
            val body = resp.body?.string() ?: ""
            return resp.code to body
        }
    }

    private fun parseError(code: Int, body: String, fallback: String): ApiException {
        return try {
            val o = JSONObject(body)
            val msg = o.optString("error").ifBlank { o.optString("message").ifBlank { o.optString("msg") } }
            val conflict = code == 409 || o.optBoolean("conflict", false)
            ApiException(code, msg.ifBlank { "$fallback (HTTP $code)" }, conflict)
        } catch (_: Exception) {
            ApiException(code, "$fallback (HTTP $code)", code == 409)
        }
    }

    private fun restReq(path: String, method: String = "GET", token: String = "", bodyJson: JSONObject? = null): JSONObject {
        val builder = Request.Builder().url("$apiBaseUrl$path")
        if (token.isNotBlank()) builder.header("Authorization", "Bearer $token")
        if (method == "GET" || method == "DELETE") {
            builder.method(method, null)
        } else {
            val payload = (bodyJson ?: JSONObject()).toString().toRequestBody(jsonMedia)
            builder.method(method, payload)
        }
        val (code, body) = executeJson(builder.build())
        if (code !in 200..299) throw parseError(code, body, "Request failed")
        return if (body.isBlank()) JSONObject() else JSONObject(body)
    }

    private fun supaGetArray(table: String, query: String, token: String): JSONArray {
        val auth = token.ifBlank { supabaseAnonKey }
        val req = Request.Builder()
            .url("$supabaseUrl/rest/v1/$table?$query")
            .header("apikey", supabaseAnonKey)
            .header("Authorization", "Bearer $auth")
            .get()
            .build()
        val (code, body) = executeJson(req)
        if (code !in 200..299) throw parseError(code, body, "Cloud query failed")
        return if (body.isBlank()) JSONArray() else JSONArray(body)
    }

    private fun supaInvokeFn(fnName: String, bodyJson: JSONObject, token: String): JSONObject {
        val auth = token.ifBlank { supabaseAnonKey }
        val req = Request.Builder()
            .url("$supabaseUrl/functions/v1/$fnName")
            .header("apikey", supabaseAnonKey)
            .header("Authorization", "Bearer $auth")
            .post(bodyJson.toString().toRequestBody(jsonMedia))
            .build()
        val (code, body) = executeJson(req)
        if (code !in 200..299) throw parseError(code, body, "Edge function failed")
        val obj = if (body.isBlank()) JSONObject() else JSONObject(body)
        if (obj.has("error") && obj.optString("error").isNotBlank()) {
            throw ApiException(code, obj.optString("error"))
        }
        return obj
    }

    private fun supaRpc(fnName: String, bodyJson: JSONObject, token: String): JSONObject {
        val auth = token.ifBlank { supabaseAnonKey }
        val req = Request.Builder()
            .url("$supabaseUrl/rest/v1/rpc/$fnName")
            .header("apikey", supabaseAnonKey)
            .header("Authorization", "Bearer $auth")
            .post(bodyJson.toString().toRequestBody(jsonMedia))
            .build()
        val (code, body) = executeJson(req)
        if (code !in 200..299) throw parseError(code, body, "Cloud RPC failed")
        return if (body.isBlank() || body == "null") JSONObject() else if (body.trim().startsWith("[")) JSONObject().put("items", JSONArray(body)) else JSONObject(body)
    }

    // ---------------------------------------------------------
    // AUTHENTICATION & PASSWORD RECOVERY
    // ---------------------------------------------------------
    suspend fun loginWithPassword(role: AppRole, username: String, password: String): AuthSession = withContext(Dispatchers.IO) {
        if (!role.requiresPassword) throw ApiException(400, "Password sign-in is only for Admin and Supervisor.")
        if (username.isBlank() || password.isBlank()) throw ApiException(400, "Username and password are required.")

        if (usesRestBackend) {
            val res = restReq("/api/auth/login", "POST", "", JSONObject().put("role", role.wireName).put("username", username.trim()).put("password", password))
            val u = res.getJSONObject("user")
            val ttl = res.optLong("expires_in", 8 * 3600L)
            return@withContext AuthSession(
                user = UserProfile(
                    id = u.optString("id"),
                    username = u.optString("username"),
                    fullName = u.optString("full_name"),
                    role = AppRole.fromWireName(u.optString("role")) ?: role,
                    department = u.optString("department", "Press Shop MFG-2"),
                    mustChangePassword = u.optBoolean("must_change_password", false),
                    recoveryEmail = u.optString("recovery_email"),
                    recoveryEmailVerified = u.optBoolean("recovery_email_verified", false),
                    isActive = u.optBoolean("is_active", true),
                ),
                token = res.optString("token"),
                mode = "rest-api",
                expiresAtEpochMs = System.currentTimeMillis() + ttl * 1000L,
            )
        }

        if (!isSupabaseConfigured) throw ApiException(500, "Cloud authentication service is not configured.")
        val authReq = Request.Builder()
            .url("$supabaseUrl/auth/v1/token?grant_type=password")
            .header("apikey", supabaseAnonKey)
            .header("Content-Type", "application/json")
            .post(JSONObject().put("email", mapAuthEmail(username)).put("password", password).toString().toRequestBody(jsonMedia))
            .build()
        val (code, body) = executeJson(authReq)
        if (code !in 200..299) throw ApiException(401, "Invalid credentials.")
        val authObj = JSONObject(body)
        val accessToken = authObj.optString("access_token")
        val userId = authObj.optJSONObject("user")?.optString("id") ?: ""
        val expiresIn = authObj.optLong("expires_in", 8 * 3600L)
        if (accessToken.isBlank() || userId.isBlank()) throw ApiException(401, "Invalid credentials.")

        val arr = supaGetArray("user_profiles", "id=eq.${enc(userId)}&select=id,username,full_name,role,department,recovery_email,recovery_email_verified,must_change_password,is_active", accessToken)
        if (arr.length() == 0) throw ApiException(403, "Invalid credentials.")
        val p = arr.getJSONObject(0)
        val profileRole = AppRole.fromWireName(p.optString("role"))
        if (profileRole != role || !p.optBoolean("is_active", false)) {
            throw ApiException(403, "Invalid credentials.")
        }

        AuthSession(
            user = UserProfile(
                id = p.optString("id"),
                username = p.optString("username"),
                fullName = p.optString("full_name"),
                role = profileRole,
                department = p.optString("department", "Press Shop MFG-2"),
                mustChangePassword = p.optBoolean("must_change_password", false),
                recoveryEmail = p.optString("recovery_email"),
                recoveryEmailVerified = p.optBoolean("recovery_email_verified", false),
                isActive = p.optBoolean("is_active", true),
            ),
            token = accessToken,
            mode = "supabase",
            expiresAtEpochMs = System.currentTimeMillis() + expiresIn * 1000L,
        )
    }

    suspend fun enterUnauthenticatedRole(role: AppRole, operatorName: String = ""): AuthSession = withContext(Dispatchers.IO) {
        if (role.requiresPassword) throw ApiException(403, "Authentication required for ${role.title}.")
        if (usesRestBackend) {
            val res = restReq("/api/auth/role-session", "POST", "", JSONObject().put("role", role.wireName).put("full_name", operatorName.trim()))
            val u = res.getJSONObject("user")
            val ttl = res.optLong("expires_in", 8 * 3600L)
            return@withContext AuthSession(
                user = UserProfile(
                    id = u.optString("id"),
                    username = u.optString("username"),
                    fullName = u.optString("full_name"),
                    role = role,
                    department = "Press Shop MFG-2",
                ),
                token = res.optString("token"),
                mode = "rest-api",
                expiresAtEpochMs = System.currentTimeMillis() + ttl * 1000L,
            )
        }
        AuthSession(
            user = UserProfile(
                username = if (role == AppRole.OPERATOR) "operator" else "dashboard_kiosk",
                fullName = operatorName.trim().ifBlank { if (role == AppRole.OPERATOR) "Line Operator" else "Shopfloor Monitor" },
                role = role,
            ),
            token = "",
            mode = "supabase",
            expiresAtEpochMs = System.currentTimeMillis() + 8 * 3600L * 1000L,
        )
    }

    suspend fun signOut(session: AuthSession) = withContext(Dispatchers.IO) {
        try {
            if (usesRestBackend && session.token.isNotBlank()) {
                restReq("/api/auth/logout", "POST", session.token, JSONObject())
            }
        } catch (_: Exception) {
        }
    }

    suspend fun changePassword(session: AuthSession, currentPw: String, newPw: String): AuthSession = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canChangeOwnPassword) {
            throw ApiException(403, "Password change is restricted to Admin and Supervisor.")
        }
        if (usesRestBackend) {
            restReq("/api/auth/change-password", "POST", session.token, JSONObject().put("current_password", currentPw).put("new_password", newPw))
            return@withContext session.copy(user = session.user.copy(mustChangePassword = false))
        }
        // Re-verify current password via Supabase password grant before password update
        loginWithPassword(session.user.role, session.user.username, currentPw)
        supaInvokeFn("password-recovery", JSONObject().put("action", "complete-password-change").put("new_password", newPw), session.token)
        session.copy(user = session.user.copy(mustChangePassword = false))
    }

    suspend fun setAdminRecoveryEmail(session: AuthSession, email: String): String = withContext(Dispatchers.IO) {
        if (session.user.role != AppRole.ADMIN) throw ApiException(403, "Only Admin can configure recovery email.")
        val res = if (usesRestBackend) {
            restReq("/api/auth/recovery-email", "POST", session.token, JSONObject().put("recovery_email", email))
        } else {
            supaInvokeFn("password-recovery", JSONObject().put("action", "set-recovery-email").put("recovery_email", email), session.token)
        }
        res.optString("message", "Verification code sent to recovery email.")
    }

    suspend fun verifyAdminRecoveryEmail(session: AuthSession, code: String): AuthSession = withContext(Dispatchers.IO) {
        if (session.user.role != AppRole.ADMIN) throw ApiException(403, "Only Admin can verify recovery email.")
        if (usesRestBackend) {
            restReq("/api/auth/verify-recovery-email", "POST", session.token, JSONObject().put("code", code))
        } else {
            supaInvokeFn("password-recovery", JSONObject().put("action", "verify-recovery-email").put("code", code), session.token)
        }
        session.copy(user = session.user.copy(recoveryEmailVerified = true))
    }

    suspend fun requestPasswordReset(role: AppRole, email: String): String = withContext(Dispatchers.IO) {
        val body = JSONObject().put("role", role.wireName).put("email", email.trim())
        val res = if (usesRestBackend) {
            restReq("/api/auth/forgot-password", "POST", "", body)
        } else {
            supaInvokeFn("password-recovery", body.put("action", "request-reset"), "")
        }
        res.optString("message", "If a verified recovery email matches this account, a reset code was sent.")
    }

    suspend fun confirmPasswordReset(role: AppRole, email: String, code: String, newPw: String): String = withContext(Dispatchers.IO) {
        val body = JSONObject().put("role", role.wireName).put("email", email.trim()).put("code", code.trim()).put("new_password", newPw)
        val res = if (usesRestBackend) {
            restReq("/api/auth/reset-password", "POST", "", body)
        } else {
            supaInvokeFn("password-recovery", body.put("action", "confirm-reset"), "")
        }
        res.optString("message", "Password has been reset.")
    }

    suspend fun testConnection(session: AuthSession): ConnectionDiagnostic = withContext(Dispatchers.IO) {
        if (session.user.role != AppRole.ADMIN) throw ApiException(403, "Diagnostics reserved for Admin.")
        val t0 = System.currentTimeMillis()
        try {
            if (usesRestBackend) {
                val res = restReq("/api/health", "GET", session.token)
                return@withContext ConnectionDiagnostic(true, "rest-api", "Connected to ${res.optString("plant", "Plant 1")} (${System.currentTimeMillis() - t0} ms)")
            }
            if (!isSupabaseConfigured) return@withContext ConnectionDiagnostic(false, "unconfigured", "Supabase URL/Key not configured in build environment.")
            supaGetArray("machines", "select=machine_number&limit=1", session.token)
            ConnectionDiagnostic(true, "supabase", "Connected to Supabase Cloud (${System.currentTimeMillis() - t0} ms)")
        } catch (e: Exception) {
            ConnectionDiagnostic(false, if (usesRestBackend) "rest-api" else "supabase", e.message ?: "Connection failed")
        }
    }

    // ---------------------------------------------------------
    // OPERATIONAL BUNDLE & LIVE DATA
    // ---------------------------------------------------------
    private fun parseMachines(arr: JSONArray): List<Machine> = (0 until arr.length()).map { i ->
        val o = arr.getJSONObject(i)
        val mType = o.optString("machine_type", "NC")
        Machine(
            id = o.optLong("id", 0L),
            machineNumber = o.optString("machine_number"),
            machineType = mType,
            machineGroup = o.optString("machine_group", mType),
            plantId = o.optString("plant_id", "Plant 1"),
            tonnage = o.optDouble("tonnage", 0.0),
            productionTarget = o.optInt("production_target", 500),
            status = o.optString("status", "Idle"),
            assignedOperator = o.optString("assigned_operator"),
            maintenanceNotes = o.optString("maintenance_notes"),
            version = o.optInt("version", 1),
        )
    }

    private fun parseRecords(arr: JSONArray): List<ProductionRecord> = (0 until arr.length()).map { i ->
        val o = arr.getJSONObject(i)
        ProductionRecord(
            id = o.optLong("id", 0L),
            clientSubmissionId = o.optString("client_submission_id"),
            plantId = o.optString("plant_id", "Plant 1"),
            date = o.optString("date"),
            shift = o.optString("shift"),
            machineOrLine = o.optString("machine_or_line"),
            productionType = o.optString("production_type", "NC"),
            toolNumber = o.optString("tool_number"),
            operatorName = o.optString("operator_name"),
            hourInterval = o.optString("hour_interval"),
            targetUph = o.optInt("target_uph", 0),
            targetQty = o.optInt("target_qty", 0),
            actualQty = o.optInt("actual_qty", 0),
            goodQty = o.optInt("good_qty", 0),
            rejectedQty = o.optInt("rejected_qty", 0),
            downtimeMinutes = o.optInt("downtime_minutes", 0),
            downtimeCode = o.optString("downtime_code"),
            downtimeReason = o.optString("downtime_reason"),
            remarks = o.optString("remarks"),
            createdAt = o.optString("created_at"),
        )
    }

    private fun parseDowntimes(arr: JSONArray): List<MachineDowntime> = (0 until arr.length()).map { i ->
        val o = arr.getJSONObject(i)
        MachineDowntime(
            id = o.optLong("id", 0L),
            machineNumber = o.optString("machine_number"),
            downtimeCode = o.optString("downtime_code", "D01"),
            reason = o.optString("reason").ifBlank { o.optString("breakdown_reason") },
            operatorName = o.optString("operator_name"),
            startTime = o.optString("start_time").ifBlank { o.optString("breakdown_start") },
            date = o.optString("date"),
            shift = o.optString("shift"),
            status = o.optString("status", "Open"),
        )
    }

    suspend fun fetchOperationalBundle(session: AuthSession, date: String): OperationalBundle = coroutineScope {
        val mDef = async(Dispatchers.IO) {
            if (usesRestBackend) parseMachines(restReq("/api/machines", "GET", session.token).optJSONArray("machines") ?: JSONArray())
            else parseMachines(supaGetArray("machines", "select=*&order=machine_type.asc,machine_number.asc", session.token))
        }
        val rDef = async(Dispatchers.IO) {
            if (usesRestBackend) parseRecords(restReq("/api/production/records?date=${enc(date)}", "GET", session.token).optJSONArray("records") ?: JSONArray())
            else parseRecords(supaGetArray("production_records", "date=eq.${enc(date)}&select=*&order=created_at.desc", session.token))
        }
        val dDef = async(Dispatchers.IO) {
            if (usesRestBackend) parseDowntimes(restReq("/api/machine-downtime", "GET", session.token).optJSONArray("downtimes") ?: JSONArray())
            else parseDowntimes(supaGetArray("machine_downtime", "select=*&order=created_at.desc&limit=200", session.token))
        }
        val cDef = async(Dispatchers.IO) {
            try {
                val arr = if (usesRestBackend) restReq("/api/downtime-codes", "GET", session.token).optJSONArray("codes") ?: JSONArray()
                else supaGetArray("downtime_codes", "select=*&order=display_order.asc", session.token)
                if (arr.length() == 0) MetricsEngine.DEFAULT_DOWNTIME_CODES else (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    DowntimeCode(o.optString("code"), o.optString("name"), o.optString("description"), o.optInt("display_order", i + 1))
                }
            } catch (_: Exception) {
                MetricsEngine.DEFAULT_DOWNTIME_CODES
            }
        }
        OperationalBundle(mDef.await(), rDef.await(), dDef.await(), cDef.await())
    }

    suspend fun fetchAllRecords(session: AuthSession): List<ProductionRecord> = withContext(Dispatchers.IO) {
        if (usesRestBackend) parseRecords(restReq("/api/production/records", "GET", session.token).optJSONArray("records") ?: JSONArray())
        else parseRecords(supaGetArray("production_records", "select=*&order=created_at.desc&limit=500", session.token))
    }

    suspend fun submitProductionEntry(session: AuthSession, sub: PendingSubmission): JSONObject = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canSubmitProduction) {
            throw ApiException(403, "Read-only sessions cannot submit production entries.")
        }
        val body = JSONObject()
            .put("client_submission_id", sub.clientSubmissionId)
            .put("plant_id", sub.plantId)
            .put("date", sub.date)
            .put("shift", sub.shift)
            .put("machine_or_line", sub.machineOrLine)
            .put("tool_number", sub.toolNumber)
            .put("operator_name", sub.operatorName)
            .put("hour_interval", sub.hourInterval)
            .put("target_uph", sub.targetUph)
            .put("actual_qty", sub.actualQty)
            .put("rejected_qty", sub.rejectedQty)
            .put("downtime_minutes", sub.downtimeMinutes)
            .put("downtime_code", sub.downtimeCode)
            .put("downtime_reason", sub.downtimeReason)
            .put("remarks", sub.remarks)

        if (usesRestBackend) {
            return@withContext restReq("/api/production/hourly", "POST", session.token, body)
        }
        if (session.user.role == AppRole.OPERATOR) {
            return@withContext supaInvokeFn("operator-entry", body.put("action", "submit-production"), session.token)
        }
        val prodType = if (sub.machineOrLine.startsWith("LP") || sub.machineOrLine.startsWith("HP")) "Tandem" else "NC"
        val targetQty = sub.targetUph * 60
        val rpcBody = JSONObject()
            .put("p_client_submission_id", sub.clientSubmissionId)
            .put("p_plant_id", sub.plantId)
            .put("p_production_type", prodType)
            .put("p_machine_or_line", sub.machineOrLine)
            .put("p_date", sub.date)
            .put("p_shift", sub.shift)
            .put("p_hour_interval", sub.hourInterval)
            .put("p_operator_name", sub.operatorName)
            .put("p_tool_number", sub.toolNumber)
            .put("p_uph", sub.targetUph)
            .put("p_target_qty", targetQty)
            .put("p_actual_qty", sub.actualQty)
            .put("p_rejected_qty", sub.rejectedQty)
            .put("p_downtime_minutes", sub.downtimeMinutes)
            .put("p_downtime_code", sub.downtimeCode)
            .put("p_downtime_reason", sub.downtimeReason)
            .put("p_remarks", sub.remarks)
            .put("p_entry_time", "")
        supaRpc("submit_production_entry", rpcBody, session.token)
    }

    // ---------------------------------------------------------
    // MACHINE MANAGEMENT (ADMIN EDITS WITH CONFLICT DETECTION)
    // ---------------------------------------------------------
    suspend fun updateMachineConfig(session: AuthSession, machineNumber: String, updates: Machine, expectedVersion: Int): Unit = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canEditMachines) {
            throw ApiException(403, "Only Admin can modify machine configuration.")
        }
        if (usesRestBackend) {
            restReq(
                "/api/machines/${enc(machineNumber)}",
                "PUT",
                session.token,
                JSONObject()
                    .put("machine_number", updates.machineNumber)
                    .put("machine_type", updates.machineType)
                    .put("tonnage", updates.tonnage)
                    .put("production_target", updates.productionTarget)
                    .put("status", updates.status)
                    .put("assigned_operator", updates.assignedOperator)
                    .put("maintenance_notes", updates.maintenanceNotes)
                    .put("version", expectedVersion),
            )
            return@withContext
        }
        var targetId = updates.id
        if (targetId <= 0L) {
            val found = supaGetArray("machines", "machine_number=eq.${enc(machineNumber)}&select=id", session.token)
            if (found.length() == 0) throw ApiException(404, "Machine not found.")
            targetId = found.getJSONObject(0).getLong("id")
        }
        val res = supaRpc(
            "update_machine_config",
            JSONObject()
                .put("p_id", targetId)
                .put("p_expected_version", expectedVersion)
                .put("p_machine_number", updates.machineNumber)
                .put("p_machine_type", updates.machineType)
                .put("p_tonnage", updates.tonnage)
                .put("p_production_target", updates.productionTarget)
                .put("p_status", updates.status)
                .put("p_assigned_operator", updates.assignedOperator)
                .put("p_assigned_shift", "Shift A")
                .put("p_maintenance_notes", updates.maintenanceNotes),
            session.token,
        )
        if (res.has("conflict") && res.optBoolean("conflict")) {
            throw ApiException(409, "Conflict: machine configuration changed elsewhere. Refresh and retry.", true)
        }
    }

    suspend fun createMachine(session: AuthSession, machine: Machine): Unit = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canEditMachines) {
            throw ApiException(403, "Only Admin can create machines.")
        }
        val body = JSONObject()
            .put("machine_number", machine.machineNumber)
            .put("machine_type", machine.machineType)
            .put("tonnage", machine.tonnage)
            .put("production_target", machine.productionTarget)
            .put("status", machine.status)
            .put("assigned_operator", machine.assignedOperator)
            .put("maintenance_notes", machine.maintenanceNotes)

        if (usesRestBackend) {
            restReq("/api/machines", "POST", session.token, body)
        } else {
            val req = Request.Builder()
                .url("$supabaseUrl/rest/v1/machines")
                .header("apikey", supabaseAnonKey)
                .header("Authorization", "Bearer ${session.token}")
                .header("Content-Type", "application/json")
                .post(body.put("machine_group", machine.machineType).put("plant_id", "Plant 1").toString().toRequestBody(jsonMedia))
                .build()
            val (code, respBody) = executeJson(req)
            if (code !in 200..299) throw parseError(code, respBody, "Failed to create machine")
        }
    }

    suspend fun logMachineDowntime(session: AuthSession, machineNumber: String, code: String, reason: String, date: String, shift: String): Unit = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canSubmitProduction) throw ApiException(403, "Read-only session.")
        val body = JSONObject()
            .put("machine_number", machineNumber)
            .put("downtime_code", code)
            .put("reason", reason)
            .put("operator_name", session.user.fullName)
            .put("date", date)
            .put("shift", shift)
        if (usesRestBackend) {
            restReq("/api/machine-downtime", "POST", session.token, body)
        } else if (session.user.role == AppRole.OPERATOR) {
            supaInvokeFn("operator-entry", body.put("action", "report-downtime"), session.token)
        } else {
            val req = Request.Builder()
                .url("$supabaseUrl/rest/v1/machine_downtime")
                .header("apikey", supabaseAnonKey)
                .header("Authorization", "Bearer ${session.token}")
                .post(body.put("status", "Open").toString().toRequestBody(jsonMedia))
                .build()
            val (rc, rb) = executeJson(req)
            if (rc !in 200..299) throw parseError(rc, rb, "Unable to log breakdown")
        }
    }

    suspend fun resolveMachineDowntime(session: AuthSession, id: Long, mins: Int): Unit = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canSubmitProduction) throw ApiException(403, "Read-only session.")
        if (usesRestBackend) {
            restReq("/api/machine-downtime/$id/resolve", "PUT", session.token, JSONObject().put("duration_minutes", mins))
        } else {
            val req = Request.Builder()
                .url("$supabaseUrl/rest/v1/machine_downtime?id=eq.$id")
                .header("apikey", supabaseAnonKey)
                .header("Authorization", "Bearer ${session.token}")
                .patch(JSONObject().put("status", "Resolved").toString().toRequestBody(jsonMedia))
                .build()
            val (rc, rb) = executeJson(req)
            if (rc !in 200..299) throw parseError(rc, rb, "Unable to resolve breakdown")
        }
    }

    // ---------------------------------------------------------
    // MANPOWER, ATTENDANCE, HANDOVERS, USERS, AUDIT, SETTINGS
    // ---------------------------------------------------------
    suspend fun getEmployees(session: AuthSession): List<Employee> = withContext(Dispatchers.IO) {
        val caps = RolePolicy.capabilities(session.user.role)
        if (!caps.canManageEmployees) throw ApiException(403, "Manpower access restricted.")
        val arr = if (usesRestBackend) restReq("/api/employees", "GET", session.token).optJSONArray("employees") ?: JSONArray()
        else {
            val cols = if (caps.canViewPersonalEmployeeFields) "id,emp_id,name,department,designation,phone,email,shift,assigned_machine,status" else "id,emp_id,name,department,designation,shift,assigned_machine,status"
            supaGetArray("employees", "select=$cols&order=emp_id.asc", session.token)
        }
        (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Employee(
                id = o.optLong("id"),
                empId = o.optString("emp_id"),
                name = o.optString("name"),
                department = o.optString("department"),
                designation = o.optString("designation"),
                shift = o.optString("shift"),
                assignedMachine = o.optString("assigned_machine"),
                status = o.optString("status", "Active"),
                phone = if (caps.canViewPersonalEmployeeFields) o.optString("phone") else "",
                email = if (caps.canViewPersonalEmployeeFields) o.optString("email") else "",
            )
        }
    }

    suspend fun getAttendance(session: AuthSession, date: String, shift: String): Map<String, String> = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canManageAttendance) throw ApiException(403, "Attendance access restricted.")
        val arr = if (usesRestBackend) {
            restReq("/api/attendance?date=${enc(date)}&shift=${enc(shift)}", "GET", session.token).optJSONArray("attendance") ?: JSONArray()
        } else {
            supaGetArray("attendance", "date=eq.${enc(date)}&shift=eq.${enc(shift)}&select=emp_id,status", session.token)
        }
        val out = mutableMapOf<String, String>()
        (0 until arr.length()).forEach { i ->
            val o = arr.getJSONObject(i)
            out[o.optString("emp_id")] = o.optString("status")
        }
        out
    }

    suspend fun saveAttendance(session: AuthSession, marks: List<AttendanceMark>): Unit = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canManageAttendance) throw ApiException(403, "Attendance access restricted.")
        val arr = JSONArray()
        marks.forEach { m ->
            arr.put(JSONObject().put("emp_id", m.empId).put("date", m.date).put("shift", m.shift).put("status", m.status).put("notes", m.notes))
        }
        if (usesRestBackend) {
            restReq("/api/attendance", "POST", session.token, JSONObject().put("records", arr))
        } else {
            val req = Request.Builder()
                .url("$supabaseUrl/rest/v1/attendance?on_conflict=emp_id,date,shift")
                .header("apikey", supabaseAnonKey)
                .header("Authorization", "Bearer ${session.token}")
                .header("Prefer", "resolution=merge-duplicates")
                .post(arr.toString().toRequestBody(jsonMedia))
                .build()
            val (rc, rb) = executeJson(req)
            if (rc !in 200..299) throw parseError(rc, rb, "Unable to save attendance")
        }
    }

    suspend fun getHandovers(session: AuthSession): List<ShiftHandover> = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canManageHandovers) throw ApiException(403, "Handovers restricted.")
        val arr = if (usesRestBackend) restReq("/api/handovers", "GET", session.token).optJSONArray("handovers") ?: JSONArray()
        else supaGetArray("shift_handovers", "select=*&order=date.desc&limit=50", session.token)
        (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            ShiftHandover(
                id = o.optLong("id"),
                date = o.optString("date"),
                fromShift = o.optString("from_shift"),
                toShift = o.optString("to_shift"),
                machineSummary = o.optString("machine_summary"),
                pendingIssues = o.optString("pending_issues"),
                toolingStatus = o.optString("tooling_status"),
                safetyNotes = o.optString("safety_notes"),
                handoverBy = o.optString("handover_by"),
                status = o.optString("status", "Open"),
            )
        }
    }

    suspend fun saveHandover(session: AuthSession, h: ShiftHandover): Unit = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canManageHandovers) throw ApiException(403, "Handovers restricted.")
        val body = JSONObject()
            .put("date", h.date)
            .put("from_shift", h.fromShift)
            .put("to_shift", h.toShift)
            .put("machine_summary", h.machineSummary)
            .put("pending_issues", h.pendingIssues)
            .put("tooling_status", h.toolingStatus)
            .put("safety_notes", h.safetyNotes)
            .put("handover_by", h.handoverBy.ifBlank { session.user.fullName })
            .put("status", h.status)
        if (usesRestBackend) {
            if (h.id > 0L) restReq("/api/handovers/${h.id}", "PUT", session.token, body)
            else restReq("/api/handovers", "POST", session.token, body)
        } else {
            val req = Request.Builder()
                .url("$supabaseUrl/rest/v1/shift_handovers")
                .header("apikey", supabaseAnonKey)
                .header("Authorization", "Bearer ${session.token}")
                .header("Prefer", "resolution=merge-duplicates")
                .post((if (h.id > 0L) body.put("id", h.id) else body).toString().toRequestBody(jsonMedia))
                .build()
            val (rc, rb) = executeJson(req)
            if (rc !in 200..299) throw parseError(rc, rb, "Unable to save handover")
        }
    }

    suspend fun getPlans(session: AuthSession): List<ToolPlan> = withContext(Dispatchers.IO) {
        val arr = if (usesRestBackend) restReq("/api/plans", "GET", session.token).optJSONArray("plans") ?: JSONArray()
        else supaGetArray("machine_plans", "select=*&order=machine_number.asc,plan_index.asc", session.token)
        (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            ToolPlan(
                id = o.optLong("id"),
                machineNumber = o.optString("machine_number"),
                planIndex = o.optInt("plan_index", 1),
                toolNumber = o.optString("tool_number"),
                planQuantity = o.optInt("plan_quantity", 0),
                partName = o.optString("part_name"),
                status = o.optString("status", "Queued"),
            )
        }
    }

    suspend fun savePlan(session: AuthSession, plan: ToolPlan): Unit = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canManagePlans) throw ApiException(403, "Only Admin/Supervisor can save tool plans.")
        val body = JSONObject()
            .put("machine_number", plan.machineNumber)
            .put("plan_index", plan.planIndex)
            .put("tool_number", plan.toolNumber)
            .put("plan_quantity", plan.planQuantity)
            .put("part_name", plan.partName)
            .put("status", plan.status)
        if (usesRestBackend) {
            restReq("/api/plans", "POST", session.token, body)
        } else {
            val req = Request.Builder()
                .url("$supabaseUrl/rest/v1/machine_plans?on_conflict=machine_number,plan_index")
                .header("apikey", supabaseAnonKey)
                .header("Authorization", "Bearer ${session.token}")
                .header("Prefer", "resolution=merge-duplicates")
                .post(body.toString().toRequestBody(jsonMedia))
                .build()
            val (rc, rb) = executeJson(req)
            if (rc !in 200..299) throw parseError(rc, rb, "Unable to save tool plan")
        }
    }

    suspend fun getUsers(session: AuthSession): List<UserAccountRow> = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canManageUsers) throw ApiException(403, "Only Admin can view users.")
        val res = if (usesRestBackend) restReq("/api/users", "GET", session.token) else supaInvokeFn("admin-users", JSONObject().put("action", "list"), session.token)
        val arr = res.optJSONArray("users") ?: JSONArray()
        (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            UserAccountRow(
                id = o.optString("id"),
                username = o.optString("username"),
                fullName = o.optString("full_name"),
                role = o.optString("role"),
                mustChangePassword = o.optBoolean("must_change_password", false),
                recoveryEmail = o.optString("recovery_email"),
                recoveryEmailVerified = o.optBoolean("recovery_email_verified", false),
                isActive = o.optBoolean("is_active", true),
            )
        }
    }

    suspend fun createUser(session: AuthSession, username: String, fullName: String, role: AppRole, password: String): Unit = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canManageUsers) throw ApiException(403, "Only Admin can create users.")
        val body = JSONObject().put("username", username).put("full_name", fullName).put("role", role.wireName).put("password", password).put("must_change_password", true)
        if (usesRestBackend) restReq("/api/users", "POST", session.token, body)
        else supaInvokeFn("admin-users", body.put("action", "create"), session.token)
    }

    suspend fun getAuditLogs(session: AuthSession): Pair<List<AuditLogRow>, List<RecoveryAuditRow>> = withContext(Dispatchers.IO) {
        if (!RolePolicy.capabilities(session.user.role).canViewAuditLog) throw ApiException(403, "Audit log reserved for Admin.")
        val logsArr: JSONArray
        val recArr: JSONArray
        if (usesRestBackend) {
            val res = restReq("/api/activity-logs", "GET", session.token)
            logsArr = res.optJSONArray("logs") ?: JSONArray()
            recArr = res.optJSONArray("recovery_logs") ?: JSONArray()
        } else {
            logsArr = supaGetArray("activity_logs", "select=*&order=created_at.desc&limit=150", session.token)
            recArr = supaGetArray("recovery_audit_logs", "select=*&order=created_at.desc&limit=100", session.token)
        }
        val logs = (0 until logsArr.length()).map { i ->
            val o = logsArr.getJSONObject(i)
            AuditLogRow(o.optString("id"), o.optString("created_at"), o.optString("user_name"), o.optString("role"), o.optString("action"), o.optString("record_type"), o.optString("record_id"), o.optString("details"))
        }
        val recs = (0 until recArr.length()).map { i ->
            val o = recArr.getJSONObject(i)
            RecoveryAuditRow(o.optString("id"), o.optString("created_at"), o.optString("target_role"), o.optString("email"), o.optString("event_type"), o.optInt("success", 0) == 1 || o.optBoolean("success", false), o.optString("detail"))
        }
        logs to recs
    }
}
