import { Link, Outlet, useLocation } from 'react-router-dom'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotPopup } from '@copilotkit/react-ui'
import { useChatModel } from '@/contexts/chat-model'
import {
  Home,
  LayoutDashboard,
  Database,
  ClipboardCheck,
  Network,
  FileText,
  HelpCircle,
  Info,
  LogIn,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Knowledge Base', href: '/knowledge-base', icon: Database },
  { name: 'Assessments', href: '/assessments', icon: ClipboardCheck },
  { name: 'Knowledge Graph', href: '/knowledge-graph', icon: Network },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'FAQ', href: '/faq', icon: HelpCircle },
  { name: 'Help', href: '/help', icon: Info },
]

export default function Layout() {
  const location = useLocation()
  const { model } = useChatModel()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-slate-900 text-slate-100">
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="flex h-16 items-center border-b border-slate-800 px-6">
            <Link to="/" className="text-2xl font-bold tracking-tight">
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
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Login */}
          <div className="border-t border-slate-800 p-3">
            <Link
              to="/login"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
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
