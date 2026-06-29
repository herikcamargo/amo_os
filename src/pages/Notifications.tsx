import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Bell, CheckCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { filterNotificationsForUser } from '@/lib/notifications'

export function Notifications() {
  const navigate = useNavigate()
  const { user, notifications, markNotificationRead } = useStore()
  const visibleNotifications = filterNotificationsForUser(notifications, user)
  const unread = visibleNotifications.filter((n) => !n.read).length

  return (
    <div className="px-5 pt-3">
      <div className="flex items-center gap-3 pt-2 mb-4">
        <IconBtn onClick={() => navigate(-1)}><ChevronLeft size={22} /></IconBtn>
        <h1 className="text-xl font-bold tracking-tight flex-1">Notificações</h1>
        {unread > 0 && (
          <button
            onClick={() => visibleNotifications.forEach((n) => markNotificationRead(n.id))}
            className="text-brand text-xs font-semibold flex items-center gap-1"
          >
            <CheckCheck size={14} /> Marcar todas
          </button>
        )}
      </div>

      <div className="space-y-2">
        {visibleNotifications.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <Bell size={40} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm">Nenhuma notificação</p>
          </div>
        )}
        {visibleNotifications.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              markNotificationRead(n.id)
              if (n.order_id) navigate(`/os/${n.order_id}`)
            }}
            className={`w-full text-left p-4 rounded-[16px] border transition-colors active:scale-[0.99] ${
              n.read
                ? 'bg-surface-card border-white/5'
                : 'bg-brand/5 border-brand/20'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-gray-600' : 'bg-brand'}`} />
              <div>
                <div className="font-semibold text-sm">{n.title}</div>
                <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.body}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
