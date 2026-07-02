import { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BarChart3, Bell, Boxes, Cloud, CloudOff, Files, Home, Landmark,
  LogOut, Package, Plus, Search, Settings, Users,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { filterNotificationsForUser } from '@/lib/notifications'
import { can, roleLabel } from '@/lib/permissions'

const NAV_ITEMS = [
  { key: '/', label: 'Inicio', icon: Home, requires: null as null | 'view_reports' },
  { key: '/ordens', label: 'Ordens', icon: Files, requires: null },
  { key: '/vendas', label: 'Vendas', icon: Package, requires: null },
  { key: '/clientes', label: 'Clientes', icon: Users, requires: null },
  { key: '/precos', label: 'Consulta de precos', icon: Search, requires: null },
  { key: '/vendas?tab=estoque', label: 'Estoque', icon: Boxes, requires: null },
  { key: '/relatorios', label: 'Relatorios', icon: BarChart3, requires: 'view_reports' as const },
  { key: '/relatorios?financeiro=1', label: 'Financeiro', icon: Landmark, requires: 'view_financial' as const },
  { key: '/notificacoes', label: 'Notificacoes', icon: Bell, requires: null },
  { key: '/ajustes', label: 'Ajustes', icon: Settings, requires: null },
]

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, notifications, isCloudConnected, signOut } = useStore()
  const unread = useMemo(
    () => filterNotificationsForUser(notifications, user).filter((n) => !n.read).length,
    [notifications, user],
  )
  const visibleNav = NAV_ITEMS.filter((it) => !it.requires || can(user, it.requires))

  const isActive = (key: string) => {
    if (key === '/vendas?tab=estoque') return location.pathname === '/vendas' && location.search.includes('tab=estoque')
    if (key === '/vendas') return location.pathname === '/vendas' && !location.search.includes('tab=estoque')
    if (key === '/relatorios?financeiro=1') return location.pathname === '/relatorios' && location.search.includes('financeiro=1')
    if (key === '/relatorios') return location.pathname === '/relatorios' && !location.search.includes('financeiro=1')
    if (key === '/') return location.pathname === '/'
    return location.pathname.startsWith(key)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="hidden md:flex w-[260px] h-screen bg-surface-card border-r border-white/5 flex-col p-5 sticky top-0">
      <div className="mb-8">
        <div className="text-[28px] font-black tracking-tight leading-none">
          <span>AMO</span><span className="text-brand">.OS</span>
        </div>
        <div className="text-[9px] tracking-[0.18em] text-gray-500 font-semibold mt-2">
          GESTAO DE ASSISTENCIA TECNICA
        </div>
      </div>

      <button
        onClick={() => navigate('/nova-os')}
        className="w-full h-12 rounded-[12px] bg-brand font-semibold text-sm flex items-center justify-center gap-2 mb-6 shadow-[0_4px_24px_rgba(215,25,32,0.35)] hover:bg-brand-dark hover:shadow-[0_4px_32px_rgba(215,25,32,0.5)] active:scale-[0.98] transition-all"
      >
        <Plus size={18} /> Nova OS
      </button>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {visibleNav.map((it) => {
          const active = isActive(it.key)
          const Icon = it.icon
          return (
            <button
              key={it.key}
              onClick={() => navigate(it.key)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] transition-colors ${
                active
                  ? 'bg-brand/14 text-white'
                  : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Icon size={18} className={active ? 'text-brand' : 'text-gray-500 group-hover:text-gray-300'} />
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

      <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-white/[0.025] mb-3">
        {isCloudConnected ? (
          <>
            <Cloud size={14} className="text-green-400" />
            <span className="text-[11px] text-green-400 font-medium">Conectado a nuvem</span>
            <div className="ml-auto w-2 h-2 rounded-full bg-green-400" />
          </>
        ) : (
          <>
            <CloudOff size={14} className="text-gray-500" />
            <span className="text-[11px] text-gray-500 font-medium">Modo local</span>
          </>
        )}
      </div>

      <div className="border-t border-white/5 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center">
            <span className="text-brand font-bold text-sm">
              {user?.nome?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{user?.nome || 'Usuario'}</div>
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
