import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { authAdapter } from '@/lib/storage-adapter'
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
import { ResetPassword } from '@/pages/ResetPassword'
import { CloudSetup } from '@/pages/CloudSetup'
import { UserManagement } from '@/pages/UserManagement'
import { GoogleDriveSetup } from '@/pages/GoogleDriveSetup'
import { PriceLookup } from '@/pages/PriceLookup'
import { DeviceSales } from '@/pages/DeviceSales'
import { OsSettings } from '@/pages/OsSettings'
import { Finance } from '@/pages/Finance'

export default function App() {
  const { user, authReady, isCloudConnected, initializeAuth, syncFromSupabase, signOut } = useStore()
  const isRecoveryFlow = window.location.hash.includes('type=recovery')

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  useEffect(() => {
    if (authReady && user && isCloudConnected) {
      syncFromSupabase()
    }
  }, [authReady, user, isCloudConnected, syncFromSupabase])

  useEffect(() => {
    if (!authReady || !user || !isCloudConnected) return

    const interval = window.setInterval(async () => {
      const sessionUser = await authAdapter.getSession()
      if (!sessionUser) await signOut()
    }, 60 * 1000)

    return () => window.clearInterval(interval)
  }, [authReady, user, isCloudConnected, signOut])

  if (isRecoveryFlow) {
    return (
      <Routes>
        <Route path="*" element={<ResetPassword />} />
      </Routes>
    )
  }

  if (!authReady) {
    return <LoadingScreen />
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />
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
        <Route path="/precos" element={<PriceLookup />} />
        <Route path="/vendas" element={<DeviceSales />} />
        <Route path="/ajustes" element={<Settings />} />
        <Route path="/ajustes/os" element={<OsSettings />} />
        <Route path="/relatorios" element={<Reports />} />
        <Route path="/financeiro" element={<Finance />} />
        <Route path="/conectar-nuvem" element={<CloudSetup />} />
        <Route path="/google-drive" element={<GoogleDriveSetup />} />
        <Route path="/usuarios" element={<UserManagement />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-surface text-white flex items-center justify-center px-6">
      <div className="w-full max-w-[320px] text-center">
        <div className="text-[32px] font-black tracking-tight">
          Amo<span className="text-brand">Celular</span>
          <span className="text-brand text-xl align-top ml-0.5">♥</span>
        </div>
        <div className="text-[10px] tracking-[0.25em] text-gray-500 font-medium mt-1.5">
          ASSISTENCIA TECNICA
        </div>
        <div className="mt-8 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-brand animate-shimmer" />
        </div>
        <div className="text-xs text-gray-500 mt-4">Carregando sessão...</div>
      </div>
    </div>
  )
}
