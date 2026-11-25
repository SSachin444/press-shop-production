// Canonical Role, Route, Navigation, and Capability Model for PHA INDIA Press Shop System

export const ROLES = {
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  OPERATOR: 'Operator',
  DASHBOARD: 'Dashboard',
};

export const ROLE_GATEWAY_OPTIONS = [
  {
    id: ROLES.ADMIN,
    title: 'Admin',
    requiresPassword: true,
    description: 'Full plant configuration, machines, users, audit log, and recovery settings.',
  },
  {
    id: ROLES.SUPERVISOR,
    title: 'Supervisor',
    requiresPassword: true,
    description: 'Shift production entry, manpower attendance, machine status, handovers, and reports.',
  },
  {
    id: ROLES.OPERATOR,
    title: 'Operator',
    requiresPassword: false,
    description: 'Hourly production entry and live cell status only.',
  },
  {
    id: ROLES.DASHBOARD,
    title: 'Dashboard',
    requiresPassword: false,
    description: 'Read-only full-screen live cell status monitor for shopfloor displays.',
  },
];

export const ROUTE_DEFINITIONS = [
  {
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    title: 'Plant Production Dashboard',
    section: 'Operations',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
    mobilePrimary: true,
  },
  {
    id: 'hourly-production',
    path: '/hourly-entry',
    label: 'Hourly Entry',
    title: 'Hourly Production Entry',
    section: 'Operations',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.OPERATOR],
    mobilePrimary: true,
  },
  {
    id: 'cell-status',
    path: '/cell-status',
    label: 'Live Cell Status',
    title: 'Live Cell Status',
    section: 'Operations',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.OPERATOR, ROLES.DASHBOARD],
    mobilePrimary: true,
  },
  {
    id: 'production',
    path: '/production',
    label: 'Production',
    title: 'Production & Tool Plans',
    section: 'Operations',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
    mobilePrimary: false,
  },
  {
    id: 'employees',
    path: '/manpower',
    label: 'Manpower',
    title: 'Manpower Directory',
    section: 'Workforce',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
    mobilePrimary: false,
  },
  {
    id: 'attendance',
    path: '/attendance',
    label: 'Attendance',
    title: 'Shift Attendance',
    section: 'Workforce',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
    mobilePrimary: true,
  },
  {
    id: 'machines',
    path: '/machines',
    label: 'Machines',
    title: 'Machine Directory',
    section: 'Equipment',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
    mobilePrimary: false,
  },
  {
    id: 'handovers',
    path: '/handovers',
    label: 'Shift Handover',
    title: 'Shift Handover',
    section: 'Operations',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
    mobilePrimary: false,
  },
  {
    id: 'reports',
    path: '/reports',
    label: 'Reports & Exports',
    title: 'Reports & Exports',
    section: 'Reporting',
    roles: [ROLES.ADMIN, ROLES.SUPERVISOR],
    mobilePrimary: false,
  },
  {
    id: 'users',
    path: '/users',
    label: 'Users & Roles',
    title: 'User & Role Management',
    section: 'Administration',
    roles: [ROLES.ADMIN],
    mobilePrimary: false,
  },
  {
    id: 'activity-logs',
    path: '/audit-log',
    label: 'Audit Log',
    title: 'System Audit Log',
    section: 'Administration',
    roles: [ROLES.ADMIN],
    mobilePrimary: false,
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    title: 'Admin Settings & Diagnostics',
    section: 'Administration',
    roles: [ROLES.ADMIN],
    mobilePrimary: false,
  },
];

export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

export function getAllowedRoutes(role) {
  if (!isValidRole(role)) return [];
  return ROUTE_DEFINITIONS.filter((r) => r.roles.includes(role));
}

export function getDefaultTabForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
    case ROLES.SUPERVISOR:
      return 'dashboard';
    case ROLES.OPERATOR:
      return 'hourly-production';
    case ROLES.DASHBOARD:
      return 'cell-status';
    default:
      return 'dashboard';
  }
}

export function canAccessTab(role, tabId) {
  return ROUTE_DEFINITIONS.some((r) => r.id === tabId && r.roles.includes(role));
}

export function getRouteByTab(tabId) {
  return ROUTE_DEFINITIONS.find((r) => r.id === tabId) || ROUTE_DEFINITIONS[0];
}

export function getTabFromPath(pathname) {
  const clean = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (clean === '/live-display') return 'cell-status';
  const match = ROUTE_DEFINITIONS.find((r) => r.path === clean);
  return match ? match.id : null;
}

export function getCapabilities(role) {
  return {
    isAdmin: role === ROLES.ADMIN,
    isSupervisor: role === ROLES.SUPERVISOR,
    isOperator: role === ROLES.OPERATOR,
    isDashboard: role === ROLES.DASHBOARD,
    isReadOnly: role === ROLES.DASHBOARD,
    canEditMachines: role === ROLES.ADMIN,
    canManageDowntimeCodes: role === ROLES.ADMIN,
    canViewSettings: role === ROLES.ADMIN,
    canManageUsers: role === ROLES.ADMIN,
    canViewAuditLog: role === ROLES.ADMIN,
    canManageRecoveryEmail: role === ROLES.ADMIN,
    canViewPersonalEmployeeFields: role === ROLES.ADMIN,
    canDeleteEmployees: role === ROLES.ADMIN,
    canDeleteProduction: role === ROLES.ADMIN,
    canManageEmployees: role === ROLES.ADMIN || role === ROLES.SUPERVISOR,
    canManageAttendance: role === ROLES.ADMIN || role === ROLES.SUPERVISOR,
    canManageHandovers: role === ROLES.ADMIN || role === ROLES.SUPERVISOR,
    canManagePlans: role === ROLES.ADMIN || role === ROLES.SUPERVISOR,
    canViewReports: role === ROLES.ADMIN || role === ROLES.SUPERVISOR,
    canSubmitProduction: role === ROLES.ADMIN || role === ROLES.SUPERVISOR || role === ROLES.OPERATOR,
    canChangeOwnPassword: role === ROLES.ADMIN || role === ROLES.SUPERVISOR,
  };
}
