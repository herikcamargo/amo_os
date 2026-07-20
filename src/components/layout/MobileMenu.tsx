import { useMemo, useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { can, roleLabel } from '@/lib/permissions'
import { filterNotificationsForUser } from '@/lib/notifications'
import { NAV_ITEMS } from './navigation'

export function MobileMenu({ floating = false }: { floating?: boolean }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, notifications, signOut } = useStore()
  const unread = useMemo(
    () => filterNotificationsForUser(notifications, user).filter((item) => !item.read).length,
    [notifications, user],
  )
  const visibleNav = NAV_ITEMS.filter((item) => !item.requires || can(user, item.requires))

  const goTo = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        className={floating
          ? 'fixed top-4 right-4 z-[65] w-11 h-11 rounded-[12px] bg-surface-elevated border border-white/10 shadow-xl flex items-center justify-center text-gray-300 md:hidden'
          : 'group flex flex-col items-center gap-1 w-12 transition-transform active:scale-90'}
      >
        <Menu size={floating ? 21 : 20} className="text-gray-400" />
        {!floating && <span className="text-[10px] font-medium text-gray-500">Mais</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 md:hidden" onClick={() => setOpen(false)}>
          <aside
            className="absolute right-0 top-0 h-full w-[min(88vw,360px)] bg-surface-card border-l border-white/10 p-5 flex flex-col shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xl font-black">AMO<span className="text-brand">.OS</span></div>
                <div className="text-[8px] tracking-[0.16em] text-gray-500 mt-1">GESTAO DE ASSISTENCIA TECNICA</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="w-10 h-10 rounded-[10px] bg-white/5 flex items-center justify-center text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon
                const path = item.key.split('?')[0]
                const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => goTo(item.key)}
                    className={`w-full min-h-12 px-3 rounded-[10px] flex items-center gap-3 text-sm font-medium ${
                      active ? 'bg-brand/15 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-brand' : 'text-gray-500'} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.key === '/notificacoes' && unread > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand text-[10px] font-bold flex items-center justify-center">
                        {unread}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="border-t border-white/10 pt-4">
              <div className="px-3 mb-3">
                <div className="text-sm font-semibold truncate">{user?.nome || 'Usuario'}</div>
                <div className="text-xs text-gray-500">{user ? roleLabel(user.role) : ''}</div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full min-h-12 px-3 rounded-[10px] flex items-center gap-3 text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/15"
              >
                <LogOut size={18} />
                Sair da conta
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
