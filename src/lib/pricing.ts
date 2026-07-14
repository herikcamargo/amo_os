import { PRICE_CATALOG, PRICE_CATALOG_VERSION } from '@/data/priceCatalog'
import { isSupabaseEnabled } from '@/lib/storage-adapter'
import { supabase } from '@/lib/supabase'
import type { NewServiceOptionInput, PriceCatalogItem, PriceService, PricingConfig, PriceSyncResult } from '@/types/pricing'

const PRICE_OVERRIDES_KEY = 'amo-os-price-overrides'
const PRICING_CONFIG_KEY = 'amo-os-pricing-config'
const REMOTE_PRICE_CATALOG_KEY = 'amo-os-remote-price-catalog'
// Fallback local (modo demo/offline): opcoes criadas e excluidas pelo admin
const CUSTOM_SERVICES_KEY = 'amo-os-custom-price-services'
const REMOVED_SERVICES_KEY = 'amo-os-removed-price-services'

const DEFAULT_CONFIG: PricingConfig = {
  attendantDiscountLimitPct: 5,
  cardInstallmentFeePct: 11,
  maxInstallments: 10,
}

type ServiceOverride = Partial<PriceService> & { catalogVersion?: string }
type ServiceOverrides = Record<string, ServiceOverride>
type PriceOverrideRow = {
  item_id: string
  service_key: string
  cost_price: number | null
  final_price: number | null
  catalog_version?: string | null
}
type PriceCatalogRow = {
  id: string
  brand: string
  model: string
  search?: string | null
}
type PriceServiceRow = {
  catalog_id: string
  key: string
  label: string
  source_label?: string | null
  quality?: string | null
  final_price?: number | string | null
  installment_price?: number | string | null
  cost_price?: number | string | null
  note?: string | null
  supplier_id?: string | null
}
type PricingConfigRow = {
  attendant_discount_limit_pct?: number | string | null
  card_installment_fee_pct?: number | string | null
  max_installments?: number | string | null
}

export function getPricingConfig(): PricingConfig {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(PRICING_CONFIG_KEY) || '{}') }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function savePricingConfig(config: PricingConfig) {
  localStorage.setItem(PRICING_CONFIG_KEY, JSON.stringify(config))
}

export async function syncPricingFromSupabase(): Promise<PriceSyncResult> {
  if (!isSupabaseEnabled) return { remoteReady: false, loaded: false }

  try {
    const [
      { data: catalogRows, error: catalogError },
      { data: serviceRows, error: servicesError },
      { data: config, error: configError },
    ] = await Promise.all([
      supabase.from('price_catalog').select('id, brand, model, search').order('brand').order('model'),
      supabase.from('price_services').select('catalog_id, key, label, source_label, quality, final_price, installment_price, cost_price, note, supplier_id'),
      supabase
        .from('pricing_config')
        .select('attendant_discount_limit_pct, card_installment_fee_pct, max_installments')
        .eq('id', 'default')
        .maybeSingle(),
    ])

    if (!catalogError && !servicesError) {
      const remoteCatalog = rowsToCatalog(
        (catalogRows || []) as PriceCatalogRow[],
        (serviceRows || []) as PriceServiceRow[],
      )

      if (remoteCatalog.length > 0) {
        localStorage.setItem(REMOTE_PRICE_CATALOG_KEY, JSON.stringify(remoteCatalog))
        localStorage.removeItem(PRICE_OVERRIDES_KEY)
      }

      if (!configError && config) {
        localStorage.setItem(PRICING_CONFIG_KEY, JSON.stringify(configRowToSettings(config as PricingConfigRow)))
      }

      return { remoteReady: true, loaded: remoteCatalog.length > 0 }
    }

    const [{ data: overrides, error: overridesError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from('price_overrides').select('item_id, service_key, cost_price, final_price, catalog_version'),
      supabase
        .from('pricing_settings')
        .select('attendant_discount_limit_pct, card_installment_fee_pct, max_installments')
        .eq('id', 'default')
        .maybeSingle(),
    ])

    if (overridesError || settingsError) {
      console.warn('Tabelas de precos ainda nao estao prontas no Supabase:', catalogError || servicesError || overridesError || settingsError)
      return { remoteReady: false, loaded: false }
    }

    const merged = rowsToOverrides((overrides || []) as PriceOverrideRow[])
    if (Object.keys(merged).length > 0) {
      localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(merged))
    } else {
      localStorage.removeItem(PRICE_OVERRIDES_KEY)
    }

    if (settings) {
      localStorage.setItem(PRICING_CONFIG_KEY, JSON.stringify(configRowToSettings(settings as PricingConfigRow)))
    }

    return { remoteReady: true, loaded: true }
  } catch (err) {
    console.warn('Falha ao sincronizar precos com Supabase:', err)
    return { remoteReady: false, loaded: false }
  }
}

export function getPriceCatalog(): PriceCatalogItem[] {
  const baseCatalog = getRemoteCatalog() || PRICE_CATALOG
  const overrides = getOverrides()
  const custom = getCustomServices()
  const removed = getRemovedServiceKeys()

  return baseCatalog.map((item) => {
    const baseServices = item.services
      .filter((service) => !removed.has(serviceOverrideKey(item.id, service.key)))
      .map((service) => ({
        ...service,
        ...(overrides[serviceOverrideKey(item.id, service.key)] || {}),
      }))
    const extras = (custom[item.id] || [])
      .filter(
        (service) => !removed.has(serviceOverrideKey(item.id, service.key))
          && !baseServices.some((existing) => existing.key === service.key),
      )
      .map((service) => ({
        ...service,
        ...(overrides[serviceOverrideKey(item.id, service.key)] || {}),
      }))
    return { ...item, services: [...baseServices, ...extras] }
  })
}

export function searchPriceCatalog(query: string, limit = 12): PriceCatalogItem[] {
  const clean = normalize(query)
  if (!clean) return getPriceCatalog().slice(0, limit)
  const words = clean.split(' ').filter(Boolean)

  return getPriceCatalog()
    .map((item) => {
      const haystack = normalize(`${item.brand} ${item.model}`)
      const score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0)
      const starts = haystack.startsWith(clean) ? 3 : 0
      return { item, score: score + starts }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.model.localeCompare(b.item.model))
    .slice(0, limit)
    .map(({ item }) => item)
}

export async function saveServicePrice(itemId: string, serviceKey: string, updates: Partial<PriceService>, userId?: string) {
  const overrides = getOverrides()
  overrides[serviceOverrideKey(itemId, serviceKey)] = {
    ...(overrides[serviceOverrideKey(itemId, serviceKey)] || {}),
    ...updates,
    catalogVersion: PRICE_CATALOG_VERSION,
  }
  localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(overrides))

  if (!isSupabaseEnabled) return

  const existing = getPriceCatalog()
    .find((item) => item.id === itemId)
    ?.services.find((service) => service.key === serviceKey)
  const finalPrice = updates.finalPrice ?? existing?.finalPrice ?? null
  const costPrice = updates.costPrice ?? existing?.costPrice ?? null
  const installmentPrice = finalPrice === null ? null : calculateInstallmentPrice(finalPrice)

  const servicePayload = {
    catalog_id: itemId,
    key: serviceKey,
    label: updates.label || existing?.label || serviceKey,
    source_label: updates.sourceLabel || existing?.sourceLabel || null,
    quality: updates.quality ?? existing?.quality ?? null,
    cost_price: costPrice,
    final_price: finalPrice,
    installment_price: installmentPrice,
    note: updates.note ?? existing?.note ?? null,
    supplier_id: updates.supplierId ?? existing?.supplierId ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error: serviceError } = await supabase
    .from('price_services')
    .upsert(servicePayload, { onConflict: 'catalog_id,key' })

  if (!serviceError) {
    localStorage.removeItem(PRICE_OVERRIDES_KEY)
    await syncPricingFromSupabase()
    return
  }

  const { error } = await supabase
    .from('price_overrides')
    .upsert({
      item_id: itemId,
      service_key: serviceKey,
      cost_price: costPrice,
      final_price: finalPrice,
      catalog_version: PRICE_CATALOG_VERSION,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'item_id,service_key' })

  if (error) throw error
}

export async function addServiceOption(itemId: string, input: NewServiceOptionInput): Promise<PriceService> {
  const item = getPriceCatalog().find((entry) => entry.id === itemId)
  if (!item) throw new Error('Modelo não encontrado no catálogo')

  const key = uniqueServiceKey(item.services, input.label, input.quality)
  const service: PriceService = {
    key,
    label: input.label.trim(),
    sourceLabel: 'Cadastro manual',
    quality: input.quality?.trim() || null,
    finalPrice: input.finalPrice,
    installmentPrice: calculateInstallmentPrice(input.finalPrice),
    costPrice: input.costPrice ?? null,
    note: input.note?.trim() || null,
    supplierId: input.supplierId || null,
  }

  if (isSupabaseEnabled) {
    const { error } = await supabase.from('price_services').insert({
      catalog_id: itemId,
      key: service.key,
      label: service.label,
      source_label: service.sourceLabel,
      quality: service.quality,
      final_price: service.finalPrice,
      installment_price: service.installmentPrice,
      cost_price: service.costPrice,
      note: service.note,
      supplier_id: service.supplierId,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    await syncPricingFromSupabase()
    return service
  }

  const custom = getCustomServices()
  custom[itemId] = [...(custom[itemId] || []), service]
  localStorage.setItem(CUSTOM_SERVICES_KEY, JSON.stringify(custom))
  return service
}

export async function deleteServiceOption(itemId: string, serviceKey: string): Promise<void> {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('price_services')
      .delete()
      .eq('catalog_id', itemId)
      .eq('key', serviceKey)
    if (error) throw error
    await syncPricingFromSupabase()
    return
  }

  // Modo local: se for opcao customizada, remove da lista; se vier do
  // catalogo base, marca como removida.
  const custom = getCustomServices()
  const list = custom[itemId] || []
  if (list.some((service) => service.key === serviceKey)) {
    custom[itemId] = list.filter((service) => service.key !== serviceKey)
    localStorage.setItem(CUSTOM_SERVICES_KEY, JSON.stringify(custom))
    return
  }

  const removed = getRemovedServiceKeys()
  removed.add(serviceOverrideKey(itemId, serviceKey))
  localStorage.setItem(REMOVED_SERVICES_KEY, JSON.stringify(Array.from(removed)))
}

export async function savePricingConfigToSupabase(config: PricingConfig, userId?: string) {
  savePricingConfig(config)

  if (!isSupabaseEnabled) return

  const configPayload = {
    id: 'default',
    attendant_discount_limit_pct: config.attendantDiscountLimitPct,
    card_installment_fee_pct: config.cardInstallmentFeePct,
    max_installments: config.maxInstallments,
    updated_at: new Date().toISOString(),
  }

  const { error: configError } = await supabase
    .from('pricing_config')
    .upsert(configPayload, { onConflict: 'id' })

  if (!configError) return

  const { error } = await supabase
    .from('pricing_settings')
    .upsert({
      ...configPayload,
      updated_by: userId || null,
    }, { onConflict: 'id' })

  if (error) throw error
}

export function calculateInstallmentPrice(finalPrice: number, feePct = getPricingConfig().cardInstallmentFeePct) {
  return Math.ceil(finalPrice * (1 + feePct / 100))
}

export function calculateInstallmentAmount(finalPrice: number, config = getPricingConfig()) {
  const maxInstallments = Math.max(1, Math.floor(config.maxInstallments || DEFAULT_CONFIG.maxInstallments))
  return Math.ceil(calculateInstallmentPrice(finalPrice, config.cardInstallmentFeePct) / maxInstallments)
}

export function calculateMaxDiscount(finalPrice: number, limitPct = getPricingConfig().attendantDiscountLimitPct) {
  return Math.floor(finalPrice * (1 - limitPct / 100))
}

export function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return 'Consultar'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getOverrides(): ServiceOverrides {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRICE_OVERRIDES_KEY) || '{}') as ServiceOverrides
    const current = Object.entries(parsed).reduce<ServiceOverrides>((acc, [key, override]) => {
      if (override.catalogVersion === PRICE_CATALOG_VERSION) {
        acc[key] = override
      }
      return acc
    }, {})

    if (Object.keys(current).length !== Object.keys(parsed).length) {
      if (Object.keys(current).length > 0) {
        localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(current))
      } else {
        localStorage.removeItem(PRICE_OVERRIDES_KEY)
      }
    }

    return current
  } catch {
    return {}
  }
}

function getRemoteCatalog(): PriceCatalogItem[] | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMOTE_PRICE_CATALOG_KEY) || 'null') as PriceCatalogItem[] | null
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

function rowsToCatalog(catalogRows: PriceCatalogRow[], serviceRows: PriceServiceRow[]): PriceCatalogItem[] {
  const servicesByCatalog = serviceRows.reduce<Record<string, PriceService[]>>((acc, row) => {
    if (!row.catalog_id || !row.key || !row.label) return acc
    const list = acc[row.catalog_id] || []
    list.push({
      key: row.key,
      label: row.label,
      sourceLabel: row.source_label || row.label,
      quality: row.quality || null,
      finalPrice: toNumberOrNull(row.final_price),
      installmentPrice: toNumberOrNull(row.installment_price),
      costPrice: toNumberOrNull(row.cost_price),
      note: row.note || null,
      supplierId: row.supplier_id || null,
    })
    acc[row.catalog_id] = list
    return acc
  }, {})

  return catalogRows
    .filter((row) => row.id && row.brand && row.model)
    .map((row) => ({
      id: row.id,
      brand: row.brand,
      model: row.model,
      search: row.search || `${row.brand} ${row.model}`.toLowerCase(),
      services: servicesByCatalog[row.id] || [],
    }))
}

function rowsToOverrides(rows: PriceOverrideRow[]): ServiceOverrides {
  return rows.reduce<ServiceOverrides>((acc, row) => {
    if (row.catalog_version !== PRICE_CATALOG_VERSION) return acc
    acc[serviceOverrideKey(row.item_id, row.service_key)] = {
      costPrice: row.cost_price,
      finalPrice: row.final_price,
      catalogVersion: row.catalog_version,
    }
    return acc
  }, {})
}

function configRowToSettings(row: PricingConfigRow): PricingConfig {
  return {
    attendantDiscountLimitPct: toNumberOrDefault(row.attendant_discount_limit_pct, DEFAULT_CONFIG.attendantDiscountLimitPct),
    cardInstallmentFeePct: toNumberOrDefault(row.card_installment_fee_pct, DEFAULT_CONFIG.cardInstallmentFeePct),
    maxInstallments: toNumberOrDefault(row.max_installments, DEFAULT_CONFIG.maxInstallments),
  }
}

function toNumberOrNull(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNumberOrDefault(value: number | string | null | undefined, fallback: number) {
  const parsed = toNumberOrNull(value)
  return parsed === null ? fallback : parsed
}

function serviceOverrideKey(itemId: string, serviceKey: string) {
  return `${itemId}:${serviceKey}`
}

function getCustomServices(): Record<string, PriceService[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_SERVICES_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getRemovedServiceKeys(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(REMOVED_SERVICES_KEY) || '[]')
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function uniqueServiceKey(existing: PriceService[], label: string, quality?: string | null) {
  const base = normalize(`${label} ${quality || ''}`).replace(/\s+/g, '-') || 'servico'
  if (!existing.some((service) => service.key === base)) return base
  let suffix = 2
  while (existing.some((service) => service.key === `${base}-${suffix}`)) suffix++
  return `${base}-${suffix}`
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
