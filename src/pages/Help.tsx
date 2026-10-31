import { useState } from 'react'
import { KeyRound, RotateCcw, ShieldCheck } from 'lucide-react'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { navForRole } from '../lib/nav'
import { resetDemoData } from '../lib/store'
import { PageHeader } from '../components/PageHeader'

const DEMO_ROWS = [
  { username: 'debjeet', password: '1234', role: 'admin' as const },
  { username: 'mehul', password: '1234', role: 'event_manager' as const },
  { username: 'indranil', password: '1234', role: 'department_coordinator' as const },
]

export default function Help() {
  const { user } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  if (!user) return null

  const isAdmin = user.role === 'admin'
  const allowedNav = navForRole(user.role)

  const doReset = () => {
    const ok = window.confirm(
      'Reset demo data? All bookings, approvals and audit entries return to their seed state. Your login stays active.',
    )
    if (!ok) return
    resetDemoData()
    setMessage('Demo data reset to seed state.')
    window.setTimeout(() => window.location.reload(), 800)
  }

  return (
    <div>
      <PageHeader
        title="Help & demo accounts"
        subtitle="Credentials, navigation scope and demo data controls"
      />

      {message && (
        <div role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Demo accounts */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <KeyRound className="h-4 w-4 text-indigo-500" aria-hidden />
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
            Sign in with any of these, or use the one-click buttons on the login screen. Credentials
            live only in this browser's localStorage.
          </p>
        </section>

        {/* Your access */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-indigo-500" aria-hidden />
            Your access as {ROLE_LABEL[user.role]}
          </h3>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {allowedNav.map((item) => (
              <li
                key={item.path}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <item.icon className="h-4 w-4 text-indigo-500" aria-hidden />
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
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <RotateCcw className="h-4 w-4 text-amber-500" aria-hidden />
              Demo controls
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Reset every booking, approval, conflict and audit entry back to the seed state —
              useful before a demo run.
            </p>
            <button
              type="button"
              onClick={doReset}
              className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
            >
              Reset demo data
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
