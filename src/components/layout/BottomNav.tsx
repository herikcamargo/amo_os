import { Files, Home, Plus, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MobileMenu } from './MobileMenu'

const LEFT = [
  { key: '/', label: 'Inicio', icon: Home },
  { key: '/ordens', label: 'Ordens', icon: Files },
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
        {LEFT.map((item) => (
          <NavItem
            key={item.key}
            label={item.label}
            icon={item.icon}
            active={isActive(item.key)}
            onClick={() => navigate(item.key)}
          />
        ))}
        <div className="w-12" />
        <NavItem
          label="Precos"
          icon={Search}
          active={isActive('/precos')}
          onClick={() => navigate('/precos')}
        />
        <MobileMenu />
        <button
          type="button"
          onClick={() => navigate('/nova-os')}
          aria-label="Nova OS"
          className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full bg-brand hover:bg-brand-dark flex items-center justify-center shadow-lg shadow-brand/40 active:scale-95 transition-colors duration-150"
        >
          <Plus size={26} className="text-white" />
        </button>
      </div>
    </div>
  )
}

function NavItem({ label, icon: Icon, active, onClick }: {
  label: string
  icon: typeof Home
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1 w-12 transition-transform active:scale-90"
    >
      <Icon
        size={20}
        className="transition-transform duration-200 group-hover:scale-110"
        style={{ color: active ? '#D71920' : '#6B7280' }}
      />
      <span
        className="text-[10px] font-medium transition-colors"
        style={{ color: active ? '#D71920' : '#6B7280' }}
      >
        {label}
      </span>
    </button>
  )
}
