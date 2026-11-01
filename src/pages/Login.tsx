import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound, Loader2, UserRound } from 'lucide-react'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { ThemeToggle } from '../components/ThemeToggle'
import { Field, fieldInput } from '../components/FormBits'

const DEMO_ACCOUNTS = [
  { username: 'debjeet', role: 'admin' as const },
  { username: 'mehul', role: 'event_manager' as const },
  { username: 'indranil', role: 'department_coordinator' as const },
  { username: 'ananya', role: 'faculty' as const },
]

const FACTS: { label: string; body: string }[] = [
  { label: 'Solver', body: 'CP-SAT places every session under the institute’s hard rules.' },
  { label: 'Venues', body: 'A priority board for Spectra week, decided by category.' },
  { label: 'Audit', body: 'Every decision is stored with its reason and its approver.' },
]

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  const signIn = async (u: string, p: string) => {
    setBusy(true)
    setError(null)
    const result = await login(u, p)
    if (result.ok) {
      setError(null)
      navigate('/dashboard', { replace: true })
    } else {
      setError(result.error)
      setBusy(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter both username and password.')
      return
    }
    void signIn(username, password)
  }

  const mark = (
    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2">
      <img src="/logo-mark.png" alt="" className="h-full w-full object-contain" />
    </span>
  )

  return (
    <div className="cit-page relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_404px]">
        {/* Brand panel */}
        <div className="hidden lg:block">
          {mark}
          <h1 className="mt-5 text-[30px] font-semibold leading-tight tracking-[-0.025em] text-slate-900">
            CIT Scheduler
          </h1>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-slate-600">
            Timetable generation, venue decisions and approvals for Chilika Institute of Technology.
          </p>
          <dl className="mt-8 max-w-md space-y-4 border-t border-slate-200 pt-6">
            {FACTS.map((fact) => (
              <div key={fact.label}>
                <dt className="text-[13px] font-medium text-slate-900">{fact.label}</dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{fact.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Sign-in */}
        <div className="w-full">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            {mark}
            <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-slate-900">
              CIT Scheduler
            </h1>
            <p className="mt-1 text-[13px] text-slate-600">
              Sign in to scheduling, bookings and approvals
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h2 className="text-[15px] font-semibold text-slate-900">Sign in</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              Use an account below, or type your own credentials.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Username" htmlFor="username">
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    id="username"
                    name="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="debjeet"
                    className={`${fieldInput} pl-8`}
                  />
                </div>
              </Field>

              <Field label="Password" htmlFor="password">
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="1234"
                    className={`${fieldInput} pl-8`}
                  />
                </div>
              </Field>
            </div>

            {error ? (
              <p
                role="alert"
                className="cit-anim-pop mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] leading-relaxed text-rose-800"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="text-[12px] text-slate-500">Demo accounts, one click</p>
              <div className="cit-stagger mt-2 grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.username}
                    type="button"
                    disabled={busy}
                    onClick={() => void signIn(account.username, '1234')}
                    className="min-w-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <span className="block truncate text-[13px] font-medium text-slate-800">
                      {account.username}
                    </span>
                    <span className="block truncate text-[12px] text-slate-500">
                      {ROLE_LABEL[account.role]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </form>

          <p className="mt-3 text-center text-[12px] text-slate-500">
            Demo password for all accounts: <span className="tabular-nums text-slate-700">1234</span>
          </p>
        </div>
      </div>
    </div>
  )
}
