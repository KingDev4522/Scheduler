import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarRange,
  GitCompareArrows,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  Settings2,
  type LucideIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { useSidebar } from './ui/sidebar'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { NAV_GROUPS, findNav, navForRole, type NavGroup } from '../lib/nav'

const PANEL_WIDTH = 250

const GROUP_ICONS: Record<NavGroup, LucideIcon> = {
  Overview: LayoutDashboard,
  Scheduling: CalendarRange,
  Workflow: GitCompareArrows,
  System: Settings2,
}

const SIDEBAR_MOTION_STYLES = `
  :root {
    --cit-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --cit-duration: 320ms;
  }

  .cit-sidebar-panel {
    transition: width var(--cit-duration) var(--cit-ease);
    will-change: width;
  }

  .cit-mobile-drawer {
    transition: transform var(--cit-duration) var(--cit-ease);
    will-change: transform;
  }

  .cit-scrollbar::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  .cit-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .cit-scrollbar::-webkit-scrollbar-thumb {
    background: #475569;
    border-radius: 9999px;
  }
  .cit-scrollbar:hover::-webkit-scrollbar-thumb {
    background: #64748b;
  }

  @media (prefers-reduced-motion: reduce) {
    .cit-sidebar-panel,
    .cit-mobile-drawer {
      transition: none !important;
    }
  }
`

export default function AppSidebar() {
  const { user, logout } = useAuth()
  const { open, setOpen, isMobile, openMobile, setOpenMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()

  const activeItem = findNav(location.pathname)
  const activeGroup: NavGroup = activeItem?.group ?? 'Overview'
  const [selectedGroup, setSelectedGroup] = useState<NavGroup>(activeGroup)

  const [tooltip, setTooltip] = useState({ visible: false, label: '', top: 0, left: 0 })
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSelectedGroup(activeGroup)
  }, [activeGroup])

  const hideTooltip = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
  }, [])

  const showTooltip = useCallback(
    (e: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>, label: string) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      const rect = e.currentTarget.getBoundingClientRect()
      hoverTimerRef.current = setTimeout(() => {
        setTooltip({
          visible: true,
          label,
          top: rect.top + rect.height / 2,
          left: rect.right + 10,
        })
      }, 280)
    },
    [],
  )

  useEffect(() => {
    if (!openMobile) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMobile(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openMobile, setOpenMobile])

  useEffect(() => {
    hideTooltip()
  }, [openMobile, hideTooltip])

  const closeMobile = useCallback(() => {
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile])

  const handleSelectNav = useCallback(
    (path: string) => {
      navigate(path)
      hideTooltip()
      closeMobile()
    },
    [navigate, hideTooltip, closeMobile],
  )

  const handleGroupClick = useCallback(
    (group: NavGroup) => {
      hideTooltip()
      if (isMobile) {
        setSelectedGroup(group)
        return
      }
      if (!open) {
        setSelectedGroup(group)
        setOpen(true)
        return
      }
      if (selectedGroup === group) {
        setOpen(false)
        return
      }
      setSelectedGroup(group)
    },
    [hideTooltip, isMobile, open, selectedGroup, setOpen],
  )

  const handleLogout = useCallback(() => {
    closeMobile()
    logout()
    navigate('/login', { replace: true })
  }, [closeMobile, logout, navigate])

  if (!user) return null

  const items = navForRole(user.role)
  const availableGroups = NAV_GROUPS.filter((group) =>
    items.some((item) => item.group === group),
  )
  const groupItems = items.filter((item) => item.group === selectedGroup)

  const isActivePath = (path: string) =>
    path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`)

  const renderRail = () => (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex h-14 w-full shrink-0 items-center justify-center border-b border-[#334155]">
        <button
          type="button"
          onClick={() => handleSelectNav('/dashboard')}
          onMouseEnter={(e) => showTooltip(e, 'CIT Scheduler')}
          onMouseLeave={hideTooltip}
          onFocus={(e) => showTooltip(e, 'CIT Scheduler')}
          onBlur={hideTooltip}
          aria-label="CIT Scheduler home"
          className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white p-0.5 transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#64748b]"
        >
          <img src="/logo-mark.png" alt="" className="h-full w-full object-contain" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto py-3">
        {availableGroups.map((group) => {
          const Icon = GROUP_ICONS[group]
          const isSelected = selectedGroup === group
          return (
            <button
              key={group}
              type="button"
              onClick={() => handleGroupClick(group)}
              onMouseEnter={(e) => showTooltip(e, group)}
              onMouseLeave={hideTooltip}
              onFocus={(e) => showTooltip(e, group)}
              onBlur={hideTooltip}
              aria-label={group}
              aria-pressed={isSelected && open}
              className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition-[color,background-color,transform] duration-200 hover:scale-[1.06] active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#64748b] ${
                isSelected
                  ? 'bg-[#334155] text-[#f8fafc]'
                  : 'text-[#cbd5e1] hover:bg-[#2c3e57] hover:text-[#f1f5f9]'
              }`}
            >
              <Icon size={18} strokeWidth={isSelected ? 2 : 1.75} />
            </button>
          )
        })}
      </div>

      <div className="flex w-full shrink-0 justify-center border-t border-[#334155] py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseEnter={(e) => showTooltip(e, user.displayName)}
              onMouseLeave={hideTooltip}
              onFocus={(e) => showTooltip(e, user.displayName)}
              onBlur={hideTooltip}
              aria-label={`Account menu for ${user.displayName}`}
              className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[#475569] bg-[#334155] text-[10.5px] font-medium text-[#f8fafc] transition-colors hover:border-[#64748b] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#64748b]"
            >
              {user.initials}
              <span className="absolute -bottom-[1px] -right-[1px] h-[7px] w-[7px] rounded-full bg-[#93c5fd] ring-2 ring-[#1e293b]" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? 'top' : 'right'}
            align="start"
            className="min-w-56 rounded-lg"
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  {user.initials}
                </span>
                <div className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate font-medium text-popover-foreground">
                    {user.displayName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {ROLE_LABEL[user.role]}
                    {user.department ? ` · ${user.department}` : ''}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={handleLogout}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  const renderPanel = (mobile = false) => (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#334155] px-3">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-[#cbd5e1]">
          {selectedGroup}
        </span>
        {!mobile && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse navigation"
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#cbd5e1] transition-colors hover:bg-[#334155] hover:text-[#f1f5f9] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#64748b]"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      <nav
        aria-label={`${selectedGroup} links`}
        className="cit-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2"
      >
        <ul key={selectedGroup} className="cit-stagger space-y-0.5" role="list">
          {groupItems.map((item) => {
            const Icon = item.icon
            const isActive = isActivePath(item.path)
            return (
              <li key={item.path}>
                <button
                  type="button"
                  onClick={() => handleSelectNav(item.path)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex h-9 w-full items-center overflow-hidden rounded-[8px] px-2.5 text-left transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#94a3b8] ${
                    isActive
                      ? 'bg-[#334155] text-[#f8fafc]'
                      : 'text-[#cbd5e1] hover:bg-[#2c3e57] hover:text-[#f1f5f9]'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-[8px] bottom-[8px] w-[2.5px] rounded-r-full bg-[#f4f4f5] transition-opacity duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <Icon
                    size={16}
                    strokeWidth={isActive ? 2 : 1.75}
                    className="shrink-0 transition-colors duration-150"
                  />
                  <span
                    className={`ml-2.5 truncate text-[13px] tracking-[-0.005em] ${
                      isActive ? 'font-medium' : 'font-normal'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-[#334155] px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">
          CIT Scheduler · official
        </span>
      </div>
    </div>
  )

  return (
    <>
      <style>{SIDEBAR_MOTION_STYLES}</style>

      <aside
        aria-label="Primary navigation rail"
        className="z-40 hidden h-full w-16 shrink-0 flex-col bg-[#1e293b] md:flex"
      >
        {renderRail()}
      </aside>

      <aside
        aria-label="Section navigation"
        style={{ width: open ? `${PANEL_WIDTH}px` : '0px' }}
        className="cit-sidebar-panel z-30 hidden h-full shrink-0 flex-col overflow-hidden rounded-tr-2xl border-r border-[#334155] bg-[#243247] md:flex"
      >
        <div
          style={{ width: `${PANEL_WIDTH}px` }}
          className={`h-full shrink-0 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {renderPanel()}
        </div>
      </aside>

      <div
        className={`fixed inset-0 z-50 md:hidden ${
          openMobile ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!openMobile}
      >
        <div
          onClick={() => setOpenMobile(false)}
          className={`fixed inset-0 bg-black/65 transition-opacity duration-300 ${
            openMobile ? 'opacity-100' : 'opacity-0'
          }`}
        />

        <aside
          aria-label="Mobile navigation drawer"
          className={`cit-mobile-drawer fixed inset-y-0 left-0 z-50 flex w-[314px] max-w-[92vw] overflow-hidden rounded-r-2xl border-r border-[#334155] bg-[#1e293b] ${
            openMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="w-16 shrink-0">{renderRail()}</div>
          <div className="min-w-0 flex-1 bg-[#243247]">{renderPanel(true)}</div>
        </aside>
      </div>

      <div
        role="tooltip"
        style={{
          top: `${tooltip.top}px`,
          left: `${tooltip.left}px`,
          transform: `translate3d(${tooltip.visible ? '0px' : '-4px'}, -50%, 0)`,
        }}
        className={`pointer-events-none fixed z-50 rounded-[6px] border border-[#475569] bg-[#243247] px-[9px] py-[5px] text-[12px] font-medium tracking-[-0.005em] text-[#f8fafc] shadow-md transition-all duration-150 ${
          tooltip.visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {tooltip.label}
      </div>
    </>
  )
}
