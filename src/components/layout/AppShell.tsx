import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

// Rotas de tarefa em tela cheia: escondem o BottomNav no mobile
// para dar lugar a barra de comandos propria da tela.
const FULLSCREEN_TASK_ROUTES = ['/nova-os']

export function AppShell() {
  const { pathname } = useLocation()
  const hideBottomNav = FULLSCREEN_TASK_ROUTES.includes(pathname)

  return (
    <div className="min-h-screen bg-surface text-white font-sans">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-screen flex justify-center md:justify-start">
          <div className="w-full max-w-[440px] md:max-w-[1360px] relative pb-28 md:pb-8 md:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      {!hideBottomNav && (
        <div className="md:hidden">
          <BottomNav />
        </div>
      )}
    </div>
  )
}
