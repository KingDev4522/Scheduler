import type { ReactNode } from 'react'
import {
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ClipboardCheck,
  DatabaseBackup,
  DoorOpen,
  GitCompareArrows,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from './auth'
import Dashboard from '../pages/Dashboard'
import Timetables from '../pages/Timetables'
import Rooms from '../pages/Rooms'
import Bookings from '../pages/Bookings'
import ManualBooking from '../pages/ManualBooking'
import Changes from '../pages/Changes'
import Exams from '../pages/Exams'
import Assistant from '../pages/Assistant'
import Approvals from '../pages/Approvals'
import AdminImportExport from '../pages/AdminImportExport'
import OfficialData from '../pages/OfficialData'
import Workspace from '../pages/Workspace'
import Help from '../pages/Help'

const ALL: Role[] = ['admin', 'event_manager', 'department_coordinator', 'faculty']
const ADMIN_COORD: Role[] = ['admin', 'department_coordinator']
const ADMIN_ONLY: Role[] = ['admin']

export type NavGroup = 'Overview' | 'Scheduling' | 'Workflow' | 'System'

export interface NavItem {
  path: string
  label: string
  /** Role-specific wording, e.g. "Venue request" for a club representative. */
  labelByRole?: Partial<Record<Role, string>>
  icon: LucideIcon
  group: NavGroup
  roles: Role[]
  element: ReactNode
}

export function navLabel(item: NavItem, role: Role): string {
  return item.labelByRole?.[role] ?? item.label
}

/** Single source of truth: sidebar rendering + route table + access control. */
export const NAV: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview', roles: ALL, element: <Dashboard /> },
  { path: '/timetables', label: 'Timetables', icon: CalendarRange, group: 'Scheduling', roles: ALL, element: <Timetables /> },
  { path: '/official', label: 'Official Data', icon: CalendarDays, group: 'Scheduling', roles: ALL, element: <OfficialData /> },
  { path: '/rooms', label: 'Rooms', icon: DoorOpen, group: 'Scheduling', roles: ALL, element: <Rooms /> },
  { path: '/exams', label: 'Exams', icon: GraduationCap, group: 'Scheduling', roles: ADMIN_COORD, element: <Exams /> },
  {
    path: '/bookings',
    label: 'Bookings',
    labelByRole: { faculty: 'My requests', event_manager: 'My requests' },
    icon: CalendarCheck2,
    group: 'Workflow',
    roles: ALL,
    element: <Bookings />,
  },
  {
    path: '/manual',
    label: 'Manual Booking',
    labelByRole: {
      admin: 'Booking & changes',
      department_coordinator: 'Department event',
      faculty: 'Request change',
      event_manager: 'Venue request',
    },
    icon: CalendarPlus,
    group: 'Workflow',
    roles: ALL,
    element: <ManualBooking />,
  },
  { path: '/changes', label: 'Changes', icon: GitCompareArrows, group: 'Workflow', roles: ADMIN_ONLY, element: <Changes /> },
  { path: '/assistant', label: 'AI Assistant', icon: Sparkles, group: 'Workflow', roles: ALL, element: <Assistant /> },
  { path: '/workspace', label: 'My Workspace', icon: UserRound, group: 'Workflow', roles: ALL, element: <Workspace /> },
  { path: '/approvals', label: 'Approvals', icon: ClipboardCheck, group: 'Workflow', roles: ADMIN_COORD, element: <Approvals /> },
  { path: '/admin', label: 'Import / Exports', icon: DatabaseBackup, group: 'System', roles: ADMIN_ONLY, element: <AdminImportExport /> },
  { path: '/help', label: 'Help', icon: LifeBuoy, group: 'System', roles: ALL, element: <Help /> },
]

export const NAV_GROUPS: NavGroup[] = ['Overview', 'Scheduling', 'Workflow', 'System']

export function navForRole(role: Role): NavItem[] {
  return NAV.filter((item) => item.roles.includes(role))
}

export function findNav(pathname: string): NavItem | undefined {
  return NAV.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  )
}
