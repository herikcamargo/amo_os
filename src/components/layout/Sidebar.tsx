import { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Files, Users, Settings, Plus, Bell, BarChart3, LogOut, Cloud, CloudOff,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { can, roleLabel } from '@/lib/permissions'

const NAV_ITEMS = [
  { key: '/', label: 'Início', icon: Home, requires: null as null | 'view_reports' },
  { key: '/ordens', label: 'Ordens', icon: Files, requires: null },
  { key: '/clientes', label: 'Clientes', icon: Users, requires: null },
  { key: '/relatorios', label: 'Relatórios', icon: BarChart3, requires: 'view_reports' as const },
  { key: '/notificacoes', label: 'Notificações', icon: Bell, requires: null },
  { key: '/ajustes', label: 'Ajustes', icon: Settings, requires: null },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, notifications, isCloudConnected, signOut } = useStore()
  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])
  const visibleNav = NAV_ITEMS.filter((it) => !it.requires || can(user, it.requires))

  const isActive = (key: string) => {
    if (key === '/') return location.pathname === '/'
    return location.pathname.startsWith(key)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="hidden md:flex w-[260px] h-screen bg-surface-card border-r border-white/5 flex-col p-5 sticky top-0">
      {/* Logo */}
      <div className="mb-8">
        <div className="text-[24px] font-black tracking-tight leading-none">
          Amo<span className="text-brand">Celular</span>
          <span className="text-brand text-base align-top ml-0.5">♥</span>
        </div>
        <div className="text-[9px] tracking-[0.25em] text-gray-500 font-medium mt-1.5">
          ASSISTÊNCIA TÉCNICA
        </div>
      </div>

      {/* Nova OS Button */}
      <button
        onClick={() => navigate('/nova-os')}
        className="w-full h-12 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 mb-6 shadow-lg shadow-brand/30 hover:shadow-brand/50 hover:scale-[1.02] active:scale-95 transition-all"
      >
        <Plus size={18} /> Nova OS
      </button>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {visibleNav.map((it) => {
          const active = isActive(it.key)
          const Icon = it.icon
          return (
            <button
              key={it.key}
              onClick={() => navigate(it.key)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                active
                  ? 'bg-brand/15 text-white'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon
                size={18}
                className={`transition-transform group-hover:scale-110 ${active ? 'text-brand' : ''}`}
              />
              <span className="text-sm font-medium flex-1 text-left">{it.label}</span>
              {it.key === '/notificacoes' && unread > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand text-[10px] font-bold flex items-center justify-center">
                  {unread}
                </span>
              )}
              {active && <div className="w-1 h-5 rounded-full bg-brand" />}
            </button>
          )
        })}
      </nav>

      {/* Cloud status */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] mb-3">
        {isCloudConnected ? (
          <>
            <Cloud size={14} className="text-green-400" />
            <span className="text-[11px] text-green-400 font-medium">Conectado à nuvem</span>
            <div className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </>
        ) : (
          <>
            <CloudOff size={14} className="text-gray-500" />
            <span className="text-[11px] text-gray-500 font-medium">Modo local</span>
          </>
        )}
      </div>

      {/* User */}
      <div className="border-t border-white/5 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
            <span className="text-brand font-bold text-sm">
              {user?.nome?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user?.nome || 'Usuário'}</div>
            <div className="text-[11px] text-gray-500 truncate">
              {user ? roleLabel(user.role) : ''}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sair da conta"
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
