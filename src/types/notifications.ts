import type { UserRole } from './database'

export interface AppNotification {
  id: string
  title: string
  body: string
  read: boolean
  created_at: string
  order_id?: string
  target_role?: UserRole | null
}
