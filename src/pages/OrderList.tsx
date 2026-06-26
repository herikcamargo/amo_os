import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ChevronLeft, Filter } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { OrderRow } from '@/components/ui/OrderRow'
import { STATUS_CONFIG } from '@/lib/constants'
import type { OsStatus } from '@/types/database'

export function OrderList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { orders } = useStore()
  const [q, setQ] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [activeStatuses, setActiveStatuses] = useState<OsStatus[]>(() => {
    const param = searchParams.get('status')
    return param ? param.split(',') as OsStatus[] : []
  })

  const label = useMemo(() => {
    if (activeStatuses.length === 0) return 'Todas as ordens'
    if (activeStatuses.length === 1) return STATUS_CONFIG[activeStatuses[0]].label
    return `${activeStatuses.length} filtros`
  }, [activeStatuses])

  const list = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = activeStatuses.length === 0 || activeStatuses.includes(o.status)
      const t = q.trim().toLowerCase()
      const searchable = [
        o.customer?.nome, o.customer?.telefone, o.device?.imei,
        o.numero, o.device?.modelo, o.device?.marca,
      ].join(' ').toLowerCase()
      const matchQuery = !t || searchable.includes(t)
      return matchStatus && matchQuery
    })
  }, [q, activeStatuses, orders])

  const toggleStatus = (s: OsStatus) => {
    setActiveStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  return (
    <div className="px-5 pt-3">
      <div className="flex items-center gap-3 pt-2 mb-4">
        <IconBtn onClick={() => navigate('/')}><ChevronLeft size={22} /></IconBtn>
        <h1 className="text-xl font-bold tracking-tight flex-1">{label}</h1>
        <span className="text-xs text-gray-500">{list.length}</span>
        <IconBtn onClick={() => setShowFilter(!showFilter)}>
          <Filter size={18} className={activeStatuses.length > 0 ? 'text-brand' : ''} />
        </IconBtn>
      </div>

      {showFilter && (
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(STATUS_CONFIG) as OsStatus[]).map((s) => {
            const active = activeStatuses.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-brand/20 border-brand text-white'
                    : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            )
          })}
          {activeStatuses.length > 0 && (
            <button
              onClick={() => setActiveStatuses([])}
              className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-gray-500"
            >
              Limpar
            </button>
          )}
        </div>
      )}

      <div className="relative mb-4">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome, telefone, IMEI, nº OS…"
          className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
        />
      </div>

      <div className="bg-surface-card rounded-[20px] border border-white/5 px-4 divide-y divide-white/5">
        {list.length === 0
          ? <div className="py-14 text-center text-gray-500 text-sm">Nenhuma ordem encontrada.</div>
          : list.map((o) => (
            <OrderRow key={o.id} order={o} onClick={() => navigate(`/os/${o.id}`)} showValue />
          ))}
      </div>
    </div>
  )
}
