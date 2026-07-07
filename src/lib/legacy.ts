// Identifica ordens de serviço migradas do sistema antigo (FPQ System).
// O numero das OS legadas sempre comeca com "FPQ-" (ver scripts/legacy-fpq),
// nunca colide com a numeracao nova "AMO-AAAA-NNNNNN".
export function isLegacyOrder(order: { numero?: string | null }): boolean {
  return Boolean(order.numero?.startsWith('FPQ-'))
}

export type LegacyFilter = 'atuais' | 'fpq' | 'todas'

export function matchesLegacyFilter(order: { numero?: string | null }, filter: LegacyFilter): boolean {
  if (filter === 'todas') return true
  const legacy = isLegacyOrder(order)
  return filter === 'fpq' ? legacy : !legacy
}
