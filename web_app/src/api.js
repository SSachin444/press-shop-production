// API client for PHA INDIA PRIVATE LIMITED - PRESS SHOP MFG-2
export const DEFAULT_SERVER_URL = 'http://10.50.67.50:5000';

export function getServerUrl() {
  const custom = localStorage.getItem('pha_api_url');
  if (custom && custom.trim() !== '') return custom.replace(/\/$/, '');
  
  if (typeof window !== 'undefined') {
    // If browser is directly loaded from Flask server port 5000
    if (window.location.port === '5000') {
      return window.location.origin;
    }

    // In Vite dev mode (port 5173), proxy to local 5000
    if (window.location.port === '5173') {
      return 'http://127.0.0.1:5000';
    }

    // If accessed from mobile browser at http://10.50.67.50:5000 or similar IP
    if (window.location.protocol.startsWith('http') && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:5000`;
    }
  }

  // Inside Capacitor on Android phone (where port is empty or host is localhost)
  return DEFAULT_SERVER_URL;
}

export function setServerUrl(url) {
  if (!url || url.trim() === '') {
    localStorage.removeItem('pha_api_url');
  } else {
    localStorage.setItem('pha_api_url', url.trim().replace(/\/$/, ''));
  }
}

export async function testServerConnection(urlToTest) {
  const base = (urlToTest || getServerUrl()).replace(/\/$/, '');
  const res = await fetch(`${base}/api/health`, { method: 'GET', signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
}

function getApiBase() {
  return `${getServerUrl()}/api`;
}

function getAuthHeader() {
  const token = localStorage.getItem('pha_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${getApiBase()}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  try {
    const res = await fetch(url, { credentials: 'include', ...options, headers });
    if (!res.ok) {
      let errMsg = `Request failed with status ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.error) errMsg = errJson.error;
      } catch (e) {}
      throw new Error(errMsg);
    }
    // Return blob for CSV exports
    if (options.asBlob) {
      return await res.blob();
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error(`Connection error to ${getServerUrl()}. Ensure backend server is running and device is on same Wi-Fi.`);
    }
    throw err;
  }
}

export const api = {
  // Compatibility & State
  getState: () => request('/state'),
  syncState: (data) => request('/state', { method: 'POST', body: JSON.stringify(data) }),

  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  quickLogin: (role, full_name) => request('/auth/quick-login', { method: 'POST', body: JSON.stringify({ role, full_name }) }),
  getMe: () => request('/auth/me'),

  // Dashboard & KPIs
  getKpis: (date, shift) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (shift) params.append('shift', shift);
    return request(`/dashboard/kpis?${params.toString()}`);
  },

  // Cell Status (Machine Output Percentages & Pareto Chart)
  getCellStatus: (date, shift, type = 'ALL') => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (shift) params.append('shift', shift);
    if (type) params.append('type', type);
    return request(`/dashboard/cell-status?${params.toString()}`);
  },

  // Machine Tool Next Plans (Max 5 plans per machine)
  getPlans: (machine = '') => {
    const params = new URLSearchParams();
    if (machine) params.append('machine', machine);
    return request(`/plans${params.toString() ? '?' + params.toString() : ''}`);
  },
  savePlan: (planData) => request('/plans', { method: 'POST', body: JSON.stringify(planData) }),
  updatePlan: (planId, planData) => request(`/plans/${planId}`, { method: 'PUT', body: JSON.stringify(planData) }),
  deletePlan: (planId) => request(`/plans/${planId}`, { method: 'DELETE' }),

  // Employees
  getEmployees: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/employees${q ? '?' + q : ''}`);
  },
  createEmployee: (empData) => request('/employees', { method: 'POST', body: JSON.stringify(empData) }),
  updateEmployee: (empId, empData) => request(`/employees/${empId}`, { method: 'PUT', body: JSON.stringify(empData) }),
  deleteEmployee: (empId) => request(`/employees/${empId}`, { method: 'DELETE' }),
  getEmployeeProfile: (empId) => request(`/employees/${empId}`),

  // Attendance
  getAttendance: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/attendance${q ? '?' + q : ''}`);
  },
  saveAttendance: (data) => request('/attendance', { method: 'POST', body: JSON.stringify(data) }),

  // Overtime
  getOvertime: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/overtime${q ? '?' + q : ''}`);
  },
  createOvertime: (otData) => request('/overtime', { method: 'POST', body: JSON.stringify(otData) }),
  updateOvertimeStatus: (id, statusData) => request(`/overtime/${id}/status`, { method: 'PUT', body: JSON.stringify(statusData) }),

  // Machines
  getMachines: (type = '') => request(`/machines${type ? '?type=' + type : ''}`),
  createMachine: (machineData) => request('/machines', { method: 'POST', body: JSON.stringify(machineData) }),
  updateMachine: (machineNumber, machineData) => request(`/machines/${machineNumber}`, { method: 'PUT', body: JSON.stringify(machineData) }),
  deleteMachine: (machineNumber) => request(`/machines/${machineNumber}`, { method: 'DELETE' }),

  // NC Production
  getNcProduction: (date, shift) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (shift) params.append('shift', shift);
    return request(`/production/nc?${params.toString()}`);
  },
  saveNcProduction: (prodData) => request('/production/nc', { method: 'POST', body: JSON.stringify(prodData) }),

  // Tandem Production
  getTandemProduction: (date, shift) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (shift) params.append('shift', shift);
    return request(`/production/tandem?${params.toString()}`);
  },
  saveTandemProduction: (prodData) => request('/production/tandem', { method: 'POST', body: JSON.stringify(prodData) }),

  // Hourly Production
  getHourlyProduction: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/production/hourly${q ? '?' + q : ''}`);
  },
  saveHourlyProduction: (prodData) => request('/production/hourly', { method: 'POST', body: JSON.stringify(prodData) }),

  // Shift Comparison
  getShiftComparison: (date) => request(`/production/shift-comparison?date=${date}`),

  // Handovers
  getHandovers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/handovers${q ? '?' + q : ''}`);
  },
  createHandover: (data) => request('/handovers', { method: 'POST', body: JSON.stringify(data) }),
  updateHandover: (id, data) => request(`/handovers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Settings
  getSettings: () => request('/settings'),
  saveSettings: (settingsData) => request('/settings', { method: 'POST', body: JSON.stringify(settingsData) }),

  // Production Records CRUD (Standard Production Entry)
  getProductionRecords: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/production/records${q ? '?' + q : ''}`);
  },
  saveProductionRecord: (prodData) => request('/production/records', { method: 'POST', body: JSON.stringify(prodData) }),
  updateProductionRecord: (recordId, prodData) => request(`/production/records/${recordId}`, { method: 'PUT', body: JSON.stringify(prodData) }),
  deleteProductionRecord: (recordId) => request(`/production/records/${recordId}`, { method: 'DELETE' }),

  // Activity Logs Audit Trail
  getActivityLogs: () => request('/activity-logs'),
  logActivity: (data) => request('/activity-logs', { method: 'POST', body: JSON.stringify(data) }),

  // Machine Downtime Tracking
  getMachineDowntime: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/machine-downtime${q ? '?' + q : ''}`);
  },
  saveMachineDowntime: (data) => request('/machine-downtime', { method: 'POST', body: JSON.stringify(data) }),
  resolveMachineDowntime: (id, data = {}) => request(`/machine-downtime/${id}/resolve`, { method: 'PUT', body: JSON.stringify(data) }),

  // Dynamic In-App Notifications
  getNotifications: () => request('/notifications'),

  // Production Analytics
  getAnalytics: (date, shift) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (shift) params.append('shift', shift);
    return request(`/analytics?${params.toString()}`);
  },

  // 11 Professional Factory Reports
  getReportsData: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports/data${q ? '?' + q : ''}`);
  },

  // Admin Data Management
  clearSampleData: (options = {}) => request('/admin/clear-sample-data', { method: 'POST', body: JSON.stringify(options) }),

  // Exports
  exportReport: async (type, date, shift) => {
    const params = new URLSearchParams({ type });
    if (date) params.append('date', date);
    if (shift) params.append('shift', shift);
    return request(`/reports/export?${params.toString()}`, { credentials: 'include', asBlob: true });
  }
};
