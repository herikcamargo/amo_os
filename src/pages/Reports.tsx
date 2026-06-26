import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, BarChart3, TrendingUp, Clock, DollarSign, Wrench, Lock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { CardBox } from '@/components/ui/CardBox'
import { STATUS_CONFIG, brl } from '@/lib/constants'
import { can } from '@/lib/permissions'
import type { OsStatus } from '@/types/database'

export function Reports() {
  const navigate = useNavigate()
  const { orders, user } = useStore()

  if (!can(user, 'view_reports')) {
    return <AccessDenied onBack={() => navigate('/')} />
  }

  const stats = useMemo(() => {
    const total = orders.length
    const abertas = orders.filter((o) => !['entregue', 'cancelado'].includes(o.status)).length
    const entregues = orders.filter((o) => o.status === 'entregue')
    const faturamento = entregues.reduce((s, o) => s + o.valor_servico, 0)
    const ticket = entregues.length > 0 ? faturamento / entregues.length : 0

    const byStatus: Record<string, number> = {}
    orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1 })

    const byBrand: Record<string, number> = {}
    orders.forEach((o) => {
      const m = o.device?.marca || 'Outro'
      byBrand[m] = (byBrand[m] || 0) + 1
    })

    return { total, abertas, faturamento, ticket, byStatus, byBrand }
  }, [orders])

  return (
    <div className="px-5 pt-3 pb-6">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <IconBtn onClick={() => navigate(-1)}><ChevronLeft size={22} /></IconBtn>
        <h1 className="text-xl font-bold tracking-tight flex-1">Relatórios</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <KpiCard icon={BarChart3} label="Total de OS" value={stats.total} color="#D71920" />
        <KpiCard icon={Clock} label="Em aberto" value={stats.abertas} color="#F59E0B" />
        <KpiCard icon={DollarSign} label="Faturamento" value={brl(stats.faturamento)} color="#22C55E" />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={brl(stats.ticket)} color="#3B82F6" />
      </div>

      {/* Por status */}
      <CardBox title="Por status" icon={Wrench}>
        <div className="space-y-2">
          {(Object.entries(stats.byStatus) as [OsStatus, number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status]
            if (!cfg) return null
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
            return (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{cfg.label}</span>
                  <span className="font-semibold">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.dot }} />
                </div>
              </div>
            )
          })}
        </div>
      </CardBox>

      {/* Por marca */}
      <div className="mt-4">
        <CardBox title="Por marca" icon={BarChart3}>
          <div className="space-y-2">
            {Object.entries(stats.byBrand)
              .sort(([, a], [, b]) => b - a)
              .map(([brand, count]) => {
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={brand}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">{brand}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </CardBox>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof BarChart3; label: string; value: number | string; color: string
}) {
  return (
    <div className="bg-surface-card rounded-[16px] border border-white/5 p-4">
      <Icon size={18} style={{ color }} className="mb-2" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function AccessDenied({ onBack }: { onBack: () => void }) {
  return (
    <div className="px-5 md:px-0 pt-3 md:pt-8">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <IconBtn onClick={onBack}><ChevronLeft size={22} /></IconBtn>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex-1">Acesso restrito</h1>
      </div>
      <div className="bg-surface-card rounded-[20px] border border-red-500/20 p-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
          <Lock size={28} className="text-red-400" />
        </div>
        <h2 className="text-lg font-bold mb-2">Você não tem acesso a esta área</h2>
        <p className="text-sm text-gray-400 mb-4 max-w-md leading-relaxed">
          Relatórios e dados financeiros são restritos aos administradores. Solicite acesso ao responsável da loja.
        </p>
        <button
          onClick={onBack}
          className="h-11 px-6 rounded-xl bg-brand font-semibold text-sm active:scale-95 transition-transform"
        >
          Voltar
        </button>
      </div>
    </div>
  )
}
