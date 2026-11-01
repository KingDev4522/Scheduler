import { KEYS, readJSON, writeJSON } from './storage'

export type Theme = 'light' | 'dark'

export function readTheme(): Theme {
  return readJSON<Theme>(KEYS.theme, 'light') === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export function persistTheme(theme: Theme): void {
  writeJSON(KEYS.theme, theme)
}

/** Applied before first paint so a dark session never flashes white. */
export function initTheme(): void {
  applyTheme(readTheme())
}
