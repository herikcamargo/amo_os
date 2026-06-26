import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClick?: () => void
  className?: string
}

export function IconBtn({ children, onClick, className = '' }: Props) {
  return (
    <button
      onClick={onClick}
      className={`group w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 hover:scale-110 active:scale-95 flex items-center justify-center text-gray-200 transition-all duration-200 ${className}`}
    >
      <span className="group-hover:rotate-6 transition-transform duration-200">{children}</span>
    </button>
  )
}
