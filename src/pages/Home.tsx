import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive, ArrowRight, Bell, CheckCircle2, ClipboardList,
  Clock3, FilePlus2, PackagePlus, Search, UserPlus, Wrench, DollarSign,
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
    featured: true,
  },
  {
    title: 'CONSULTA DE PRECOS',
    description: 'Orcamentos rapidos',
    icon: Search,
    path: '/precos',
  },
  {
    title: 'NOVA VENDA',
    description: 'Vender produto',
    icon: PackagePlus,
    path: '/vendas',
  },
  {
    title: 'NOVO CLIENTE',
    description: 'Cadastrar cliente',
    icon: UserPlus,
    path: '/clientes?novo=1',
  },
]

const SHORTCUTS: { label: string; description: string; icon: LucideIcon; color: string; statuses: OsStatus[] }[] = [
  { label: 'Pendencias', description: 'Aguardando atencao', icon: ClipboardList, color: '#F59E0B', statuses: ['recebido', 'analise', 'aprovacao', 'peca'] },
  { label: 'Em manutencao', description: 'Ordens em andamento', icon: Wrench, color: '#F59E0B', statuses: ['manutencao'] },
  { label: 'Prontos', description: 'Aguardando retirada', icon: CheckCircle2, color: '#22C55E', statuses: ['pronto'] },
  { label: 'Historico', description: 'Ordens finalizadas', icon: Archive, color: '#8B5CF6', statuses: ['entregue', 'cancelado'] },
]

export function Home() {
  const navigate = useNavigate()
  const { orders, deviceSales, notifications, user } = useStore()
  const visibleNotifications = useMemo(() => filterNotificationsForUser(notifications, user), [notifications, user])
  const unreadCount = useMemo(() => visibleNotifications.filter((n) => !n.read).length, [visibleNotifications])
  const canFinance = can(user, 'view_financial')

  const todaySummary = useMemo(() => {
    const open = orders.filter((order) => !['entregue', 'cancelado'].includes(order.status)).length
    const ready = orders.filter((order) => order.status === 'pronto').length
    const maintenance = orders.filter((order) => order.status === 'manutencao').length
    const waitingPart = orders.filter((order) => order.status === 'peca').length
    const revenue = getTodayRevenue(orders, deviceSales)

    return { open, ready, maintenance, waitingPart, revenue }
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
    <div className="px-4 md:px-0 pt-4 md:pt-8 pb-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-400">Bom dia, {user?.nome?.split(' ')[0] || 'equipe'}.</p>
              <h1 className="text-[30px] md:text-[38px] font-black tracking-tight mt-1">Vamos trabalhar?</h1>
            </div>
            <button
              onClick={() => navigate('/notificacoes')}
              className="relative h-11 w-11 rounded-[12px] bg-surface-card border border-white/10 flex items-center justify-center hover:border-brand/40 hover:bg-white/[0.04] transition-colors"
              title="Notificacoes"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-brand text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="mb-5">
            <div className="text-sm font-semibold text-gray-300 mb-3">Acesso rapido</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
          <FinancePanel value={todaySummary.revenue} canView={canFinance} />
          <PickupPanel orders={nextPickups} onOpen={(order) => navigate(`/os/${order.id}`)} onViewAll={() => goToStatuses(['pronto'])} />
          <TipPanel />
        </aside>
      </div>
    </div>
  )
}

function MainActionCard({ title, description, icon: Icon, featured, onClick }: {
  title: string
  description: string
  icon: LucideIcon
  featured?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`group min-h-[150px] rounded-[14px] border p-5 text-left flex flex-col justify-between transition-all hover:-translate-y-0.5 ${
        featured
          ? 'bg-brand/12 border-brand/35 hover:bg-brand/16'
          : 'bg-surface-card border-white/8 hover:border-white/16 hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`h-11 w-11 rounded-[12px] flex items-center justify-center ${
          featured ? 'bg-brand text-white' : 'bg-white/[0.06] text-gray-200'
        }`}>
          <Icon size={21} />
        </div>
        <ArrowRight size={18} className="text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>
      <div>
        <div className="text-[15px] font-black tracking-tight">{title}</div>
        <div className="text-xs text-gray-400 mt-1">{description}</div>
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
      className="group min-h-[74px] rounded-[12px] bg-surface-card border border-white/8 px-4 py-3 text-left flex items-center gap-3 hover:border-white/16 hover:bg-white/[0.04] transition-colors"
    >
      <div className="h-9 w-9 rounded-[10px] bg-white/[0.05] flex items-center justify-center shrink-0" style={{ color }}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{label}</div>
        <div className="text-xs text-gray-500 truncate">{description}</div>
      </div>
      <ArrowRight size={15} className="text-gray-600 group-hover:text-gray-300 transition-colors" />
    </button>
  )
}

function RecentOrdersTable({ orders, onOpen, onViewAll }: {
  orders: ServiceOrder[]
  onOpen: (order: ServiceOrder) => void
  onViewAll: () => void
}) {
  return (
    <div className="rounded-[14px] bg-surface-card border border-white/8 overflow-hidden">
      <div className="px-4 py-4 border-b border-white/6 flex items-center justify-between gap-3">
        <h2 className="font-bold">Ordens recentes</h2>
        <button onClick={onViewAll} className="h-9 px-3 rounded-[10px] bg-white/[0.04] border border-white/8 text-xs font-semibold hover:bg-white/[0.07] transition-colors">
          Ver todas
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-xs text-gray-500">
            <tr className="border-b border-white/6">
              <th className="px-4 py-3 text-left font-medium">OS</th>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">Aparelho</th>
              <th className="px-4 py-3 text-left font-medium">Problema</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Entrada</th>
              <th className="px-4 py-3 text-left font-medium">Previsao</th>
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
                    <span className="inline-flex items-center rounded-[8px] px-2 py-1 text-[11px] font-semibold" style={{ color: status.dot, backgroundColor: status.bg }}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">-</td>
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
    { label: 'Prontas para retirada', value: summary.ready, icon: CheckCircle2, color: '#22C55E' },
    { label: 'Em manutencao', value: summary.maintenance, icon: Wrench, color: '#F97316' },
    { label: 'Aguardando peca', value: summary.waitingPart, icon: PackagePlus, color: '#8B5CF6' },
  ]

  return (
    <div className="rounded-[14px] bg-surface-card border border-white/8 p-5">
      <div className="mb-4">
        <h2 className="font-bold">Resumo do dia</h2>
        <p className="text-xs text-gray-500 mt-0.5">Atualizado agora</p>
      </div>
      <div className="space-y-3">
        {rows.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon size={16} style={{ color }} />
            <div className="w-8 text-lg font-bold tabular-nums">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FinancePanel({ value, canView }: { value: number; canView: boolean }) {
  return (
    <div className="rounded-[14px] bg-surface-card border border-white/8 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm text-gray-400">Faturamento hoje</h2>
          <div className="text-[28px] font-black tracking-tight mt-2">{canView ? brl(value) : 'Restrito'}</div>
        </div>
        <div className="h-11 w-11 rounded-[12px] bg-white/[0.05] border border-white/8 flex items-center justify-center text-gray-400">
          <DollarSign size={19} />
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
    <div className="rounded-[14px] bg-surface-card border border-white/8 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-bold">Proximas retiradas</h2>
        <button onClick={onViewAll} className="text-xs text-brand hover:text-brand/80">Ver todas</button>
      </div>
      <div className="space-y-3">
        {orders.map((order) => (
          <button key={order.id} onClick={() => onOpen(order)} className="w-full text-left rounded-[10px] hover:bg-white/[0.04] transition-colors p-2 -mx-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{order.customer?.nome || '-'}</div>
                <div className="text-xs text-gray-500 truncate mt-0.5">{deviceName(order)}</div>
              </div>
              <div className="text-right text-xs text-gray-400 whitespace-nowrap">
                <div>{formatDate(order.updated_at)}</div>
                <div className="text-gray-500 mt-0.5">{formatTime(order.updated_at)}</div>
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
    <div className="rounded-[14px] bg-brand/10 border border-brand/25 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-brand">Dica rapida</h2>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed">
            Use a consulta de precos para gerar orcamentos mais rapidos e precisos.
          </p>
        </div>
        <Search size={20} className="text-brand shrink-0 mt-0.5" />
      </div>
    </div>
  )
}

function getTodayRevenue(orders: ServiceOrder[], deviceSales: ReturnType<typeof useStore.getState>['deviceSales']) {
  const today = new Date().toDateString()
  const orderRevenue = orders
    .filter((order) => order.status === 'entregue' && new Date(order.updated_at).toDateString() === today)
    .reduce((sum, order) => sum + (order.valor_servico || 0), 0)
  const salesRevenue = deviceSales
    .filter((sale) => !sale.cancelled_at && new Date(sale.sold_at).toDateString() === today)
    .reduce((sum, sale) => sum + (sale.valor_final || 0), 0)

  return orderRevenue + salesRevenue
}

function deviceName(order: ServiceOrder) {
  return [order.device?.marca, order.device?.modelo].filter(Boolean).join(' ') || '-'
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(value))
}

function formatTime(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
