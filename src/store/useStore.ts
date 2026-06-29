import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ServiceOrder,
  AppUser,
  Customer,
  Supplier,
  SaleDevice,
  DeviceSale,
  AuditLog,
  AppSettings,
} from '@/types/database'
import type { AppNotification } from '@/types/notifications'
import {
  authAdapter,
  ordersAdapter,
  customersAdapter,
  suppliersAdapter,
  saleDevicesAdapter,
  deviceSalesAdapter,
  auditLogsAdapter,
  appSettingsAdapter,
  isSupabaseEnabled,
} from '@/lib/storage-adapter'

interface AppState {
  user: AppUser | null
  users: AppUser[]
  orders: ServiceOrder[]
  customers: Customer[]
  suppliers: Supplier[]
  saleDevices: SaleDevice[]
  deviceSales: DeviceSale[]
  auditLogs: AuditLog[]
  settings: AppSettings
  notifications: AppNotification[]
  osCounter: number
  saleCounter: number
  loading: boolean
  authReady: boolean

  setUser: (user: AppUser | null) => void
  setUsers: (users: AppUser[]) => void
  setOrders: (orders: ServiceOrder[]) => void
  addCustomer: (customer: Customer) => void
  updateCustomer: (id: string, updates: Partial<Customer>) => void
  addOrder: (order: ServiceOrder) => void
  updateOrder: (id: string, updates: Partial<ServiceOrder>) => void
  deleteOrder: (id: string) => void
  addSupplier: (supplier: Supplier) => void
  updateSupplier: (id: string, updates: Partial<Supplier>) => void
  addSaleDevice: (device: SaleDevice) => void
  updateSaleDevice: (id: string, updates: Partial<SaleDevice>) => void
  addDeviceSale: (sale: DeviceSale) => void
  cancelDeviceSale: (saleId: string, reason: string, returnToStock: boolean) => void
  addAuditLog: (log: AuditLog) => void
  updateSettings: (settings: Partial<AppSettings>) => void
  addUser: (user: AppUser) => void
  updateUser: (id: string, updates: Partial<AppUser>) => void
  removeUser: (id: string) => void
  addNotification: (n: AppNotification) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  nextOsNumber: () => string
  nextSaleNumber: () => string
  setLoading: (loading: boolean) => void
  initializeAuth: () => Promise<void>
  signOut: () => Promise<void>
  resetToDemo: () => void
  syncFromSupabase: () => Promise<void>
  isCloudConnected: boolean
}

const DEMO_DATA = buildDemoData()

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      users: [
        { id: 'u1', nome: 'Herik', email: 'admin@amocelular.com', role: 'admin', ativo: true, created_at: '2026-01-01T00:00:00Z' },
        { id: 'u2', nome: 'Bia Souza', email: 'bia@amocelular.com', role: 'atendente', ativo: true, telefone: '(16) 99000-0001', created_at: '2026-02-01T00:00:00Z' },
        { id: 'u3', nome: 'Léo Martins', email: 'leo@amocelular.com', role: 'tecnico', ativo: true, telefone: '(16) 99000-0002', created_at: '2026-02-15T00:00:00Z' },
      ],
      orders: DEMO_DATA.orders,
      customers: DEMO_DATA.customers,
      suppliers: [],
      saleDevices: [],
      deviceSales: [],
      auditLogs: [],
      settings: {
        warranty_terms: 'A garantia cobre exclusivamente o servico realizado e as pecas substituidas, respeitando mau uso, queda, oxidacao e violacao do aparelho.',
        sale_terms: 'Declaro estar ciente das condicoes do aparelho, garantia informada e forma de pagamento registrada neste recibo.',
      },
      notifications: DEMO_DATA.notifications,
      osCounter: 124,
      saleCounter: 0,
      loading: false,
      authReady: false,
      isCloudConnected: isSupabaseEnabled,

      setUser: (user) => set({ user }),
      setUsers: (users) => set({ users }),
      setOrders: (orders) => set({ orders }),
      addCustomer: (customer) => {
        set((s) => ({ customers: [customer, ...s.customers] }))
        if (isSupabaseEnabled) {
          void customersAdapter.create(customer).catch((err) => {
            console.warn('Falha ao criar cliente no Supabase:', err)
          })
        }
      },
      updateCustomer: (id, updates) => {
        set((s) => ({
          customers: s.customers.map((c) => c.id === id ? { ...c, ...updates } : c),
          orders: s.orders.map((o) => o.customer_id === id ? { ...o, customer: o.customer ? { ...o.customer, ...updates } : o.customer } : o),
        }))
        if (isSupabaseEnabled) {
          void customersAdapter.update(id, updates).catch((err) => {
            console.warn('Falha ao atualizar cliente no Supabase:', err)
          })
        }
      },

      addOrder: (order) => set((s) => ({
        orders: [order, ...s.orders],
        customers: order.customer && !s.customers.some((c) => c.id === order.customer_id)
          ? [order.customer, ...s.customers]
          : s.customers,
      })),

      updateOrder: (id, updates) => {
        set((s) => ({
          orders: s.orders.map((o) => o.id === id ? { ...o, ...updates } : o),
        }))

        if (isSupabaseEnabled) {
          void ordersAdapter.update(id, updates).catch((err) => {
            console.warn('Falha ao atualizar OS no Supabase:', err)
          })
        }
      },

      deleteOrder: (id) => {
        set((s) => ({
          orders: s.orders.filter((o) => o.id !== id),
        }))

        if (isSupabaseEnabled) {
          void ordersAdapter.delete(id).catch((err) => {
            console.warn('Falha ao excluir OS no Supabase:', err)
          })
        }
      },

      addUser: (user) => set((s) => ({ users: [...s.users, user] })),

      updateUser: (id, updates) => set((s) => ({
        users: s.users.map((u) => u.id === id ? { ...u, ...updates } : u),
      })),

      removeUser: (id) => set((s) => ({
        users: s.users.filter((u) => u.id !== id),
      })),

      addSupplier: (supplier) => {
        set((s) => ({ suppliers: [supplier, ...s.suppliers] }))
        if (isSupabaseEnabled) {
          void suppliersAdapter.create(supplier).catch((err) => {
            console.warn('Falha ao criar fornecedor no Supabase:', err)
          })
        }
      },
      updateSupplier: (id, updates) => {
        const nextUpdates = { ...updates, updated_at: new Date().toISOString() }
        set((s) => ({
          suppliers: s.suppliers.map((supplier) => (
            supplier.id === id ? { ...supplier, ...nextUpdates } : supplier
          )),
        }))
        if (isSupabaseEnabled) {
          void suppliersAdapter.update(id, nextUpdates).catch((err) => {
            console.warn('Falha ao atualizar fornecedor no Supabase:', err)
          })
        }
      },

      addSaleDevice: (device) => {
        set((s) => ({ saleDevices: [device, ...s.saleDevices] }))
        if (isSupabaseEnabled) {
          void saleDevicesAdapter.create(device).catch((err) => {
            console.warn('Falha ao criar aparelho de venda no Supabase:', err)
          })
        }
      },
      updateSaleDevice: (id, updates) => {
        const nextUpdates = { ...updates, updated_at: new Date().toISOString() }
        set((s) => ({
          saleDevices: s.saleDevices.map((device) => (
            device.id === id ? { ...device, ...nextUpdates } : device
          )),
        }))
        if (isSupabaseEnabled) {
          void saleDevicesAdapter.update(id, nextUpdates).catch((err) => {
            console.warn('Falha ao atualizar aparelho de venda no Supabase:', err)
          })
        }
      },
      addDeviceSale: (sale) => {
        set((s) => ({
          deviceSales: [sale, ...s.deviceSales],
          saleDevices: s.saleDevices.map((device) => {
            if (device.id !== sale.device_id) return device
            const nextStock = Math.max(0, (device.stock_quantity ?? 1) - (sale.quantity ?? 1))
            return {
              ...device,
              stock_quantity: nextStock,
              status: nextStock <= 0 ? 'vendido' : device.status,
              updated_at: sale.sold_at,
            }
          }),
        }))
        if (isSupabaseEnabled) {
          void deviceSalesAdapter.create(sale)
            .then(() => {
              const current = get().saleDevices.find((device) => device.id === sale.device_id)
              return current
                ? saleDevicesAdapter.update(sale.device_id, {
                  status: current.status,
                  stock_quantity: current.stock_quantity,
                  updated_at: current.updated_at,
                })
                : undefined
            })
            .catch((err) => {
              console.warn('Falha ao criar venda no Supabase:', err)
            })
        }
      },
      cancelDeviceSale: (saleId, reason, returnToStock) => set((s) => {
        const sale = s.deviceSales.find((item) => item.id === saleId)
        const cancelledAt = new Date().toISOString()
        if (isSupabaseEnabled && sale) {
          void deviceSalesAdapter.update(saleId, { cancel_reason: reason, cancelled_at: cancelledAt })
            .then(() => (
              returnToStock
                ? saleDevicesAdapter.update(sale.device_id, { status: 'disponivel', updated_at: cancelledAt })
                : undefined
            ))
            .catch((err) => {
              console.warn('Falha ao cancelar venda no Supabase:', err)
            })
        }
        return {
          deviceSales: s.deviceSales.map((item) => (
            item.id === saleId ? { ...item, cancel_reason: reason, cancelled_at: cancelledAt } : item
          )),
          saleDevices: returnToStock && sale
            ? s.saleDevices.map((device) => (
              device.id === sale.device_id
                ? {
                  ...device,
                  stock_quantity: (device.stock_quantity ?? 0) + (sale.quantity ?? 1),
                  status: 'disponivel',
                  updated_at: cancelledAt,
                }
                : device
            ))
            : s.saleDevices,
        }
      }),
      addAuditLog: (log) => {
        set((s) => ({ auditLogs: [log, ...s.auditLogs] }))
        if (isSupabaseEnabled) {
          void auditLogsAdapter.create(log).catch((err) => {
            console.warn('Falha ao registrar auditoria no Supabase:', err)
          })
        }
      },
      updateSettings: (settings) => {
        set((s) => ({ settings: { ...s.settings, ...settings } }))
        if (isSupabaseEnabled) {
          void appSettingsAdapter.update(settings).catch((err) => {
            console.warn('Falha ao salvar configuracoes no Supabase:', err)
          })
        }
      },

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

      nextSaleNumber: () => {
        const counter = get().saleCounter + 1
        set({ saleCounter: counter })
        const year = new Date().getFullYear()
        return `VEN-${year}-${String(counter).padStart(6, '0')}`
      },

      setLoading: (loading) => set({ loading }),

      initializeAuth: async () => {
        if (!isSupabaseEnabled) {
          set({ user: null, authReady: true })
          return
        }

        set({ loading: true })
        try {
          const user = await authAdapter.getSession()
          set({ user, authReady: true, loading: false })
        } catch (err) {
          console.warn('Falha ao carregar sessão do Supabase:', err)
          set({ user: null, authReady: true, loading: false })
        }
      },

      signOut: async () => {
        try {
          await authAdapter.signOut()
        } catch (err) {
          console.warn('Falha ao sair do Supabase:', err)
        } finally {
          set({ user: null, orders: [], customers: [], notifications: [], loading: false })
        }
      },

      resetToDemo: () => set({
        orders: DEMO_DATA.orders,
        customers: DEMO_DATA.customers,
        suppliers: [],
        saleDevices: [],
        deviceSales: [],
        auditLogs: [],
        notifications: DEMO_DATA.notifications,
        osCounter: 124,
        saleCounter: 0,
      }),

      syncFromSupabase: async () => {
        if (!isSupabaseEnabled) return
        set({ loading: true })
        try {
          const [customers, orders, suppliers, saleDevices, auditLogs, cloudSettings] = await Promise.all([
            customersAdapter.list(),
            ordersAdapter.list(),
            suppliersAdapter.list(),
            saleDevicesAdapter.list(),
            auditLogsAdapter.list(),
            appSettingsAdapter.get(),
          ])
          const deviceSales = await deviceSalesAdapter.list(customers, saleDevices)
          set({
            customers,
            orders,
            suppliers,
            saleDevices,
            deviceSales,
            auditLogs,
            settings: cloudSettings || get().settings,
            loading: false,
          })
        } catch (err) {
          console.warn('Falha ao sincronizar com Supabase:', err)
          set({ loading: false })
        }
      },
    }),
    {
      name: 'amo-os-storage',
      version: 3,
      partialize: (state) => ({
        users: state.users,
        orders: state.orders,
        customers: state.customers,
        suppliers: state.suppliers,
        saleDevices: state.saleDevices,
        deviceSales: state.deviceSales,
        auditLogs: state.auditLogs,
        settings: state.settings,
        notifications: state.notifications,
        osCounter: state.osCounter,
        saleCounter: state.saleCounter,
      }),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted
        return {
          customers: DEMO_DATA.customers,
          suppliers: [],
          saleDevices: [],
          deviceSales: [],
          auditLogs: [],
          settings: {
            warranty_terms: 'A garantia cobre exclusivamente o servico realizado e as pecas substituidas, respeitando mau uso, queda, oxidacao e violacao do aparelho.',
            sale_terms: 'Declaro estar ciente das condicoes do aparelho, garantia informada e forma de pagamento registrada neste recibo.',
          },
          saleCounter: 0,
          ...(persisted as object),
          user: null,
          authReady: false,
          loading: false,
        }
      },
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

  const notifications: AppNotification[] = [
    { id: 'n1', title: 'OS pronta há 2 dias', body: 'Pedro Lima — Moto G60 está pronto desde 25/06. Avisar cliente.', read: false, created_at: '2026-06-26T08:00:00Z', order_id: 'o3' },
    { id: 'n2', title: 'Orçamento pendente', body: 'João Silva aguarda aprovação do orçamento R$480.', read: false, created_at: '2026-06-26T10:40:00Z', order_id: 'o1' },
    { id: 'n3', title: 'Peça chegou', body: 'Display Redmi Note 12 disponível para retirada no fornecedor.', read: false, created_at: '2026-06-26T07:00:00Z', order_id: 'o4' },
  ]

  return { customers: customers as Customer[], orders, notifications }
}
