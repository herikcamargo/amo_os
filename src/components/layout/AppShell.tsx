import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-screen bg-surface text-white flex justify-center font-sans">
      <div className="w-full max-w-[440px] relative pb-28">
        <Outlet />
        <BottomNav />
      </div>
    </div>
  )
}
