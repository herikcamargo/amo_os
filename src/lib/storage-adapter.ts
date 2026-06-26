// ═══════════════════════════════════════════════════════════════
// Storage Adapter — Camada de abstração
//
// Se Supabase estiver configurado: usa Supabase.
// Senão: usa localStorage (via Zustand persist).
//
// Permite ligar/desligar o backend sem mudar o resto do app.
// ═══════════════════════════════════════════════════════════════

import { supabase, isDemoMode } from './supabase'
import type { ServiceOrder, Customer, Device, AppUser } from '@/types/database'

export const isSupabaseEnabled = !isDemoMode

// ───────── ORDERS ─────────
export const ordersAdapter = {
  async list(): Promise<ServiceOrder[]> {
    if (!isSupabaseEnabled) return []

    const { data, error } = await supabase
      .from('v_service_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(rowToOrder)
  },

  async create(order: Omit<ServiceOrder, 'id' | 'numero' | 'created_at' | 'updated_at'>): Promise<ServiceOrder> {
    if (!isSupabaseEnabled) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('service_orders')
      .insert({
        customer_id: order.customer_id,
        device_id: order.device_id,
        status: order.status,
        problema_relatado: order.problema_relatado,
        condicao_estetica: order.condicao_estetica,
        valor_servico: order.valor_servico,
        garantia_dias: order.garantia_dias,
        created_by: order.created_by,
      })
      .select()
      .single()

    if (error) throw error
    return rowToOrder(data)
  },

  async update(id: string, updates: Partial<ServiceOrder>): Promise<void> {
    if (!isSupabaseEnabled) return

    const { error } = await supabase
      .from('service_orders')
      .update({
        status: updates.status,
        diagnostico: updates.diagnostico,
        servico_executado: updates.servico_executado,
        pecas_utilizadas: updates.pecas_utilizadas,
        valor_servico: updates.valor_servico,
        garantia_dias: updates.garantia_dias,
      })
      .eq('id', id)

    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseEnabled) return
    const { error } = await supabase.from('service_orders').delete().eq('id', id)
    if (error) throw error
  },
}

// ───────── CUSTOMERS ─────────
export const customersAdapter = {
  async create(customer: Omit<Customer, 'id' | 'created_at'>): Promise<Customer> {
    if (!isSupabaseEnabled) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async findByPhone(telefone: string): Promise<Customer | null> {
    if (!isSupabaseEnabled) return null
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('telefone', telefone)
      .maybeSingle()
    return data
  },

  async list(): Promise<Customer[]> {
    if (!isSupabaseEnabled) return []
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('nome')
    if (error) throw error
    return data || []
  },
}

// ───────── DEVICES ─────────
export const devicesAdapter = {
  async create(device: Omit<Device, 'id' | 'created_at'>): Promise<Device> {
    if (!isSupabaseEnabled) throw new Error('Supabase não configurado')

    const { data, error } = await supabase
      .from('devices')
      .insert(device)
      .select()
      .single()

    if (error) throw error
    return data
  },
}

// ───────── AUTH ─────────
export const authAdapter = {
  async signIn(email: string, password: string): Promise<AppUser> {
    if (!isSupabaseEnabled) {
      // Demo mode — accept anything
      return {
        id: 'u1',
        nome: email.split('@')[0] || 'Usuário',
        email,
        role: 'admin',
        ativo: true,
        created_at: new Date().toISOString(),
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    return profile as unknown as AppUser
  },

  async signOut(): Promise<void> {
    if (isSupabaseEnabled) await supabase.auth.signOut()
  },

  async getSession(): Promise<AppUser | null> {
    if (!isSupabaseEnabled) return null

    const { data } = await supabase.auth.getSession()
    if (!data.session) return null

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.session.user.id)
      .single()

    return profile as unknown as AppUser | null
  },
}

// ───────── HELPER ─────────
interface ServiceOrderRow {
  id: string
  numero: string
  customer_id: string
  device_id: string
  status: ServiceOrder['status']
  problema_relatado: string
  condicao_estetica: ServiceOrder['condicao_estetica']
  diagnostico?: string | null
  servico_executado?: string | null
  pecas_utilizadas?: string | null
  valor_servico: number
  garantia_dias: number
  created_by: string
  created_at: string
  updated_at: string
  cliente_nome?: string
  cliente_telefone?: string
  cliente_cpf?: string | null
  device_marca?: string
  device_modelo?: string
  device_cor?: string
  device_imei?: string | null
  device_acessorios?: string[]
}

function rowToOrder(row: ServiceOrderRow): ServiceOrder {
  return {
    id: row.id,
    numero: row.numero,
    customer_id: row.customer_id,
    device_id: row.device_id,
    status: row.status,
    problema_relatado: row.problema_relatado,
    condicao_estetica: row.condicao_estetica,
    diagnostico: row.diagnostico,
    servico_executado: row.servico_executado,
    pecas_utilizadas: row.pecas_utilizadas,
    valor_servico: row.valor_servico,
    garantia_dias: row.garantia_dias,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer: row.cliente_nome ? {
      id: row.customer_id,
      nome: row.cliente_nome,
      telefone: row.cliente_telefone || '',
      cpf: row.cliente_cpf,
      created_at: row.created_at,
    } : undefined,
    device: row.device_marca ? {
      id: row.device_id,
      customer_id: row.customer_id,
      marca: row.device_marca,
      modelo: row.device_modelo || '',
      cor: row.device_cor || '',
      imei: row.device_imei,
      acessorios: row.device_acessorios || [],
      created_at: row.created_at,
    } : undefined,
  }
}
