import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { OrderRow } from '@/components/ui/OrderRow'
import { STATUS_CONFIG } from '@/lib/constants'
import { matchesLegacyFilter, type LegacyFilter } from '@/lib/legacy'
import { matchesOsQuery } from '@/lib/os-search'
import type { OsStatus } from '@/types/database'

const LEGACY_OPTIONS: { key: LegacyFilter; label: string }[] = [
  { key: 'atuais', label: 'Atuais' },
  { key: 'fpq', label: 'FPQ (antigas)' },
  { key: 'todas', label: 'Todas' },
]

const PAGE_SIZE = 100

export function OrderList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { orders } = useStore()
  const [q, setQ] = useState(() => searchParams.get('q') || '')
  const [showFilter, setShowFilter] = useState(false)
  const [activeStatuses, setActiveStatuses] = useState<OsStatus[]>(() => {
    const param = searchParams.get('status')
    return param ? param.split(',') as OsStatus[] : []
  })
  const [legacyFilter, setLegacyFilter] = useState<LegacyFilter>(() => {
    const param = searchParams.get('legacy')
    if (param === 'fpq' || param === 'todas') return param
    // Busca global (vinda do popup) nao sabe se a OS e nova ou antiga —
    // parte procurando em tudo por padrao.
    return searchParams.get('q') ? 'todas' : 'atuais'
  })

  const label = useMemo(() => {
    if (activeStatuses.length === 0) return 'Todas as ordens'
    if (activeStatuses.length === 1) return STATUS_CONFIG[activeStatuses[0]].label
    return `${activeStatuses.length} filtros`
  }, [activeStatuses])

  const [page, setPage] = useState(1)

  const list = useMemo(() => {
    const filtered = orders.filter((o) => {
      const matchStatus = activeStatuses.length === 0 || activeStatuses.includes(o.status)
      const matchLegacy = matchesLegacyFilter(o, legacyFilter)
      const matchQuery = !q.trim() || matchesOsQuery(o, q)
      return matchStatus && matchLegacy && matchQuery
    })
    // Sempre da mais nova para a mais antiga, independente da ordem de chegada dos dados
    return [...filtered].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  }, [q, activeStatuses, legacyFilter, orders])

  // Renderizar milhares de OS de uma vez trava o navegador — pagina.
  useEffect(() => { setPage(1) }, [q, activeStatuses, legacyFilter])

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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

      {/* Filtro Atuais / FPQ / Todas — sempre visivel */}
      <div className="flex gap-2 mb-3">
        {LEGACY_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setLegacyFilter(opt.key)}
            className={`flex-1 h-9 rounded-xl text-xs font-semibold border transition-colors ${
              legacyFilter === opt.key
                ? 'bg-brand/20 border-brand text-white'
                : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
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
        {pageItems.length === 0
          ? <div className="py-14 text-center text-gray-500 text-sm">Nenhuma ordem encontrada.</div>
          : pageItems.map((o) => (
            <OrderRow key={o.id} order={o} onClick={() => navigate(`/os/${o.id}`)} showValue />
          ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 mt-4 mb-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-gray-300 disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <span className="text-xs text-gray-500">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-gray-300 disabled:opacity-40 flex items-center gap-1"
          >
            Próxima <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
