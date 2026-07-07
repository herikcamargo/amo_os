import type { ServiceOrder } from '@/types/database'

// Busca por numero (novas "AMO-2026-000123" e antigas "FPQ-000077"),
// cliente, telefone, IMEI, marca ou modelo. Substring simples ja cobre
// "digitar so os numeros" pois o numero da OS e uma string continua de
// digitos (ex: "77" encontra "FPQ-000077" e "123" encontra "AMO-...-000123").
export function matchesOsQuery(order: ServiceOrder, rawQuery: string): boolean {
  const term = rawQuery.trim().toLowerCase()
  if (!term) return false
  const searchable = [
    order.numero, order.customer?.nome, order.customer?.telefone,
    order.device?.imei, order.device?.modelo, order.device?.marca,
  ].filter(Boolean).join(' ').toLowerCase()
  return searchable.includes(term)
}

export function searchOrders(orders: ServiceOrder[], rawQuery: string, limit?: number): ServiceOrder[] {
  const term = rawQuery.trim()
  if (!term) return []
  const matches = orders
    .filter((o) => matchesOsQuery(o, term))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  return typeof limit === 'number' ? matches.slice(0, limit) : matches
}
