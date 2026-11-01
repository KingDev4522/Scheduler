import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { useAuth } from '../../hooks/useAuth'

/*
 * NAV — full-bleed editorial header, no container, no boundaries.
 * Individual elements float over a black-blur melt (same language as the
 * hero → engine bridge): frosted blur masked into transparency plus a black
 * gradient, so the bar blends into whatever scrolls beneath it.
 *
 * The landing page carries no in-app destinations. It has the brand, the
 * account slot and one call to action; the scheduler's own navigation lives
 * inside the app, behind the login.
 */

function UserAvatar({ user }) {
  const url = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  if (!url) {
    return (
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-neutral-200"
      >
        {(user?.email?.[0] ?? 'S').toUpperCase()}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt=""
      width="28"
      height="28"
      draggable={false}
      referrerPolicy="no-referrer"
      onError={(event) => {
        event.currentTarget.style.display = 'none'
      }}
      className="block h-7 w-7 shrink-0 rounded-full border border-white/15 object-cover outline-none"
    />
  )
}

export default function Nav() {
  const barRef = useRef(null)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, signOut } = useAuth()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return undefined
    const ctx = gsap.context(() => {
      gsap.from(barRef.current, {
        y: -24,
        opacity: 0,
        duration: 1,
        delay: 0.3,
        ease: 'power4.out',
      })
    })
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Blur melt — frost first, only a kiss of black for legibility */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 h-[150px]">
        <div className="absolute inset-0 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black_30%,transparent_96%)] [-webkit-mask-image:linear-gradient(to_bottom,black_30%,transparent_96%)]" />
        <div
          className={`absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.32),rgba(0,0,0,0.1)_52%,transparent)] transition-opacity duration-500 ${
            scrolled ? 'opacity-100' : 'opacity-70'
          }`}
        />
      </div>

      <div
        ref={barRef}
        className="relative flex h-[76px] items-center gap-8 px-6 [text-shadow:0_1px_14px_rgba(0,0,0,0.5)] md:px-10"
      >
        {/* Brand — logo artwork, rendered borderless */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 border-0 bg-transparent p-0 outline-none"
          aria-label="CIT Scheduler home"
        >
          <img
            src="/logo-nav.png"
            alt=""
            width="40"
            height="40"
            draggable={false}
            className="block h-10 w-10 border-0 bg-transparent object-contain outline-none"
          />
          <span className="text-[15px] font-semibold tracking-tight text-neutral-50">
            CIT Scheduler
          </span>
        </Link>

        <div className="flex-1" />

        {/* Auth slot — always visible: avatar + email + Log out when signed
            in, Log in when signed out. */}
        <div className="hidden items-center gap-4 lg:flex">
          {user ? (
            <div className="flex max-w-[16rem] items-center gap-2.5 text-[12px] text-neutral-400">
              <UserAvatar user={user} />
              <span title={user.email} className="truncate">
                {user.email}
              </span>
              {isAdmin && <span className="ss-admin-badge">Admin</span>}
              <button
                type="button"
                onClick={handleSignOut}
                className="shrink-0 text-neutral-400 transition-colors duration-300 hover:text-neutral-50"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="group relative flex items-center gap-1.5 text-[13px] font-semibold text-neutral-100 transition-colors duration-300 hover:text-amber-100"
            >
              Log in
              <span
                aria-hidden="true"
                className="text-amber-200 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px"
              >
                →
              </span>
            </Link>
          )}
        </div>

        {/* CTA — quiet editorial link, no box */}
        <Link
          to="/login"
          className="group relative hidden items-center gap-1.5 text-[13px] font-semibold text-neutral-100 transition-colors duration-300 hover:text-amber-100 sm:flex"
        >
          Open the scheduler
          <span
            aria-hidden="true"
            className="text-amber-200 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px"
          >
            ↗
          </span>
          <span
            aria-hidden="true"
            className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-amber-200/70 transition-transform duration-500 group-hover:scale-x-100"
          />
        </Link>

        {/* Mobile toggle — bare lines, no box */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex h-10 w-10 items-center justify-center text-neutral-200 lg:hidden"
        >
          <span className="relative block h-3 w-4" aria-hidden="true">
            <span
              className={`absolute left-0 top-0 h-[1.5px] w-full bg-current transition-transform duration-300 ${
                open ? 'translate-y-[5px] rotate-45' : ''
              }`}
            />
            <span
              className={`absolute bottom-0 left-0 h-[1.5px] w-full bg-current transition-transform duration-300 ${
                open ? '-translate-y-[5px] -rotate-45' : ''
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobile panel — borderless blur sheet, account only */}
      {open && (
        <div className="nav-drop relative max-h-[calc(100dvh-76px)] overflow-y-auto bg-black/60 px-6 pb-6 pt-4 backdrop-blur-xl lg:hidden">
          {user ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-neutral-400">
              <span className="flex min-w-0 items-center gap-2.5">
                <UserAvatar user={user} />
                <span title={user.email} className="truncate">
                  {user.email}
                </span>
              </span>
              <div className="flex items-center gap-2.5">
                {isAdmin && <span className="ss-admin-badge">Admin</span>}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-neutral-400 transition-colors duration-300 hover:text-neutral-50"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between py-3.5 text-[15px] font-semibold text-neutral-50"
            >
              Log in
              <span aria-hidden="true" className="text-amber-200">
                →
              </span>
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
