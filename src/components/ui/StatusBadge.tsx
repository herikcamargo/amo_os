import type { OsStatus } from '@/types/database'
import { STATUS_CONFIG } from '@/lib/constants'

interface Props {
  status: OsStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const st = STATUS_CONFIG[status]
  const sizeClasses = size === 'sm'
    ? 'text-[11px] px-2 py-0.5 gap-1.5'
    : 'text-sm px-3 py-1.5 gap-2'

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${sizeClasses}`}
      style={{ background: st.bg, color: st.dot }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.dot }} />
      {st.label}
    </span>
  )
}
