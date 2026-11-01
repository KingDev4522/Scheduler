import { useEffect, useState, type MouseEvent } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, persistTheme, readTheme, type Theme } from '../lib/theme'

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    const commit = () => {
      setTheme(next)
      applyTheme(next)
      persistTheme(next)
    }

    const doc = document as TransitionDocument
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!doc.startViewTransition || reduce) {
      commit()
      return
    }

    const { clientX: x, clientY: y } = event
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    const transition = doc.startViewTransition(commit)
    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 620,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
      .catch(() => undefined)
  }

  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to black theme'}
      title={dark ? 'Switch to light theme' : 'Switch to black theme'}
      className="group/theme relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 outline-none transition-[background-color,border-color,color,transform] duration-300 hover:border-slate-400 hover:text-slate-900 active:scale-95 focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <Sun
          className={`absolute h-4 w-4 transition-all duration-500 ${
            dark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
          aria-hidden
        />
        <Moon
          className={`absolute h-4 w-4 transition-all duration-500 ${
            dark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          }`}
          aria-hidden
        />
      </span>
      <span className="sr-only">{dark ? 'Light theme' : 'Black theme'}</span>
    </button>
  )
}
