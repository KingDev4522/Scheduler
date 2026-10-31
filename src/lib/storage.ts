/** Tiny typed wrapper over localStorage with JSON + error safety. */

export const KEYS = {
  users: 'cit-scheduler:users',
  session: 'cit-scheduler:session',
  token: 'cit-scheduler:token',
  data: 'cit-scheduler:data',
  dataset: 'cit-scheduler:dataset',
  loginAttempts: 'cit-scheduler:login-attempts',
  sidebarOpen: 'cit-scheduler:sidebar-open',
} as const

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error(`Failed to persist "${key}"`, err)
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (err) {
    console.error(`Failed to remove "${key}"`, err)
  }
}
