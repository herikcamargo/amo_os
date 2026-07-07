import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, ArrowRight, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { STATUS_CONFIG } from '@/lib/constants'
import { searchOrders } from '@/lib/os-search'
import { isLegacyOrder } from '@/lib/legacy'
import { formatDate } from '@/lib/utils'

const PREVIEW_LIMIT = 8

interface Props {
  open: boolean
  onClose: () => void
}

export function SearchOsModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { orders } = useStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      // Da um tick pro modal montar antes de focar
      const id = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(id)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const allMatches = useMemo(() => searchOrders(orders, query), [orders, query])
  const preview = allMatches.slice(0, PREVIEW_LIMIT)

  if (!open) return null

  const goToOrder = (id: string) => {
    onClose()
    navigate(`/os/${id}`)
  }

  const goToFullList = () => {
    onClose()
    navigate(`/ordens?q=${encodeURIComponent(query.trim())}&legacy=todas`)
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 flex items-start justify-center px-4 pt-20 sm:pt-28"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-elevated rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/10">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) goToFullList()
            }}
            placeholder="Numero da OS (novas ou antigas), cliente, telefone, IMEI..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-600"
          />
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 shrink-0 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {!query.trim() && (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              Digite o numero de uma OS (ex: 123 ou 000077), nome do cliente, telefone ou IMEI.
              <div className="text-xs text-gray-600 mt-1.5">Busca nas ordens atuais e nas antigas (FPQ).</div>
            </div>
          )}

          {query.trim() && preview.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              Nenhuma OS encontrada para "{query.trim()}".
            </div>
          )}

          {preview.map((order) => {
            const st = STATUS_CONFIG[order.status]
            const legacy = isLegacyOrder(order)
            const modelo = [order.device?.marca, order.device?.modelo].filter(Boolean).join(' ') || 'Aparelho'
            return (
              <button
                key={order.id}
                onClick={() => goToOrder(order.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors border-b border-white/5 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm truncate">{order.numero}</span>
                    {legacy && (
                      <span className="shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300">
                        FPQ
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate mt-0.5">
                    {order.customer?.nome || '—'} · {modelo}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                    <span className="text-[11px] font-medium" style={{ color: st.dot }}>{st.label}</span>
                    <span className="text-[11px] text-gray-600">· Entrada: {formatDate(order.created_at)}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-600 shrink-0" />
              </button>
            )
          })}
        </div>

        {query.trim() && allMatches.length > 0 && (
          <button
            onClick={goToFullList}
            className="w-full h-12 flex items-center justify-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] border-t border-white/10 text-sm font-semibold text-brand transition-colors"
          >
            Ver {allMatches.length > PREVIEW_LIMIT ? `todos os ${allMatches.length}` : ''} resultados em Ordens
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
