import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotPopup } from '@copilotkit/react-ui'
import { VoiceButton } from '@/components/voice-button'
import { useChatModel } from '@/contexts/chat-model'
import { useTheme } from '@/contexts/theme'
import {
  Home,
  Database,
  ClipboardCheck,
  Network,
  FileText,
  BookOpen,
  HelpCircle,
  Info,
  Activity,
  Menu,
  LogIn,
  Moon,
  Sun,
  Monitor,
  GraduationCap,
  Settings,
  PlayCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigationSections = [
  {
    label: 'Core',
    items: [
      { name: 'Home', href: '/', icon: Home },
      { name: 'Watch Intro', href: '/splash', icon: PlayCircle },
      { name: 'Getting Started', href: '/tutorial', icon: GraduationCap },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { name: 'AI Knowledge Base', href: '/knowledge-base', icon: Database },
      { name: 'Knowledge Graph', href: '/knowledge-graph', icon: Network },
      { name: 'Standards Library', href: '/standards-library', icon: BookOpen },
    ],
  },
  {
    label: 'GRC',
    items: [
      { name: 'GRC & Gap Analysis', href: '/assessments', icon: ClipboardCheck },
      { name: 'AI RMF Taxonomy', href: '/taxonomy', icon: ClipboardCheck },
      { name: 'AI Readiness Check', href: '/ai-readiness', icon: ClipboardCheck },
      { name: 'Reports', href: '/reports', icon: FileText },
    ],
  },
  {
    label: 'Support',
    items: [
      { name: 'About', href: '/about-marlowe', icon: BookOpen },
      { name: 'FAQ', href: '/faq', icon: HelpCircle },
      { name: 'Help', href: '/help', icon: Info },
    ],
  },
  {
    label: 'Admin',
    items: [
      { name: 'Dashboard', href: '/admin', icon: Settings },
      { name: 'Observability', href: '/admin/observability', icon: Activity },
    ],
  },
]

export default function Layout() {
  const location = useLocation()
  const { model } = useChatModel()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'border-r border-border bg-secondary text-secondary-foreground transition-all duration-200',
          isSidebarCollapsed ? 'w-20' : 'w-72'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Link
              to="/"
              className={cn(
                'flex items-center gap-3 text-2xl font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary rounded',
                isSidebarCollapsed && 'justify-center'
              )}
            >
              <img
                src="/marlowe.jpeg"
                alt="Marlowe"
                className="h-9 w-9 rounded object-cover"
              />
              {!isSidebarCollapsed && <span>Marlowe</span>}
            </Link>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="rounded-md p-2 text-secondary-foreground/80 transition-colors hover:bg-primary/20 hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-4 px-3 py-4">
            {navigationSections.map((section) => (
              <div key={section.label} className="space-y-2">
                {!isSidebarCollapsed && (
                  <p className="px-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive =
                      item.href === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.href)

                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary',
                          isSidebarCollapsed ? 'justify-center px-2' : 'justify-start',
                          isActive
                            ? 'border-primary bg-primary/15 text-secondary-foreground'
                            : 'border-transparent text-secondary-foreground/80 hover:bg-primary/20 hover:text-secondary-foreground'
                        )}
                        title={isSidebarCollapsed ? item.name : undefined}
                      >
                        <item.icon className="h-6 w-6" />
                        {!isSidebarCollapsed && <span>{item.name}</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Theme toggle & Login */}
          <div className="border-t border-border p-3 space-y-1">
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Theme: ${theme}. Current: ${resolvedTheme}. Click to cycle.`}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-secondary-foreground/80 transition-colors hover:bg-primary/20 hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary',
                isSidebarCollapsed && 'justify-center px-2'
              )}
            >
              {theme === 'light' && <Sun className="h-5 w-5" />}
              {theme === 'dark' && <Moon className="h-5 w-5" />}
              {theme === 'system' && <Monitor className="h-5 w-5" />}
              {!isSidebarCollapsed && theme === 'light' && 'Light'}
              {!isSidebarCollapsed && theme === 'dark' && 'Dark'}
              {!isSidebarCollapsed && theme === 'system' && 'System'}
            </button>
            <Link
              to="/login"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-secondary-foreground/80 transition-colors hover:bg-primary/20 hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-secondary',
                isSidebarCollapsed && 'justify-center px-2'
              )}
            >
              <LogIn className="h-5 w-5" />
              {!isSidebarCollapsed && 'Login'}
            </Link>
            {!isSidebarCollapsed && (
              <p className="px-3 pt-2 text-xs text-muted-foreground/80">
                Marlowe is a trademark of GallowGlass AI.{' '}
                <Link to="/about-marlowe" className="underline hover:text-muted-foreground">
                  Who was Marlowe?
                </Link>{' '}
                ·{' '}
                <Link to="/help" className="underline hover:text-muted-foreground">
                  See Help
                </Link>{' '}
                for license and trademark information.
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Side chat: Marlowe agent (RAG + knowledge graph) for consistency across the app */}
      <CopilotKit runtimeUrl="/api/copilotkit" agent="marlowe_agent" properties={{ model }}>
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
          <CopilotPopup
            labels={{
              title: 'Marlowe Assistant',
              initial: 'Ask about the knowledge graph, frameworks, requirements, or your documents.',
            }}
          >
            <div className="flex flex-col items-center gap-2 mb-2">
              <VoiceButton />
            </div>
          </CopilotPopup>
        </div>
      </CopilotKit>
    </div>
  )
}
