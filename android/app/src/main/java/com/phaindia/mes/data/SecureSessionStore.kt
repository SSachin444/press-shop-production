package com.phaindia.mes.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.phaindia.mes.model.AppRole
import com.phaindia.mes.model.AuthSession
import com.phaindia.mes.model.PendingSubmission
import com.phaindia.mes.model.UserProfile
import org.json.JSONArray
import org.json.JSONObject

interface SessionStore {
    fun loadSession(): AuthSession?
    fun saveSession(session: AuthSession)
    fun clearSession()
    fun loadQueue(): List<PendingSubmission>
    fun saveQueue(items: List<PendingSubmission>)
}

class EncryptedSessionStore(context: Context) : SessionStore {
    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "pha_secure_session_v2",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    init {
        // Purge any legacy insecure Capacitor preferences if present
        context.deleteSharedPreferences("CapacitorStorage")
    }

    override fun loadSession(): AuthSession? {
        val raw = prefs.getString(KEY_SESSION, null) ?: return null
        return try {
            val obj = JSONObject(raw)
            val expiresAt = obj.optLong("expiresAtEpochMs", 0L)
            if (expiresAt > 0L && System.currentTimeMillis() > expiresAt) {
                clearSession()
                return null
            }
            val u = obj.getJSONObject("user")
            val role = AppRole.fromWireName(u.optString("role")) ?: return null
            AuthSession(
                user = UserProfile(
                    id = u.optString("id"),
                    username = u.optString("username"),
                    fullName = u.optString("fullName"),
                    role = role,
                    department = u.optString("department", "Press Shop MFG-2"),
                    mustChangePassword = u.optBoolean("mustChangePassword", false),
                    recoveryEmail = u.optString("recoveryEmail"),
                    recoveryEmailVerified = u.optBoolean("recoveryEmailVerified", false),
                    isActive = u.optBoolean("isActive", true),
                ),
                token = obj.optString("token"),
                mode = obj.optString("mode", "supabase"),
                expiresAtEpochMs = expiresAt,
            )
        } catch (_: Exception) {
            clearSession()
            null
        }
    }

    override fun saveSession(session: AuthSession) {
        val uObj = JSONObject()
            .put("id", session.user.id)
            .put("username", session.user.username)
            .put("fullName", session.user.fullName)
            .put("role", session.user.role.wireName)
            .put("department", session.user.department)
            .put("mustChangePassword", session.user.mustChangePassword)
            .put("recoveryEmail", session.user.recoveryEmail)
            .put("recoveryEmailVerified", session.user.recoveryEmailVerified)
            .put("isActive", session.user.isActive)

        val root = JSONObject()
            .put("user", uObj)
            .put("token", session.token)
            .put("mode", session.mode)
            .put("expiresAtEpochMs", session.expiresAtEpochMs)

        prefs.edit().putString(KEY_SESSION, root.toString()).apply()
    }

    override fun clearSession() {
        prefs.edit().remove(KEY_SESSION).apply()
    }

    override fun loadQueue(): List<PendingSubmission> {
        val raw = prefs.getString(KEY_QUEUE, null) ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                PendingSubmission(
                    clientSubmissionId = o.getString("clientSubmissionId"),
                    plantId = o.optString("plantId", "Plant 1"),
                    date = o.getString("date"),
                    shift = o.getString("shift"),
                    machineOrLine = o.getString("machineOrLine"),
                    toolNumber = o.optString("toolNumber"),
                    operatorName = o.optString("operatorName"),
                    hourInterval = o.getString("hourInterval"),
                    targetUph = o.optInt("targetUph", 10),
                    actualQty = o.optInt("actualQty", 0),
                    rejectedQty = o.optInt("rejectedQty", 0),
                    downtimeMinutes = o.optInt("downtimeMinutes", 0),
                    downtimeCode = o.optString("downtimeCode", "D01"),
                    downtimeReason = o.optString("downtimeReason"),
                    remarks = o.optString("remarks"),
                    queuedAt = o.optString("queuedAt"),
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    override fun saveQueue(items: List<PendingSubmission>) {
        val arr = JSONArray()
        items.forEach { item ->
            arr.put(
                JSONObject()
                    .put("clientSubmissionId", item.clientSubmissionId)
                    .put("plantId", item.plantId)
                    .put("date", item.date)
                    .put("shift", item.shift)
                    .put("machineOrLine", item.machineOrLine)
                    .put("toolNumber", item.toolNumber)
                    .put("operatorName", item.operatorName)
                    .put("hourInterval", item.hourInterval)
                    .put("targetUph", item.targetUph)
                    .put("actualQty", item.actualQty)
                    .put("rejectedQty", item.rejectedQty)
                    .put("downtimeMinutes", item.downtimeMinutes)
                    .put("downtimeCode", item.downtimeCode)
                    .put("downtimeReason", item.downtimeReason)
                    .put("remarks", item.remarks)
                    .put("queuedAt", item.queuedAt)
            )
        }
        prefs.edit().putString(KEY_QUEUE, arr.toString()).apply()
    }

    companion object {
        private const val KEY_SESSION = "verified_session"
        private const val KEY_QUEUE = "pending_submissions"
    }
}
