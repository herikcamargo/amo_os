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
      className={`w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-gray-200 transition-colors duration-150 ${className}`}
    >
      <span>{children}</span>
    </button>
  )
}
