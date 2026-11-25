package com.phaindia.mes.model

enum class AppRole(
    val wireName: String,
    val title: String,
    val requiresPassword: Boolean,
    val description: String,
) {
    ADMIN(
        wireName = "Admin",
        title = "Admin",
        requiresPassword = true,
        description = "Full plant configuration, machines, users, audit log, and recovery settings.",
    ),
    SUPERVISOR(
        wireName = "Supervisor",
        title = "Supervisor",
        requiresPassword = true,
        description = "Shift production entry, manpower attendance, machine status, handovers, and reports.",
    ),
    OPERATOR(
        wireName = "Operator",
        title = "Operator",
        requiresPassword = false,
        description = "Hourly production entry and live cell status only.",
    ),
    DASHBOARD(
        wireName = "Dashboard",
        title = "Dashboard",
        requiresPassword = false,
        description = "Read-only full-screen live cell status monitor for shopfloor displays.",
    );

    companion object {
        fun fromWireName(name: String?): AppRole? = entries.find { it.wireName == name }
    }
}

enum class NavDestination(
    val id: String,
    val label: String,
    val title: String,
    val roles: Set<AppRole>,
) {
    DASHBOARD("dashboard", "Dashboard", "Plant Production Dashboard", setOf(AppRole.ADMIN, AppRole.SUPERVISOR)),
    HOURLY_ENTRY("hourly-production", "Hourly Entry", "Hourly Production Entry", setOf(AppRole.ADMIN, AppRole.SUPERVISOR, AppRole.OPERATOR)),
    CELL_STATUS("cell-status", "Live Cell", "Live Cell Status", setOf(AppRole.ADMIN, AppRole.SUPERVISOR, AppRole.OPERATOR, AppRole.DASHBOARD)),
    PRODUCTION("production", "Production", "Production & Tool Plans", setOf(AppRole.ADMIN, AppRole.SUPERVISOR)),
    MANPOWER("employees", "Manpower", "Manpower Directory", setOf(AppRole.ADMIN, AppRole.SUPERVISOR)),
    ATTENDANCE("attendance", "Attendance", "Shift Attendance", setOf(AppRole.ADMIN, AppRole.SUPERVISOR)),
    MACHINES("machines", "Machines", "Machine Directory", setOf(AppRole.ADMIN, AppRole.SUPERVISOR)),
    HANDOVERS("handovers", "Handover", "Shift Handover", setOf(AppRole.ADMIN, AppRole.SUPERVISOR)),
    REPORTS("reports", "Reports", "Reports & Exports", setOf(AppRole.ADMIN, AppRole.SUPERVISOR)),
    USERS("users", "Users", "User & Role Management", setOf(AppRole.ADMIN)),
    AUDIT_LOG("activity-logs", "Audit Log", "System Audit Log", setOf(AppRole.ADMIN)),
    SETTINGS("settings", "Settings", "Admin Settings & Diagnostics", setOf(AppRole.ADMIN));
}

data class RoleCapabilities(
    val canEditMachines: Boolean,
    val canViewSettings: Boolean,
    val canManageUsers: Boolean,
    val canViewAuditLog: Boolean,
    val canManageRecoveryEmail: Boolean,
    val canViewPersonalEmployeeFields: Boolean,
    val canDeleteEmployees: Boolean,
    val canManageEmployees: Boolean,
    val canManageAttendance: Boolean,
    val canManageHandovers: Boolean,
    val canManagePlans: Boolean,
    val canViewReports: Boolean,
    val canSubmitProduction: Boolean,
    val canChangeOwnPassword: Boolean,
)

object RolePolicy {
    fun allowedDestinations(role: AppRole): List<NavDestination> =
        NavDestination.entries.filter { role in it.roles }

    fun canAccess(role: AppRole, dest: NavDestination): Boolean = role in dest.roles

    fun defaultDestination(role: AppRole): NavDestination = when (role) {
        AppRole.ADMIN, AppRole.SUPERVISOR -> NavDestination.DASHBOARD
        AppRole.OPERATOR -> NavDestination.HOURLY_ENTRY
        AppRole.DASHBOARD -> NavDestination.CELL_STATUS
    }

    fun capabilities(role: AppRole): RoleCapabilities = RoleCapabilities(
        canEditMachines = role == AppRole.ADMIN,
        canViewSettings = role == AppRole.ADMIN,
        canManageUsers = role == AppRole.ADMIN,
        canViewAuditLog = role == AppRole.ADMIN,
        canManageRecoveryEmail = role == AppRole.ADMIN,
        canViewPersonalEmployeeFields = role == AppRole.ADMIN,
        canDeleteEmployees = role == AppRole.ADMIN,
        canManageEmployees = role == AppRole.ADMIN || role == AppRole.SUPERVISOR,
        canManageAttendance = role == AppRole.ADMIN || role == AppRole.SUPERVISOR,
        canManageHandovers = role == AppRole.ADMIN || role == AppRole.SUPERVISOR,
        canManagePlans = role == AppRole.ADMIN || role == AppRole.SUPERVISOR,
        canViewReports = role == AppRole.ADMIN || role == AppRole.SUPERVISOR,
        canSubmitProduction = role != AppRole.DASHBOARD,
        canChangeOwnPassword = role == AppRole.ADMIN || role == AppRole.SUPERVISOR,
    )
}

data class UserProfile(
    val id: String = "",
    val username: String = "",
    val fullName: String = "",
    val role: AppRole = AppRole.OPERATOR,
    val department: String = "Press Shop MFG-2",
    val mustChangePassword: Boolean = false,
    val recoveryEmail: String = "",
    val recoveryEmailVerified: Boolean = false,
    val isActive: Boolean = true,
)

data class AuthSession(
    val user: UserProfile,
    val token: String = "",
    val mode: String = "supabase",
    val expiresAtEpochMs: Long = 0L,
)

data class Machine(
    val machineNumber: String,
    val id: Long = 0L,
    val machineType: String = "NC",
    val machineGroup: String = "NC",
    val plantId: String = "Plant 1",
    val tonnage: Double = 0.0,
    val productionTarget: Int = 500,
    val status: String = "Idle",
    val assignedOperator: String = "",
    val maintenanceNotes: String = "",
    val version: Int = 1,
)

data class ProductionRecord(
    val id: Long = 0L,
    val clientSubmissionId: String = "",
    val plantId: String = "Plant 1",
    val date: String = "",
    val shift: String = "",
    val machineOrLine: String = "",
    val productionType: String = "NC",
    val toolNumber: String = "",
    val operatorName: String = "",
    val hourInterval: String = "",
    val targetUph: Int = 0,
    val targetQty: Int = 0,
    val actualQty: Int = 0,
    val goodQty: Int = 0,
    val rejectedQty: Int = 0,
    val downtimeMinutes: Int = 0,
    val downtimeCode: String = "",
    val downtimeReason: String = "",
    val remarks: String = "",
    val createdAt: String = "",
)

data class DowntimeCode(
    val code: String,
    val name: String,
    val description: String = "",
    val displayOrder: Int = 1,
)

data class MachineDowntime(
    val id: Long = 0L,
    val machineNumber: String = "",
    val downtimeCode: String = "D01",
    val reason: String = "",
    val operatorName: String = "",
    val startTime: String = "",
    val date: String = "",
    val shift: String = "",
    val status: String = "Open",
)

data class Employee(
    val id: Long = 0L,
    val empId: String,
    val name: String,
    val department: String = "NC Production",
    val designation: String = "Operator",
    val shift: String = "Shift A",
    val assignedMachine: String = "",
    val status: String = "Active",
    val phone: String = "",
    val email: String = "",
)

data class AttendanceMark(
    val empId: String,
    val date: String,
    val shift: String,
    val status: String,
    val notes: String = "",
)

data class ShiftHandover(
    val id: Long = 0L,
    val date: String = "",
    val fromShift: String = "Shift A",
    val toShift: String = "Shift B",
    val machineSummary: String = "",
    val pendingIssues: String = "",
    val toolingStatus: String = "",
    val safetyNotes: String = "",
    val handoverBy: String = "",
    val status: String = "Open",
)

data class ToolPlan(
    val id: Long = 0L,
    val machineNumber: String,
    val planIndex: Int = 1,
    val toolNumber: String,
    val planQuantity: Int = 0,
    val partName: String = "",
    val status: String = "Queued",
)

data class UserAccountRow(
    val id: String,
    val username: String,
    val fullName: String,
    val role: String,
    val mustChangePassword: Boolean,
    val recoveryEmail: String,
    val recoveryEmailVerified: Boolean,
    val isActive: Boolean,
)

data class AuditLogRow(
    val id: String,
    val createdAt: String,
    val userName: String,
    val role: String,
    val action: String,
    val recordType: String,
    val recordId: String,
    val details: String,
)

data class RecoveryAuditRow(
    val id: String,
    val createdAt: String,
    val targetRole: String,
    val email: String,
    val eventType: String,
    val success: Boolean,
    val detail: String,
)

data class PendingSubmission(
    val clientSubmissionId: String,
    val plantId: String,
    val date: String,
    val shift: String,
    val machineOrLine: String,
    val toolNumber: String,
    val operatorName: String,
    val hourInterval: String,
    val targetUph: Int,
    val actualQty: Int,
    val rejectedQty: Int,
    val downtimeMinutes: Int,
    val downtimeCode: String,
    val downtimeReason: String,
    val remarks: String,
    val queuedAt: String,
)

data class MetricTotals(
    val actual: Int,
    val target: Int,
    val good: Int,
    val rejected: Int,
    val downtimeMinutes: Int,
    val achievementPct: Double,
    val qualityPct: Double,
    val scrapPct: Double,
    val machinesAffected: Int,
    val recordCount: Int,
)

data class MachineCounts(
    val total: Int,
    val running: Int,
    val maintenance: Int,
    val stopped: Int,
)

data class MachineMetricRow(
    val machine: Machine,
    val status: String,
    val actual: Int,
    val target: Int,
    val good: Int,
    val rejected: Int,
    val downtime: Int,
    val achievementPct: Double,
    val operator: String,
    val toolNumber: String,
    val recordsCount: Int,
)

data class HourlySlotMetric(
    val key: String,
    val shortLabel: String,
    val label: String,
    val actual: Int,
    val target: Int,
)

data class UnifiedMetrics(
    val totals: MetricTotals,
    val machineCounts: MachineCounts,
    val machines: List<MachineMetricRow>,
    val hourlySeries: List<HourlySlotMetric>,
    val filteredRecords: List<ProductionRecord>,
)

data class ConnectionDiagnostic(
    val ok: Boolean,
    val mode: String,
    val detail: String,
)
