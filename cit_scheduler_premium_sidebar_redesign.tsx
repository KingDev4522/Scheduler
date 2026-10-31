import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Calendar,
  DoorOpen,
  GraduationCap,
  CalendarCheck,
  GitPullRequest,
  Sparkles,
  CheckCircle2,
  ArrowLeftRight,
  HelpCircle,
  PanelLeft,
  PanelLeftClose,
  Menu,
  X,
  Clock,
  Users,
  AlertCircle,
  Check,
  Search,
  Bell,
  ChevronRight,
  Building2,
  BookOpen,
  SlidersHorizontal,
  ArrowUpRight
} from 'lucide-react';

/**
 * NAVIGATION CONFIGURATION
 * Preserves the exact groupings, labels, icons, and hierarchy of CIT Scheduler.
 */
const NAVIGATION_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    ],
  },
  {
    id: 'scheduling',
    label: 'Scheduling',
    items: [
      { id: 'timetables', label: 'Timetables', icon: Calendar, path: '/timetables' },
      { id: 'rooms', label: 'Rooms', icon: DoorOpen, path: '/rooms' },
      { id: 'exams', label: 'Exams', icon: GraduationCap, path: '/exams' },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      { id: 'bookings', label: 'Bookings', icon: CalendarCheck, path: '/bookings' },
      { id: 'changes', label: 'Changes', icon: GitPullRequest, path: '/changes', badge: '3' },
      { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, path: '/ai-assistant' },
      { id: 'approvals', label: 'Approvals', icon: CheckCircle2, path: '/approvals', badge: '5' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'import-exports', label: 'Import / Exports', icon: ArrowLeftRight, path: '/import-exports' },
      { id: 'help', label: 'Help', icon: HelpCircle, path: '/help' },
    ],
  },
];

const USER_PROFILE = {
  initials: 'AD',
  name: 'Alex Donovan',
  role: 'Administrator',
  email: 'a.donovan@cit.edu',
};

const STORAGE_KEY = 'cit_scheduler_sidebar_collapsed_v1';

/**
 * DELAYED TOOLTIP FOR COLLAPSED RAIL
 * Renders a restrained, high-contrast floating label on the right of the icon rail
 * with a subtle 140ms hover delay inspired by the ChatGPT desktop app.
 */
function RailTooltip({ children, label, badge, enabled }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const timerRef = useRef(null);

  const handleMouseEnter = () => {
    if (!enabled) return;
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.top + rect.height / 2,
          left: rect.right + 10,
        });
        setVisible(true);
      }
    }, 140);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => {
    if (!enabled) setVisible(false);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className="relative flex items-center justify-center w-full"
    >
      {children}
      {enabled && visible && (
        <div
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: 'translateY(-50%)',
          }}
          className="fixed z-50 pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#2A2A2A] text-[#F3F4F6] text-[12.5px] font-medium tracking-tight shadow-[0_6px_20px_rgba(0,0,0,0.55)] border border-white/[0.08] whitespace-nowrap animate-in fade-in duration-150"
          role="tooltip"
        >
          <span>{label}</span>
          {badge && (
            <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-white/10 text-zinc-300">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * APPLICATION LOGO MARK
 * Minimal architectural emblem representing CIT Scheduler.
 */
function CITLogoMark({ className = 'w-7 h-7' }) {
  return (
    <div
      className={`${className} rounded-lg bg-[#232323] border border-white/[0.08] flex items-center justify-center text-zinc-100 shrink-0 select-none shadow-sm`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <path d="M7 11h4v5H7z" fill="currentColor" stroke="none" />
        <line x1="14" y1="11" x2="17" y2="11" />
        <line x1="14" y1="15" x2="17" y2="15" />
      </svg>
    </div>
  );
}

/**
 * UNIFIED RESPONSIVE SIDEBAR COMPONENT
 * Supports Expanded (256px), Collapsed Icon Rail (60px), and Mobile Drawer states
 * within a single unified DOM hierarchy to ensure zero layout jump and smooth transitions.
 */
function ApplicationSidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  activeRoute,
  onNavigate,
}) {
  // On mobile drawer, always display the full expanded appearance
  const collapsed = isCollapsed && !isMobileOpen;

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity duration-250 md:hidden ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Primary Sidebar Container */}
      <aside
        aria-label="Primary Sidebar Navigation"
        style={{
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col shrink-0 bg-[#171717] text-[#ECECEC] border-r border-white/[0.06] select-none transition-[width,transform] duration-[250ms] overflow-hidden ${
          isMobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-[60px]' : 'md:w-[256px]'}`}
      >
        {/* Top Header: Brand + ChatGPT-inspired Panel Toggle */}
        <div className="h-14 px-2.5 flex items-center justify-between shrink-0">
          {collapsed ? (
            /* Collapsed Top Header: Stacked or swapping clean logo + toggle trigger */
            <div className="w-full flex flex-col items-center">
              <RailTooltip label="Expand sidebar" enabled={true}>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Expand sidebar"
                  className="group relative w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
                >
                  {/* Show logo normally, smoothly swap to PanelLeft on hover like ChatGPT desktop */}
                  <span className="transition-opacity duration-150 group-hover:opacity-0">
                    <CITLogoMark className="w-7 h-7" />
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <PanelLeft className="w-[18px] h-[18px] stroke-[1.75]" />
                  </span>
                </button>
              </RailTooltip>
            </div>
          ) : (
            /* Expanded Top Header: Logo + Brand Title on left, Collapse button on right */
            <div className="w-full flex items-center justify-between pl-1.5 pr-0.5">
              <div
                onClick={() => onNavigate('dashboard')}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer group py-1 pr-2 rounded-lg"
              >
                <CITLogoMark className="w-7 h-7" />
                <div className="flex flex-col min-w-0 transition-opacity duration-200 opacity-100">
                  <span className="text-[13.5px] font-semibold tracking-[-0.01em] text-zinc-100 truncate leading-tight">
                    CIT Scheduler
                  </span>
                </div>
              </div>

              {/* Desktop Sidebar Collapse Button */}
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors duration-150 shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
              >
                <PanelLeftClose className="w-[17px] h-[17px] stroke-[1.75]" />
              </button>

              {/* Mobile Drawer Close Button */}
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="flex md:hidden w-8 h-8 rounded-lg items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors duration-150 shrink-0"
              >
                <X className="w-[18px] h-[18px] stroke-[1.75]" />
              </button>
            </div>
          )}
        </div>

        {/* Dedicated Toggle Button Row in Collapsed Mode so Logo & Toggle are both always visible */}
        {collapsed && (
          <div className="px-2.5 pb-1.5 flex justify-center shrink-0">
            <RailTooltip label="Open sidebar" enabled={true}>
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Open sidebar"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
              >
                <PanelLeft className="w-[18px] h-[18px] stroke-[1.75]" />
              </button>
            </RailTooltip>
          </div>
        )}

        {/* Navigation Scroll Region */}
        <nav
          aria-label="CIT Scheduler Sections"
          className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2 space-y-4 scrollbar-none"
        >
          {NAVIGATION_GROUPS.map((group, groupIndex) => (
            <div key={group.id} className="space-y-0.5">
              {/* Section Heading — Smoothly collapses height & opacity when in icon rail mode */}
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  collapsed
                    ? 'max-h-0 opacity-0 pointer-events-none mb-0'
                    : 'max-h-6 opacity-100 px-2.5 pb-1 pt-0.5'
                }`}
              >
                <span className="text-[11px] font-medium tracking-[0.02em] text-zinc-500 select-none">
                  {group.label}
                </span>
              </div>

              {/* Subtle spacer between icon groups when collapsed */}
              {collapsed && groupIndex > 0 && (
                <div className="h-1.5" aria-hidden="true" />
              )}

              {/* Navigation Items */}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeRoute === item.id;

                  return (
                    <RailTooltip
                      key={item.id}
                      label={item.label}
                      badge={item.badge}
                      enabled={collapsed}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          if (isMobileOpen) onCloseMobile();
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative flex items-center w-full h-9 rounded-lg text-[13.5px] transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 ${
                          collapsed ? 'justify-center px-0 w-9 mx-auto' : 'px-2.5 gap-3'
                        } ${
                          isActive
                            ? 'bg-white/[0.09] text-white font-medium'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.045] font-normal'
                        }`}
                      >
                        {/* Active indicator pill for collapsed rail clarity */}
                        {isActive && collapsed && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full bg-zinc-200"
                          />
                        )}

                        {/* Icon */}
                        <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                          <Icon
                            className={`w-[18px] h-[18px] transition-colors duration-150 ${
                              isActive
                                ? 'text-white stroke-[1.9]'
                                : 'text-zinc-400 group-hover:text-zinc-200 stroke-[1.75]'
                            }`}
                          />
                        </span>

                        {/* Label + Optional Count Pill (smooth fade without layout jump) */}
                        <div
                          className={`flex items-center justify-between flex-1 min-w-0 overflow-hidden transition-opacity duration-200 ${
                            collapsed ? 'opacity-0 w-0 pointer-events-none hidden' : 'opacity-100'
                          }`}
                        >
                          <span className="truncate leading-none">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`ml-2 px-1.5 py-0.5 text-[11px] leading-none rounded-md font-medium transition-colors ${
                                isActive
                                  ? 'bg-white/[0.14] text-zinc-100'
                                  : 'bg-white/[0.06] text-zinc-400 group-hover:text-zinc-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>

                        {/* Subtle dot indicator on collapsed icon if item has pending badge */}
                        {collapsed && item.badge && (
                          <span
                            aria-hidden="true"
                            className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 ring-2 ring-[#171717]"
                          />
                        )}
                      </button>
                    </RailTooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom User Profile Area */}
        <div className="p-2 shrink-0 border-t border-white/[0.05]">
          <RailTooltip
            label={`${USER_PROFILE.name} · ${USER_PROFILE.role}`}
            enabled={collapsed}
          >
            <button
              type="button"
              className={`group w-full flex items-center rounded-lg p-1.5 text-left hover:bg-white/[0.05] transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 ${
                collapsed ? 'justify-center' : 'gap-2.5'
              }`}
            >
              {/* User Avatar */}
              <div className="w-7 h-7 rounded-full bg-[#2A2A2A] border border-white/[0.09] flex items-center justify-center text-[11px] font-semibold tracking-tight text-zinc-200 shrink-0">
                {USER_PROFILE.initials}
              </div>

              {/* User Name & Administrator Role */}
              <div
                className={`flex flex-col min-w-0 flex-1 overflow-hidden transition-opacity duration-200 ${
                  collapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'
                }`}
              >
                <span className="text-[13px] font-medium text-zinc-200 truncate leading-tight">
                  {USER_PROFILE.name}
                </span>
                <span className="text-[11.5px] text-zinc-500 truncate leading-tight mt-0.5">
                  {USER_PROFILE.role}
                </span>
              </div>
            </button>
          </RailTooltip>
        </div>
      </aside>
    </>
  );
}

/**
 * EXISTING CIT SCHEDULER MAIN CONTENT
 * Kept intact and faithful to the CIT Scheduler domain to demonstrate how the main
 * application workspace seamlessly adjusts to the sidebar states and route selection.
 */
function MainWorkspaceContent({
  activeRoute,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  onOpenMobileMenu,
}) {
  // Resolve active item metadata
  const allItems = NAVIGATION_GROUPS.flatMap((g) =>
    g.items.map((item) => ({ ...item, groupLabel: g.label }))
  );
  const currentItem =
    allItems.find((item) => item.id === activeRoute) || allItems[0];
  const ActiveIcon = currentItem.icon;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#212121] text-zinc-100">
      {/* Top Application Bar */}
      <header className="h-14 px-4 sm:px-6 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-[#212121]/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation drawer"
            className="md:hidden -ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>

          {/* Breadcrumb Context */}
          <div className="flex items-center gap-2 text-[13.5px] min-w-0">
            <span className="text-zinc-500 hidden sm:inline">{currentItem.groupLabel}</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 hidden sm:inline shrink-0" />
            <span className="font-medium text-zinc-100 truncate">{currentItem.label}</span>
          </div>
        </div>

        {/* Right Workspace Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Term Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-[12px] text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Semester 1 · AY 2026/27</span>
          </div>

          {/* Sidebar state quick indicator pill for testing */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Toggle Sidebar (Ctrl+B)"
          >
            {isCollapsed ? (
              <>
                <PanelLeft className="w-3.5 h-3.5" />
                <span>Expand Rail</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-3.5 h-3.5" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>

          <button
            type="button"
            aria-label="Notifications"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Scrollable Viewport */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <ActiveIcon className="w-5 h-5 text-zinc-400 stroke-[1.75]" />
                <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
                  {currentItem.label}
                </h1>
              </div>
              <p className="text-[13.5px] text-zinc-400 mt-1">
                {activeRoute === 'dashboard' &&
                  'Academic timetable status, room utilization metrics, and pending scheduling workflows.'}
                {activeRoute === 'timetables' &&
                  'Master academic timetables across departments, cohorts, and lecture blocks.'}
                {activeRoute === 'rooms' &&
                  'Campus lecture theatres, laboratories, and seminar room capacity allocations.'}
                {activeRoute === 'exams' &&
                  'Final examination slots, invigilation rosters, and seating configurations.'}
                {activeRoute === 'bookings' &&
                  'Ad-hoc room reservations, guest lectures, and society event requests.'}
                {activeRoute === 'changes' &&
                  'Requested timetable adjustments and conflict resolution queue.'}
                {activeRoute === 'ai-assistant' &&
                  'Constraint-aware scheduling assistant for conflict-free slot optimization.'}
                {activeRoute === 'approvals' &&
                  'Departmental sign-offs and registrar approval items requiring administrator review.'}
                {activeRoute === 'import-exports' &&
                  'Synchronize SIS data feeds, CSV rosters, and iCal timetable exports.'}
                {activeRoute === 'help' &&
                  'Documentation, keyboard shortcuts, and scheduling constraint guidelines.'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search schedules, rooms..."
                  className="bg-[#181818] border border-white/[0.07] rounded-lg pl-8 pr-3 py-1.5 text-[13px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-white/20 w-52 sm:w-60 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => onNavigate('ai-assistant')}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-[13px] flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Schedule</span>
              </button>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                label: 'Scheduled Classes',
                value: '1,428',
                delta: '98.4% conflict-free',
                icon: Calendar,
              },
              {
                label: 'Active Rooms',
                value: '84 / 92',
                delta: '91.3% peak utilization',
                icon: Building2,
              },
              {
                label: 'Pending Changes',
                value: '3',
                delta: '2 clash resolutions',
                icon: GitPullRequest,
                route: 'changes',
              },
              {
                label: 'Awaiting Approval',
                value: '5',
                delta: 'Registrar sign-off',
                icon: CheckCircle2,
                route: 'approvals',
              },
            ].map((stat, idx) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={idx}
                  onClick={() => stat.route && onNavigate(stat.route)}
                  className={`p-4 rounded-xl bg-[#191919] border border-white/[0.06] flex flex-col justify-between gap-3 ${
                    stat.route ? 'cursor-pointer hover:border-white/[0.12] transition-colors' : ''
                  }`}
                >
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-[12.5px] font-medium">{stat.label}</span>
                    <StatIcon className="w-4 h-4 text-zinc-500 stroke-[1.75]" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold tracking-tight text-zinc-100">
                      {stat.value}
                    </div>
                    <div className="text-[12px] text-zinc-500 mt-0.5">{stat.delta}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timetable Live Matrix & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Schedule Table */}
            <div className="lg:col-span-2 rounded-xl bg-[#191919] border border-white/[0.06] overflow-hidden">
              <div className="px-4 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <h2 className="text-[13.5px] font-medium text-zinc-200">
                    Today’s Active Allocations — {currentItem.label}
                  </h2>
                </div>
                <span className="text-[12px] text-zinc-500">Updated 2m ago</span>
              </div>

              <div className="divide-y divide-white/[0.05]">
                {[
                  {
                    code: 'CS-304',
                    title: 'Distributed Systems & Consensus',
                    room: 'LT-01 (Main Wing)',
                    time: '09:00 – 11:00',
                    cohort: 'BSc Computer Science Y3',
                    status: 'Confirmed',
                  },
                  {
                    code: 'EE-210',
                    title: 'Embedded Microcontrollers Lab',
                    room: 'LAB-B204',
                    time: '11:00 – 13:00',
                    cohort: 'BEng Electrical Eng Y2',
                    status: 'Confirmed',
                  },
                  {
                    code: 'MA-108',
                    title: 'Linear Algebra & Optimization',
                    room: 'SEM-109',
                    time: '14:00 – 15:30',
                    cohort: 'Common First Year',
                    status: 'Room Swap Pending',
                  },
                  {
                    code: 'AI-402',
                    title: 'Statistical Machine Learning',
                    room: 'LT-03 (North Block)',
                    time: '16:00 – 18:00',
                    cohort: 'MSc Artificial Intelligence',
                    status: 'Confirmed',
                  },
                ].map((slot) => (
                  <div
                    key={slot.code}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300">
                          {slot.code}
                        </span>
                        <span className="text-[13.5px] font-medium text-zinc-200 truncate">
                          {slot.title}
                        </span>
                      </div>
                      <div className="text-[12px] text-zinc-500 mt-0.5 flex items-center gap-2">
                        <span>{slot.cohort}</span>
                        <span>·</span>
                        <span>{slot.room}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[12.5px] font-mono text-zinc-400">
                        {slot.time}
                      </span>
                      <span
                        className={`text-[11.5px] px-2 py-0.5 rounded-full font-medium ${
                          slot.status === 'Confirmed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        }`}
                      >
                        {slot.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Navigation & Workflow Panel */}
            <div className="rounded-xl bg-[#191919] border border-white/[0.06] p-4 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13.5px] font-medium text-zinc-200">
                    Workflow Queue
                  </h2>
                  <span className="text-[11.5px] text-zinc-500">8 items</span>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      title: 'Approve Exam Seating — Hall B',
                      dept: 'Examinations Office',
                      target: 'approvals',
                    },
                    {
                      title: 'Resolve CS-304 / Lab B204 Overlap',
                      dept: 'School of Computing',
                      target: 'changes',
                    },
                    {
                      title: 'Import Autumn Roster CSV',
                      dept: 'Student Records',
                      target: 'import-exports',
                    },
                  ].map((task, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onNavigate(task.target)}
                      className="w-full p-2.5 rounded-lg bg-[#212121] hover:bg-white/[0.05] border border-white/[0.05] text-left transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-[13px] font-medium text-zinc-200 truncate">
                          {task.title}
                        </div>
                        <div className="text-[11.5px] text-zinc-500">{task.dept}</div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between text-[12px] text-zinc-500">
                <span>Sidebar shortcut</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-300 font-mono text-[11px]">
                  Ctrl / ⌘ + B
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * ROOT APPLICATION SHELL
 * Coordinates persistent sidebar preference, responsive breakpoint adaptation,
 * keyboard shortcuts (Ctrl/Cmd + B), and active route state.
 */
export default function App() {
  // Initialize sidebar collapsed preference from localStorage or tablet screen width
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        return JSON.parse(saved);
      }
      // Prefer collapsed icon rail by default on tablet viewports (768px - 1024px)
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024) {
        return true;
      }
    } catch {
      // Fallback to expanded if localStorage is unavailable
    }
    return false;
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState('dashboard');

  // Persist user's sidebar state preference across reloads
  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage write errors in restricted frames
      }
      return next;
    });
  };

  // Support Ctrl+B / Cmd+B desktop shortcut to toggle sidebar like ChatGPT desktop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Automatically close mobile drawer if viewport resizes to desktop/tablet
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileOpen]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121] antialiased selection:bg-white/15 selection:text-white">
      <ApplicationSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        activeRoute={activeRoute}
        onNavigate={(routeId) => setActiveRoute(routeId)}
      />

      <MainWorkspaceContent
        activeRoute={activeRoute}
        onNavigate={(routeId) => setActiveRoute(routeId)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onOpenMobileMenu={() => setIsMobileOpen(true)}
      />
    </div>
  );
}