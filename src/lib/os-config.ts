// ═══════════════════════════════════════════════════════════════
// Configuracoes do modulo de OS
//
// Persistidas em localStorage (nao exigem mudanca de backend).
// Textos de garantia/condicoes continuam vindo de AppSettings
// (app_settings no Supabase) — aqui ficam apenas as configuracoes
// operacionais do modulo.
// ═══════════════════════════════════════════════════════════════

import type { OsStatus, ServiceOrder } from '@/types/database'
import { STATUS_CONFIG } from '@/lib/constants'

const OS_CONFIG_KEY = 'amo-os-module-config'

export interface OsConfig {
  /** Mensagem de WhatsApp por status. Placeholders: {cliente} {numero} {aparelho} {loja} */
  whatsappMessages: Partial<Record<OsStatus, string>>
  /** Status habilitados no fluxo (recebido/entregue/cancelado sempre ativos) */
  enabledStatuses: OsStatus[]
  companyName: string
  companyAddress: string
  companyPhone: string
  companyFooter: string
  /** Prazo padrao de entrega em dias (previsao impressa na OS) */
  defaultDeadlineDays: number
  /** Mostrar valores na impressao da OS */
  printShowValues: boolean
  /** Imprimir 2 vias (cliente + assistencia) na entrada */
  printTwoVias: boolean
}

export const ALWAYS_ON_STATUSES: OsStatus[] = ['recebido', 'entregue', 'cancelado']

export const DEFAULT_OS_CONFIG: OsConfig = {
  whatsappMessages: {
    recebido: 'Ola, {cliente}! Recebemos seu aparelho {aparelho} (OS {numero}). Em breve iniciaremos a analise. — {loja}',
    analise: 'Ola, {cliente}! Seu aparelho {aparelho} esta sob analise. Avisaremos assim que tivermos um retorno do especialista. (OS {numero}) — {loja}',
    aprovacao: 'Ola, {cliente}! O orcamento do seu {aparelho} esta pronto e aguarda sua aprovacao. Responda esta mensagem para aprovar. (OS {numero}) — {loja}',
    peca: 'Ola, {cliente}! Estamos aguardando a chegada da peca para o seu {aparelho}. Avisaremos assim que chegar. (OS {numero}) — {loja}',
    manutencao: 'Ola, {cliente}! Seu aparelho {aparelho} esta em manutencao. Em breve estara pronto. (OS {numero}) — {loja}',
    pronto: 'SEU APARELHO ESTA PRONTO PARA RETIRADA! Estamos ate as 18h hoje. ({aparelho} — OS {numero}) — {loja}',
    entregue: 'Ola, {cliente}! Obrigado por confiar na {loja}. Qualquer duvida sobre a garantia do seu {aparelho}, estamos a disposicao. (OS {numero})',
    cancelado: 'Ola, {cliente}! A OS {numero} do seu {aparelho} foi cancelada. Qualquer duvida, entre em contato. — {loja}',
  },
  enabledStatuses: ['recebido', 'analise', 'aprovacao', 'peca', 'manutencao', 'pronto', 'entregue', 'cancelado'],
  companyName: 'AmoCelular — Assistencia Tecnica',
  companyAddress: 'Araraquara/SP',
  companyPhone: '',
  companyFooter: 'Obrigado pela preferencia!',
  defaultDeadlineDays: 3,
  printShowValues: true,
  printTwoVias: true,
}

export function getOsConfig(): OsConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(OS_CONFIG_KEY) || '{}') as Partial<OsConfig>
    return {
      ...DEFAULT_OS_CONFIG,
      ...saved,
      whatsappMessages: { ...DEFAULT_OS_CONFIG.whatsappMessages, ...(saved.whatsappMessages || {}) },
      enabledStatuses: normalizeEnabled(saved.enabledStatuses),
    }
  } catch {
    return DEFAULT_OS_CONFIG
  }
}

export function saveOsConfig(config: Partial<OsConfig>): OsConfig {
  const next = {
    ...getOsConfig(),
    ...config,
    whatsappMessages: { ...getOsConfig().whatsappMessages, ...(config.whatsappMessages || {}) },
  }
  next.enabledStatuses = normalizeEnabled(next.enabledStatuses)
  localStorage.setItem(OS_CONFIG_KEY, JSON.stringify(next))
  return next
}

function normalizeEnabled(list?: OsStatus[]): OsStatus[] {
  const base = Array.isArray(list) && list.length > 0 ? list : DEFAULT_OS_CONFIG.enabledStatuses
  const merged = new Set<OsStatus>([...base, ...ALWAYS_ON_STATUSES])
  return DEFAULT_OS_CONFIG.enabledStatuses.filter((status) => merged.has(status))
}

export function buildWhatsappMessage(order: ServiceOrder, config: OsConfig = getOsConfig()): string {
  const template = config.whatsappMessages[order.status]
    || `Ola, {cliente}! Atualizacao da sua OS {numero}: ${STATUS_CONFIG[order.status]?.label || order.status}. — {loja}`
  const aparelho = [order.device?.marca, order.device?.modelo].filter(Boolean).join(' ') || 'aparelho'
  const firstName = (order.customer?.nome || 'cliente').split(' ')[0]

  return template
    .replace(/\{cliente\}/g, firstName)
    .replace(/\{numero\}/g, order.numero)
    .replace(/\{aparelho\}/g, aparelho)
    .replace(/\{loja\}/g, config.companyName)
}

export async function copyWhatsappMessage(order: ServiceOrder): Promise<string> {
  const message = buildWhatsappMessage(order)
  await navigator.clipboard.writeText(message)
  return message
}
