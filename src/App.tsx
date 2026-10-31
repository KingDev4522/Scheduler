import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { AuthProvider, ROLE_LABEL, useAuth, type Role } from './lib/auth'
import { NAV } from './lib/nav'
import AppShell from './components/AppShell'
import Login from './pages/Login'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

/** Hides inaccessible nav items AND enforces them on the route itself. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold text-slate-900">You don't have access to this page</h2>
        <p className="mt-2 text-sm text-slate-500">
          This section is limited to{' '}
          {roles.map((r) => ROLE_LABEL[r]).join(', ')} accounts. You are signed in as{' '}
          <span className="font-medium text-slate-700">{ROLE_LABEL[user.role]}</span>.
        </p>
        <a
          href="/"
          className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Back to dashboard
        </a>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            {NAV.map((item) => (
              <Route
                key={item.path}
                path={item.path}
                element={
                  <RequireRole roles={item.roles}>
                    {item.element}
                  </RequireRole>
                }
              />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
