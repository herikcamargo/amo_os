export interface PriceService {
  key: string
  label: string
  sourceLabel: string
  quality?: string | null
  finalPrice?: number | null
  installmentPrice?: number | null
  costPrice?: number | null
  note?: string | null
}

export interface PriceCatalogItem {
  id: string
  brand: string
  model: string
  search: string
  services: PriceService[]
}

export interface PricingConfig {
  attendantDiscountLimitPct: number
  cardInstallmentFeePct: number
}

export interface PriceSyncResult {
  remoteReady: boolean
  loaded: boolean
}
