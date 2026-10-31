import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CalendarClock, KeyRound, Loader2, UserRound } from 'lucide-react'
import { ROLE_LABEL, useAuth } from '../lib/auth'

const DEMO_ACCOUNTS = [
  { username: 'debjeet', role: 'admin' as const },
  { username: 'mehul', role: 'event_manager' as const },
  { username: 'indranil', role: 'department_coordinator' as const },
  { username: 'ananya', role: 'faculty' as const },
]

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const signIn = (u: string, p: string) => {
    setBusy(true)
    // Small delay keeps the UI state honest (loading -> result)
    window.setTimeout(() => {
      const result = login(u, p)
      if (result.ok) {
        setError(null)
        navigate('/', { replace: true })
      } else {
        setError(result.error)
        setBusy(false)
      }
    }, 250)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter both username and password.')
      return
    }
    signIn(username, password)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
      {/* Soft backdrop pattern */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.10),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.06),transparent_45%)]"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/40">
            <CalendarClock className="h-7 w-7 text-neutral-950" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-white">CIT Scheduler</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Sign in to scheduling, bookings and approvals
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-xl backdrop-blur"
        >
          <label className="block text-sm font-medium text-neutral-300" htmlFor="username">
            Username
          </label>
          <div className="relative mt-1.5">
            <UserRound
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
              aria-hidden
            />
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. debjeet"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-600"
            />
          </div>

          <label className="mt-4 block text-sm font-medium text-neutral-300" htmlFor="password">
            Password
          </label>
          <div className="relative mt-1.5">
            <KeyRound
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
              aria-hidden
            />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-neutral-600"
            />
          </div>

          {error && (
            <p
              role="alert"               className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-300"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="mt-6 border-t border-neutral-800 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Demo accounts — one click
            </p>
            <div className="mt-2 space-y-2">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.username}
                  type="button"
                  disabled={busy}
                  onClick={() => signIn(acct.username, '1234')}
                  className="flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:border-neutral-500/60 hover:bg-neutral-800 disabled:opacity-60"
                >
                  <span className="font-medium">{acct.username}</span>
                  <span className="text-xs text-neutral-500">{ROLE_LABEL[acct.role]}</span>
                </button>
              ))}
            </div>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-neutral-600">
          Demo credentials are stored in your browser's localStorage only.
        </p>
      </div>
    </div>
  )
}
