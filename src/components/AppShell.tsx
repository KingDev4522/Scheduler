import { useCallback, useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { findNav } from '../lib/nav'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { KEYS, readJSON, writeJSON } from '../lib/storage'
import { SOFT_EASE } from '../lib/motion'
import AppSidebar from './AppSidebar'
import { AssistantDock } from './AssistantDock'
import { ThemeToggle } from './ThemeToggle'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar'

export default function AppShell() {
  const location = useLocation()
  const outlet = useOutlet()
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
      className="h-svh w-full overflow-hidden bg-background"
    >
      <AppSidebar />

      <SidebarInset
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-tr-2xl bg-background"
      >
        <div aria-hidden className="cit-ambient">
          <span className="cit-ambient-blob cit-ambient-blob-a" />
          <span className="cit-ambient-blob cit-ambient-blob-b" />
        </div>

        <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-slate-200" aria-hidden />
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
            <span className="hidden text-sm font-medium text-black sm:inline">{current?.group}</span>
            <ChevronRight
              className="hidden h-3.5 w-3.5 shrink-0 text-slate-700 sm:block"
              aria-hidden
            />
            <h1 className="truncate text-sm font-semibold text-slate-900">
              {current?.label ?? 'CIT Scheduler'}
            </h1>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            {user && (
              <span className="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-900">
                {ROLE_LABEL[user.role]}
              </span>
            )}
          </div>
        </header>

        {/* Route transition — the old page settles away before the next one
            rises in, so navigation never cuts. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.26, ease: SOFT_EASE }}
            className="relative z-10 min-h-0 flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-28"
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </SidebarInset>

      <AssistantDock />
    </SidebarProvider>
  )
}
