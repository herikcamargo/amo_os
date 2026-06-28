import { useEffect, useState } from 'react'
import {
  Search, ChevronLeft, SlidersHorizontal, Shield, Tag, CreditCard,
  Pencil, Save, Star, Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconBtn } from '@/components/ui/IconBtn'
import { useStore } from '@/store/useStore'
import { can } from '@/lib/permissions'
import {
  calculateInstallmentAmount,
  calculateInstallmentPrice,
  calculateMaxDiscount,
  formatCurrency,
  getPricingConfig,
  savePricingConfigToSupabase,
  saveServicePrice,
  searchPriceCatalog,
  syncPricingFromSupabase,
} from '@/lib/pricing'
import type { PriceCatalogItem, PriceService } from '@/types/pricing'
import toast from 'react-hot-toast'

const SERVICE_ORDER = [
  'Troca de Tela',
  'Troca de Bateria',
  'Troca de Tampa',
  'Troca de Conector de Carga',
  'Troca de Carcaça',
]

export function PriceLookup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useStore()
  const isAdmin = can(user, 'manage_settings')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PriceCatalogItem | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const results = searchPriceCatalog(query, 14)
  const active = selected || results[0] || null
  const groups = active ? groupServices(active.services) : []

  useEffect(() => {
    let mounted = true
    syncPricingFromSupabase().then(() => {
      if (mounted) setSyncing(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (isAdmin && searchParams.get('config') === '1') {
      setConfigOpen(true)
    }
  }, [isAdmin, searchParams])

  return (
    <div className="px-5 md:px-0 pt-3 md:pt-8 pb-8">
      <div className="flex items-center gap-3 pt-2 mb-5">
        <IconBtn onClick={() => navigate(-1)}><ChevronLeft size={22} /></IconBtn>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Consultar preços</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {syncing ? 'Carregando tabela de preços...' : 'Busca rápida para orçamento de consertos'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setConfigOpen(true)}
            className="h-10 w-10 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center"
            title="Configurar preços"
          >
            <SlidersHorizontal size={17} />
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setSelected(null) }}
          placeholder="Digite modelo: A52, iPhone 11, G84, Redmi..."
          className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
        />
      </div>

      {query && results.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-left ${
                active?.id === item.id ? 'bg-brand/15 border-brand/40' : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="text-xs text-gray-500">{item.brand}</div>
              <div className="text-sm font-semibold">{item.model}</div>
            </button>
          ))}
        </div>
      )}

      {!active ? (
        <div className="bg-surface-card rounded-[18px] border border-white/5 p-8 text-center">
          <Search size={28} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Digite um modelo para consultar serviços e valores.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-surface-card rounded-[18px] border border-white/5 p-4">
            <div className="text-xs text-gray-500">{active.brand}</div>
            <div className="text-xl font-bold">{active.model}</div>
            <div className="text-xs text-gray-500 mt-1">
              {groups.length ? 'Valores reais encontrados na planilha' : 'Nenhum preço encontrado na planilha'}
            </div>
          </div>

          {groups.map((group) => (
            <ServiceGroup
              key={group.label}
              item={active}
              label={group.label}
              services={group.services}
              isAdmin={isAdmin}
              userId={user?.id}
            />
          ))}
        </div>
      )}

      {configOpen && (
        <PricingConfigModal
          userId={user?.id}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  )
}

function ServiceGroup({ item, label, services, isAdmin, userId }: {
  item: PriceCatalogItem
  label: string
  services: PriceService[]
  isAdmin: boolean
  userId?: string
}) {
  return (
    <div className="bg-surface-card rounded-[18px] border border-white/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center text-brand shrink-0">
          <Wrench size={18} />
        </div>
        <div>
          <h2 className="font-bold text-base">{label}</h2>
          <div className="text-[11px] text-gray-500">
            {services.length} opção{services.length > 1 ? 'ões' : ''} disponível{services.length > 1 ? 'eis' : ''}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {services.map((service) => (
          <ServiceOption
            key={service.key}
            item={item}
            service={service}
            isAdmin={isAdmin}
            userId={userId}
          />
        ))}
      </div>
    </div>
  )
}

function ServiceOption({ item, service, isAdmin, userId }: {
  item: PriceCatalogItem
  service: PriceService
  isAdmin: boolean
  userId?: string
}) {
  const [editing, setEditing] = useState(false)
  const [cost, setCost] = useState(service.costPrice?.toString() || '')
  const [final, setFinal] = useState(service.finalPrice?.toString() || '')
  const config = getPricingConfig()
  const meta = getServiceMeta(service)
  const costPrice = valueOrNull(cost, service.costPrice)
  const cashPrice = valueOrNull(final, service.finalPrice)
  const termPrice = cashPrice === null ? null : calculateInstallmentPrice(cashPrice, config.cardInstallmentFeePct)
  const installmentAmount = cashPrice === null ? null : calculateInstallmentAmount(cashPrice, config)
  const minAllowed = cashPrice === null ? null : calculateMaxDiscount(cashPrice, config.attendantDiscountLimitPct)

  const save = async () => {
    setEditing(false)
    try {
      await saveServicePrice(item.id, service.key, {
        costPrice,
        finalPrice: cashPrice,
      }, userId)
      toast.success('Preço atualizado')
    } catch {
      toast.success('Preço salvo neste dispositivo')
    }
  }

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/6 p-3">
      <div className="flex items-start gap-3">
        <div className={`w-2 self-stretch rounded-full ${meta.barClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${meta.pillClass}`}>
              {meta.label}
            </span>
            {meta.stars > 0 && <StarRating count={meta.stars} className={meta.starClass} />}
            {meta.warranty && (
              <span className="text-[11px] text-gray-400">{meta.warranty}</span>
            )}
          </div>
          <div className="text-[11px] text-gray-600 mt-1">Planilha: {service.sourceLabel}</div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditing(!editing)}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            title="Editar preço"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Custo" value={cost} onChange={setCost} />
          <Field label="Valor à vista" value={final} onChange={setFinal} />
          <button
            onClick={save}
            className="col-span-2 h-10 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Save size={15} /> Salvar preço
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          {isAdmin && <Metric icon={Shield} label="Custo" value={formatCurrency(costPrice)} muted={costPrice === null} />}
          <Metric icon={Tag} label="À vista" value={formatCurrency(cashPrice)} muted={cashPrice === null} />
          <Metric icon={CreditCard} label="A prazo" value={formatCurrency(termPrice)} muted={termPrice === null} />
          <Metric
            icon={CreditCard}
            label={`Até ${config.maxInstallments}x`}
            value={installmentAmount === null ? 'Consultar' : `${config.maxInstallments}x de ${formatCurrency(installmentAmount)}`}
            muted={installmentAmount === null}
          />
          {!isAdmin && <Metric icon={Tag} label="Mín. permitido" value={formatCurrency(minAllowed)} muted={minAllowed === null} />}
        </div>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value, muted = false }: {
  icon: LucideIcon
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="rounded-xl bg-black/10 border border-white/5 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
        <Icon size={12} /> {label}
      </div>
      <div className={`text-sm font-bold ${muted ? 'text-gray-500' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function Field({ label, value, onChange }: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-10 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm"
      />
    </div>
  )
}

function PricingConfigModal({ userId, onClose }: {
  userId?: string
  onClose: () => void
}) {
  const current = getPricingConfig()
  const [discount, setDiscount] = useState(String(current.attendantDiscountLimitPct))
  const [fee, setFee] = useState(String(current.cardInstallmentFeePct))
  const [maxInstallments, setMaxInstallments] = useState(String(current.maxInstallments))

  const save = async () => {
    try {
      await savePricingConfigToSupabase({
        attendantDiscountLimitPct: Number(discount) || 0,
        cardInstallmentFeePct: Number(fee) || 0,
        maxInstallments: Number(maxInstallments) || 10,
      }, userId)
      toast.success('Configuração salva')
    } catch {
      toast.success('Configuração salva neste dispositivo')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        className="w-full max-w-[420px] bg-surface-elevated rounded-t-[24px] md:rounded-[24px] border border-white/10 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">Configurar preços</h2>
        <div className="space-y-3">
          <Field label="Limite de desconto do atendente (%)" value={discount} onChange={setDiscount} />
          <Field label="Acréscimo do valor a prazo (%)" value={fee} onChange={setFee} />
          <Field label="Máximo de parcelas no cartão" value={maxInstallments} onChange={setMaxInstallments} />
          <button onClick={save} className="w-full h-11 rounded-xl bg-brand font-semibold text-sm">
            Salvar configurações
          </button>
        </div>
      </div>
    </div>
  )
}

function groupServices(services: PriceService[]) {
  const unique = new Map<string, PriceService>()
  services.forEach((service) => {
    const current = unique.get(service.key)
    if (!current || service.finalPrice || service.costPrice) {
      unique.set(service.key, service)
    }
  })

  const map = new Map<string, PriceService[]>()
  Array.from(unique.values()).forEach((service) => {
    if (!service.finalPrice && !service.costPrice) return
    const list = map.get(service.label) || []
    list.push(service)
    map.set(service.label, list)
  })

  return Array.from(map.entries())
    .map(([label, grouped]) => ({
      label,
      services: grouped.sort((a, b) => serviceRank(a) - serviceRank(b)),
    }))
    .sort((a, b) => SERVICE_ORDER.indexOf(a.label) - SERVICE_ORDER.indexOf(b.label))
}

function serviceRank(service: PriceService) {
  if (service.key.includes('paralela')) return 1
  if (service.key.includes('premium')) return 2
  if (service.key.includes('original')) return 3
  return 4
}

function getServiceMeta(service: PriceService) {
  const quality = service.quality || service.label

  if (quality.includes('PARALELA')) {
    return {
      label: 'PARALELA',
      stars: 3,
      warranty: 'Garantia 3 meses',
      barClass: 'bg-amber-400',
      pillClass: 'bg-amber-400/15 text-amber-300',
      starClass: 'text-amber-300',
    }
  }

  if (quality.includes('PREMIUM')) {
    return {
      label: 'PREMIUM',
      stars: 4,
      warranty: 'Garantia 6 meses',
      barClass: 'bg-sky-400',
      pillClass: 'bg-sky-400/15 text-sky-300',
      starClass: 'text-sky-300',
    }
  }

  if (quality.includes('ORIGINAL')) {
    return {
      label: 'ORIGINAL',
      stars: 5,
      warranty: 'Garantia 3 meses',
      barClass: 'bg-emerald-400',
      pillClass: 'bg-emerald-400/15 text-emerald-300',
      starClass: 'text-emerald-300',
    }
  }

  return {
    label: service.label.replace('Troca de ', '').toUpperCase(),
    stars: 0,
    warranty: '',
    barClass: 'bg-brand',
    pillClass: 'bg-brand/15 text-brand',
    starClass: 'text-brand',
  }
}

function StarRating({ count, className }: { count: number; className: string }) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <Star key={index} size={12} fill="currentColor" />
      ))}
    </div>
  )
}

function valueOrNull(value: string, fallback?: number | null) {
  if (value.trim() === '') return fallback ?? null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
