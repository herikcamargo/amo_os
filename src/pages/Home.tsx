import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Bell, FileText, ClipboardCheck, Wrench, CheckCircle2,
  Archive, BarChart3, Clock, ChevronRight,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { OrderRow } from '@/components/ui/OrderRow'
import type { OsStatus } from '@/types/database'

const QUICK = [
  { key: 'abrir', title: 'ABRIR OS', sub: 'Criar nova ordem de serviço', icon: FileText, grad: 'from-[#D71920]/35', ic: '#FF4242', icbg: '#D71920', ring: '#D71920' },
  { key: 'pend', title: 'VERIFICAR PENDÊNCIAS', sub: 'Itens aguardando atenção', icon: ClipboardCheck, grad: 'from-[#F59E0B]/30', ic: '#FBBF24', icbg: '#92610A', ring: '#F59E0B' },
  { key: 'manut', title: 'EM MANUTENÇÃO', sub: 'Ordens em andamento', icon: Wrench, grad: 'from-[#3B82F6]/30', ic: '#60A5FA', icbg: '#1E3A8A', ring: '#3B82F6' },
  { key: 'pronto', title: 'PRONTOS P/ RETIRADA', sub: 'Aguardando o cliente', icon: CheckCircle2, grad: 'from-[#22C55E]/30', ic: '#4ADE80', icbg: '#14532D', ring: '#22C55E' },
  { key: 'hist', title: 'HISTÓRICO', sub: 'Ordens finalizadas', icon: Archive, grad: 'from-[#A855F7]/30', ic: '#C084FC', icbg: '#581C87', ring: '#A855F7' },
  { key: 'rel', title: 'RELATÓRIOS', sub: 'Desempenho da loja', icon: BarChart3, grad: 'from-[#14B8A6]/30', ic: '#2DD4BF', icbg: '#134E4A', ring: '#14B8A6' },
]

const CARD_FILTER: Record<string, OsStatus[]> = {
  pend: ['aprovacao', 'peca', 'analise'],
  manut: ['manutencao'],
  pronto: ['pronto'],
  hist: ['entregue', 'cancelado'],
}

export function Home() {
  const navigate = useNavigate()
  const { orders, notifications } = useStore()
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const handleCard = (key: string) => {
    if (key === 'abrir') return navigate('/nova-os')
    if (key === 'rel') return navigate('/relatorios')
    const statuses = CARD_FILTER[key]
    if (statuses) {
      navigate(`/ordens?status=${statuses.join(',')}`)
    }
  }

  return (
    <div className="px-5 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 mb-7">
        <div className="leading-none">
          <div className="text-[26px] font-black tracking-tight">
            Amo<span className="text-brand">Celular</span>
            <span className="text-brand text-lg align-top ml-0.5">♥</span>
          </div>
          <div className="text-[10px] tracking-[0.25em] text-gray-500 font-medium mt-1.5">ASSISTÊNCIA TÉCNICA</div>
        </div>
        <div className="flex items-center gap-2.5">
          <IconBtn onClick={() => navigate('/ordens')}><Search size={20} /></IconBtn>
          <div className="relative">
            <IconBtn onClick={() => navigate('/notificacoes')}><Bell size={20} /></IconBtn>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-brand text-[10px] font-bold flex items-center justify-center border-2 border-surface">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="mb-6">
        <div className="text-gray-400 text-lg">Bom dia, 👋</div>
        <h1 className="text-[34px] font-bold tracking-tight leading-tight mt-0.5">Vamos trabalhar?</h1>
      </div>

      {/* Quick cards */}
      <div className="grid grid-cols-2 gap-3.5 mb-7">
        {QUICK.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.key}
              onClick={() => handleCard(c.key)}
              className={`relative text-left rounded-[20px] p-4 h-[150px] flex flex-col justify-between bg-gradient-to-br ${c.grad} to-transparent border active:scale-[0.98] transition-transform`}
              style={{ borderColor: c.ring + '33', backgroundColor: '#161618' }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: c.icbg }}>
                <Icon size={24} style={{ color: c.ic }} />
              </div>
              <div>
                <div className="font-bold text-[15px] leading-tight">{c.title}</div>
                <div className="text-[12px] text-gray-400 mt-1 leading-snug">{c.sub}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Recent orders */}
      <div className="bg-surface-card rounded-[20px] border border-white/5 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-brand" />
            <span className="text-[13px] font-bold tracking-wide uppercase text-gray-200">Últimas ordens</span>
          </div>
          <button onClick={() => navigate('/ordens')} className="text-brand text-[13px] font-semibold flex items-center gap-0.5">
            Ver todas <ChevronRight size={14} />
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {orders.slice(0, 3).map((o) => (
            <OrderRow key={o.id} order={o} onClick={() => navigate(`/os/${o.id}`)} />
          ))}
        </div>
      </div>

      {/* Daily summary */}
      <div className="bg-surface-card rounded-[20px] border border-white/5 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-brand" />
          <span className="text-[13px] font-bold tracking-wide uppercase text-gray-200">Resumo do dia</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Abertas" value={orders.filter((o) => !['entregue', 'cancelado'].includes(o.status)).length} />
          <MiniStat label="Prontas" value={orders.filter((o) => o.status === 'pronto').length} color="#22C55E" />
          <MiniStat
            label="Faturamento"
            value={`R$${orders.filter((o) => o.status === 'entregue').reduce((s, o) => s + o.valor_servico, 0)}`}
            color="#F59E0B"
          />
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold" style={{ color: color || '#fff' }}>{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
