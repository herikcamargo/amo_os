import { formatDistanceToNow, parseISO, isToday, isYesterday, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatTimeAgo(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Hoje'
  if (isYesterday(date)) return 'Ontem'
  return formatDistanceToNow(date, { addSuffix: false, locale: ptBR })
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR })
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function daysSince(dateStr: string): number {
  const date = parseISO(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
