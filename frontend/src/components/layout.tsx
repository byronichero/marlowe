import { Link, Outlet, useLocation } from 'react-router-dom'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotPopup } from '@copilotkit/react-ui'
import { useChatModel } from '@/contexts/chat-model'
import { useTheme } from '@/contexts/theme'
import {
  Home,
  LayoutDashboard,
  Database,
  ClipboardCheck,
  Network,
  FileText,
  BookOpen,
  HelpCircle,
  Info,
  LogIn,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Knowledge Base', href: '/knowledge-base', icon: Database },
  { name: 'Compliance & Gap Analysis', href: '/assessments', icon: ClipboardCheck },
  { name: 'Standards Library', href: '/standards-library', icon: BookOpen },
  { name: 'Knowledge Graph', href: '/knowledge-graph', icon: Network },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'FAQ', href: '/faq', icon: HelpCircle },
  { name: 'Help', href: '/help', icon: Info },
]

export default function Layout() {
  const location = useLocation()
  const { model } = useChatModel()
  const { theme, setTheme, resolvedTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-secondary text-secondary-foreground">
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="flex h-16 items-center border-b border-border px-6">
            <Link
              to="/"
              className="flex items-center gap-3 text-2xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary rounded"
            >
              <img
                src="/marlowe.jpeg"
                alt="Marlowe"
                className="h-9 w-9 rounded object-cover"
              />
              Marlowe
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href)

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-secondary-foreground/80 hover:bg-primary/20 hover:text-secondary-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Theme toggle & Login */}
          <div className="border-t border-border p-3 space-y-1">
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Theme: ${theme}. Current: ${resolvedTheme}. Click to cycle.`}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-secondary-foreground/80 transition-colors hover:bg-primary/20 hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
            >
              {theme === 'light' && <Sun className="h-5 w-5" />}
              {theme === 'dark' && <Moon className="h-5 w-5" />}
              {theme === 'system' && <Monitor className="h-5 w-5" />}
              {theme === 'light' && 'Light'}
              {theme === 'dark' && 'Dark'}
              {theme === 'system' && 'System'}
            </button>
            <Link
              to="/login"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-secondary-foreground/80 transition-colors hover:bg-primary/20 hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
            >
              <LogIn className="h-5 w-5" />
              Login
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6">
          <Outlet />
        </div>
      </main>

      {/* Side chat: plain model (no Marlowe system prompt); wrapped in its own CopilotKit so it uses free_chat_agent */}
      <CopilotKit runtimeUrl="/api/copilotkit" agent="free_chat_agent" properties={{ model }}>
        <CopilotPopup
          labels={{
            title: 'Quick Chat',
            initial: 'General chat with the model—no Marlowe context.',
          }}
        />
      </CopilotKit>
    </div>
  )
}
