import { useEffect, useState } from 'react'
import { Search, ChevronLeft, SlidersHorizontal, Shield, Tag, CreditCard, Pencil, Save } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { IconBtn } from '@/components/ui/IconBtn'
import { useStore } from '@/store/useStore'
import { can } from '@/lib/permissions'
import {
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

export function PriceLookup() {
  const navigate = useNavigate()
  const { user } = useStore()
  const isAdmin = can(user, 'manage_settings')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PriceCatalogItem | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const results = searchPriceCatalog(query, 14)
  const active = selected || results[0] || null

  useEffect(() => {
    let active = true
    syncPricingFromSupabase().then(() => {
      if (!active) return
      setSyncing(false)
    })
    return () => {
      active = false
    }
  }, [])

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
          >
            <SlidersHorizontal size={17} />
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
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
            <div className="text-xs text-gray-500 mt-1">{active.services.length} serviço(s) encontrado(s)</div>
          </div>

          {active.services.map((service) => (
            <ServiceCard
              key={service.key}
              item={active}
              service={service}
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

function ServiceCard({ item, service, isAdmin, userId }: {
  item: PriceCatalogItem
  service: PriceService
  isAdmin: boolean
  userId?: string
}) {
  const [editing, setEditing] = useState(false)
  const [cost, setCost] = useState(service.costPrice?.toString() || '')
  const [final, setFinal] = useState(service.finalPrice?.toString() || '')
  const config = getPricingConfig()
  const finalPrice = Number(final || service.finalPrice || 0) || 0
  const installment = service.installmentPrice || (finalPrice ? calculateInstallmentPrice(finalPrice, config.cardInstallmentFeePct) : null)
  const minAllowed = finalPrice ? calculateMaxDiscount(finalPrice, config.attendantDiscountLimitPct) : null

  const save = async () => {
    setEditing(false)
    try {
      await saveServicePrice(item.id, service.key, {
        costPrice: cost ? Number(cost) : null,
        finalPrice: final ? Number(final) : null,
      }, userId)
      toast.success('Preço atualizado')
    } catch {
      toast.success('Preço salvo neste dispositivo')
    }
  }

  return (
    <div className="bg-surface-card rounded-[18px] border border-white/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center text-brand shrink-0">
          <Tag size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-sm">{service.label}</h2>
            {service.quality && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/8 text-gray-300">
                {service.quality}
              </span>
            )}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Origem: {service.sourceLabel}</div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setEditing(!editing)}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Custo" value={cost} onChange={setCost} />
          <Field label="Preço final" value={final} onChange={setFinal} />
          <button
            onClick={save}
            className="col-span-2 h-10 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Save size={15} /> Salvar preço
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {isAdmin && <Metric icon={Shield} label="Custo" value={formatCurrency(cost ? Number(cost) : service.costPrice)} muted={!cost && !service.costPrice} />}
          <Metric icon={Tag} label="Preço final" value={formatCurrency(finalPrice)} />
          <Metric icon={CreditCard} label="Parcelado" value={formatCurrency(installment)} />
          {!isAdmin && <Metric icon={Tag} label="Mín. permitido" value={formatCurrency(minAllowed)} />}
          {service.note && <Metric icon={Search} label="Obs." value={service.note} />}
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
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
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
        onChange={(e) => onChange(e.target.value)}
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

  const save = async () => {
    try {
      await savePricingConfigToSupabase({
        attendantDiscountLimitPct: Number(discount) || 0,
        cardInstallmentFeePct: Number(fee) || 0,
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
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">Configurar preços</h2>
        <div className="space-y-3">
          <Field label="Limite de desconto do atendente (%)" value={discount} onChange={setDiscount} />
          <Field label="Taxa para parcelado (%)" value={fee} onChange={setFee} />
          <button onClick={save} className="w-full h-11 rounded-xl bg-brand font-semibold text-sm">
            Salvar configurações
          </button>
        </div>
      </div>
    </div>
  )
}
