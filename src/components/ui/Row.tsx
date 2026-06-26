interface Props {
  k: string
  v: string
  mono?: boolean
}

export function Row({ k, v, mono }: Props) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-500">{k}</span>
      <span className={`text-sm font-medium text-right ${mono ? 'font-mono text-xs' : ''}`}>{v}</span>
    </div>
  )
}
