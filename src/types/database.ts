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
  created_at: string
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
    }
  }
}
