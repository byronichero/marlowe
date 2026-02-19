import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'marlowe-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(getSystemTheme)

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value)
    localStorage.setItem(STORAGE_KEY, value)
  }, [])

  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(resolved)
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(resolved)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      setResolvedTheme(mq.matches ? 'dark' : 'light')
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const value: ThemeContextValue = { theme, setTheme, resolvedTheme }
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
