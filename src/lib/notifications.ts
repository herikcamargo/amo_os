import type { AppUser } from '@/types/database'
import type { AppNotification } from '@/types/notifications'

export function filterNotificationsForUser(
  notifications: AppNotification[],
  user: AppUser | null,
) {
  return notifications.filter((notification) => (
    !notification.target_role || notification.target_role === user?.role
  ))
}
