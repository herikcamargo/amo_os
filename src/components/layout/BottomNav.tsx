import { Home, Files, Users, Settings, Plus, Search } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

const LEFT = [
  { key: '/', label: 'Início', icon: Home },
  { key: '/ordens', label: 'Ordens', icon: Files },
]
const RIGHT = [
  { key: '/precos', label: 'Preços', icon: Search },
  { key: '/clientes', label: 'Clientes', icon: Users },
  { key: '/ajustes', label: 'Ajustes', icon: Settings },
]

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (key: string) => {
    if (key === '/') return location.pathname === '/'
    return location.pathname.startsWith(key)
  }

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] px-4 pb-4 pt-6 bg-gradient-to-t from-surface via-surface to-transparent pointer-events-none z-50">
      <div className="bg-surface-elevated border border-white/8 rounded-[22px] h-16 flex items-center justify-between px-3 relative pointer-events-auto shadow-2xl shadow-black/40">
        {LEFT.map((it) => (
          <NavItem key={it.key} label={it.label} icon={it.icon} active={isActive(it.key)} onClick={() => navigate(it.key)} />
        ))}
        <div className="w-12" />
        {RIGHT.map((it) => (
          <NavItem key={it.key} label={it.label} icon={it.icon} active={isActive(it.key)} onClick={() => navigate(it.key)} />
        ))}
        <button
          onClick={() => navigate('/nova-os')}
          className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full bg-brand flex items-center justify-center shadow-lg shadow-brand/40 hover:shadow-brand/70 hover:scale-110 active:scale-95 transition-all hover:rotate-90 duration-300"
        >
          <Plus size={26} className="text-white" />
        </button>
      </div>
    </div>
  )
}

function NavItem({ label, icon: Icon, active, onClick }: {
  label: string; icon: typeof Home; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1 w-12 transition-transform active:scale-90"
    >
      <div className="relative">
        <Icon
          size={20}
          className="transition-all duration-200 group-hover:scale-110"
          style={{ color: active ? '#D71920' : '#6B7280' }}
        />
        {active && (
          <div
            className="absolute -inset-2 rounded-full opacity-30 blur-md -z-10"
            style={{ background: '#D71920' }}
          />
        )}
      </div>
      <span
        className="text-[10px] font-medium transition-colors"
        style={{ color: active ? '#D71920' : '#6B7280' }}
      >
        {label}
      </span>
    </button>
  )
}
