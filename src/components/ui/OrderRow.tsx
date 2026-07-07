import { Smartphone, ChevronRight } from 'lucide-react'
import type { ServiceOrder } from '@/types/database'
import { STATUS_CONFIG, brl } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { isLegacyOrder } from '@/lib/legacy'
import { useStore } from '@/store/useStore'
import { can } from '@/lib/permissions'

interface Props {
  order: ServiceOrder
  onClick: () => void
  showValue?: boolean
}

export function OrderRow({ order, onClick, showValue }: Props) {
  const st = STATUS_CONFIG[order.status]
  const modelo = order.device?.modelo || 'Aparelho'
  const cliente = order.customer?.nome || '—'
  const { user } = useStore()
  const canFinance = can(user, 'view_financial')
  const displayValue = showValue && canFinance && order.valor_servico > 0
  const legacy = isLegacyOrder(order)

  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3 py-3 md:py-2 text-left hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-colors"
    >
      <div className="w-12 h-14 md:w-10 md:h-12 rounded-xl bg-surface-muted border border-white/5 flex items-center justify-center shrink-0 group-hover:border-brand/30 transition-colors">
        <Smartphone size={20} className="text-gray-500 group-hover:text-brand transition-colors" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="font-semibold text-[15px] truncate group-hover:text-brand transition-colors">{order.numero}</div>
          {legacy && (
            <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300">
              FPQ
            </span>
          )}
        </div>
        <div className="text-[13px] text-gray-400 truncate">{modelo} – {cliente}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-2 h-2 rounded-full" style={{ background: st.dot, boxShadow: `0 0 6px ${st.dot}80` }} />
          <span className="text-[12px] font-medium" style={{ color: st.dot }}>{st.label}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        {displayValue && (
          <div className="text-sm font-bold tabular-nums">{brl(order.valor_servico)}</div>
        )}
        <div className="text-[11px] text-gray-500 tabular-nums">
          Entrada: {formatDate(order.created_at)}
        </div>
        <ChevronRight size={16} className="text-gray-500 inline-block mt-1 group-hover:text-brand transition-colors" />
      </div>
    </button>
  )
}
