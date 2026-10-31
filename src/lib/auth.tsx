import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import { KEYS, readJSON, removeKey, writeJSON } from './storage'

export type Role = 'admin' | 'event_manager' | 'department_coordinator' | 'faculty'

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  event_manager: 'Club Representative',
  department_coordinator: 'Department Coordinator',
  faculty: 'Faculty',
}

export interface StoredUser {
  username: string
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
  token: string
  user: SessionUser
  loggedInAt: number
}

const SEED_USERS: StoredUser[] = [
  { username: 'debjeet', role: 'admin', displayName: 'Debjeet' },
  { username: 'mehul', role: 'event_manager', displayName: 'Mehul' },
  {
    username: 'indranil',
    role: 'department_coordinator',
    displayName: 'Indranil',
    department: 'CSE',
  },
  {
    username: 'ananya',
    role: 'faculty',
    displayName: 'Dr. Ananya Mishra',
    department: 'CSE',
  },
]

/** Kept for the Help page/demo list; login is authenticated by the backend. */
export function ensureSeedUsers(): void {
  writeJSON(KEYS.users, SEED_USERS)
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

function restoreSession(): SessionUser | null {
  const session = readJSON<Session | null>(KEYS.session, null)
  if (!session?.token || !session.user?.username) return null
  if (localStorage.getItem(KEYS.token) !== session.token) {
    writeJSON(KEYS.token, session.token)
  }
  return session.user
}

export type LoginResult = { ok: true; user: SessionUser } | { ok: false; error: string }

interface AuthContextValue {
  user: SessionUser | null
  login: (username: string, password: string) => Promise<LoginResult>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => restoreSession())

  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      try {
        const result = await api.login(username.trim(), password)
        const next: SessionUser = {
          username: result.user.username,
          role: result.user.role,
          displayName: result.user.displayName,
          department: result.user.department ?? undefined,
          initials: result.user.initials || initialsOf(result.user.displayName),
        }
        writeJSON(KEYS.token, result.token)
        localStorage.setItem(KEYS.token, result.token)
        writeJSON(KEYS.session, {
          token: result.token,
          user: next,
          loggedInAt: Date.now(),
        } satisfies Session)
        setUser(next)
        return { ok: true, user: next }
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Sign-in failed. Check the backend is running.',
        }
      }
    },
    [],
  )

  const logout = useCallback(() => {
    removeKey(KEYS.token)
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
