import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

export function AppShell() {
  return (
    <div className="min-h-screen bg-surface text-white font-sans grain">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-screen flex justify-center md:justify-start">
          <div className="w-full max-w-[440px] md:max-w-[1100px] relative pb-28 md:pb-8 md:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
