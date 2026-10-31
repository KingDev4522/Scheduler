import { useCallback, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { findNav } from '../lib/nav'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { KEYS, readJSON, writeJSON } from '../lib/storage'
import AppSidebar from './AppSidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar'

export default function AppShell() {
  const location = useLocation()
  const current = findNav(location.pathname)
  const { user } = useAuth()

  // Persist the expanded/collapsed preference across reloads.
  const [open, setOpen] = useState(() => readJSON(KEYS.sidebarOpen, true))
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    writeJSON(KEYS.sidebarOpen, next)
  }, [])

  return (
    <SidebarProvider
      open={open}
      onOpenChange={handleOpenChange}
      className="h-svh w-full overflow-hidden bg-[#0a0a0a] pt-2"
    >
      <AppSidebar />

      <SidebarInset
        className={`relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-tr-2xl bg-background ${
          open ? '' : 'md:rounded-tl-2xl'
        }`}
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-slate-200" aria-hidden />
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
            <span className="hidden text-sm text-slate-400 sm:inline">{current?.group}</span>
            <ChevronRight
              className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 sm:block"
              aria-hidden
            />
            <h1 className="truncate text-sm font-semibold text-slate-900">
              {current?.label ?? 'CIT Scheduler'}
            </h1>
          </nav>
          {user && (
            <span className="ml-auto shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
              {ROLE_LABEL[user.role]}
            </span>
          )}
        </header>

        {/* Quiet route transition — opacity + 4px lift, no bounce, honours reduced motion via MotionConfig. */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6"
        >
          <Outlet />
        </motion.div>

        <footer className="shrink-0 border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-400 md:px-6">
          CIT Scheduler — demo build, data stored in your browser (localStorage)
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
