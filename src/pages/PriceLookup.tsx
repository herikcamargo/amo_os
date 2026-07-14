import { useEffect, useMemo, useState } from 'react'
import {
  Search, ChevronLeft, SlidersHorizontal, Shield, Tag, CreditCard,
  Pencil, Save, Star, Wrench, Copy, Plus, Trash2, X, Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconBtn } from '@/components/ui/IconBtn'
import { useStore } from '@/store/useStore'
import { can } from '@/lib/permissions'
import { generateId } from '@/lib/utils'
import {
  addServiceOption,
  calculateInstallmentAmount,
  calculateInstallmentPrice,
  calculateMaxDiscount,
  deleteServiceOption,
  formatCurrency,
  getPricingConfig,
  savePricingConfigToSupabase,
  saveServicePrice,
  searchPriceCatalog,
  syncPricingFromSupabase,
} from '@/lib/pricing'
import type { PriceCatalogItem, PriceService } from '@/types/pricing'
import type { Supplier } from '@/types/database'
import toast from 'react-hot-toast'

const SERVICE_ORDER = [
  'Troca de Tela',
  'Troca de Bateria',
  'Troca de Tampa',
  'Troca de Conector de Carga',
  'Troca de Carcaça',
]

const QUALITY_OPTIONS = ['PARALELA', 'PREMIUM', 'ORIGINAL'] as const

export function PriceLookup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, suppliers, addSupplier } = useStore()
  const isAdmin = can(user, 'manage_settings')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [addingOption, setAddingOption] = useState(false)
  const [syncing, setSyncing] = useState(true)
  // Incrementa apos qualquer alteracao para reler o catalogo (localStorage/Supabase)
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion((v) => v + 1)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const results = useMemo(() => searchPriceCatalog(query, 14), [query, version])
  const active = useMemo(() => {
    if (selectedId) {
      const found = results.find((item) => item.id === selectedId)
        || searchPriceCatalog('', Number.MAX_SAFE_INTEGER).find((item) => item.id === selectedId)
      if (found) return found
    }
    return results[0] || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, selectedId, version])
  const groups = active ? groupServices(active.services) : []
  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.status === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [suppliers],
  )

  useEffect(() => {
    let mounted = true
    syncPricingFromSupabase().then(() => {
      if (mounted) {
        setSyncing(false)
        refresh()
      }
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

  const quickCreateSupplier = (nome: string): Supplier => {
    const now = new Date().toISOString()
    const supplier: Supplier = { id: generateId(), nome: nome.trim(), status: 'ativo', created_at: now, updated_at: now }
    addSupplier(supplier)
    toast.success(`Fornecedor "${supplier.nome}" cadastrado`)
    return supplier
  }

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
          onChange={(event) => { setQuery(event.target.value); setSelectedId(null) }}
          placeholder="Digite modelo: A52, iPhone 11, G84, Redmi..."
          className="w-full h-12 pl-10 pr-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
        />
      </div>

      {query && results.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 md:grid md:grid-cols-3 lg:grid-cols-4 md:overflow-visible md:pb-0">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-colors ${
                active?.id === item.id ? 'bg-brand/15 border-brand/40' : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'
              }`}
            >
              <div className="text-xs text-gray-400">{item.brand}</div>
              <div className="text-sm font-semibold truncate">{item.model}</div>
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
          <div className="bg-surface-card rounded-[18px] border border-white/5 p-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500">{active.brand}</div>
              <div className="text-xl font-bold">{active.model}</div>
              <div className="text-xs text-gray-500 mt-1">
                {groups.length ? `${active.services.filter((s) => s.finalPrice || s.costPrice).length} opções de serviço` : 'Nenhum preço cadastrado para este modelo'}
              </div>
            </div>
            {isAdmin && (
              <button
                onClick={() => setAddingOption(true)}
                className="h-10 px-3.5 rounded-xl bg-brand font-semibold text-sm flex items-center gap-1.5 shrink-0 hover:bg-brand-dark transition-colors"
              >
                <Plus size={15} /> Nova opção
              </button>
            )}
          </div>

          {isAdmin && addingOption && (
            <AddOptionForm
              item={active}
              suppliers={activeSuppliers}
              onQuickSupplier={quickCreateSupplier}
              onClose={() => setAddingOption(false)}
              onSaved={() => { setAddingOption(false); refresh() }}
            />
          )}

          {groups.map((group) => (
            <ServiceGroup
              key={group.label}
              item={active}
              label={group.label}
              services={group.services}
              isAdmin={isAdmin}
              userId={user?.id}
              suppliers={activeSuppliers}
              onQuickSupplier={quickCreateSupplier}
              onChanged={refresh}
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

function AddOptionForm({ item, suppliers, onQuickSupplier, onClose, onSaved }: {
  item: PriceCatalogItem
  suppliers: Supplier[]
  onQuickSupplier: (nome: string) => Supplier
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState('Troca de Tela')
  const [customLabel, setCustomLabel] = useState('')
  const [quality, setQuality] = useState<string | null>('PARALELA')
  const [supplierId, setSupplierId] = useState('')
  const [newSupplier, setNewSupplier] = useState('')
  const [cost, setCost] = useState('')
  const [final, setFinal] = useState('')
  const [saving, setSaving] = useState(false)

  const effectiveLabel = label === '__custom__' ? customLabel.trim() : label

  const save = async () => {
    if (!effectiveLabel) {
      toast.error('Informe o tipo de serviço')
      return
    }
    const finalPrice = Number(final)
    if (!Number.isFinite(finalPrice) || finalPrice <= 0) {
      toast.error('Informe o valor à vista')
      return
    }
    setSaving(true)
    try {
      await addServiceOption(item.id, {
        label: effectiveLabel,
        quality,
        finalPrice,
        costPrice: cost.trim() === '' ? null : Number(cost) || null,
        supplierId: supplierId || null,
      })
      toast.success(`Opção adicionada em ${item.model}`)
      onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Não consegui adicionar: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-card rounded-[18px] border border-brand/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-sm flex items-center gap-2"><Plus size={15} className="text-brand" /> Nova opção — {item.model}</h2>
        <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400"><X size={14} /></button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Tipo de serviço</label>
          <div className="flex flex-wrap gap-2">
            {SERVICE_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => setLabel(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  label === s ? 'bg-brand/20 border-brand text-white' : 'bg-white/5 border-white/10 text-gray-400'
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setLabel('__custom__')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                label === '__custom__' ? 'bg-brand/20 border-brand text-white' : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              Outro...
            </button>
          </div>
          {label === '__custom__' && (
            <input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Ex: Troca de Alto-falante"
              className="mt-2 w-full h-10 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm"
            />
          )}
        </div>

        <QualityPicker value={quality} onChange={setQuality} />

        <SupplierPicker
          suppliers={suppliers}
          value={supplierId}
          onChange={setSupplierId}
          newSupplier={newSupplier}
          setNewSupplier={setNewSupplier}
          onQuickSupplier={(nome) => {
            const created = onQuickSupplier(nome)
            setSupplierId(created.id)
            setNewSupplier('')
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Custo (opcional)" value={cost} onChange={setCost} />
          <Field label="Valor à vista *" value={final} onChange={setFinal} />
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full h-11 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-brand-dark transition-colors"
        >
          <Save size={15} /> {saving ? 'Salvando...' : 'Adicionar opção'}
        </button>
      </div>
    </div>
  )
}

function QualityPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">Categoria / qualidade</label>
      <div className="flex flex-wrap gap-2">
        {QUALITY_OPTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onChange(q)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              value === q ? 'bg-brand/20 border-brand text-white' : 'bg-white/5 border-white/10 text-gray-400'
            }`}
          >
            {q}
          </button>
        ))}
        <button
          onClick={() => onChange(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            value === null ? 'bg-brand/20 border-brand text-white' : 'bg-white/5 border-white/10 text-gray-400'
          }`}
        >
          Sem categoria
        </button>
      </div>
    </div>
  )
}

function SupplierPicker({ suppliers, value, onChange, newSupplier, setNewSupplier, onQuickSupplier }: {
  suppliers: Supplier[]
  value: string
  onChange: (id: string) => void
  newSupplier: string
  setNewSupplier: (v: string) => void
  onQuickSupplier: (nome: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">Fornecedor da peça</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm"
      >
        <option value="">Sem fornecedor</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>
      <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
        <input
          value={newSupplier}
          onChange={(e) => setNewSupplier(e.target.value)}
          placeholder="Cadastrar fornecedor rápido..."
          className="h-9 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-xs"
        />
        <button
          onClick={() => newSupplier.trim() && onQuickSupplier(newSupplier)}
          disabled={!newSupplier.trim()}
          className="h-9 px-3 rounded-xl bg-white/8 border border-white/10 text-xs font-semibold disabled:opacity-40"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

function ServiceGroup({ item, label, services, isAdmin, userId, suppliers, onQuickSupplier, onChanged }: {
  item: PriceCatalogItem
  label: string
  services: PriceService[]
  isAdmin: boolean
  userId?: string
  suppliers: Supplier[]
  onQuickSupplier: (nome: string) => Supplier
  onChanged: () => void
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
            groupLabel={label}
            service={service}
            isAdmin={isAdmin}
            userId={userId}
            suppliers={suppliers}
            onQuickSupplier={onQuickSupplier}
            onChanged={onChanged}
          />
        ))}
      </div>
    </div>
  )
}

function ServiceOption({ item, groupLabel, service, isAdmin, userId, suppliers, onQuickSupplier, onChanged }: {
  item: PriceCatalogItem
  groupLabel: string
  service: PriceService
  isAdmin: boolean
  userId?: string
  suppliers: Supplier[]
  onQuickSupplier: (nome: string) => Supplier
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [cost, setCost] = useState(service.costPrice?.toString() || '')
  const [final, setFinal] = useState(service.finalPrice?.toString() || '')
  const [quality, setQuality] = useState<string | null>(normalizeQuality(service.quality))
  const [supplierId, setSupplierId] = useState(service.supplierId || '')
  const [newSupplier, setNewSupplier] = useState('')
  const [saving, setSaving] = useState(false)
  const config = getPricingConfig()
  const meta = getServiceMeta(service)
  const costPrice = valueOrNull(cost, service.costPrice)
  const cashPrice = valueOrNull(final, service.finalPrice)
  const termPrice = cashPrice === null ? null : calculateInstallmentPrice(cashPrice, config.cardInstallmentFeePct)
  const installmentAmount = cashPrice === null ? null : calculateInstallmentAmount(cashPrice, config)
  const minAllowed = cashPrice === null ? null : calculateMaxDiscount(cashPrice, config.attendantDiscountLimitPct)
  const supplierName = service.supplierId
    ? suppliers.find((s) => s.id === service.supplierId)?.nome
    : null

  const copyBudget = async () => {
    if (cashPrice === null || termPrice === null || installmentAmount === null) {
      toast.error('Este serviço ainda não tem valor para copiar')
      return
    }

    const text = [
      `Orçamento - ${groupLabel}${service.quality ? ` (${meta.label})` : ''}`,
      `Modelo: ${item.model}`,
      `Valor à vista: ${formatCurrency(cashPrice)}`,
      `Valor a prazo: ${formatCurrency(termPrice)} em até ${config.maxInstallments}x de ${formatCurrency(installmentAmount)}`,
      'Prazo do serviço: a confirmar',
      '',
      `Essa é uma ótima opção para deixar seu ${item.model} pronto com garantia. Se quiser, já posso separar a peça e agilizar seu atendimento.`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      toast.success('Orçamento copiado')
    } catch {
      toast.error('Não foi possível copiar automaticamente')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await saveServicePrice(item.id, service.key, {
        costPrice,
        finalPrice: cashPrice,
        quality,
        supplierId: supplierId || null,
      }, userId)
      toast.success('Opção atualizada')
      setEditing(false)
      onChanged()
    } catch {
      toast.success('Alteração salva neste dispositivo')
      setEditing(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm(`Excluir a opção "${meta.label}" de ${groupLabel} em ${item.model}?`)) return
    try {
      await deleteServiceOption(item.id, service.key)
      toast.success('Opção excluída')
      onChanged()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Não consegui excluir: ${message}`)
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
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-[11px] text-gray-600">Planilha: {service.sourceLabel}</span>
            {supplierName && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                <Truck size={11} /> {supplierName}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={copyBudget}
          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
          title="Copiar orçamento"
        >
          <Copy size={14} />
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => setEditing(!editing)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${editing ? 'bg-brand/20 text-brand' : 'bg-white/5 hover:bg-white/10'}`}
              title="Editar opção"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={remove}
              className="w-9 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center"
              title="Excluir opção"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 mt-4">
          <QualityPicker value={quality} onChange={setQuality} />
          <SupplierPicker
            suppliers={suppliers}
            value={supplierId}
            onChange={setSupplierId}
            newSupplier={newSupplier}
            setNewSupplier={setNewSupplier}
            onQuickSupplier={(nome) => {
              const created = onQuickSupplier(nome)
              setSupplierId(created.id)
              setNewSupplier('')
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Custo" value={cost} onChange={setCost} />
            <Field label="Valor à vista" value={final} onChange={setFinal} />
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="w-full h-10 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar alterações'}
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
    .sort((a, b) => serviceOrderRank(a.label) - serviceOrderRank(b.label))
}

function serviceOrderRank(label: string) {
  const index = SERVICE_ORDER.indexOf(label)
  return index === -1 ? SERVICE_ORDER.length : index
}

function serviceRank(service: PriceService) {
  const quality = (service.quality || service.key).toLowerCase()
  if (quality.includes('paralela')) return 1
  if (quality.includes('premium')) return 2
  if (quality.includes('original')) return 3
  return 4
}

function normalizeQuality(quality?: string | null): string | null {
  if (!quality) return null
  const upper = quality.toUpperCase()
  const match = QUALITY_OPTIONS.find((option) => upper.includes(option))
  return match || null
}

function getServiceMeta(service: PriceService) {
  const quality = (service.quality || service.label).toUpperCase()

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
