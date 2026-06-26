import { Home, Files, Users, Settings, Plus } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

const LEFT = [
  { key: '/', label: 'Início', icon: Home },
  { key: '/ordens', label: 'Ordens', icon: Files },
]
const RIGHT = [
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
      <div className="bg-surface-elevated border border-white/8 rounded-[22px] h-16 flex items-center justify-between px-5 relative pointer-events-auto">
        {LEFT.map((it) => (
          <NavItem key={it.key} label={it.label} icon={it.icon} active={isActive(it.key)} onClick={() => navigate(it.key)} />
        ))}
        <div className="w-12" />
        {RIGHT.map((it) => (
          <NavItem key={it.key} label={it.label} icon={it.icon} active={isActive(it.key)} onClick={() => navigate(it.key)} />
        ))}
        <button
          onClick={() => navigate('/nova-os')}
          className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full bg-brand flex items-center justify-center shadow-lg shadow-brand/40 active:scale-95 transition-transform"
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
    <button onClick={onClick} className="flex flex-col items-center gap-1 w-14">
      <Icon size={20} style={{ color: active ? '#D71920' : '#6B7280' }} />
      <span className="text-[10px] font-medium" style={{ color: active ? '#D71920' : '#6B7280' }}>{label}</span>
    </button>
  )
}
