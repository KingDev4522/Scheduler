import { useCallback, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { findNav } from '../lib/nav'
import { KEYS, readJSON, writeJSON } from '../lib/storage'
import { AppSidebar } from './AppSidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar'

export default function AppShell() {
  const location = useLocation()
  const current = findNav(location.pathname)

  // Persist the expanded/collapsed preference across reloads.
  const [open, setOpen] = useState(() => readJSON(KEYS.sidebarOpen, true))
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    writeJSON(KEYS.sidebarOpen, next)
  }, [])

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange}>
      <AppSidebar />

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          <SidebarTrigger className="-ml-1" />
          <h1 className="truncate text-sm font-semibold text-slate-900">
            {current?.label ?? 'CIT Scheduler'}
          </h1>
        </header>

        {/* Quiet route transition — opacity + 4px lift, no bounce, honours reduced motion via MotionConfig. */}
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex-1 p-4 md:p-6"
        >
          <Outlet />
        </motion.main>

        <footer className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-400 md:px-6">
          CIT Scheduler — demo build, data stored in your browser (localStorage)
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
