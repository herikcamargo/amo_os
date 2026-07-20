import { useEffect, useMemo, useState } from 'react'
import {
  Search, ChevronLeft, SlidersHorizontal, Shield, Tag, CreditCard,
  Pencil, Save, Star, Wrench, Copy, Plus, Trash2, X, Truck,
  Grid2X2, List, Smartphone, ChevronRight, Filter, Files,
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
  getPriceCatalog,
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
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [brand, setBrand] = useState('Todos')
  const [category, setCategory] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<PriceCatalogItem | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [version, setVersion] = useState(0)
  const refresh = () => setVersion((v) => v + 1)
  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.status === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [suppliers],
  )
  const results = useMemo(() => {
    void version
    const source = debouncedQuery
      ? searchPriceCatalog(debouncedQuery, Number.MAX_SAFE_INTEGER)
      : getPriceCatalog()
    return source.filter((item) => {
      if (!matchesBrand(item.brand, brand)) return false
      if (category && deviceCategory(item) !== category) return false
      if (serviceFilter && !item.services.some((service) => service.label === serviceFilter && service.finalPrice)) return false
      return true
    })
  }, [brand, category, debouncedQuery, serviceFilter, version])
  const availableServices = useMemo(
    () => {
      void version
      return Array.from(new Set(getPriceCatalog().flatMap((item) => item.services.map((service) => service.label)))).sort()
    },
    [version],
  )
  const pageSize = 24
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize))
  const visibleResults = results.slice((page - 1) * pageSize, page * pageSize)

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
    const timer = window.setTimeout(() => setDebouncedQuery(query), 220)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [brand, category, debouncedQuery, serviceFilter])

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
    <div className="px-4 md:px-0 pt-4 md:pt-8 pb-8">
      <div className="flex items-center gap-3 mb-5">
        <IconBtn onClick={() => navigate(-1)}><ChevronLeft size={22} /></IconBtn>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Consulta de preços</h1>
          <p className="text-xs text-gray-500 mt-0.5">{syncing ? 'Carregando catálogo...' : 'Catálogo rápido de serviços por modelo'}</p>
        </div>
        <div className="hidden sm:flex bg-surface-card border border-white/6 rounded-[10px] p-1">
          <ViewButton active={view === 'grid'} onClick={() => setView('grid')} icon={Grid2X2}>Grade</ViewButton>
          <ViewButton active={view === 'list'} onClick={() => setView('list')} icon={List}>Lista</ViewButton>
        </div>
        {isAdmin && <button onClick={() => setConfigOpen(true)} className="h-10 w-10 rounded-[10px] bg-white/6 border border-white/8 flex items-center justify-center" title="Configurar preços"><SlidersHorizontal size={17} /></button>}
      </div>

      <div className="grid md:grid-cols-[minmax(280px,1fr)_auto] gap-2 mb-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="iPhone 11, A52, Redmi..." className="w-full h-12 pl-10 pr-3 rounded-[10px] bg-surface-input border border-white/6 focus:border-brand outline-none text-sm" />
        </div>
        <button onClick={() => setFiltersOpen(!filtersOpen)} className={`h-12 px-4 rounded-[10px] border flex items-center justify-center gap-2 text-sm ${filtersOpen || category || serviceFilter ? 'bg-brand/12 border-brand/30 text-white' : 'bg-surface-input border-white/6 text-gray-400'}`}>
          <Filter size={16} /> Filtros
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto bg-surface-card border border-white/6 rounded-[10px] p-1.5 mb-3">
        {['Todos', 'Apple', 'Samsung', 'Motorola', 'Xiaomi', 'Realme', 'Google', 'Outros'].map((value) => (
          <button key={value} onClick={() => setBrand(value)} className={`h-8 px-3 rounded-lg text-xs font-medium shrink-0 ${brand === value ? 'bg-brand text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>{value}</button>
        ))}
      </div>

      {filtersOpen && (
        <div className="grid sm:grid-cols-2 gap-2 bg-surface-card border border-white/6 rounded-[10px] p-3 mb-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 px-3 rounded-[9px] bg-surface-input border border-white/6 outline-none text-sm">
            <option value="">Todas as categorias</option>
            <option value="Celular">Celular</option>
            <option value="Tablet">Tablet</option>
            <option value="Relógio">Relógio</option>
          </select>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="h-10 px-3 rounded-[9px] bg-surface-input border border-white/6 outline-none text-sm">
            <option value="">Todos os serviços</option>
            {availableServices.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
      )}

      {results.length === 0 ? (
        <div className="bg-surface-card rounded-[12px] border border-white/6 p-12 text-center">
          <Search size={28} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhum aparelho encontrado.</p>
        </div>
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3' : 'space-y-2'}>
          {visibleResults.map((item) => <CatalogCard key={item.id} item={item} list={view === 'list'} onOpen={() => setSelected(item)} />)}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-4">
        <div className="text-xs text-gray-500">{results.length} modelo{results.length === 1 ? '' : 's'}</div>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} title="Página anterior" className="w-9 h-9 rounded-[9px] bg-white/5 disabled:opacity-30 flex items-center justify-center"><ChevronLeft size={16} /></button>
            <span className="text-xs text-gray-400">{page} de {pageCount}</span>
            <button onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount} title="Próxima página" className="w-9 h-9 rounded-[9px] bg-white/5 disabled:opacity-30 flex items-center justify-center"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {selected && <CatalogDetails item={selected} isAdmin={isAdmin} userId={user?.id} suppliers={activeSuppliers} onQuickSupplier={quickCreateSupplier} onClose={() => setSelected(null)} onChanged={() => { refresh(); setSelected(getPriceCatalog().find((item) => item.id === selected.id) || null) }} />}
      {configOpen && <PricingConfigModal userId={user?.id} onClose={() => setConfigOpen(false)} />}
    </div>
  )
}

function ViewButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: LucideIcon; children: string }) {
  return <button onClick={onClick} className={`h-8 px-3 rounded-lg flex items-center gap-2 text-xs font-semibold ${active ? 'bg-brand text-white' : 'text-gray-400'}`}><Icon size={14} />{children}</button>
}

function CatalogCard({ item, list, onOpen }: { item: PriceCatalogItem; list: boolean; onOpen: () => void }) {
  const services = cardServices(item)
  return (
    <button onClick={onOpen} className={`text-left bg-surface-card border border-white/6 rounded-[12px] hover:border-white/15 transition-colors overflow-hidden ${list ? 'w-full flex items-center p-3 gap-3' : 'p-4'}`}>
      <div className={`${list ? 'w-14 h-14' : 'w-full h-20 sm:h-24 mb-3'} rounded-[10px] bg-white/[0.035] flex items-center justify-center shrink-0`}>
        <Smartphone size={list ? 26 : 38} className="text-gray-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-500">{item.brand}</div>
        <div className="font-bold truncate">{item.model}</div>
        {!list && (
          <div className="mt-3 divide-y divide-white/5 sm:min-h-[116px]">
            {services.length ? services.map((service) => (
              <div key={service.key} className="h-7 flex items-center gap-2 text-xs">
                <Wrench size={12} className="text-brand shrink-0" />
                <span className="text-gray-400 truncate flex-1">{service.label}{service.quality ? ` ${service.quality}` : ''}</span>
                <span className="font-semibold tabular-nums shrink-0">{formatCurrency(service.finalPrice)}</span>
              </div>
            )) : <div className="text-xs text-gray-500 pt-3">Sem preço cadastrado</div>}
          </div>
        )}
        <div className={`${list ? 'mt-1' : 'mt-3 pt-3 border-t border-white/6'} flex items-center justify-between text-xs`}>
          <span className="text-gray-500">{pricedServices(item).length} serviços</span>
          <span className="text-gray-300 flex items-center gap-1">Ver todos <ChevronRight size={13} /></span>
        </div>
      </div>
    </button>
  )
}

function CatalogDetails({ item, isAdmin, userId, suppliers, onQuickSupplier, onClose, onChanged }: {
  item: PriceCatalogItem
  isAdmin: boolean
  userId?: string
  suppliers: Supplier[]
  onQuickSupplier: (nome: string) => Supplier
  onClose: () => void
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const groups = groupServices(item.services)
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-stretch md:justify-end" onClick={onClose}>
      <div className="w-full md:w-[720px] max-h-[94vh] md:max-h-none overflow-y-auto bg-surface-elevated border border-white/10 rounded-t-[18px] md:rounded-none p-4 md:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-surface-elevated pb-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-[10px] bg-white/5 flex items-center justify-center"><Smartphone size={24} className="text-gray-500" /></div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500">{item.brand}</div>
            <h2 className="text-xl font-bold truncate">{item.model}</h2>
            <div className="text-xs text-gray-500">{pricedServices(item).length} serviços cadastrados</div>
          </div>
          {isAdmin && <button onClick={() => setAdding(true)} className="h-9 px-3 rounded-[9px] bg-brand text-xs font-semibold flex items-center gap-1.5"><Plus size={14} /> Opção</button>}
          <button onClick={onClose} className="w-9 h-9 rounded-[9px] bg-white/5 flex items-center justify-center"><X size={16} /></button>
        </div>
        {adding && <AddOptionForm item={item} suppliers={suppliers} onQuickSupplier={onQuickSupplier} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged() }} />}
        <div className="space-y-3 mt-3">
          {groups.length ? groups.map((group) => <ServiceGroup key={group.label} item={item} label={group.label} services={group.services} isAdmin={isAdmin} userId={userId} suppliers={suppliers} onQuickSupplier={onQuickSupplier} onChanged={onChanged} />) : <div className="py-14 text-center text-sm text-gray-500">Nenhum serviço com preço cadastrado.</div>}
        </div>
      </div>
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
            {services.length} {services.length > 1 ? 'opções disponíveis' : 'opção disponível'}
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
  const navigate = useNavigate()
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
      `Garantia: ${meta.warranty || 'a confirmar'}`,
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

  const duplicate = async () => {
    if (cashPrice === null) {
      toast.error('Informe um valor antes de duplicar')
      return
    }
    try {
      await addServiceOption(item.id, {
        label: service.label,
        quality: service.quality,
        finalPrice: cashPrice,
        costPrice,
        supplierId: service.supplierId,
        note: service.note,
      })
      toast.success('Opção duplicada')
      onChanged()
    } catch {
      toast.error('Não foi possível duplicar')
    }
  }

  const createOrder = () => {
    const params = new URLSearchParams({
      marca: item.brand,
      modelo: item.model,
      servico: `${groupLabel}${service.quality ? ` (${meta.label})` : ''}`,
    })
    navigate(`/nova-os?${params.toString()}`)
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
            {service.note && <span className="text-[11px] text-gray-500">{service.note}</span>}
          </div>
        </div>
        <button
          onClick={copyBudget}
          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
          title="Copiar orçamento"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={createOrder}
          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
          title="Criar OS"
        >
          <Files size={14} />
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => void duplicate()}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
              title="Duplicar opção"
            >
              <Plus size={14} />
            </button>
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

function pricedServices(item: PriceCatalogItem) {
  return item.services.filter((service) => Number(service.finalPrice) > 0)
}

function cardServices(item: PriceCatalogItem) {
  return pricedServices(item)
    .sort((a, b) => serviceOrderRank(a.label) - serviceOrderRank(b.label) || serviceRank(a) - serviceRank(b))
    .slice(0, 4)
}

function matchesBrand(itemBrand: string, selected: string) {
  if (selected === 'Todos') return true
  const normalized = itemBrand.toLocaleLowerCase('pt-BR')
  if (selected === 'Outros') {
    return !['apple', 'samsung', 'motorola', 'xiaomi', 'realme', 'google'].some((known) => normalized.includes(known))
  }
  return normalized.includes(selected.toLocaleLowerCase('pt-BR'))
}

function deviceCategory(item: PriceCatalogItem) {
  const value = `${item.brand} ${item.model}`.toLocaleLowerCase('pt-BR')
  if (value.includes('watch') || value.includes('relógio')) return 'Relógio'
  if (value.includes('ipad') || value.includes('tablet') || value.includes('tab ')) return 'Tablet'
  return 'Celular'
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
