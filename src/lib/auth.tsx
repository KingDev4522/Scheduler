import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { KEYS, readJSON, removeKey, writeJSON } from './storage'

export type Role = 'admin' | 'event_manager' | 'department_coordinator'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  event_manager: 'Event Manager',
  department_coordinator: 'Department Coordinator',
}

export interface StoredUser {
  username: string
  password: string
  role: Role
  displayName: string
  department?: string
}

export interface SessionUser {
  username: string
  role: Role
  displayName: string
  department?: string
  initials: string
}

interface Session {
  username: string
  loggedInAt: number
}

interface LoginAttempts {
  count: number
  lockedUntil: number
}

/** Demo accounts (documented in README). Passwords are demo-only by design. */
const SEED_USERS: StoredUser[] = [
  { username: 'debjeet', password: '1234', role: 'admin', displayName: 'Debjeet' },
  { username: 'mehul', password: '1234', role: 'event_manager', displayName: 'Mehul' },
  {
    username: 'indranil',
    password: '1234',
    role: 'department_coordinator',
    displayName: 'Indranil',
    department: 'CSE',
  },
]

const MAX_ATTEMPTS = 5
const LOCK_MS = 30_000

/** Called once at startup: makes sure demo users exist in localStorage. */
export function ensureSeedUsers(): void {
  const existing = readJSON<StoredUser[] | null>(KEYS.users, null)
  if (!existing || existing.length === 0) writeJSON(KEYS.users, SEED_USERS)
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

function toSessionUser(user: StoredUser): SessionUser {
  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    department: user.department,
    initials: initialsOf(user.displayName),
  }
}

function getLockState(): LoginAttempts {
  return readJSON<LoginAttempts>(KEYS.loginAttempts, { count: 0, lockedUntil: 0 })
}

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string }

function attemptLogin(username: string, password: string): LoginResult {
  const attempts = getLockState()
  if (attempts.lockedUntil > Date.now()) {
    const secs = Math.ceil((attempts.lockedUntil - Date.now()) / 1000)
    return { ok: false, error: `Too many attempts. Try again in ${secs}s.` }
  }

  const users = readJSON<StoredUser[]>(KEYS.users, SEED_USERS)
  const match = users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password,
  )

  if (!match) {
    const next: LoginAttempts = {
      count: attempts.count + 1,
      lockedUntil:
        attempts.count + 1 >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : attempts.lockedUntil,
    }
    writeJSON(KEYS.loginAttempts, next)
    const remaining = MAX_ATTEMPTS - next.count
    return {
      ok: false,
      error:
        next.lockedUntil > Date.now()
          ? `Too many attempts. Locked for ${LOCK_MS / 1000}s.`
          : `Invalid username or password. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
    }
  }

  removeKey(KEYS.loginAttempts)
  const user = toSessionUser(match)
  const session: Session = { username: match.username, loggedInAt: Date.now() }
  writeJSON(KEYS.session, session)
  return { ok: true, user }
}

function restoreSession(): SessionUser | null {
  const session = readJSON<Session | null>(KEYS.session, null)
  if (!session?.username) return null
  const users = readJSON<StoredUser[]>(KEYS.users, SEED_USERS)
  const stored = users.find((u) => u.username === session.username)
  return stored ? toSessionUser(stored) : null
}

interface AuthContextValue {
  user: SessionUser | null
  login: (username: string, password: string) => LoginResult
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => restoreSession())

  const login = useCallback((username: string, password: string): LoginResult => {
    const result = attemptLogin(username, password)
    if (result.ok) setUser(result.user)
    return result
  }, [])

  const logout = useCallback(() => {
    removeKey(KEYS.session)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
