import { PRICE_CATALOG } from '@/data/priceCatalog'
import { isSupabaseEnabled } from '@/lib/storage-adapter'
import { supabase } from '@/lib/supabase'
import type { PriceCatalogItem, PriceService, PricingConfig, PriceSyncResult } from '@/types/pricing'

const PRICE_OVERRIDES_KEY = 'amo-os-price-overrides'
const PRICING_CONFIG_KEY = 'amo-os-pricing-config'

const DEFAULT_CONFIG: PricingConfig = {
  attendantDiscountLimitPct: 5,
  cardInstallmentFeePct: 11,
  maxInstallments: 10,
}

type ServiceOverrides = Record<string, Partial<PriceService>>
type PriceOverrideRow = {
  item_id: string
  service_key: string
  cost_price: number | null
  final_price: number | null
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
    const [{ data: overrides, error: overridesError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from('price_overrides').select('item_id, service_key, cost_price, final_price'),
      supabase
        .from('pricing_settings')
        .select('attendant_discount_limit_pct, card_installment_fee_pct, max_installments')
        .eq('id', 'default')
        .maybeSingle(),
    ])

    if (overridesError || settingsError) {
      console.warn('Tabela de precos ainda nao esta pronta no Supabase:', overridesError || settingsError)
      return { remoteReady: false, loaded: false }
    }

    const merged = rowsToOverrides((overrides || []) as PriceOverrideRow[])
    localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(merged))

    if (settings) {
      localStorage.setItem(PRICING_CONFIG_KEY, JSON.stringify({
        attendantDiscountLimitPct: Number(settings.attendant_discount_limit_pct ?? DEFAULT_CONFIG.attendantDiscountLimitPct),
        cardInstallmentFeePct: Number(settings.card_installment_fee_pct ?? DEFAULT_CONFIG.cardInstallmentFeePct),
        maxInstallments: Number(settings.max_installments ?? DEFAULT_CONFIG.maxInstallments),
      }))
    }

    return { remoteReady: true, loaded: true }
  } catch (err) {
    console.warn('Falha ao sincronizar precos com Supabase:', err)
    return { remoteReady: false, loaded: false }
  }
}

export function getPriceCatalog(): PriceCatalogItem[] {
  const overrides = getOverrides()
  return PRICE_CATALOG.map((item) => ({
    ...item,
    services: item.services.map((service) => ({
      ...service,
      ...(overrides[serviceOverrideKey(item.id, service.key)] || {}),
    })),
  }))
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
  }
  localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(overrides))

  if (!isSupabaseEnabled) return

  const { error } = await supabase
    .from('price_overrides')
    .upsert({
      item_id: itemId,
      service_key: serviceKey,
      cost_price: updates.costPrice ?? null,
      final_price: updates.finalPrice ?? null,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'item_id,service_key' })

  if (error) throw error
}

export async function savePricingConfigToSupabase(config: PricingConfig, userId?: string) {
  savePricingConfig(config)

  if (!isSupabaseEnabled) return

  const { error } = await supabase
    .from('pricing_settings')
    .upsert({
      id: 'default',
      attendant_discount_limit_pct: config.attendantDiscountLimitPct,
      card_installment_fee_pct: config.cardInstallmentFeePct,
      max_installments: config.maxInstallments,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
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
    return JSON.parse(localStorage.getItem(PRICE_OVERRIDES_KEY) || '{}')
  } catch {
    return {}
  }
}

function rowsToOverrides(rows: PriceOverrideRow[]): ServiceOverrides {
  return rows.reduce<ServiceOverrides>((acc, row) => {
    acc[serviceOverrideKey(row.item_id, row.service_key)] = {
      costPrice: row.cost_price,
      finalPrice: row.final_price,
    }
    return acc
  }, {})
}

function serviceOverrideKey(itemId: string, serviceKey: string) {
  return `${itemId}:${serviceKey}`
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
