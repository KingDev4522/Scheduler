import type { ComponentProps } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronsUpDown, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from './ui/sidebar'
import { ROLE_LABEL, useAuth } from '../lib/auth'
import { NAV_GROUPS, navForRole } from '../lib/nav'

/** The app's navigation column: brand, role-filtered groups, user menu, rail. */
export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { user, logout } = useAuth()
  const { isMobile, setOpenMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user) return null

  const items = navForRole(user.role)

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  const handleLogout = () => {
    closeMobile()
    logout()
    navigate('/login', { replace: true })
  }

  const isActivePath = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Brand */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <CalendarClock className="size-4" aria-hidden />
          </span>
          <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold text-white">
              CIT Scheduler
            </span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              Campus scheduling platform
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group)
          if (groupItems.length === 0) return null
          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
              <SidebarMenu>
                {groupItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(item.path)}
                      tooltip={item.label}
                    >
                      <NavLink to={item.path} end={item.path === '/'} onClick={closeMobile}>
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      {/* User */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                    {user.initials}
                  </span>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.displayName}</span>
                    <span className="truncate text-xs">{ROLE_LABEL[user.role]}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto" aria-hidden />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
