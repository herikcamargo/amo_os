import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ServiceOrder, AppUser } from '@/types/database'

interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  created_at: string
  order_id?: string
}

interface AppState {
  user: AppUser | null
  orders: ServiceOrder[]
  notifications: Notification[]
  osCounter: number
  loading: boolean

  setUser: (user: AppUser | null) => void
  setOrders: (orders: ServiceOrder[]) => void
  addOrder: (order: ServiceOrder) => void
  updateOrder: (id: string, updates: Partial<ServiceOrder>) => void
  deleteOrder: (id: string) => void
  addNotification: (n: Notification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  nextOsNumber: () => string
  setLoading: (loading: boolean) => void
  resetToDemo: () => void
}

const DEMO_DATA = buildDemoData()

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: {
        id: 'u1', nome: 'Herik', email: 'admin@amocelular.com',
        role: 'admin', ativo: true, created_at: '2026-01-01T00:00:00Z',
      },
      orders: DEMO_DATA.orders,
      notifications: DEMO_DATA.notifications,
      osCounter: 124,
      loading: false,

      setUser: (user) => set({ user }),
      setOrders: (orders) => set({ orders }),

      addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),

      updateOrder: (id, updates) => set((s) => ({
        orders: s.orders.map((o) => o.id === id ? { ...o, ...updates } : o),
      })),

      deleteOrder: (id) => set((s) => ({
        orders: s.orders.filter((o) => o.id !== id),
      })),

      addNotification: (n) => set((s) => ({
        notifications: [n, ...s.notifications],
      })),

      markNotificationRead: (id) => set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      })),

      markAllNotificationsRead: () => set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      })),

      nextOsNumber: () => {
        const counter = get().osCounter + 1
        set({ osCounter: counter })
        const year = new Date().getFullYear()
        return `AMO-${year}-${String(counter).padStart(6, '0')}`
      },

      setLoading: (loading) => set({ loading }),

      resetToDemo: () => set({
        orders: DEMO_DATA.orders,
        notifications: DEMO_DATA.notifications,
        osCounter: 124,
      }),
    }),
    {
      name: 'amo-os-storage',
      version: 1,
    },
  ),
)

function buildDemoData() {
  const customers = [
    { id: 'c1', nome: 'João Silva', telefone: '(16) 99812-4471', cpf: '412.889.220-10', created_at: '2026-06-26T09:00:00Z' },
    { id: 'c2', nome: 'Maria Santos', telefone: '(16) 99745-1188', cpf: null, created_at: '2026-06-26T08:00:00Z' },
    { id: 'c3', nome: 'Pedro Lima', telefone: '(16) 99980-2231', cpf: null, created_at: '2026-06-25T16:00:00Z' },
    { id: 'c4', nome: 'Camila Ferreira', telefone: '(16) 99654-9090', cpf: null, created_at: '2026-06-25T14:00:00Z' },
    { id: 'c5', nome: 'Lucas Martins', telefone: '(16) 99877-3322', cpf: null, created_at: '2026-06-24T10:00:00Z' },
    { id: 'c6', nome: 'Ana Beatriz', telefone: '(16) 99123-7765', cpf: '330.112.998-44', created_at: '2026-06-23T11:00:00Z' },
  ]

  const devices = [
    { id: 'd1', customer_id: 'c1', marca: 'Apple', modelo: 'iPhone 13', cor: 'Azul', imei: '356938035643809', acessorios: ['capinha', 'chip'], created_at: '2026-06-26T09:00:00Z' },
    { id: 'd2', customer_id: 'c2', marca: 'Samsung', modelo: 'Galaxy S22', cor: 'Preto', imei: '351855112309887', acessorios: ['carregador'], created_at: '2026-06-26T08:00:00Z' },
    { id: 'd3', customer_id: 'c3', marca: 'Motorola', modelo: 'Moto G60', cor: 'Preto', imei: '862188042200315', acessorios: ['capinha', 'película'], created_at: '2026-06-25T16:00:00Z' },
    { id: 'd4', customer_id: 'c4', marca: 'Xiaomi', modelo: 'Redmi Note 12', cor: 'Azul', imei: '351112667700991', acessorios: ['chip'], created_at: '2026-06-25T14:00:00Z' },
    { id: 'd5', customer_id: 'c5', marca: 'Apple', modelo: 'iPhone 11', cor: 'Branco', imei: '356741092118843', acessorios: ['capinha', 'película', 'chip'], created_at: '2026-06-24T10:00:00Z' },
    { id: 'd6', customer_id: 'c6', marca: 'Samsung', modelo: 'Galaxy A54', cor: 'Verde', imei: '356938033221107', acessorios: ['carregador', 'chip'], created_at: '2026-06-23T11:00:00Z' },
  ]

  const orders: ServiceOrder[] = [
    { id: 'o1', numero: 'AMO-2026-000123', customer_id: 'c1', device_id: 'd1', status: 'aprovacao', problema_relatado: 'Tela trincada, touch falhando no canto superior.', condicao_estetica: { tela_trincada: true }, valor_servico: 480, garantia_dias: 90, created_by: 'u1', created_at: '2026-06-26T09:12:00Z', updated_at: '2026-06-26T10:40:00Z', customer: customers[0], device: devices[0] },
    { id: 'o2', numero: 'AMO-2026-000122', customer_id: 'c2', device_id: 'd2', status: 'manutencao', problema_relatado: 'Não carrega. Conector oxidado.', condicao_estetica: { oxidacao_aparente: true }, valor_servico: 260, garantia_dias: 90, created_by: 'u1', created_at: '2026-06-26T08:30:00Z', updated_at: '2026-06-26T11:05:00Z', customer: customers[1], device: devices[1] },
    { id: 'o3', numero: 'AMO-2026-000121', customer_id: 'c3', device_id: 'd3', status: 'pronto', problema_relatado: 'Troca de bateria.', condicao_estetica: {}, valor_servico: 190, garantia_dias: 90, created_by: 'u1', created_at: '2026-06-25T16:20:00Z', updated_at: '2026-06-26T09:15:00Z', customer: customers[2], device: devices[2] },
    { id: 'o4', numero: 'AMO-2026-000120', customer_id: 'c4', device_id: 'd4', status: 'peca', problema_relatado: 'Display com manchas, aguardando peça.', condicao_estetica: {}, valor_servico: 0, garantia_dias: 0, created_by: 'u1', created_at: '2026-06-25T14:00:00Z', updated_at: '2026-06-25T14:00:00Z', customer: customers[3], device: devices[3] },
    { id: 'o5', numero: 'AMO-2026-000119', customer_id: 'c5', device_id: 'd5', status: 'analise', problema_relatado: 'Molhou, não liga.', condicao_estetica: { oxidacao_aparente: true }, valor_servico: 0, garantia_dias: 0, created_by: 'u1', created_at: '2026-06-24T10:00:00Z', updated_at: '2026-06-24T10:00:00Z', customer: customers[4], device: devices[4] },
    { id: 'o6', numero: 'AMO-2026-000118', customer_id: 'c6', device_id: 'd6', status: 'entregue', problema_relatado: 'Troca de película + limpeza.', condicao_estetica: {}, valor_servico: 80, garantia_dias: 30, created_by: 'u1', created_at: '2026-06-23T11:00:00Z', updated_at: '2026-06-23T17:30:00Z', customer: customers[5], device: devices[5] },
  ]

  const notifications: Notification[] = [
    { id: 'n1', title: 'OS pronta há 2 dias', body: 'Pedro Lima — Moto G60 está pronto desde 25/06. Avisar cliente.', read: false, created_at: '2026-06-26T08:00:00Z', order_id: 'o3' },
    { id: 'n2', title: 'Orçamento pendente', body: 'João Silva aguarda aprovação do orçamento R$480.', read: false, created_at: '2026-06-26T10:40:00Z', order_id: 'o1' },
    { id: 'n3', title: 'Peça chegou', body: 'Display Redmi Note 12 disponível para retirada no fornecedor.', read: false, created_at: '2026-06-26T07:00:00Z', order_id: 'o4' },
  ]

  return { orders, notifications }
}
