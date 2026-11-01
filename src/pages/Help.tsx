import { useState } from 'react'
import { KeyRound, RotateCcw, ShieldCheck } from 'lucide-react'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { navForRole } from '../lib/nav'
import { resetDemoData } from '../lib/store'
import { api } from '../lib/api'
import { PageHeader } from '../components/PageHeader'

const DEMO_ROWS = [
  { username: 'debjeet', password: '1234', role: 'admin' as const },
  { username: 'mehul', password: '1234', role: 'event_manager' as const },
  { username: 'indranil', password: '1234', role: 'department_coordinator' as const },
  { username: 'ananya', password: '1234', role: 'faculty' as const },
]

export default function Help() {
  const { user } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  if (!user) return null

  const isAdmin = user.role === 'admin'
  const allowedNav = navForRole(user.role)

  const doReset = async () => {
    const ok = window.confirm(
      'Reset demo data? The backend dataset, generated artifacts, booking submissions and change requests are cleared, and browser demo state returns to seed.',
    )
    if (!ok) return
    resetDemoData()
    if (isAdmin) {
      try {
        await api.reset(user.username)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Backend reset failed.')
        return
      }
    }
    setMessage('Demo data reset: backend and browser state cleared.')
    window.setTimeout(() => window.location.reload(), 800)
  }

  return (
    <div className="cit-page">
      <PageHeader
        title="Help & demo accounts"
        subtitle="Credentials, navigation scope and demo data controls"
      />        {message && (
        <div role="status" className="cit-anim-pop mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800">
          {message}
        </div>
      )}

      <div className="cit-stagger grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Demo accounts */}
        <section className="cit-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <KeyRound className="h-4 w-4 text-neutral-700" aria-hidden />
            Demo accounts
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">Username</th>
                  <th className="py-2 pr-3">Password</th>
                  <th className="py-2">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {DEMO_ROWS.map((row) => (
                  <tr key={row.username}>
                    <td className="py-2.5 pr-3 font-medium text-slate-800">{row.username}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{row.password}</td>
                    <td className="py-2.5 text-slate-600">{ROLE_LABEL[row.role]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Credentials are verified by the demo backend. Use the one-click buttons on the login
            screen or type the shared demo password.
          </p>
        </section>

        {/* Your access */}
        <section className="cit-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-neutral-700" aria-hidden />
            Your access as {ROLE_LABEL[user.role]}
          </h3>
          <ul className="mt-4 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {allowedNav.map((item) => (
              <li key={item.path} className="text-slate-700">
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            Pages outside this list are hidden from your sidebar and blocked at the route level.
          </p>
        </section>

        {/* Reset */}
        {isAdmin && (
          <section className="cit-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <RotateCcw className="h-4 w-4 text-neutral-700" aria-hidden />
              Demo controls
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Reset the backend dataset and generated artifacts, plus the browser demo store. Use
              this before a demo run.
            </p>
            <button
              type="button"
              onClick={() => void doReset()}
              className="mt-4 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
            >
              Reset demo data
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
