import type { ReactNode, ElementType } from 'react'

interface Props {
  title: string
  icon: ElementType
  children: ReactNode
  action?: ReactNode
}

export function CardBox({ title, icon: Icon, children, action }: Props) {
  return (
    <div className="bg-surface-card rounded-[18px] border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-brand" />
        <h3 className="text-xs font-semibold text-gray-400 flex-1">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}
