import type { PartWarranty, WarrantyUnit } from '@/types/database'

export function calculateWarrantyUntil(date: string, time?: number | null, unit?: WarrantyUnit | null) {
  if (!date || !time || time <= 0 || !unit) return ''
  const result = new Date(`${date}T00:00:00`)
  if (Number.isNaN(result.getTime())) return ''
  if (unit === 'meses') result.setMonth(result.getMonth() + time)
  else result.setDate(result.getDate() + time)
  return result.toISOString().slice(0, 10)
}

export function isPartWarrantyActive(part?: PartWarranty | null) {
  if (!part?.warranty_until) return false
  const end = new Date(`${part.warranty_until}T23:59:59`)
  return end.getTime() >= Date.now()
}

export function partWarrantyLabel(part?: PartWarranty | null) {
  if (!part?.has_part) return 'Sem peca substituida'
  if (!part.warranty_until) return 'Garantia nao calculada'
  return isPartWarrantyActive(part) ? 'Peca em garantia' : 'Garantia da peca vencida'
}
