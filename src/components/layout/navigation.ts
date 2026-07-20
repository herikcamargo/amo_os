import {
  BarChart3, Bell, Boxes, Files, Home, Landmark,
  Package, Search, Settings, Users,
} from 'lucide-react'

export const NAV_ITEMS = [
  { key: '/', label: 'Inicio', icon: Home, requires: null as null | 'view_reports' },
  { key: '/ordens', label: 'Ordens', icon: Files, requires: null },
  { key: '/vendas', label: 'Vendas', icon: Package, requires: null },
  { key: '/clientes', label: 'Clientes', icon: Users, requires: null },
  { key: '/precos', label: 'Consulta de precos', icon: Search, requires: null },
  { key: '/vendas?tab=estoque', label: 'Estoque', icon: Boxes, requires: null },
  { key: '/relatorios', label: 'Relatorios', icon: BarChart3, requires: 'view_reports' as const },
  { key: '/financeiro', label: 'Financeiro', icon: Landmark, requires: 'view_financial' as const },
  { key: '/notificacoes', label: 'Notificacoes', icon: Bell, requires: null },
  { key: '/ajustes', label: 'Ajustes', icon: Settings, requires: null },
]
