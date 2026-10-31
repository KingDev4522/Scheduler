import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  Calendar,
  DoorOpen,
  GraduationCap,
  BookmarkCheck,
  GitPullRequest,
  Sparkles,
  CheckCircle2,
  ArrowLeftRight,
  HelpCircle,
  PanelLeft,
  Search,
  Plus,
  Filter,
  Download,
  Clock,
  Users,
  Building2,
  AlertCircle,
  ChevronRight,
  Check,
  MoreHorizontal,
  SlidersHorizontal,
  ArrowUpRight,
  Terminal
} from 'lucide-react';

// ---------------------------------------------------------------------------
// 1. Navigation Structure (Strictly Preserved)
// ---------------------------------------------------------------------------
const NAVIGATION_GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, route: '/dashboard' }
    ]
  },
  {
    id: 'scheduling',
    label: 'Scheduling',
    items: [
      { id: 'timetables', label: 'Timetables', icon: Calendar, route: '/timetables', badge: 'Live' },
      { id: 'rooms', label: 'Rooms', icon: DoorOpen, route: '/rooms' },
      { id: 'exams', label: 'Exams', icon: GraduationCap, route: '/exams' }
    ]
  },
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      { id: 'bookings', label: 'Bookings', icon: BookmarkCheck, route: '/bookings' },
      { id: 'changes', label: 'Changes', icon: GitPullRequest, route: '/changes', count: 3 },
      { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, route: '/ai-assistant' },
      { id: 'approvals', label: 'Approvals', icon: CheckCircle2, route: '/approvals', count: 5 }
    ]
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'import-exports', label: 'Import / Exports', icon: ArrowLeftRight, route: '/import-exports' },
      { id: 'help', label: 'Help', icon: HelpCircle, route: '/help' }
    ]
  }
];

const ADMIN_PROFILE = {
  name: 'Dr. Elena Vance',
  role: 'Chief Scheduler • CIT',
  initials: 'EV',
  email: 'e.vance@cit.edu'
};

// ---------------------------------------------------------------------------
// 2. Mock Data for Coordinated Layout Reflow Testing
// ---------------------------------------------------------------------------
const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIMETABLE_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

const SCHEDULE_BLOCKS = [
  { id: 'CS301', title: 'Systems Architecture', room: 'CIT-302 (Lab A)', instructor: 'Prof. K. Thorne', day: 0, start: 1, span: 2, type: 'Lecture', enrolled: '118/120' },
  { id: 'MA204', title: 'Linear Algebra II', room: 'Hall B-104', instructor: 'Dr. S. Lin', day: 0, start: 4, span: 2, type: 'Seminar', enrolled: '64/65' },
  { id: 'SE402', title: 'Distributed Consensus', room: 'CIT-401', instructor: 'Dr. E. Vance', day: 1, start: 0, span: 2, type: 'Core', enrolled: '45/50' },
  { id: 'AI310', title: 'Neural Computation', room: 'GPU Cluster Rm 2', instructor: 'Prof. M. Ravel', day: 1, start: 3, span: 3, type: 'Lab', enrolled: '80/80' },
  { id: 'CS301-B', title: 'Systems Arch (Sec B)', room: 'CIT-302 (Lab A)', instructor: 'Prof. K. Thorne', day: 2, start: 2, span: 2, type: 'Lecture', enrolled: '112/120' },
  { id: 'CY201', title: 'Applied Cryptography', room: 'SecLab 109', instructor: 'Dr. H. Mercer', day: 3, start: 1, span: 2, type: 'Workshop', enrolled: '38/40' },
  { id: 'DB305', title: 'Query Optimization', room: 'CIT-208', instructor: 'Prof. A. Koothrappali', day: 3, start: 5, span: 2, type: 'Lecture', enrolled: '90/95' },
  { id: 'SE499', title: 'Capstone Review Board', room: 'Auditorium North', instructor: 'Committee', day: 4, start: 2, span: 3, type: 'Exam', enrolled: '185/200' }
];

const ROOM_DATA = [
  { id: 'CIT-302', name: 'Systems Lab A', building: 'Computing North', capacity: 120, utilization: '92%', status: 'Occupied', nextFree: '14:00' },
  { id: 'CIT-401', name: 'Advanced Seminar Room', building: 'Computing North', capacity: 50, utilization: '78%', status: 'Available', nextFree: 'Now' },
  { id: 'GPU-02', name: 'Neural Cluster Bay 2', building: 'Research Wing', capacity: 80, utilization: '96%', status: 'Occupied', nextFree: '16:00' },
  { id: 'HALL-B104', name: 'Lecture Theatre B104', building: 'Main Quad', capacity: 160, utilization: '84%', status: 'Maintenance', nextFree: 'Tomorrow' },
  { id: 'SEC-109', name: 'Airgapped Security Lab', building: 'Annex C', capacity: 40, utilization: '61%', status: 'Available', nextFree: 'Now' },
  { id: 'AUD-N', name: 'Auditorium North', building: 'Central Forum', capacity: 250, utilization: '45%', status: 'Reserved', nextFree: '15:30' }
];

const RECENT_CHANGES = [
  { id: 'CHG-942', course: 'CS301 • Systems Architecture', action: 'Room swapped to CIT-302', author: 'E. Vance', time: '14m ago', state: 'Verified' },
  { id: 'CHG-941', course: 'AI310 • Neural Computation', action: 'Extended lab slot +60m', author: 'M. Ravel', time: '1h ago', state: 'Pending' },
  { id: 'CHG-939', course: 'SE499 • Capstone Review', action: 'Conflict resolved with MA204', author: 'AutoSolver', time: '3h ago', state: 'Verified' },
  { id: 'CHG-935', course: 'CY201 • Applied Cryptography', action: 'Instructor reassignment', author: 'H. Mercer', time: 'Yesterday', state: 'Verified' }
];

// ---------------------------------------------------------------------------
// 3. Main Application Component
// ---------------------------------------------------------------------------
export default function App() {
  // Persisted Sidebar State (Single Source of Truth)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('cit_scheduler_sidebar_collapsed');
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {
      // Fallback if storage is restricted
    }
    return typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024;
  });

  // Mobile Overlay Drawer State
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Active Navigation Route
  const [activeRoute, setActiveRoute] = useState('timetables');

  // Search filter state for interactive realism
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');

  // Portal Tooltip State (for Collapsed Desktop Sidebar & Header Toggle)
  const [tooltip, setTooltip] = useState({
    visible: false,
    label: '',
    shortcut: '',
    badge: null,
    top: 0,
    left: 0,
    align: 'right' // 'right' of sidebar or 'bottom' of header button
  });

  const hoverTimerRef = useRef(null);

  // Save preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('cit_scheduler_sidebar_collapsed', JSON.stringify(isCollapsed));
    } catch (e) {
      // Ignore storage errors
    }
  }, [isCollapsed]);

  // Clear tooltip immediately when sidebar state changes
  useEffect(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, [isCollapsed, isMobileOpen]);

  // Responsive breakpoint listener & Keyboard shortcuts (Cmd+B / Ctrl+B & Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setIsMobileOpen((prev) => !prev);
        } else {
          setIsCollapsed((prev) => !prev);
        }
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 768 && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileOpen]);

  // Unified Sidebar Toggle Handler
  const handleToggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  }, []);

  // Delayed Tooltip Trigger (280ms native desktop delay)
  const showSidebarTooltip = useCallback(
    (e, item, forceShow = false) => {
      if (!forceShow && (!isCollapsed || isMobileOpen)) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

      const rect = e.currentTarget.getBoundingClientRect();
      hoverTimerRef.current = setTimeout(() => {
        setTooltip({
          visible: true,
          label: item.label,
          shortcut: item.shortcut || '',
          badge: item.count || item.badge || null,
          top: rect.top + rect.height / 2,
          left: rect.right + 10,
          align: 'right'
        });
      }, 280);
    },
    [isCollapsed, isMobileOpen]
  );

  const showHeaderToggleTooltip = useCallback(
    (e) => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      const rect = e.currentTarget.getBoundingClientRect();
      hoverTimerRef.current = setTimeout(() => {
        setTooltip({
          visible: true,
          label: isCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
          shortcut: '⌘B',
          badge: null,
          top: rect.bottom + 8,
          left: Math.max(12, rect.left),
          align: 'bottom'
        });
      }, 280);
    },
    [isCollapsed]
  );

  const hideTooltip = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  // Navigation Click Handler
  const handleSelectNav = (itemId) => {
    setActiveRoute(itemId);
    hideTooltip();
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  // Resolve current active item metadata
  const activeItemObj =
    NAVIGATION_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeRoute) ||
    NAVIGATION_GROUPS[0].items[0];
  const activeGroupObj =
    NAVIGATION_GROUPS.find((g) => g.items.some((i) => i.id === activeRoute)) ||
    NAVIGATION_GROUPS[0];

  // Shared Navigation Content Renderer (Used in Desktop Rail & Mobile Drawer)
  const renderSidebarContents = (collapsedMode) => (
    <div className="flex flex-col h-full w-full select-none">
      {/* ----------------------------------------------------------------- */}
      {/* Top Application Branding Header                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="h-[56px] shrink-0 flex items-center px-[12px] border-b border-[#1c1c1f]">
        <button
          type="button"
          onClick={() => handleSelectNav('dashboard')}
          onMouseEnter={(e) =>
            collapsedMode &&
            showSidebarTooltip(e, { label: 'CIT Scheduler • Home' }, true)
          }
          onMouseLeave={hideTooltip}
          className="group relative flex items-center w-full h-[36px] rounded-[8px] px-[6px] text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[#52525b] hover:bg-[#161618] transition-colors duration-150 overflow-hidden"
        >
          {/* Stationary 24x24 Monochrome Academic Mark */}
          <div className="w-[24px] h-[24px] shrink-0 rounded-[6px] bg-[#ededef] text-[#09090b] flex items-center justify-center font-semibold text-[11px] tracking-tighter shadow-xs">
            CIT
          </div>

          {/* Smoothly Collapsing Brand Title */}
          <div
            className={`cit-label-transition flex items-center justify-between flex-1 min-w-0 ml-[10px] whitespace-nowrap ${
              collapsedMode
                ? 'opacity-0 -translate-x-[6px] pointer-events-none'
                : 'opacity-100 translate-x-0'
            }`}
            aria-hidden={collapsedMode}
          >
            <div className="flex items-center gap-[6px] truncate">
              <span className="text-[13.5px] font-medium text-[#f4f4f5] tracking-[-0.01em]">
                CIT Scheduler
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider px-[5px] py-[1px] rounded bg-[#1c1c1f] text-[#a1a1aa] border border-[#27272a]">
                v4.2
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Scrollable Navigation Groups                                      */}
      {/* ----------------------------------------------------------------- */}
      <nav
        aria-label="Primary Navigation"
        className="flex-1 overflow-y-auto overflow-x-hidden py-[10px] px-[12px] space-y-[4px] cit-scrollbar"
      >
        {NAVIGATION_GROUPS.map((group, groupIndex) => (
          <div key={group.id} className=" relative">
            {/* Collapsible Section Heading / Subtle Hairline Divider in Collapsed State */}
            <div
              className={`cit-section-header overflow-hidden relative flex items-center ${
                groupIndex === 0
                  ? collapsedMode
                    ? 'h-[4px] opacity-0'
                    : 'h-[24px] opacity-100'
                  : collapsedMode
                  ? 'h-[17px] opacity-100'
                  : 'h-[28px] opacity-100'
              }`}
            >
              {/* Section Text Label (Fades & translates slightly left when collapsing) */}
              <span
                className={`cit-label-transition block px-[8px] text-[10.5px] font-medium uppercase tracking-[0.07em] text-[#71717a] whitespace-nowrap ${
                  collapsedMode
                    ? 'opacity-0 -translate-x-[6px] pointer-events-none'
                    : 'opacity-100 translate-x-0'
                }`}
                aria-hidden={collapsedMode}
              >
                {group.label}
              </span>

              {/* Subtle Centered Hairline Divider when Collapsed (Except first group) */}
              {groupIndex > 0 && (
                <div
                  className={`cit-divider-transition absolute left-[8px] right-[8px] h-[1px] bg-[#1c1c1f] ${
                    collapsedMode ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                />
              )}
            </div>

            {/* Group Navigation Items */}
            <ul className="space-y-[2px]" role="list">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeRoute === item.id;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      onMouseEnter={(e) => showSidebarTooltip(e, item)}
                      onMouseLeave={hideTooltip}
                      onFocus={(e) => showSidebarTooltip(e, item)}
                      onBlur={hideTooltip}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={collapsedMode ? item.label : undefined}
                      className={`group relative flex items-center w-full h-[36px] px-[10px] rounded-[8px] text-left overflow-hidden transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#71717a] ${
                        isActive
                          ? 'bg-[#232326] text-[#f4f4f5]'
                          : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#e4e4e7]'
                      }`}
                    >
                      {/* Subtle Left Active Pill Indicator */}
                      <span
                        className={`absolute left-0 top-[9px] bottom-[9px] w-[2.5px] rounded-r-full bg-[#f4f4f5] transition-opacity duration-200 ${
                          isActive ? 'opacity-100' : 'opacity-0'
                        }`}
                      />

                      {/* Stationary 16px Lucide Icon — Always at 10px from button left edge */}
                      {/* Math: 12px nav pad + 10px btn pad + 16px icon + 10px pad + 12px nav pad = 60px! */}
                      <span className="w-[16px] h-[16px] shrink-0 flex items-center justify-center relative">
                        <Icon
                          size={16}
                          strokeWidth={isActive ? 2 : 1.75}
                          className="transition-colors duration-150"
                        />
                        {/* Subtle notification dot when collapsed if item has a count */}
                        {item.count && (
                          <span
                            className={`absolute -top-[2px] -right-[2px] w-[5px] h-[5px] rounded-full bg-[#e4e4e7] ring-2 ring-[#0c0c0e] transition-opacity duration-200 ${
                              collapsedMode ? 'opacity-100' : 'opacity-0'
                            }`}
                          />
                        )}
                      </span>

                      {/* Smoothly Animated Label & Right Metadata */}
                      <div
                        className={`cit-label-transition flex items-center justify-between flex-1 min-w-0 ml-[10px] whitespace-nowrap ${
                          collapsedMode
                            ? 'opacity-0 -translate-x-[6px] pointer-events-none'
                            : 'opacity-100 translate-x-0'
                        }`}
                        aria-hidden={collapsedMode}
                      >
                        <span
                          className={`text-[13px] truncate tracking-[-0.005em] ${
                            isActive ? 'font-medium text-[#f4f4f5]' : 'font-normal'
                          }`}
                        >
                          {item.label}
                        </span>

                        {item.count && (
                          <span
                            className={`ml-[8px] px-[6px] py-[0.5px] text-[11px] font-mono rounded-[5px] transition-colors ${
                              isActive
                                ? 'bg-[#323236] text-[#f4f4f5]'
                                : 'bg-[#18181b] text-[#71717a] group-hover:bg-[#232326] group-hover:text-[#a1a1aa]'
                            }`}
                          >
                            {item.count}
                          </span>
                        )}

                        {item.badge && (
                          <span className="ml-[8px] px-[5px] py-[0.5px] text-[10px] font-mono uppercase tracking-wider rounded-[4px] bg-[#1c1c1f] text-[#a1a1aa] border border-[#27272a]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ----------------------------------------------------------------- */}
      {/* Administrator Profile Footer (Smooth Avatar-Only Transition)      */}
      {/* ----------------------------------------------------------------- */}
      <div className="p-[12px] border-t border-[#1c1c1f] shrink-0">
        <button
          type="button"
          onMouseEnter={(e) =>
            collapsedMode &&
            showSidebarTooltip(
              e,
              { label: `${ADMIN_PROFILE.name} (${ADMIN_PROFILE.role})` },
              true
            )
          }
          onMouseLeave={hideTooltip}
          onFocus={(e) =>
            collapsedMode &&
            showSidebarTooltip(
              e,
              { label: `${ADMIN_PROFILE.name} (${ADMIN_PROFILE.role})` },
              true
            )
          }
          onBlur={hideTooltip}
          className="group relative flex items-center w-full h-[40px] px-[6px] rounded-[8px] text-left overflow-hidden hover:bg-[#18181b] transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#52525b]"
        >
          {/* Stationary 24x24 Avatar */}
          {/* Math: 12px container pad + 6px button pad + 24px avatar + 6px pad + 12px pad = 60px! */}
          <div className="relative w-[24px] h-[24px] shrink-0 rounded-full bg-[#27272a] border border-[#3f3f46] text-[#f4f4f5] flex items-center justify-center text-[10.5px] font-medium tracking-tight">
            {ADMIN_PROFILE.initials}
            <span className="absolute -bottom-[1px] -right-[1px] w-[7px] h-[7px] rounded-full bg-[#a1a1aa] ring-2 ring-[#0c0c0e]" />
          </div>

          {/* Administrator Details (Fades & translates smoothly) */}
          <div
            className={`cit-label-transition flex items-center justify-between flex-1 min-w-0 ml-[10px] whitespace-nowrap ${
              collapsedMode
                ? 'opacity-0 -translate-x-[6px] pointer-events-none'
                : 'opacity-100 translate-x-0'
            }`}
            aria-hidden={collapsedMode}
          >
            <div className="truncate">
              <div className="text-[12.5px] font-medium text-[#e4e4e7] leading-tight truncate">
                {ADMIN_PROFILE.name}
              </div>
              <div className="text-[11px] text-[#71717a] leading-tight truncate mt-[1px]">
                {ADMIN_PROFILE.role}
              </div>
            </div>
            <MoreHorizontal
              size={14}
              className="text-[#71717a] group-hover:text-[#a1a1aa] shrink-0 ml-[6px]"
            />
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111113] text-[#f4f4f5] antialiased selection:bg-[#27272a] selection:text-[#ffffff]">
      {/* ------------------------------------------------------------------- */}
      {/* Precision Motion & Reduced-Motion Styles                            */}
      {/* ------------------------------------------------------------------- */}
      <style>{`
        :root {
          --cit-ease: cubic-bezier(0.22, 1, 0.36, 1);
          --cit-duration: 300ms;
        }

        /* Coordinated Sidebar Width Transition */
        .cit-sidebar-rail {
          transition: width var(--cit-duration) var(--cit-ease);
          will-change: width;
        }

        /* Navigation Label Opacity & Horizontal Slide Transition */
        .cit-label-transition {
          transition:
            opacity 200ms var(--cit-ease),
            transform 260ms var(--cit-ease);
          will-change: opacity, transform;
        }

        /* Subtle 15ms Expand Delay so Width Leads Slightly Before Text Reveals */
        .cit-sidebar-expanded .cit-label-transition {
          transition-delay: 15ms;
        }

        /* Section Header Height & Opacity Coordination */
        .cit-section-header {
          transition:
            height var(--cit-duration) var(--cit-ease),
            opacity 200ms var(--cit-ease);
        }

        .cit-divider-transition {
          transition: opacity 220ms var(--cit-ease);
        }

        /* Mobile Drawer Slide Transition */
        .cit-mobile-drawer {
          transition: transform var(--cit-duration) var(--cit-ease);
          will-change: transform;
        }

        /* Custom Minimal Scrollbar */
        .cit-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .cit-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .cit-scrollbar::-webkit-scrollbar-thumb {
          background: #232326;
          border-radius: 9999px;
        }
        .cit-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #323236;
        }

        /* Strict Accessibility Support for Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .cit-sidebar-rail,
          .cit-label-transition,
          .cit-section-header,
          .cit-divider-transition,
          .cit-mobile-drawer {
            transition: none !important;
            transition-delay: 0ms !important;
          }
        }
      `}</style>

      {/* ------------------------------------------------------------------- */}
      {/* 1. Desktop & Tablet Adaptive Sidebar (250px <-> 60px)               */}
      {/* ------------------------------------------------------------------- */}
      <aside
        aria-label="Sidebar Navigation"
        style={{ width: isCollapsed ? '60px' : '250px' }}
        className={`cit-sidebar-rail hidden md:flex flex-col shrink-0 h-full bg-[#0c0c0e] border-r border-[#1c1c1f] z-20 overflow-hidden ${
          isCollapsed ? 'cit-sidebar-collapsed' : 'cit-sidebar-expanded'
        }`}
      >
        {renderSidebarContents(isCollapsed)}
      </aside>

      {/* ------------------------------------------------------------------- */}
      {/* 2. Mobile Overlay Drawer + Backdrop (< 768px)                       */}
      {/* ------------------------------------------------------------------- */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${
          isMobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!isMobileOpen}
      >
        {/* Dark Monochromatic Backdrop */}
        <div
          onClick={() => setIsMobileOpen(false)}
          className={`fixed inset-0 bg-black/65 transition-opacity duration-300 ${
            isMobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Animated Slide-Over Drawer */}
        <aside
          aria-label="Mobile Navigation Drawer"
          className={`cit-mobile-drawer relative w-[250px] max-w-[82vw] h-full bg-[#0c0c0e] border-r border-[#1f1f23] flex flex-col z-50 ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {renderSidebarContents(false)}
        </aside>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 3. Floating Portal Tooltip (Collapsed Icons & Header Toggle)        */}
      {/* ------------------------------------------------------------------- */}
      <div
        role="tooltip"
        style={{
          top: `${tooltip.top}px`,
          left: `${tooltip.left}px`,
          transform:
            tooltip.align === 'right'
              ? `translate3d(${tooltip.visible ? '0px' : '-4px'}, -50%, 0)`
              : `translate3d(0, ${tooltip.visible ? '0px' : '-4px'}, 0)`
        }}
        className={`fixed z-50 pointer-events-none flex items-center gap-[6px] px-[9px] py-[5px] rounded-[6px] bg-[#18181b] text-[#f4f4f5] text-[12px] font-medium tracking-[-0.005em] border border-[#27272a] shadow-md transition-all duration-150 ${
          tooltip.visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span>{tooltip.label}</span>
        {tooltip.badge && (
          <span className="px-[5px] py-[0.5px] text-[10px] font-mono rounded bg-[#27272a] text-[#d4d4d8]">
            {tooltip.badge}
          </span>
        )}
        {tooltip.shortcut && (
          <span className="text-[10.5px] font-mono text-[#71717a] ml-[2px]">
            {tooltip.shortcut}
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4. Coordinated Main Application Viewport                            */}
      {/* ------------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-[#111113] overflow-hidden">
        {/* ----------------------------------------------------------------- */}
        {/* Refined Application Header with Compact Sidebar Toggle            */}
        {/* ----------------------------------------------------------------- */}
        <header className="h-[56px] shrink-0 px-[16px] lg:px-[24px] border-b border-[#1c1c1f] bg-[#111113] flex items-center justify-between gap-[12px]">
          <div className="flex items-center gap-[10px] min-w-0">
            {/* Compact, Unobtrusive Header Sidebar Toggle */}
            <button
              type="button"
              onClick={handleToggleSidebar}
              onMouseEnter={showHeaderToggleTooltip}
              onMouseLeave={hideTooltip}
              onFocus={showHeaderToggleTooltip}
              onBlur={hideTooltip}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
              className="w-[32px] h-[32px] rounded-[7px] flex items-center justify-center text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#1c1c1f] active:bg-[#232326] transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#52525b] shrink-0"
            >
              <PanelLeft size={17} strokeWidth={1.75} />
            </button>

            <div className="h-[16px] w-[1px] bg-[#1f1f23] shrink-0" />

            {/* Breadcrumb Context */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-[6px] text-[13px] min-w-0">
              <span className="text-[#71717a] hidden sm:inline truncate">
                {activeGroupObj.label}
              </span>
              <ChevronRight size={13} className="text-[#52525b] hidden sm:inline shrink-0" />
              <span className="font-medium text-[#f4f4f5] truncate">
                {activeItemObj.label}
              </span>
              <span className="hidden md:inline-flex items-center gap-[5px] ml-[8px] px-[7px] py-[2px] rounded-[5px] bg-[#18181b] border border-[#232326] text-[11px] font-mono text-[#a1a1aa]">
                Fall Semester 2026
              </span>
            </nav>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-[8px] shrink-0">
            {/* Quick Filter Search Input */}
            <div className="relative hidden sm:flex items-center">
              <Search
                size={14}
                className="absolute left-[10px] text-[#71717a] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter courses, rooms..."
                className="h-[32px] w-[180px] lg:w-[230px] pl-[30px] pr-[28px] rounded-[7px] bg-[#161618] border border-[#232326] text-[12.5px] text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-[#3f3f46] transition-colors"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-[8px] text-[10px] font-mono text-[#71717a] hover:text-[#e4e4e7]"
                >
                  ESC
                </button>
              ) : (
                <kbd className="absolute right-[8px] text-[10px] font-mono text-[#52525b] pointer-events-none">
                  /
                </kbd>
              )}
            </div>

            {/* Department Selector */}
            <button
              type="button"
              onClick={() =>
                setSelectedDepartment((prev) =>
                  prev === 'All Departments' ? 'Computer Science' : 'All Departments'
                )
              }
              className="h-[32px] px-[10px] rounded-[7px] bg-[#161618] hover:bg-[#1c1c1f] border border-[#232326] text-[12px] text-[#d4d4d8] hidden lg:flex items-center gap-[6px] transition-colors"
            >
              <SlidersHorizontal size={13} className="text-[#71717a]" />
              <span>{selectedDepartment}</span>
            </button>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => handleSelectNav('bookings')}
              className="h-[32px] px-[11px] rounded-[7px] bg-[#f4f4f5] hover:bg-[#e4e4e7] active:bg-[#d4d4d8] text-[#09090b] font-medium text-[12.5px] flex items-center gap-[5px] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#a1a1aa]"
            >
              <Plus size={14} strokeWidth={2.2} />
              <span>New Slot</span>
            </button>
          </div>
        </header>

        {/* ----------------------------------------------------------------- */}
        {/* Scrollable Coordinated Content Area                               */}
        {/* ----------------------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-[16px] lg:p-[24px] cit-scrollbar">
          <div className="max-w-[1600px] mx-auto space-y-[20px]">
            {/* Top Context Banner & Interactive State Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[12px] pb-[16px] border-b border-[#1c1c1f]">
              <div>
                <h1 className="text-[18px] font-semibold text-[#f4f4f5] tracking-[-0.015em] flex items-center gap-[8px]">
                  <span>{activeItemObj.label}</span>
                  <span className="text-[11px] font-mono font-normal text-[#71717a] px-[6px] py-[1px] rounded bg-[#18181b] border border-[#232326]">
                    {isCollapsed ? '60px Rail' : '250px Expanded'}
                  </span>
                </h1>
                <p className="text-[12.5px] text-[#71717a] mt-[2px]">
                  Coordinated desktop workspace • Master academic timetable and room allocation matrix.
                </p>
              </div>

              {/* Quick View Switcher */}
              <div className="flex items-center gap-[6px] self-start sm:self-auto">
                <div className="inline-flex p-[2px] rounded-[7px] bg-[#161618] border border-[#232326]">
                  {['timetables', 'rooms', 'dashboard', 'changes'].map((tabId) => {
                    const labelMap = {
                      timetables: 'Matrix Grid',
                      rooms: 'Room Directory',
                      dashboard: 'Overview',
                      changes: 'Audit Log'
                    };
                    const active = activeRoute === tabId;
                    return (
                      <button
                        key={tabId}
                        type="button"
                        onClick={() => setActiveRoute(tabId)}
                        className={`px-[10px] py-[4px] rounded-[5px] text-[12px] font-medium transition-colors ${
                          active
                            ? 'bg-[#27272a] text-[#f4f4f5]'
                            : 'text-[#71717a] hover:text-[#d4d4d8]'
                        }`}
                      >
                        {labelMap[tabId]}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveRoute('import-exports')}
                  className="h-[30px] px-[10px] rounded-[7px] bg-[#161618] hover:bg-[#1c1c1f] border border-[#232326] text-[12px] text-[#a1a1aa] hover:text-[#f4f4f5] flex items-center gap-[5px] transition-colors"
                >
                  <Download size={13} />
                  <span className="hidden md:inline">Export CSV</span>
                </button>
              </div>
            </div>

            {/* Fluid KPI Metric Strip (Tests Grid Reflow during Sidebar Transition) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[12px]">
              {[
                {
                  title: 'Scheduled Sections',
                  value: '418',
                  delta: '+12 this week',
                  sub: '98.4% conflict-free rate',
                  icon: Calendar
                },
                {
                  title: 'Room Utilization',
                  value: '86.2%',
                  delta: 'Peak 10:00–14:00',
                  sub: '42 active lecture halls',
                  icon: Building2
                },
                {
                  title: 'Pending Approvals',
                  value: '5',
                  delta: '2 high priority',
                  sub: 'Requires chair sign-off',
                  icon: CheckCircle2
                },
                {
                  title: 'Solver Constraint Score',
                  value: '99.1%',
                  delta: 'Optimal pass',
                  sub: '0 hard room collisions',
                  icon: Terminal
                }
              ].map((stat, idx) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={idx}
                    className="p-[14px] rounded-[8px] bg-[#151518] border border-[#1f1f23] flex flex-col justify-between min-w-0"
                  >
                    <div className="flex items-center justify-between text-[#71717a] text-[12px]">
                      <span className="truncate font-medium">{stat.title}</span>
                      <StatIcon size={14} className="shrink-0 text-[#71717a]" />
                    </div>
                    <div className="mt-[10px] flex items-baseline justify-between gap-[8px]">
                      <span className="text-[22px] font-semibold text-[#f4f4f5] tracking-tight font-mono">
                        {stat.value}
                      </span>
                      <span className="text-[11px] font-mono text-[#a1a1aa] px-[6px] py-[1px] rounded bg-[#1c1c1f] border border-[#27272a] truncate">
                        {stat.delta}
                      </span>
                    </div>
                    <div className="mt-[6px] text-[11.5px] text-[#71717a] truncate">
                      {stat.sub}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Coordinated Master Timetable Grid & Responsive Data Table     */}
            {/* ------------------------------------------------------------- */}
            {activeRoute === 'rooms' ? (
              /* Room Directory Table View */
              <div className="rounded-[8px] bg-[#151518] border border-[#1f1f23] overflow-hidden">
                <div className="px-[16px] py-[12px] border-b border-[#1f1f23] flex items-center justify-between">
                  <div className="flex items-center gap-[8px]">
                    <h2 className="text-[13.5px] font-medium text-[#f4f4f5]">
                      Academic Room & Lab Inventory
                    </h2>
                    <span className="text-[11px] font-mono text-[#71717a]">
                      {ROOM_DATA.length} facilities
                    </span>
                  </div>
                  <span className="text-[11.5px] text-[#71717a] hidden sm:inline">
                    Columns resize fluidly during sidebar transition
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[#1f1f23] text-[11px] font-mono uppercase tracking-wider text-[#71717a] bg-[#121215]">
                        <th className="py-[10px] px-[16px] w-[16%]">Room Code</th>
                        <th className="py-[10px] px-[16px] w-[26%]">Facility Name</th>
                        <th className="py-[10px] px-[16px] w-[20%]">Building</th>
                        <th className="py-[10px] px-[16px] w-[12%]">Capacity</th>
                        <th className="py-[10px] px-[16px] w-[13%]">Utilization</th>
                        <th className="py-[10px] px-[16px] w-[13%]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1c1c1f] text-[12.5px]">
                      {ROOM_DATA.filter(
                        (r) =>
                          !searchQuery ||
                          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          r.id.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((room) => (
                        <tr
                          key={room.id}
                          className="hover:bg-[#19191d] transition-colors"
                        >
                          <td className="py-[11px] px-[16px] font-mono text-[#f4f4f5] truncate">
                            {room.id}
                          </td>
                          <td className="py-[11px] px-[16px] text-[#d4d4d8] truncate">
                            {room.name}
                          </td>
                          <td className="py-[11px] px-[16px] text-[#71717a] truncate">
                            {room.building}
                          </td>
                          <td className="py-[11px] px-[16px] font-mono text-[#a1a1aa]">
                            {room.capacity} seats
                          </td>
                          <td className="py-[11px] px-[16px] font-mono text-[#d4d4d8]">
                            {room.utilization}
                          </td>
                          <td className="py-[11px] px-[16px]">
                            <span className="inline-flex items-center gap-[5px] px-[7px] py-[2px] rounded-[5px] text-[11px] font-mono bg-[#1f1f23] text-[#d4d4d8] border border-[#27272a]">
                              <span
                                className={`w-[5px] h-[5px] rounded-full ${
                                  room.status === 'Available'
                                    ? 'bg-[#e4e4e7]'
                                    : 'bg-[#71717a]'
                                }`}
                              />
                              {room.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Master Timetable Grid (Default & Primary Stress Test for Layout Coordination) */
              <div className="rounded-[8px] bg-[#151518] border border-[#1f1f23] overflow-hidden">
                <div className="px-[16px] py-[12px] border-b border-[#1f1f23] flex flex-wrap items-center justify-between gap-[8px]">
                  <div className="flex items-center gap-[8px]">
                    <h2 className="text-[13.5px] font-medium text-[#f4f4f5]">
                      Master Compute & Lecture Matrix
                    </h2>
                    <span className="text-[11px] font-mono px-[6px] py-[1px] rounded bg-[#1c1c1f] text-[#a1a1aa] border border-[#27272a]">
                      Week 09 • Oct 2026
                    </span>
                  </div>
                  <div className="flex items-center gap-[12px] text-[11.5px] text-[#71717a]">
                    <span className="flex items-center gap-[5px]">
                      <span className="w-[8px] h-[8px] rounded-[2px] bg-[#27272a] border border-[#3f3f46]" />
                      Core Lecture
                    </span>
                    <span className="flex items-center gap-[5px]">
                      <span className="w-[8px] h-[8px] rounded-[2px] bg-[#1c1c1f] border border-[#2e2e33]" />
                      Lab / Seminar
                    </span>
                  </div>
                </div>

                {/* Responsive CSS Grid Timetable that Reflows Smoothly Without Horizontal Scroll Jumps */}
                <div className="p-[12px] lg:p-[16px]">
                  <div className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))] border border-[#1f1f23] rounded-[6px] bg-[#111113] overflow-hidden">
                    {/* Top Header Row */}
                    <div className="h-[36px] border-b border-r border-[#1f1f23] flex items-center justify-center text-[10.5px] font-mono text-[#71717a] bg-[#141417]">
                      UTC+5
                    </div>
                    {TIMETABLE_DAYS.map((day, idx) => (
                      <div
                        key={day}
                        className={`h-[36px] border-b border-[#1f1f23] px-[10px] flex items-center justify-between bg-[#141417] min-w-0 ${
                          idx < 4 ? 'border-r' : ''
                        }`}
                      >
                        <span className="text-[12px] font-medium text-[#d4d4d8] truncate">
                          {day}
                        </span>
                        <span className="text-[10.5px] font-mono text-[#71717a] hidden sm:inline">
                          Oct {26 + idx}
                        </span>
                      </div>
                    ))}

                    {/* Time Rows */}
                    {TIMETABLE_SLOTS.map((slot, slotIdx) => (
                      <React.Fragment key={slot}>
                        {/* Time Column Label */}
                        <div
                          className={`h-[54px] border-r border-[#1f1f23] flex items-start justify-center pt-[6px] text-[11px] font-mono text-[#71717a] ${
                            slotIdx < TIMETABLE_SLOTS.length - 1 ? 'border-b' : ''
                          }`}
                        >
                          {slot}
                        </div>

                        {/* Day Cells for this Time Slot */}
                        {TIMETABLE_DAYS.map((day, dayIdx) => {
                          const blockStartingHere = SCHEDULE_BLOCKS.find(
                            (b) =>
                              b.day === dayIdx &&
                              b.start === slotIdx &&
                              (!searchQuery ||
                                b.title
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase()) ||
                                b.id
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase()) ||
                                b.room
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase()))
                          );

                          const isCoveredByPreviousBlock = SCHEDULE_BLOCKS.some(
                            (b) =>
                              b.day === dayIdx &&
                              slotIdx > b.start &&
                              slotIdx < b.start + b.span
                          );

                          return (
                            <div
                              key={`${day}-${slot}`}
                              className={`relative h-[54px] p-[3px] min-w-0 ${
                                dayIdx < 4 ? 'border-r border-[#1f1f23]' : ''
                              } ${
                                slotIdx < TIMETABLE_SLOTS.length - 1
                                  ? 'border-b border-[#1f1f23]'
                                  : ''
                              }`}
                            >
                              {blockStartingHere && !isCoveredByPreviousBlock && (
                                <div
                                  style={{
                                    height: `calc(${
                                      blockStartingHere.span * 54
                                    }px - 6px)`
                                  }}
                                  className="relative z-10 w-full rounded-[5px] p-[8px] bg-[#1e1e22] hover:bg-[#252529] border border-[#2e2e34] flex flex-col justify-between overflow-hidden transition-colors cursor-pointer group"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center justify-between gap-[4px]">
                                      <span className="text-[10.5px] font-mono font-semibold text-[#f4f4f5] truncate">
                                        {blockStartingHere.id}
                                      </span>
                                      <span className="text-[10px] font-mono text-[#a1a1aa] px-[4px] rounded bg-[#141417] border border-[#27272a] shrink-0 hidden md:inline">
                                        {blockStartingHere.type}
                                      </span>
                                    </div>
                                    <div className="text-[12px] font-medium text-[#e4e4e7] truncate mt-[2px]">
                                      {blockStartingHere.title}
                                    </div>
                                    <div className="text-[11px] text-[#a1a1aa] truncate mt-[1px]">
                                      {blockStartingHere.room}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-[10.5px] text-[#71717a] pt-[4px] border-t border-[#27272a]/70 truncate">
                                    <span className="truncate">
                                      {blockStartingHere.instructor}
                                    </span>
                                    <span className="font-mono shrink-0 ml-[4px] hidden lg:inline">
                                      {blockStartingHere.enrolled}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Bottom Two-Column Section: Recent Changes & Room Status       */}
            {/* ------------------------------------------------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[16px]">
              {/* Recent Schedule Modifications Table */}
              <div className="lg:col-span-7 rounded-[8px] bg-[#151518] border border-[#1f1f23] overflow-hidden flex flex-col">
                <div className="px-[16px] py-[12px] border-b border-[#1f1f23] flex items-center justify-between">
                  <h3 className="text-[13px] font-medium text-[#f4f4f5]">
                    Recent Schedule Revisions
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleSelectNav('changes')}
                    className="text-[11.5px] text-[#a1a1aa] hover:text-[#f4f4f5] flex items-center gap-[3px] transition-colors"
                  >
                    <span>View all changes</span>
                    <ArrowUpRight size={12} />
                  </button>
                </div>
                <div className="divide-y divide-[#1c1c1f]">
                  {RECENT_CHANGES.map((item) => (
                    <div
                      key={item.id}
                      className="px-[16px] py-[10px] flex items-center justify-between gap-[12px] hover:bg-[#19191d] transition-colors min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-[8px]">
                          <span className="text-[11px] font-mono text-[#71717a]">
                            {item.id}
                          </span>
                          <span className="text-[12.5px] font-medium text-[#e4e4e7] truncate">
                            {item.course}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#71717a] truncate mt-[1px]">
                          {item.action} • by {item.author}
                        </div>
                      </div>
                      <div className="flex items-center gap-[10px] shrink-0">
                        <span className="text-[11px] font-mono text-[#71717a] hidden sm:inline">
                          {item.time}
                        </span>
                        <span className="px-[6px] py-[1.5px] rounded-[4px] text-[10.5px] font-mono bg-[#1c1c1f] text-[#d4d4d8] border border-[#27272a]">
                          {item.state}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Navigation & Motion Diagnostics Card */}
              <div className="lg:col-span-5 rounded-[8px] bg-[#151518] border border-[#1f1f23] p-[16px] flex flex-col justify-between space-y-[12px]">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[13px] font-medium text-[#f4f4f5]">
                      Sidebar Interaction Diagnostics
                    </h3>
                    <span className="text-[10.5px] font-mono px-[6px] py-[1px] rounded bg-[#1c1c1f] text-[#a1a1aa] border border-[#27272a]">
                      cubic-bezier(0.22, 1, 0.36, 1)
                    </span>
                  </div>
                  <p className="text-[12px] text-[#71717a] mt-[4px] leading-relaxed">
                    Test the coordinated layout transition using the header toggle or keyboard shortcut{' '}
                    <kbd className="px-[5px] py-[1px] text-[11px] font-mono rounded bg-[#1c1c1f] text-[#d4d4d8] border border-[#27272a]">
                      ⌘B
                    </kbd>
                    . Icons remain anchored at a fixed 22px horizontal axis while labels fade and translate smoothly.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-[8px] pt-[4px]">
                  <div className="p-[10px] rounded-[6px] bg-[#111113] border border-[#1f1f23]">
                    <div className="text-[10.5px] font-mono uppercase text-[#71717a]">
                      Current State
                    </div>
                    <div className="text-[13px] font-medium text-[#f4f4f5] mt-[2px] font-mono">
                      {isCollapsed ? 'Collapsed (60px)' : 'Expanded (250px)'}
                    </div>
                  </div>
                  <div className="p-[10px] rounded-[6px] bg-[#111113] border border-[#1f1f23]">
                    <div className="text-[10.5px] font-mono uppercase text-[#71717a]">
                      Persisted Storage
                    </div>
                    <div className="text-[13px] font-medium text-[#f4f4f5] mt-[2px] font-mono">
                      localStorage Sync
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-[8px] border-t border-[#1f1f23]">
                  <span className="text-[11.5px] text-[#71717a]">
                    Hover icons while collapsed for 280ms delayed tooltips
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSidebar}
                    className="px-[10px] py-[5px] rounded-[6px] bg-[#232326] hover:bg-[#2c2c30] text-[12px] font-medium text-[#f4f4f5] transition-colors"
                  >
                    {isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}