import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { AppShell } from '@/components/layout/AppShell'
import { Home } from '@/pages/Home'
import { OrderList } from '@/pages/OrderList'
import { OrderDetail } from '@/pages/OrderDetail'
import { NewOrder } from '@/pages/NewOrder'
import { Notifications } from '@/pages/Notifications'
import { Clients } from '@/pages/Clients'
import { Settings } from '@/pages/Settings'
import { Reports } from '@/pages/Reports'
import { Login } from '@/pages/Login'
import { CloudSetup } from '@/pages/CloudSetup'
import { UserManagement } from '@/pages/UserManagement'

export default function App() {
  const { user, isCloudConnected, syncFromSupabase } = useStore()

  useEffect(() => {
    if (user && isCloudConnected) {
      syncFromSupabase()
    }
  }, [user, isCloudConnected, syncFromSupabase])

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/ordens" element={<OrderList />} />
        <Route path="/os/:id" element={<OrderDetail />} />
        <Route path="/nova-os" element={<NewOrder />} />
        <Route path="/notificacoes" element={<Notifications />} />
        <Route path="/clientes" element={<Clients />} />
        <Route path="/ajustes" element={<Settings />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/conectar-nuvem" element={<CloudSetup />} />
        <Route path="/usuarios" element={<UserManagement />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
