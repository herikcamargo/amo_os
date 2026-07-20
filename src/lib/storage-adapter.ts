// ═══════════════════════════════════════════════════════════════
// Storage Adapter — Camada de abstração
//
// Se Supabase estiver configurado: usa Supabase.
// Senão: usa localStorage (via Zustand persist).
//
// Permite ligar/desligar o backend sem mudar o resto do app.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { supabase, isDemoMode, supabaseUrl, supabaseAnonKey } from './supabase'
import type {
  ServiceOrder,
  Customer,
  Device,
  AppUser,
  Supplier,
  SaleDevice,
  DeviceSale,
  AuditLog,
  AppSettings,
  ServiceOrderPhoto,
  FinancialTransaction,
} from '@/types/database'

export const isSupabaseEnabled = !isDemoMode

type CreateOrderInput = Omit<ServiceOrder, 'id' | 'numero' | 'created_at' | 'updated_at' | 'created_by'> & {
  created_by?: string | null
}

type CreateDeviceInput = Omit<Device, 'id' | 'created_at'>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const AUTH_SESSION_STARTED_AT_KEY = 'amo-os-auth-session-started-at'
export const AUTH_SESSION_LIMIT_MS = 12 * 60 * 60 * 1000

function validUuidOrNull(value?: string | null) {
  return value && UUID_RE.test(value) ? value : null
}

function readStoredSessionStartedAt() {
  const raw = localStorage.getItem(AUTH_SESSION_STARTED_AT_KEY)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function writeSessionStartedAt(value = Date.now()) {
  localStorage.setItem(AUTH_SESSION_STARTED_AT_KEY, String(value))
}

function clearSessionStartedAt() {
  localStorage.removeItem(AUTH_SESSION_STARTED_AT_KEY)
}

// Busca paginas de mais de 1000 linhas (limite do PostgREST) em paralelo
// em vez de uma atras da outra — a 1a pagina traz o total (count: 'exact')
// e as demais saem todas de uma vez via Promise.all. Concatenar por indice
// de pagina preserva a ordenacao do servidor mesmo chegando fora de ordem.
async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count?: number | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const first = await page(0, pageSize - 1)
  if (first.error) throw first.error

  const firstRows = first.data || []
  const total = first.count ?? firstRows.length
  if (total <= pageSize) return firstRows

  const ranges: [number, number][] = []
  for (let from = pageSize; from < total; from += pageSize) {
    ranges.push([from, Math.min(from + pageSize - 1, total - 1)])
  }

  const rest = await Promise.all(ranges.map(([from, to]) => page(from, to)))
  const pages = [firstRows]
  for (const result of rest) {
    if (result.error) throw result.error
    pages.push(result.data || [])
  }
  return pages.flat()
}

function getSessionStartedAt(session: { user?: { last_sign_in_at?: string | null } }) {
  const stored = readStoredSessionStartedAt()
  if (stored) return stored

  const lastSignIn = Date.parse(session.user?.last_sign_in_at || '')
  if (Number.isFinite(lastSignIn)) {
    writeSessionStartedAt(lastSignIn)
    return lastSignIn
  }

  const now = Date.now()
  writeSessionStartedAt(now)
  return now
}

function isSessionPastLimit(session: { user?: { last_sign_in_at?: string | null } }) {
  return Date.now() - getSessionStartedAt(session) >= AUTH_SESSION_LIMIT_MS
}

// ───────── ORDERS ─────────
export const ordersAdapter = {
  async list(): Promise<ServiceOrder[]> {
    if (!isSupabaseEnabled) return []

    const rows = await fetchAllPages<ServiceOrderRow>((from, to) =>
      supabase
        .from('v_service_orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: ServiceOrderRow[] | null; error: unknown; count?: number | null }>,
    )

    return rows.map(rowToOrder)
  },

  async create(order: CreateOrderInput): Promise<ServiceOrder> {
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
        created_by: validUuidOrNull(order.created_by),
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
        part_warranty: updates.part_warranty,
        delivery_terms: updates.delivery_terms,
        delivery_notes: updates.delivery_notes,
        delivery_responsible: updates.delivery_responsible,
        delivery_receiver: updates.delivery_receiver,
        delivery_receiver_document: updates.delivery_receiver_document,
        payment_method: updates.payment_method,
        payment_status: updates.payment_status,
        printed_entrada_at: updates.printed_entrada_at,
        printed_saida_at: updates.printed_saida_at,
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
    return fetchAllPages<Customer>((from, to) =>
      supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('nome')
        .range(from, to) as unknown as PromiseLike<{ data: Customer[] | null; error: unknown; count?: number | null }>,
    )
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data
  },
}

// ───────── DEVICES ─────────
export const devicesAdapter = {
  async create(device: CreateDeviceInput): Promise<Device> {
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€ SUPPLIERS / SALES / AUDIT â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const suppliersAdapter = {
  async list(): Promise<Supplier[]> {
    if (!isSupabaseEnabled) return []
    const { data, error } = await supabase.from('suppliers').select('*').order('nome')
    if (error) throw error
    return data || []
  },

  async create(supplier: Supplier): Promise<Supplier> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { data, error } = await supabase.from('suppliers').insert(supplier).select('*').single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { data, error } = await supabase.from('suppliers').update(updates).eq('id', id).select('*').single()
    if (error) throw error
    return data
  },
}

export const saleDevicesAdapter = {
  async list(): Promise<SaleDevice[]> {
    if (!isSupabaseEnabled) return []
    return fetchAllPages<SaleDevice>((from, to) =>
      supabase
        .from('sale_devices')
        .select('*', { count: 'exact' })
        .order('modelo')
        .range(from, to) as unknown as PromiseLike<{ data: SaleDevice[] | null; error: unknown; count?: number | null }>,
    )
  },

  async create(device: SaleDevice): Promise<SaleDevice> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { data, error } = await supabase.from('sale_devices').insert(device).select('*').single()
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<SaleDevice>): Promise<SaleDevice> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { data, error } = await supabase.from('sale_devices').update(updates).eq('id', id).select('*').single()
    if (error) throw error
    return data
  },
}

export const deviceSalesAdapter = {
  async list(customers: Customer[], devices: SaleDevice[]): Promise<DeviceSale[]> {
    if (!isSupabaseEnabled) return []
    const data = await fetchAllPages<DeviceSale>((from, to) =>
      supabase
        .from('device_sales')
        .select('*', { count: 'exact' })
        .order('sold_at', { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: DeviceSale[] | null; error: unknown; count?: number | null }>,
    )

    return data.map((sale) => ({
      ...sale,
      customer: customers.find((customer) => customer.id === sale.customer_id),
      device: devices.find((device) => device.id === sale.device_id),
    })) as DeviceSale[]
  },

  async create(sale: DeviceSale): Promise<DeviceSale> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { customer, device, ...payload } = sale
    const { data, error } = await supabase.from('device_sales').insert(payload).select('*').single()
    if (error) throw error
    return { ...data, customer, device } as DeviceSale
  },

  async update(id: string, updates: Partial<DeviceSale>): Promise<DeviceSale> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { customer, device, ...payload } = updates
    const { data, error } = await supabase.from('device_sales').update(payload).eq('id', id).select('*').single()
    if (error) throw error
    return { ...data, customer, device } as DeviceSale
  },
}

export const serviceOrderPhotosAdapter = {
  async list(): Promise<ServiceOrderPhoto[]> {
    if (!isSupabaseEnabled) return []
    const photos = await fetchAllPages<ServiceOrderPhoto>((from, to) =>
      supabase
        .from('service_order_photos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: ServiceOrderPhoto[] | null; error: unknown; count?: number | null }>,
    )
    const storagePaths = photos
      .map((photo) => photo.storage_path)
      .filter((path) => path.includes('/'))
    if (storagePaths.length === 0) return photos

    const { data } = await supabase.storage.from('os-fotos').createSignedUrls(storagePaths, 60 * 60)
    const urls = new Map((data || []).map((item) => [item.path, item.signedUrl]))
    return photos.map((photo) => ({ ...photo, url: urls.get(photo.storage_path) || undefined }))
  },

  async upload(blob: Blob, storagePath: string): Promise<{ storagePath: string; url: string }> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { error } = await supabase.storage
      .from('os-fotos')
      .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error

    const { data, error: signedError } = await supabase.storage
      .from('os-fotos')
      .createSignedUrl(storagePath, 60 * 60)
    if (signedError) throw signedError
    return { storagePath, url: data.signedUrl }
  },

  async create(photo: ServiceOrderPhoto): Promise<ServiceOrderPhoto> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { url, ...payload } = photo
    const { data, error } = await supabase
      .from('service_order_photos')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return { ...data, url } as ServiceOrderPhoto
  },
}

export const auditLogsAdapter = {
  async list(): Promise<AuditLog[]> {
    if (!isSupabaseEnabled) return []
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) throw error
    return data || []
  },

  async create(log: AuditLog): Promise<void> {
    if (!isSupabaseEnabled) return
    const { error } = await supabase.from('audit_logs').insert(log)
    if (error) throw error
  },
}

export const financialTransactionsAdapter = {
  async list(): Promise<FinancialTransaction[]> {
    if (!isSupabaseEnabled) return []
    return fetchAllPages<FinancialTransaction>((from, to) =>
      supabase
        .from('financial_transactions')
        .select('*', { count: 'exact' })
        .order('transaction_date', { ascending: false })
        .range(from, to) as unknown as PromiseLike<{ data: FinancialTransaction[] | null; error: unknown; count?: number | null }>,
    )
  },

  async create(input: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at'>): Promise<FinancialTransaction> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { data, error } = await supabase.from('financial_transactions').insert(input).select('*').single()
    if (error) throw error
    return data as FinancialTransaction
  },

  async update(id: string, updates: Partial<FinancialTransaction>): Promise<FinancialTransaction> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { data, error } = await supabase
      .from('financial_transactions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data as FinancialTransaction
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { error } = await supabase.from('financial_transactions').delete().eq('id', id)
    if (error) throw error
  },
}

export const appSettingsAdapter = {
  async get(): Promise<AppSettings | null> {
    if (!isSupabaseEnabled) return null
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle()
    if (error) throw error
    return data
  },

  async update(settings: Partial<AppSettings>): Promise<AppSettings> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ id: 'default', ...settings, updated_at: new Date().toISOString() })
      .select('*')
      .single()
    if (error) throw error
    return data
  },
}

// ───────── AUTH ─────────
export const usersAdapter = {
  async list(): Promise<AppUser[]> {
    if (!isSupabaseEnabled) return []

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('nome')

    if (error) throw error
    return (data || []) as AppUser[]
  },

  async create(input: {
    nome: string
    email: string
    password: string
    role: AppUser['role']
    telefone?: string
  }): Promise<AppUser> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    const { data: authData, error: authError } = await authClient.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: { nome: input.nome.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })

    if (authError) {
      if (authError.message.toLowerCase().includes('signup')) {
        throw new Error('Cadastro público está desativado no Supabase. Ative Auth > Providers > Email > Enable signups.')
      }
      throw authError
    }
    if (!authData.user?.id) throw new Error('Supabase nao retornou o ID do usuario criado')

    const profile = {
      id: authData.user.id,
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      telefone: input.telefone?.trim() || null,
      ativo: true,
    }

    const { data, error } = await supabase
      .from('users')
      .insert(profile)
      .select('*')
      .single()

    if (error) throw error
    return data as AppUser
  },

  async update(id: string, updates: Partial<AppUser>): Promise<AppUser> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')

    const { data, error } = await supabase
      .from('users')
      .update({
        nome: updates.nome,
        email: updates.email,
        role: updates.role,
        telefone: updates.telefone,
        ativo: updates.ativo,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as AppUser
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)
    if (error) throw error
  },
}

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
    writeSessionStartedAt(Date.now())

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile && !profileError) {
      if (!profile.ativo) {
        await supabase.auth.signOut()
        clearSessionStartedAt()
        throw new Error('Usuario desativado. Fale com o administrador.')
      }
      return profile as unknown as AppUser
    }

    await supabase.auth.signOut()
    clearSessionStartedAt()
    throw new Error('Usuario sem perfil de acesso. Peça para um administrador cadastrar este e-mail em Ajustes > Usuarios.')
  },

  async signOut(): Promise<void> {
    if (isSupabaseEnabled) await supabase.auth.signOut()
    clearSessionStartedAt()
  },

  async requestPasswordReset(email: string): Promise<void> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (error) throw error
  },

  async updatePassword(newPassword: string): Promise<void> {
    if (!isSupabaseEnabled) throw new Error('Supabase nao configurado')

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  },

  async getSession(): Promise<AppUser | null> {
    if (!isSupabaseEnabled) return null

    const { data } = await supabase.auth.getSession()
    if (!data.session) return null
    if (isSessionPastLimit(data.session)) {
      await supabase.auth.signOut()
      clearSessionStartedAt()
      return null
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.session.user.id)
      .maybeSingle()

    if (profile) {
      if (!profile.ativo) {
        await supabase.auth.signOut()
        clearSessionStartedAt()
        return null
      }
      return profile as unknown as AppUser
    }

    await supabase.auth.signOut()
    clearSessionStartedAt()
    return null
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
  part_warranty?: ServiceOrder['part_warranty']
  delivery_terms?: string | null
  delivery_notes?: string | null
  delivery_responsible?: string | null
  delivery_receiver?: string | null
  delivery_receiver_document?: string | null
  payment_method?: string | null
  payment_status?: string | null
  printed_entrada_at?: string | null
  printed_saida_at?: string | null
  valor_servico: number
  garantia_dias: number
  created_by: string
  created_at: string
  updated_at: string
  cliente_nome?: string
  cliente_telefone?: string
  cliente_cpf?: string | null
  cliente_cep?: string | null
  cliente_logradouro?: string | null
  cliente_numero?: string | null
  cliente_complemento?: string | null
  cliente_bairro?: string | null
  cliente_cidade?: string | null
  cliente_uf?: string | null
  device_marca?: string
  device_modelo?: string
  device_cor?: string
  device_imei?: string | null
  device_senha_desbloqueio?: string | null
  device_senha_padrao?: string | null
  device_tipo_desbloqueio?: 'senha_pin' | 'padrao' | null
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
    part_warranty: row.part_warranty,
    delivery_terms: row.delivery_terms,
    delivery_notes: row.delivery_notes,
    delivery_responsible: row.delivery_responsible,
    delivery_receiver: row.delivery_receiver,
    delivery_receiver_document: row.delivery_receiver_document,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    printed_entrada_at: row.printed_entrada_at,
    printed_saida_at: row.printed_saida_at,
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
      cep: row.cliente_cep,
      logradouro: row.cliente_logradouro,
      numero: row.cliente_numero,
      complemento: row.cliente_complemento,
      bairro: row.cliente_bairro,
      cidade: row.cliente_cidade,
      uf: row.cliente_uf,
      created_at: row.created_at,
    } : undefined,
    device: row.device_marca ? {
      id: row.device_id,
      customer_id: row.customer_id,
      marca: row.device_marca,
      modelo: row.device_modelo || '',
      cor: row.device_cor || '',
      imei: row.device_imei,
      senha_desbloqueio: row.device_senha_desbloqueio,
      senha_padrao: row.device_senha_padrao,
      tipo_desbloqueio: row.device_tipo_desbloqueio,
      acessorios: row.device_acessorios || [],
      created_at: row.created_at,
    } : undefined,
  }
}
