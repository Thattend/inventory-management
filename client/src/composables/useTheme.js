import { ref, computed } from 'vue'

export const THEME_STORAGE_KEY = 'app-theme'
const THEMES = ['light', 'dark']

// localStorage can throw (private mode, blocked storage): treat as "no value"
function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return THEMES.includes(value) ? value : null
  } catch {
    return null
  }
}

function writeStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Persistence is best effort; the in-memory theme still applies
  }
}

function systemTheme() {
  const prefersDark = typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

// CSS reads [data-theme] on <html>; keep this the single place that writes it
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

// Module-level ref: shared by every component that calls useTheme()
const theme = ref(readStoredTheme() ?? systemTheme())
applyTheme(theme.value)

export function useTheme() {
  const isDark = computed(() => theme.value === 'dark')

  const setTheme = (next) => {
    if (!THEMES.includes(next)) return
    theme.value = next
    applyTheme(next)
    writeStoredTheme(next)
  }

  const toggleTheme = () => setTheme(isDark.value ? 'light' : 'dark')

  return { theme, isDark, setTheme, toggleTheme }
}
