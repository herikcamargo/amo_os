import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive, ArrowRight, Bell, CheckCircle2, ClipboardList,
  Clock3, FilePlus2, Search, UserPlus, Wrench, DollarSign,
  ShoppingCart, Lightbulb, Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { STATUS_CONFIG, brl } from '@/lib/constants'
import { filterNotificationsForUser } from '@/lib/notifications'
import { can } from '@/lib/permissions'
import type { OsStatus, ServiceOrder } from '@/types/database'

const MAIN_ACTIONS = [
  {
    title: 'ABRIR OS',
    description: 'Nova ordem de servico',
    icon: FilePlus2,
    path: '/nova-os',
    color: '#D71920',
    featured: true,
  },
  {
    title: 'CONSULTA DE PRECOS',
    description: 'Orcamentos rapidos',
    icon: DollarSign,
    path: '/precos',
    color: '#3B82F6',
  },
  {
    title: 'NOVA VENDA',
    description: 'Vender produto',
    icon: ShoppingCart,
    path: '/vendas',
    color: '#22C55E',
  },
  {
    title: 'NOVO CLIENTE',
    description: 'Cadastrar cliente',
    icon: UserPlus,
    path: '/clientes?novo=1',
    color: '#A855F7',
  },
]

const SHORTCUTS: { label: string; description: string; icon: LucideIcon; color: string; statuses: OsStatus[] }[] = [
  { label: 'Pendencias', description: 'Aguardando atencao', icon: ClipboardList, color: '#F59E0B', statuses: ['recebido', 'analise', 'aprovacao', 'peca'] },
  { label: 'Em manutencao', description: 'Ordens em andamento', icon: Wrench, color: '#F97316', statuses: ['manutencao'] },
  { label: 'Prontos', description: 'Aguardando retirada', icon: CheckCircle2, color: '#22C55E', statuses: ['pronto'] },
  { label: 'Historico', description: 'Ordens finalizadas', icon: Archive, color: '#8B5CF6', statuses: ['entregue', 'cancelado'] },
]

export function Home() {
  const navigate = useNavigate()
  const { orders, deviceSales, notifications, user } = useStore()
  const visibleNotifications = useMemo(() => filterNotificationsForUser(notifications, user), [notifications, user])
  const unreadCount = useMemo(() => visibleNotifications.filter((n) => !n.read).length, [visibleNotifications])
  const canFinance = can(user, 'view_financial')

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        navigate('/ordens')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const todaySummary = useMemo(() => {
    const open = orders.filter((order) => !['entregue', 'cancelado'].includes(order.status)).length
    const ready = orders.filter((order) => order.status === 'pronto').length
    const maintenance = orders.filter((order) => order.status === 'manutencao').length
    const waitingPart = orders.filter((order) => order.status === 'peca').length
    const revenue = getRevenueForDate(orders, deviceSales, new Date())
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const revenueYesterday = getRevenueForDate(orders, deviceSales, yesterday)

    return { open, ready, maintenance, waitingPart, revenue, revenueYesterday }
  }, [orders, deviceSales])

  const recentOrders = useMemo(() => (
    [...orders]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 6)
  ), [orders])

  const nextPickups = useMemo(() => (
    [...orders]
      .filter((order) => order.status === 'pronto')
      .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
      .slice(0, 4)
  ), [orders])

  const goToStatuses = (statuses: OsStatus[]) => {
    navigate(`/ordens?status=${statuses.join(',')}`)
  }

  return (
    <div className="relative px-4 md:px-0 pt-4 md:pt-6 pb-8">
      {/* Luz ambiente estatica no topo (profundidade, sem custo de render) */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[820px] max-w-full opacity-60"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(215,25,32,0.07), transparent 70%)' }}
      />

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="text-sm text-gray-400">{greeting()}, {user?.nome?.split(' ')[0] || 'equipe'}! 👋</p>
          <h1 className="text-[30px] md:text-[36px] font-black tracking-tight mt-0.5">Vamos trabalhar?</h1>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => navigate('/ordens')}
            className="hidden md:flex h-11 w-[300px] lg:w-[340px] items-center gap-2.5 px-3.5 rounded-[12px] bg-surface-card border border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-400 transition-colors"
          >
            <Search size={16} className="shrink-0" />
            <span className="text-sm flex-1 text-left">Buscar OS, cliente, IMEI...</span>
            <span className="text-[11px] font-medium border border-white/10 rounded-md px-1.5 py-0.5 text-gray-500">Ctrl K</span>
          </button>
          <button
            onClick={() => navigate('/notificacoes')}
            className="relative h-11 w-11 rounded-[12px] bg-surface-card border border-white/10 flex items-center justify-center hover:border-brand/40 hover:bg-white/[0.04] transition-colors"
            title="Notificacoes"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-brand text-[10px] font-bold flex items-center justify-center border-2 border-surface">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          <div className="mb-5">
            <div className="text-sm font-semibold text-gray-300 mb-3">Acesso rapido</div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 md:gap-3">
              {MAIN_ACTIONS.map((action) => (
                <MainActionCard key={action.title} {...action} onClick={() => navigate(action.path)} />
              ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="text-sm font-semibold text-gray-300 mb-3">Atalhos</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {SHORTCUTS.map((shortcut) => (
                <ShortcutButton
                  key={shortcut.label}
                  {...shortcut}
                  onClick={() => goToStatuses(shortcut.statuses)}
                />
              ))}
            </div>
          </div>

          <RecentOrdersTable orders={recentOrders} onOpen={(order) => navigate(`/os/${order.id}`)} onViewAll={() => navigate('/ordens')} />
        </section>

        <aside className="space-y-4">
          <SummaryPanel summary={todaySummary} />
          <FinancePanel value={todaySummary.revenue} yesterday={todaySummary.revenueYesterday} canView={canFinance} />
          <PickupPanel orders={nextPickups} onOpen={(order) => navigate(`/os/${order.id}`)} onViewAll={() => goToStatuses(['pronto'])} />
          <TipPanel />
        </aside>
      </div>
    </div>
  )
}

function MainActionCard({ title, description, icon: Icon, color, featured, onClick }: {
  title: string
  description: string
  icon: LucideIcon
  color: string
  featured?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative overflow-hidden min-h-[160px] md:min-h-[196px] rounded-[18px] border p-5 text-left flex flex-col transition-colors ${
        featured
          ? 'border-brand/35 hover:border-brand/55'
          : 'border-white/8 hover:border-white/18'
      }`}
      style={{ backgroundColor: '#101012' }}
    >
      {/* Tinta radial da cor no topo do card */}
      <div
        className="absolute inset-0 pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(130% 80% at 18% 0%, ${color}17, transparent 55%)` }}
      />

      {/* Icone neon */}
      <div
        className="relative h-[60px] w-[60px] rounded-full flex items-center justify-center mb-5 md:mb-6 transition-shadow duration-300"
        style={{
          backgroundColor: '#0C0C0E',
          boxShadow: `0 0 0 1px ${color}50, 0 0 26px ${color}38, inset 0 0 14px ${color}1E`,
        }}
      >
        <Icon size={24} style={{ color, filter: `drop-shadow(0 0 6px ${color}90)` }} strokeWidth={2} />
      </div>

      <div className="relative flex-1">
        <div className="text-[15px] md:text-base font-extrabold tracking-tight leading-tight">{title}</div>
        <div className="text-xs text-gray-400 mt-1">{description}</div>
      </div>

      {/* Seta em circulo delineado */}
      <div className="relative flex justify-end mt-4">
        <span className="h-9 w-9 rounded-full border border-white/12 flex items-center justify-center text-gray-400 group-hover:border-white/30 group-hover:text-white transition-colors">
          <ArrowRight size={15} />
        </span>
      </div>
    </button>
  )
}

function ShortcutButton({ label, description, icon: Icon, color, onClick }: {
  label: string
  description: string
  icon: LucideIcon
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group min-h-[72px] rounded-[14px] bg-surface-card border border-white/8 px-4 py-3 text-left flex items-center gap-3 hover:border-white/16 hover:bg-white/[0.03] transition-colors"
    >
      <div
        className="h-10 w-10 rounded-[12px] flex items-center justify-center shrink-0"
        style={{
          backgroundColor: color + '16',
          boxShadow: `inset 0 0 0 1px ${color}30, 0 0 14px ${color}20`,
        }}
      >
        <Icon size={17} style={{ color, filter: `drop-shadow(0 0 4px ${color}70)` }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{label}</div>
        <div className="text-xs text-gray-400 truncate">{description}</div>
      </div>
    </button>
  )
}

function RecentOrdersTable({ orders, onOpen, onViewAll }: {
  orders: ServiceOrder[]
  onOpen: (order: ServiceOrder) => void
  onViewAll: () => void
}) {
  return (
    <div className="rounded-[16px] bg-surface-card border border-white/8 overflow-hidden">
      <div className="px-4 py-4 border-b border-white/6 flex items-center justify-between gap-3">
        <h2 className="font-bold">Ordens recentes</h2>
        <button onClick={onViewAll} className="h-9 px-3 rounded-[10px] bg-white/[0.04] border border-white/8 text-xs font-semibold hover:bg-white/[0.07] transition-colors">
          Ver todas
        </button>
      </div>

      {/* Lista compacta — mobile */}
      <div className="md:hidden divide-y divide-white/6">
        {orders.map((order) => {
          const status = STATUS_CONFIG[order.status]
          return (
            <button
              key={order.id}
              onClick={() => onOpen(order)}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-sm">{order.numero}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap" style={{ color: status.dot, backgroundColor: status.bg }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.dot }} />
                  {status.label}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1 truncate">
                {order.customer?.nome || '-'} · {deviceName(order)}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                {order.problema_relatado || '-'} · {formatDate(order.created_at)}
              </div>
            </button>
          )
        })}
      </div>

      {/* Tabela — desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-xs text-gray-500">
            <tr className="border-b border-white/6">
              <th className="px-4 py-3 text-left font-medium">OS</th>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">Aparelho</th>
              <th className="px-4 py-3 text-left font-medium">Problema</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Entrada</th>
              <th className="px-4 py-3 text-left font-medium">Atualizada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {orders.map((order) => {
              const status = STATUS_CONFIG[order.status]
              return (
                <tr
                  key={order.id}
                  onClick={() => onOpen(order)}
                  className="cursor-pointer hover:bg-white/[0.035] transition-colors"
                >
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{order.numero}</td>
                  <td className="px-4 py-3 text-gray-300 max-w-[150px] truncate">{order.customer?.nome || '-'}</td>
                  <td className="px-4 py-3 text-gray-300 max-w-[160px] truncate">{deviceName(order)}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-[190px] truncate">{order.problema_relatado || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ color: status.dot, backgroundColor: status.bg }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: status.dot }} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap tabular-nums">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap tabular-nums">{formatDate(order.updated_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">Nenhuma ordem cadastrada ainda.</div>
      )}
    </div>
  )
}

function SummaryPanel({ summary }: {
  summary: { open: number; ready: number; maintenance: number; waitingPart: number }
}) {
  const rows = [
    { label: 'OS em aberto', value: summary.open, icon: Clock3, color: '#F59E0B' },
    { label: 'Prontas p/ retirada', value: summary.ready, icon: CheckCircle2, color: '#22C55E' },
    { label: 'Em manutencao', value: summary.maintenance, icon: Wrench, color: '#F97316' },
    { label: 'Aguardando peca', value: summary.waitingPart, icon: Package, color: '#8B5CF6' },
  ]

  return (
    <div className="rounded-[16px] bg-surface-card border border-white/8 p-5">
      <div className="mb-4">
        <h2 className="font-bold">Resumo do dia</h2>
        <p className="text-xs text-gray-500 mt-0.5">Atualizado agora</p>
      </div>
      <div className="space-y-3">
        {rows.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: color + '18' }}
            >
              <Icon size={15} style={{ color }} />
            </div>
            <div className="w-7 text-lg font-bold tabular-nums">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinancePanel({ value, yesterday, canView }: { value: number; yesterday: number; canView: boolean }) {
  const delta = yesterday > 0 ? Math.round(((value - yesterday) / yesterday) * 100) : 0
  const deltaLabel = yesterday > 0
    ? `${delta >= 0 ? '+' : ''}${delta}% vs ontem`
    : `${value > 0 ? '+100%' : '0%'} vs ontem`
  const deltaColor = value >= yesterday ? 'text-green-400' : 'text-red-400'

  return (
    <div className="rounded-[16px] bg-surface-card border border-white/8 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm text-gray-400">Faturamento hoje</h2>
          <div className="text-[28px] font-black tracking-tight mt-1.5 tabular-nums">{canView ? brl(value) : 'Restrito'}</div>
          {canView && <div className={`text-xs mt-1 ${deltaColor}`}>{deltaLabel}</div>}
        </div>
        <div className="h-11 w-11 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-gray-400 shrink-0">
          <DollarSign size={18} />
        </div>
      </div>
    </div>
  )
}

function PickupPanel({ orders, onOpen, onViewAll }: {
  orders: ServiceOrder[]
  onOpen: (order: ServiceOrder) => void
  onViewAll: () => void
}) {
  return (
    <div className="rounded-[16px] bg-surface-card border border-white/8 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-bold">Proximas retiradas</h2>
        <button onClick={onViewAll} className="text-xs text-brand hover:text-brand-light transition-colors">Ver todas</button>
      </div>
      <div className="space-y-1">
        {orders.map((order) => (
          <button key={order.id} onClick={() => onOpen(order)} className="w-full text-left rounded-[10px] hover:bg-white/[0.04] transition-colors px-2 py-2 -mx-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{order.customer?.nome || '-'}</div>
                <div className="text-xs text-gray-500 truncate mt-0.5">{deviceName(order)}</div>
              </div>
              <div className="text-right text-xs whitespace-nowrap">
                {isToday(order.updated_at) ? (
                  <span className="inline-block px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 font-semibold">
                    Hoje
                  </span>
                ) : (
                  <div className="text-gray-400">{relativeDay(order.updated_at)}</div>
                )}
                <div className="text-gray-500 mt-1 tabular-nums">{formatTime(order.updated_at)}</div>
              </div>
            </div>
          </button>
        ))}
        {orders.length === 0 && (
          <div className="py-5 text-sm text-gray-500">Nenhuma retirada pronta no momento.</div>
        )}
      </div>
    </div>
  )
}

function TipPanel() {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-brand/30 p-5"
      style={{ background: 'radial-gradient(140% 120% at 100% 0%, rgba(215,25,32,0.16), rgba(215,25,32,0.05) 60%)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-brand-light">Dica rapida</h2>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed">
            Use a consulta de precos para gerar orcamentos mais rapidos e precisos.
          </p>
        </div>
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: '#160B0C',
            boxShadow: '0 0 0 1px rgba(215,25,32,0.45), 0 0 20px rgba(215,25,32,0.35)',
          }}
        >
          <Lightbulb size={17} className="text-brand-light" style={{ filter: 'drop-shadow(0 0 5px rgba(255,66,66,0.8))' }} />
        </div>
      </div>
    </div>
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getRevenueForDate(orders: ServiceOrder[], deviceSales: ReturnType<typeof useStore.getState>['deviceSales'], date: Date) {
  const target = date.toDateString()
  const orderRevenue = orders
    .filter((order) => order.status === 'entregue' && new Date(order.updated_at).toDateString() === target)
    .reduce((sum, order) => sum + (order.valor_servico || 0), 0)
  const salesRevenue = deviceSales
    .filter((sale) => !sale.cancelled_at && new Date(sale.sold_at).toDateString() === target)
    .reduce((sum, sale) => sum + (sale.valor_final || 0), 0)

  return orderRevenue + salesRevenue
}

function deviceName(order: ServiceOrder) {
  return [order.device?.marca, order.device?.modelo].filter(Boolean).join(' ') || '-'
}

function isToday(value?: string | null) {
  if (!value) return false
  return new Date(value).toDateString() === new Date().toDateString()
}

function relativeDay(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Hoje'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem'
  return formatDate(value)
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(value))
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
