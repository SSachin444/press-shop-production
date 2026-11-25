package com.phaindia.mes.ui

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.phaindia.mes.data.CloudRepository
import com.phaindia.mes.data.EncryptedSessionStore
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
import com.phaindia.mes.model.NavDestination
import com.phaindia.mes.model.PendingSubmission
import com.phaindia.mes.model.ProductionRecord
import com.phaindia.mes.model.RecoveryAuditRow
import com.phaindia.mes.model.RolePolicy
import com.phaindia.mes.model.ShiftHandover
import com.phaindia.mes.model.ToolPlan
import com.phaindia.mes.model.UserAccountRow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

enum class LoadState { LOADING, READY, ERROR }

data class MainUiState(
    val session: AuthSession? = null,
    val activeDest: NavDestination = NavDestination.DASHBOARD,
    val routeNotice: String = "",
    val selectedPlant: String = "Plant 1",
    val selectedDate: String = MetricsEngine.todayIso(),
    val selectedShift: String = MetricsEngine.currentShiftName(),
    val machineGroup: String = "ALL",
    val dataState: LoadState = LoadState.LOADING,
    val dataError: String = "",
    val lastSyncedAt: String = "",
    val isOnline: Boolean = true,
    val machines: List<Machine> = emptyList(),
    val records: List<ProductionRecord> = emptyList(),
    val allRecords: List<ProductionRecord> = emptyList(),
    val downtimes: List<MachineDowntime> = emptyList(),
    val downtimeCodes: List<DowntimeCode> = MetricsEngine.DEFAULT_DOWNTIME_CODES,
    val pendingQueue: List<PendingSubmission> = emptyList(),
    val employees: List<Employee> = emptyList(),
    val attendanceMarks: Map<String, String> = emptyMap(),
    val handovers: List<ShiftHandover> = emptyList(),
    val plans: List<ToolPlan> = emptyList(),
    val users: List<UserAccountRow> = emptyList(),
    val auditLogs: List<AuditLogRow> = emptyList(),
    val recoveryLogs: List<RecoveryAuditRow> = emptyList(),
    val bannerMessage: String = "",
    val bannerIsError: Boolean = false,
    val diagnostic: ConnectionDiagnostic? = null,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val store by lazy { EncryptedSessionStore(application) }
    val repo = CloudRepository()

    private val _ui = MutableStateFlow(
        MainUiState(
            isOnline = checkOnline(application),
        )
    )
    val ui: StateFlow<MainUiState> = _ui.asStateFlow()

    private var refreshJob: Job? = null

    init {
        viewModelScope.launch(Dispatchers.IO) {
            val loadedSession = store.loadSession()
            val loadedQueue = store.loadQueue()
            _ui.update {
                it.copy(
                    session = loadedSession,
                    pendingQueue = loadedQueue,
                    activeDest = loadedSession?.let { s -> RolePolicy.defaultDestination(s.user.role) } ?: it.activeDest,
                )
            }
            if (loadedSession != null && !loadedSession.user.mustChangePassword) {
                startPolling()
                refreshData()
            }
        }
        registerNetworkCallback(application)
    }

    private fun checkOnline(ctx: Context): Boolean {
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun registerNetworkCallback(ctx: Context) {
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val req = NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build()
        cm.registerNetworkCallback(
            req,
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    _ui.update { it.copy(isOnline = true) }
                    flushOfflineQueue()
                }

                override fun onLost(network: Network) {
                    _ui.update { it.copy(isOnline = checkOnline(ctx)) }
                }
            },
        )
    }

    private fun startPolling() {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            while (isActive) {
                val intervalMs = if (_ui.value.session?.user?.role == AppRole.DASHBOARD) 15_000L else 45_000L
                delay(intervalMs)
                refreshData(silent = true)
            }
        }
    }

    fun clearBanner() {
        _ui.update { it.copy(bannerMessage = "", routeNotice = "") }
    }

    fun navigate(dest: NavDestination) {
        val role = _ui.value.session?.user?.role ?: return
        if (!RolePolicy.canAccess(role, dest)) {
            val fallback = RolePolicy.defaultDestination(role)
            _ui.update {
                it.copy(
                    activeDest = fallback,
                    routeNotice = "Access denied: ${dest.title} is restricted for ${role.title}.",
                )
            }
            return
        }
        _ui.update { it.copy(activeDest = dest, routeNotice = "", bannerMessage = "") }
        when (dest) {
            NavDestination.MANPOWER -> loadEmployees()
            NavDestination.ATTENDANCE -> loadAttendance()
            NavDestination.HANDOVERS -> loadHandovers()
            NavDestination.PRODUCTION -> loadPlans()
            NavDestination.REPORTS -> loadAllRecordsForReports()
            NavDestination.USERS -> loadUsers()
            NavDestination.AUDIT_LOG -> loadAuditLogs()
            else -> Unit
        }
    }

    fun setFilters(plant: String? = null, date: String? = null, shift: String? = null, group: String? = null) {
        val dateChanged = date != null && date != _ui.value.selectedDate
        val shiftChanged = shift != null && shift != _ui.value.selectedShift
        _ui.update {
            it.copy(
                selectedPlant = plant ?: it.selectedPlant,
                selectedDate = date ?: it.selectedDate,
                selectedShift = shift ?: it.selectedShift,
                machineGroup = group ?: it.machineGroup,
            )
        }
        if (dateChanged) {
            refreshData()
            if (_ui.value.activeDest == NavDestination.ATTENDANCE) loadAttendance()
        } else if (shiftChanged && _ui.value.activeDest == NavDestination.ATTENDANCE) {
            loadAttendance()
        }
    }

    suspend fun signInWithPassword(role: AppRole, username: String, password: String): String? {
        return try {
            val session = repo.loginWithPassword(role, username, password)
            store.saveSession(session)
            val defaultDest = RolePolicy.defaultDestination(session.user.role)
            _ui.update { it.copy(session = session, activeDest = defaultDest, bannerMessage = "", routeNotice = "") }
            if (!session.user.mustChangePassword) {
                startPolling()
                refreshData()
                flushOfflineQueue()
            }
            null
        } catch (e: Exception) {
            e.message ?: "Sign-in failed."
        }
    }

    fun enterUnauthenticatedRole(role: AppRole, operatorName: String) {
        viewModelScope.launch {
            try {
                val session = repo.enterUnauthenticatedRole(role, operatorName)
                store.saveSession(session)
                _ui.update { it.copy(session = session, activeDest = RolePolicy.defaultDestination(role), bannerMessage = "", routeNotice = "") }
                startPolling()
                refreshData()
                flushOfflineQueue()
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to start role session.", bannerIsError = true) }
            }
        }
    }

    suspend fun changePassword(currentPw: String, newPw: String): String? {
        val sess = _ui.value.session ?: return "Not authenticated."
        return try {
            val updated = repo.changePassword(sess, currentPw, newPw)
            store.saveSession(updated)
            _ui.update { it.copy(session = updated, bannerMessage = "Password updated.", bannerIsError = false) }
            startPolling()
            refreshData()
            null
        } catch (e: Exception) {
            e.message ?: "Unable to update password."
        }
    }

    fun signOut() {
        val sess = _ui.value.session
        refreshJob?.cancel()
        store.clearSession()
        _ui.update {
            MainUiState(pendingQueue = store.loadQueue(), isOnline = it.isOnline)
        }
        if (sess != null) {
            viewModelScope.launch { repo.signOut(sess) }
        }
    }

    fun refreshData(silent: Boolean = false) {
        val sess = _ui.value.session ?: return
        if (sess.user.mustChangePassword) return
        viewModelScope.launch {
            if (!silent) {
                _ui.update { it.copy(dataState = if (it.dataState == LoadState.READY) LoadState.READY else LoadState.LOADING, dataError = "") }
            }
            try {
                val bundle = repo.fetchOperationalBundle(sess, _ui.value.selectedDate)
                val ts = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())
                _ui.update {
                    it.copy(
                        dataState = LoadState.READY,
                        dataError = "",
                        lastSyncedAt = ts,
                        isOnline = true,
                        machines = bundle.machines,
                        records = bundle.records,
                        downtimes = bundle.downtimes,
                        downtimeCodes = bundle.downtimeCodes,
                    )
                }
            } catch (e: Exception) {
                _ui.update {
                    it.copy(
                        dataState = if (it.machines.isEmpty()) LoadState.ERROR else it.dataState,
                        dataError = e.message ?: "Cloud synchronization error.",
                    )
                }
            }
        }
    }

    suspend fun submitHourlyProduction(
        machineOrLine: String,
        hourInterval: String,
        operatorName: String,
        toolNumber: String,
        targetUph: Int,
        actualQty: Int,
        rejectedQty: Int,
        downtimeMinutes: Int,
        downtimeCode: String,
        downtimeReason: String,
        remarks: String,
        submissionId: String = UUID.randomUUID().toString(),
    ): Pair<Boolean, String> {
        val sess = _ui.value.session ?: return false to "Session expired."
        val sub = PendingSubmission(
            clientSubmissionId = submissionId,
            plantId = _ui.value.selectedPlant,
            date = _ui.value.selectedDate,
            shift = if (_ui.value.selectedShift == "ALL") "Shift A" else _ui.value.selectedShift,
            machineOrLine = machineOrLine,
            toolNumber = toolNumber,
            operatorName = operatorName,
            hourInterval = hourInterval,
            targetUph = targetUph,
            actualQty = actualQty,
            rejectedQty = rejectedQty,
            downtimeMinutes = downtimeMinutes,
            downtimeCode = downtimeCode,
            downtimeReason = downtimeReason,
            remarks = remarks,
            queuedAt = MetricsEngine.todayIso(),
        )
        return try {
            val res = repo.submitProductionEntry(sess, sub)
            val dedup = res.optBoolean("deduplicated", false)
            refreshData(silent = true)
            true to if (dedup) "Already synced earlier (duplicate prevented)." else "Saved to cloud database."
        } catch (e: IOException) {
            val queue = store.loadQueue().filterNot { it.clientSubmissionId == sub.clientSubmissionId } + sub
            store.saveQueue(queue)
            _ui.update { it.copy(pendingQueue = queue, isOnline = false) }
            false to "Network unavailable. Entry queued securely offline and will auto-sync when online."
        } catch (e: Exception) {
            false to (e.message ?: "Submission failed.")
        }
    }

    fun flushOfflineQueue() {
        val sess = _ui.value.session ?: return
        val current = store.loadQueue()
        if (current.isEmpty()) return
        viewModelScope.launch {
            val remaining = mutableListOf<PendingSubmission>()
            var synced = 0
            for (item in current) {
                try {
                    repo.submitProductionEntry(sess, item)
                    synced++
                } catch (_: Exception) {
                    remaining.add(item)
                }
            }
            store.saveQueue(remaining)
            _ui.update {
                it.copy(
                    pendingQueue = remaining,
                    bannerMessage = if (synced > 0) "Synced $synced queued production entry(s) to cloud." else it.bannerMessage,
                    bannerIsError = false,
                )
            }
            if (synced > 0) refreshData(silent = true)
        }
    }

    suspend fun saveMachineConfig(currentNumber: String, updated: Machine, expectedVersion: Int): String? {
        val sess = _ui.value.session ?: return "Session expired."
        return try {
            repo.updateMachineConfig(sess, currentNumber, updated, expectedVersion)
            refreshData(silent = true)
            null
        } catch (e: Exception) {
            e.message ?: "Failed to update machine."
        }
    }

    suspend fun createMachine(machine: Machine): String? {
        val sess = _ui.value.session ?: return "Session expired."
        return try {
            repo.createMachine(sess, machine)
            refreshData(silent = true)
            null
        } catch (e: Exception) {
            e.message ?: "Failed to add machine."
        }
    }

    fun loadEmployees() {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                val list = repo.getEmployees(sess)
                _ui.update { it.copy(employees = list) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to load manpower.", bannerIsError = true) }
            }
        }
    }

    fun loadAttendance() {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                val roster = if (_ui.value.employees.isEmpty()) repo.getEmployees(sess) else _ui.value.employees
                val shift = if (_ui.value.selectedShift == "ALL") "Shift A" else _ui.value.selectedShift
                val marks = repo.getAttendance(sess, _ui.value.selectedDate, shift)
                _ui.update { it.copy(employees = roster, attendanceMarks = marks) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to load attendance.", bannerIsError = true) }
            }
        }
    }

    fun saveAttendanceMarks(marks: Map<String, String>) {
        val sess = _ui.value.session ?: return
        val shift = if (_ui.value.selectedShift == "ALL") "Shift A" else _ui.value.selectedShift
        val rows = marks.filterValues { it.isNotBlank() }.map { (empId, status) ->
            AttendanceMark(empId = empId, date = _ui.value.selectedDate, shift = shift, status = status)
        }
        viewModelScope.launch {
            try {
                repo.saveAttendance(sess, rows)
                _ui.update { it.copy(attendanceMarks = marks, bannerMessage = "Saved attendance for ${rows.size} operators.", bannerIsError = false) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to save attendance.", bannerIsError = true) }
            }
        }
    }

    fun loadHandovers() {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                _ui.update { it.copy(handovers = repo.getHandovers(sess)) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to load handovers.", bannerIsError = true) }
            }
        }
    }

    fun saveHandover(h: ShiftHandover) {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                repo.saveHandover(sess, h)
                _ui.update { it.copy(handovers = repo.getHandovers(sess), bannerMessage = "Shift handover saved.", bannerIsError = false) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to save handover.", bannerIsError = true) }
            }
        }
    }

    fun loadPlans() {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                _ui.update { it.copy(plans = repo.getPlans(sess)) }
            } catch (_: Exception) {
            }
        }
    }

    fun savePlan(plan: ToolPlan) {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                repo.savePlan(sess, plan)
                _ui.update { it.copy(plans = repo.getPlans(sess), bannerMessage = "Tool plan saved on ${plan.machineNumber}.", bannerIsError = false) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to save tool plan.", bannerIsError = true) }
            }
        }
    }

    fun loadAllRecordsForReports() {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                _ui.update { it.copy(allRecords = repo.fetchAllRecords(sess)) }
            } catch (_: Exception) {
            }
        }
    }

    fun loadUsers() {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                _ui.update { it.copy(users = repo.getUsers(sess)) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to load users.", bannerIsError = true) }
            }
        }
    }

    fun createUser(username: String, fullName: String, role: AppRole, password: String) {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                repo.createUser(sess, username, fullName, role, password)
                _ui.update { it.copy(users = repo.getUsers(sess), bannerMessage = "Created $role account ($username).", bannerIsError = false) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to create user.", bannerIsError = true) }
            }
        }
    }

    fun loadAuditLogs() {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                val (logs, recs) = repo.getAuditLogs(sess)
                _ui.update { it.copy(auditLogs = logs, recoveryLogs = recs) }
            } catch (e: Exception) {
                _ui.update { it.copy(bannerMessage = e.message ?: "Unable to load audit log.", bannerIsError = true) }
            }
        }
    }

    fun runDiagnostics() {
        val sess = _ui.value.session ?: return
        viewModelScope.launch {
            try {
                val d = repo.testConnection(sess)
                _ui.update { it.copy(diagnostic = d) }
            } catch (e: Exception) {
                _ui.update { it.copy(diagnostic = ConnectionDiagnostic(false, "error", e.message ?: "Test failed")) }
            }
        }
    }

    suspend fun saveRecoveryEmail(email: String): String {
        val sess = _ui.value.session ?: return "Session expired."
        return try {
            repo.setAdminRecoveryEmail(sess, email)
        } catch (e: Exception) {
            e.message ?: "Email delivery is not configured."
        }
    }

    suspend fun verifyRecoveryEmail(code: String): String? {
        val sess = _ui.value.session ?: return "Session expired."
        return try {
            val updated = repo.verifyAdminRecoveryEmail(sess, code)
            store.saveSession(updated)
            _ui.update { it.copy(session = updated, bannerMessage = "Recovery email verified.", bannerIsError = false) }
            null
        } catch (e: Exception) {
            e.message ?: "Invalid verification code."
        }
    }
}
