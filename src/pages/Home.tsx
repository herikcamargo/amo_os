import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Bell, FileText, ClipboardCheck, Wrench, CheckCircle2,
  Archive, BarChart3, Clock, ChevronRight, DollarSign,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { OrderRow } from '@/components/ui/OrderRow'
import { filterNotificationsForUser } from '@/lib/notifications'
import { can } from '@/lib/permissions'
import type { OsStatus } from '@/types/database'

const QUICK = [
  { key: 'precos', title: 'Consultar precos', sub: 'Orcamentos rapidos', icon: Search, color: '#14B8A6', glow: 'rgba(20,184,166,0.3)' },
  { key: 'abrir', title: 'Abrir OS', sub: 'Nova ordem de serviço', icon: FileText, color: '#D71920', glow: 'rgba(215,25,32,0.4)' },
  { key: 'pend', title: 'Pendências', sub: 'Aguardando atenção', icon: ClipboardCheck, color: '#F59E0B', glow: 'rgba(245,158,11,0.3)' },
  { key: 'manut', title: 'Em manutenção', sub: 'Ordens em andamento', icon: Wrench, color: '#3B82F6', glow: 'rgba(59,130,246,0.3)' },
  { key: 'pronto', title: 'Prontos', sub: 'Aguardando retirada', icon: CheckCircle2, color: '#22C55E', glow: 'rgba(34,197,94,0.3)' },
  { key: 'hist', title: 'Histórico', sub: 'Ordens finalizadas', icon: Archive, color: '#A855F7', glow: 'rgba(168,85,247,0.3)' },
  { key: 'rel', title: 'Relatórios', sub: 'Desempenho da loja', icon: BarChart3, color: '#14B8A6', glow: 'rgba(20,184,166,0.3)' },
]

const CARD_FILTER: Record<string, OsStatus[]> = {
  pend: ['aprovacao', 'peca', 'analise'],
  manut: ['manutencao'],
  pronto: ['pronto'],
  hist: ['entregue', 'cancelado'],
}

export function Home() {
  const navigate = useNavigate()
  const { orders, notifications, user } = useStore()
  const visibleNotifications = useMemo(() => filterNotificationsForUser(notifications, user), [notifications, user])
  const unreadCount = useMemo(() => visibleNotifications.filter((n) => !n.read).length, [visibleNotifications])

  const canFinance = can(user, 'view_financial')
  const canReports = can(user, 'view_reports')

  const visibleQuick = QUICK.filter((c) => {
    if (c.key === 'rel' && !canReports) return false
    return true
  })

  const handleCard = (key: string) => {
    if (key === 'abrir') return navigate('/nova-os')
    if (key === 'precos') return navigate('/precos')
    if (key === 'rel') return navigate('/relatorios')
    const statuses = CARD_FILTER[key]
    if (statuses) navigate(`/ordens?status=${statuses.join(',')}`)
  }

  const stats = useMemo(() => {
    const abertas = orders.filter((o) => !['entregue', 'cancelado'].includes(o.status)).length
    const prontas = orders.filter((o) => o.status === 'pronto').length
    const faturamento = orders.filter((o) => o.status === 'entregue').reduce((s, o) => s + o.valor_servico, 0)
    return { abertas, prontas, faturamento }
  }, [orders])

  return (
    <div className="px-5 md:px-0 pt-3 md:pt-8">
      {/* Mobile Header */}
      <div className="flex items-center justify-between pt-2 mb-7 md:hidden">
        <div className="leading-none">
          <div className="text-[26px] font-black tracking-tight">
            Amo<span className="text-brand">Celular</span>
            <span className="text-brand text-lg align-top ml-0.5">♥</span>
          </div>
          <div className="text-[10px] tracking-wide text-gray-500 font-medium mt-1">Assistência técnica</div>
        </div>
        <div className="flex items-center gap-2.5">
          <IconBtn onClick={() => navigate('/ordens')}><Search size={20} /></IconBtn>
          <div className="relative">
            <IconBtn onClick={() => navigate('/notificacoes')}><Bell size={20} /></IconBtn>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand text-[10px] font-bold flex items-center justify-center border-2 border-surface animate-pulse">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="mb-6 md:mb-8 md:flex md:items-end md:justify-between">
        <div>
          <div className="text-gray-400 text-lg">Bom dia, 👋</div>
          <h1 className="text-[34px] md:text-[42px] font-bold tracking-tight leading-tight mt-0.5">
            Vamos trabalhar?
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => navigate('/ordens')}
            className="h-11 px-4 rounded-xl bg-surface-card border border-white/10 text-sm flex items-center gap-2 hover:border-brand/40 hover:bg-surface-elevated transition-all"
          >
            <Search size={16} /> Buscar
          </button>
          <button
            onClick={() => navigate('/notificacoes')}
            className="relative h-11 w-11 rounded-xl bg-surface-card border border-white/10 flex items-center justify-center hover:border-brand/40 hover:bg-surface-elevated transition-all"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Desktop KPIs */}
      <div className={`hidden md:grid gap-4 mb-6 ${canFinance ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <KpiBox label="OS em aberto" value={stats.abertas} icon={Clock} color="#F59E0B" />
        <KpiBox label="Prontas p/ retirada" value={stats.prontas} icon={CheckCircle2} color="#22C55E" />
        {canFinance && (
          <KpiBox label="Faturamento" value={`R$${stats.faturamento.toLocaleString('pt-BR')}`} icon={DollarSign} color="#D71920" />
        )}
      </div>

      {/* Quick cards — NEW DESIGN */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 mb-7 md:mb-8">
        {visibleQuick.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.key}
              onClick={() => handleCard(c.key)}
              className="group relative text-left rounded-[20px] h-[160px] md:h-[180px] overflow-hidden border border-white/5 hover:border-white/15 transition-all duration-300 hover:-translate-y-1"
              style={{ backgroundColor: '#161618' }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 12px 40px ${c.glow}`}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              {/* Background glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: `radial-gradient(circle at 50% 50%, ${c.glow} 0%, transparent 70%)` }}
              />

              {/* Centered background icon */}
              <Icon
                size={120}
                strokeWidth={1.2}
                className="absolute right-0 bottom-0 translate-x-6 translate-y-6 opacity-[0.07] group-hover:opacity-[0.15] group-hover:scale-110 group-hover:rotate-6 transition-all duration-500"
                style={{ color: c.color }}
              />

              {/* Foreground icon (top) */}
              <div className="absolute top-4 left-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"
                  style={{
                    background: c.color + '22',
                    boxShadow: `0 4px 20px ${c.glow}`,
                  }}
                >
                  <Icon size={22} style={{ color: c.color }} strokeWidth={2.2} />
                </div>
              </div>

              {/* Text */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="font-bold text-[17px] md:text-[19px] leading-tight">{c.title}</div>
                <div className="text-[13px] text-gray-400 mt-1 leading-snug">{c.sub}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Recent + Stats Grid (Desktop) */}
      <div className="md:grid md:grid-cols-3 md:gap-4 space-y-4 md:space-y-0">
        {/* Recent orders */}
        <div className="md:col-span-2 bg-surface-card rounded-[20px] border border-white/5 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-brand" />
              <span className="text-sm font-semibold text-gray-200">Últimas ordens</span>
            </div>
            <button
              onClick={() => navigate('/ordens')}
              className="text-brand text-[13px] font-semibold flex items-center gap-0.5 hover:gap-1.5 transition-all"
            >
              Ver todas <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {orders.slice(0, 4).map((o) => (
              <OrderRow key={o.id} order={o} onClick={() => navigate(`/os/${o.id}`)} />
            ))}
          </div>
        </div>

        {/* Mobile summary */}
        <div className="md:hidden bg-surface-card rounded-[20px] border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-brand" />
            <span className="text-sm font-semibold text-gray-200">Resumo do dia</span>
          </div>
          <div className={`grid gap-3 ${canFinance ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <MiniStat label="Abertas" value={stats.abertas} />
            <MiniStat label="Prontas" value={stats.prontas} color="#22C55E" />
            {canFinance && (
              <MiniStat label="Faturamento" value={`R$${stats.faturamento}`} color="#F59E0B" />
            )}
          </div>
        </div>

        {/* Desktop side panel */}
        <div className="hidden md:block bg-surface-card rounded-[20px] border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-brand" />
            <span className="text-sm font-semibold text-gray-200">Alertas</span>
          </div>
          <div className="space-y-2">
            {visibleNotifications.slice(0, 3).map((n) => (
              <button
                key={n.id}
                onClick={() => n.order_id && navigate(`/os/${n.order_id}`)}
                className={`w-full text-left p-3 rounded-xl border transition-colors hover:bg-white/5 ${
                  n.read ? 'border-white/5' : 'bg-brand/5 border-brand/20'
                }`}
              >
                <div className="font-semibold text-xs">{n.title}</div>
                <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{n.body}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums" style={{ color: color || '#fff' }}>{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function KpiBox({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: typeof Clock; color: string }) {
  return (
    <div
      className="group bg-surface-card rounded-[18px] border border-white/5 p-4 hover:border-white/15 hover:-translate-y-0.5 transition-all cursor-default relative overflow-hidden"
    >
      <Icon
        size={80}
        strokeWidth={1.5}
        className="absolute right-0 top-0 translate-x-4 -translate-y-2 opacity-[0.06] group-hover:opacity-[0.12] group-hover:scale-110 transition-all duration-500"
        style={{ color }}
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Icon size={16} style={{ color }} />
          <span className="text-xs font-semibold text-gray-500">{label}</span>
        </div>
        <div className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</div>
      </div>
    </div>
  )
}
