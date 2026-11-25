// Secure Session Management (sessionStorage only; never persists credentials or Admin state across browser visits)

import { isValidRole } from '../config/roles';

const SESSION_KEY = 'pha_verified_session_v2';
const LEGACY_LOCAL_KEYS = [
  'pha_auth',
  'pha_logged_in',
  'pha_user',
  'pha_role',
  'pha_session',
  'pha_token',
  'pha_supabase_url',
  'pha_supabase_key',
  'pha_api_url',
  'pha_plant_data_store',
];

export function purgeLegacyLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    for (const k of LEGACY_LOCAL_KEYS) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function getActiveSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.user || !isValidRole(parsed.user.role)) {
      clearActiveSession();
      return null;
    }
    if (parsed.expiresAt && Date.now() > Number(parsed.expiresAt)) {
      clearActiveSession();
      return null;
    }
    return parsed;
  } catch {
    clearActiveSession();
    return null;
  }
}

export function saveActiveSession({ user, token = '', mode = 'supabase', expiresInSeconds = 8 * 3600 }) {
  if (typeof window === 'undefined') return null;
  const session = {
    user: {
      id: user.id ?? null,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      department: user.department || 'Press Shop MFG-2',
      must_change_password: Boolean(user.must_change_password),
      recovery_email: user.role === 'Admin' ? user.recovery_email || '' : '',
      recovery_email_verified: user.role === 'Admin' ? Boolean(user.recovery_email_verified) : false,
    },
    token,
    mode,
    createdAt: Date.now(),
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function updateSessionUser(patch) {
  const existing = getActiveSession();
  if (!existing) return null;
  return saveActiveSession({
    ...existing,
    user: { ...existing.user, ...patch },
    expiresInSeconds: Math.max(60, Math.floor((existing.expiresAt - Date.now()) / 1000)),
  });
}

export function clearActiveSession() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore
  }
}
