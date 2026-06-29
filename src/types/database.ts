export type UserRole = 'admin' | 'atendente' | 'tecnico'
export type OsStatus = 'recebido' | 'analise' | 'aprovacao' | 'peca' | 'manutencao' | 'pronto' | 'entregue' | 'cancelado'
export type ChecklistKind = 'entrada' | 'saida'

export interface AppUser {
  id: string
  nome: string
  email: string
  role: UserRole
  ativo: boolean
  telefone?: string
  created_at: string
}

export interface Customer {
  id: string
  nome: string
  telefone: string
  cpf?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  created_at: string
}

export type WarrantyUnit = 'dias' | 'meses'
export type SupplierStatus = 'ativo' | 'inativo'
export type DeviceSaleStatus = 'disponivel' | 'reservado' | 'vendido' | 'cancelado'
export type DeviceSaleType = 'novo' | 'seminovo' | 'usado'
export type FiscalStatus = 'nao_solicitado' | 'pendente' | 'emitido' | 'cancelado' | 'erro'

export interface Supplier {
  id: string
  nome: string
  nome_fantasia?: string | null
  documento?: string | null
  telefone?: string | null
  whatsapp?: string | null
  email?: string | null
  observacoes?: string | null
  status: SupplierStatus
  created_at: string
  updated_at: string
}

export interface PartWarranty {
  has_part: boolean
  supplier_id?: string | null
  supplier_name?: string | null
  order_ref?: string | null
  description?: string | null
  cost?: number | null
  purchase_date?: string | null
  warranty_time?: number | null
  warranty_unit?: WarrantyUnit | null
  warranty_until?: string | null
  notes?: string | null
}

export interface Device {
  id: string
  customer_id: string
  marca: string
  modelo: string
  cor: string
  imei?: string | null
  senha_desbloqueio?: string | null
  acessorios: string[]
  created_at: string
}

export interface CondicaoEstetica {
  tela_trincada?: boolean
  tampa_quebrada?: boolean
  arranhoes?: boolean
  amassado?: boolean
  oxidacao_aparente?: boolean
  pecas_faltando?: boolean
  descricao?: string
}

export interface ServiceOrder {
  id: string
  numero: string
  customer_id: string
  device_id: string
  status: OsStatus
  problema_relatado: string
  condicao_estetica: CondicaoEstetica
  diagnostico?: string | null
  servico_executado?: string | null
  pecas_utilizadas?: string | null
  part_warranty?: PartWarranty | null
  delivery_terms?: string | null
  delivery_notes?: string | null
  delivery_responsible?: string | null
  payment_method?: string | null
  payment_status?: string | null
  printed_entrada_at?: string | null
  printed_saida_at?: string | null
  valor_servico: number
  garantia_dias: number
  created_by: string
  created_at: string
  updated_at: string
  // joined
  customer?: Customer
  device?: Device
}

export interface ChecklistItem {
  [key: string]: boolean
}

export interface ServiceOrderChecklist {
  id: string
  service_order_id: string
  kind: ChecklistKind
  itens: ChecklistItem
  observacoes?: string | null
  created_at: string
}

export interface ServiceOrderPhoto {
  id: string
  service_order_id: string
  kind: ChecklistKind
  storage_path: string
  legenda?: string | null
  url?: string
  created_at: string
}

export interface ServiceOrderLog {
  id: string
  service_order_id: string
  user_id: string
  alteracao: string
  created_at: string
  user?: AppUser
}

export interface AuditLog {
  id: string
  user_id?: string | null
  user_name?: string | null
  action: string
  entity: string
  entity_id: string
  previous_values?: unknown
  new_values?: unknown
  created_at: string
}

export interface SaleDevice {
  id: string
  photo_url?: string | null
  tipo: DeviceSaleType
  marca: string
  modelo: string
  cor?: string | null
  armazenamento?: string | null
  memoria_ram?: string | null
  imei1?: string | null
  imei2?: string | null
  serial?: string | null
  custo_compra: number
  preco_venda: number
  supplier_id?: string | null
  data_compra?: string | null
  condicao?: string | null
  acessorios?: string | null
  garantia?: string | null
  observacoes?: string | null
  status: DeviceSaleStatus
  created_at: string
  updated_at: string
}

export interface FiscalDocument {
  status: FiscalStatus
  numero_nota?: string | null
  chave_acesso?: string | null
  serie?: string | null
  protocolo?: string | null
  emitted_at?: string | null
  document_url?: string | null
  error_message?: string | null
}

export interface DeviceSale {
  id: string
  numero: string
  customer_id: string
  device_id: string
  seller_id: string
  sold_at: string
  preco_original: number
  desconto: number
  acrescimo: number
  valor_final: number
  forma_pagamento: string
  parcelas: number
  valor_entrada: number
  financeira?: string | null
  observacoes?: string | null
  cancel_reason?: string | null
  cancelled_at?: string | null
  fiscal: FiscalDocument
  customer?: Customer
  device?: SaleDevice
}

export interface AppSettings {
  warranty_terms: string
  sale_terms: string
}

export interface Warranty {
  id: string
  service_order_id: string
  inicio: string
  dias: number
  fim: string
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      users: { Row: AppUser }
      customers: { Row: Customer }
      devices: { Row: Device }
      service_orders: { Row: ServiceOrder }
      service_order_checklists: { Row: ServiceOrderChecklist }
      service_order_photos: { Row: ServiceOrderPhoto }
      service_order_logs: { Row: ServiceOrderLog }
      warranties: { Row: Warranty }
      suppliers: { Row: Supplier }
      sale_devices: { Row: SaleDevice }
      device_sales: { Row: DeviceSale }
      audit_logs: { Row: AuditLog }
      app_settings: { Row: AppSettings }
    }
  }
}
