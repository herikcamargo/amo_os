// ═══════════════════════════════════════════════════════════════
// Checklist de entrada/saida da OS
//
// Supabase: tabela service_order_checklists.
// Modo local: localStorage, mesma interface.
// ═══════════════════════════════════════════════════════════════

import { supabase } from './supabase'
import { isSupabaseEnabled } from './storage-adapter'
import { generateId } from './utils'
import type { ChecklistItem, ChecklistKind, ServiceOrderChecklist } from '@/types/database'

const LOCAL_KEY = 'amo-os-checklists'

type LocalChecklistMap = Record<string, { itens: ChecklistItem; observacoes?: string | null }>

function localMap(kind: ChecklistKind): LocalChecklistMap {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}')
    return all[kind] || {}
  } catch {
    return {}
  }
}

function saveLocal(kind: ChecklistKind, orderId: string, itens: ChecklistItem, observacoes?: string | null) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}')
    all[kind] = { ...(all[kind] || {}), [orderId]: { itens, observacoes: observacoes || null } }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all))
  } catch {
    // localStorage cheio ou indisponivel — checklist segue so em memoria
  }
}

export async function saveChecklist(
  orderId: string,
  kind: ChecklistKind,
  itens: ChecklistItem,
  observacoes?: string | null,
): Promise<void> {
  if (isSupabaseEnabled) {
    const { error } = await supabase.from('service_order_checklists').insert({
      id: generateId(),
      service_order_id: orderId,
      kind,
      itens,
      observacoes: observacoes?.trim() || null,
    })
    if (error) throw error
    return
  }
  saveLocal(kind, orderId, itens, observacoes)
}

export async function getChecklist(
  orderId: string,
  kind: ChecklistKind,
): Promise<Pick<ServiceOrderChecklist, 'itens' | 'observacoes'> | null> {
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('service_order_checklists')
      .select('itens, observacoes')
      .eq('service_order_id', orderId)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data
  }
  const entry = localMap(kind)[orderId]
  return entry ? { itens: entry.itens, observacoes: entry.observacoes || null } : null
}
