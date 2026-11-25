package com.phaindia.mes

import com.phaindia.mes.model.AppRole
import com.phaindia.mes.model.NavDestination
import com.phaindia.mes.model.RolePolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RoleAccessPolicyTest {
    @Test
    fun `operator sees strictly hourly entry and live cell status`() {
        val allowed = RolePolicy.allowedDestinations(AppRole.OPERATOR)
        assertEquals(listOf(NavDestination.HOURLY_ENTRY, NavDestination.CELL_STATUS), allowed)
        assertFalse(RolePolicy.canAccess(AppRole.OPERATOR, NavDestination.DASHBOARD))
        assertFalse(RolePolicy.canAccess(AppRole.OPERATOR, NavDestination.REPORTS))
        assertFalse(RolePolicy.canAccess(AppRole.OPERATOR, NavDestination.SETTINGS))
        assertFalse(RolePolicy.canAccess(AppRole.OPERATOR, NavDestination.MACHINES))
    }

    @Test
    fun `dashboard role is strictly read-only kiosk live cell status`() {
        val allowed = RolePolicy.allowedDestinations(AppRole.DASHBOARD)
        assertEquals(listOf(NavDestination.CELL_STATUS), allowed)
        val caps = RolePolicy.capabilities(AppRole.DASHBOARD)
        assertFalse(caps.canSubmitProduction)
        assertFalse(caps.canEditMachines)
        assertFalse(caps.canViewReports)
        assertFalse(caps.canViewSettings)
    }

    @Test
    fun `supervisor cannot access admin settings, users, audit log, personal employee fields, or machine edits`() {
        val caps = RolePolicy.capabilities(AppRole.SUPERVISOR)
        assertFalse(caps.canViewSettings)
        assertFalse(caps.canManageUsers)
        assertFalse(caps.canViewAuditLog)
        assertFalse(caps.canManageRecoveryEmail)
        assertFalse(caps.canViewPersonalEmployeeFields)
        assertFalse(caps.canEditMachines)
        assertFalse(caps.canDeleteEmployees)

        assertTrue(caps.canManageEmployees)
        assertTrue(caps.canManageAttendance)
        assertTrue(caps.canManageHandovers)
        assertTrue(caps.canViewReports)

        assertFalse(RolePolicy.canAccess(AppRole.SUPERVISOR, NavDestination.SETTINGS))
        assertFalse(RolePolicy.canAccess(AppRole.SUPERVISOR, NavDestination.USERS))
        assertFalse(RolePolicy.canAccess(AppRole.SUPERVISOR, NavDestination.AUDIT_LOG))
    }

    @Test
    fun `admin has full configuration, audit, user, and recovery privileges`() {
        val caps = RolePolicy.capabilities(AppRole.ADMIN)
        assertTrue(caps.canEditMachines)
        assertTrue(caps.canViewSettings)
        assertTrue(caps.canManageUsers)
        assertTrue(caps.canViewAuditLog)
        assertTrue(caps.canManageRecoveryEmail)
        assertTrue(caps.canViewPersonalEmployeeFields)
        assertEquals(NavDestination.entries, RolePolicy.allowedDestinations(AppRole.ADMIN))
    }
}
