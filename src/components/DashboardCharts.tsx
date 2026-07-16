// ═══════════════════════════════════════════════════════════════
// Graficos do dashboard — SVG puro, sem dependencias novas.
// Hover reativo: tooltip proprio, destaque de barra/ponto/fatia.
//
// Paleta de status validada (contraste/CVD) contra o surface #141416:
// aberto #D97706 · andamento #3B82F6 · prontas #16A34A ·
// entregues #8B5CF6 · canceladas #EF4444
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { brl } from '@/lib/constants'
import type { DeviceSale, ServiceOrder } from '@/types/database'

type Period = '30d' | '3m' | '12m' | 'all'

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: '30d', label: '30 dias' },
  { key: '3m', label: '3 meses' },
  { key: '12m', label: '12 meses' },
  { key: 'all', label: 'Tudo' },
]

const STATUS_GROUPS = [
  { key: 'aberto', label: 'Em aberto', color: '#D97706', statuses: ['recebido', 'analise', 'aprovacao', 'peca'] },
  { key: 'andamento', label: 'Em manutencao', color: '#3B82F6', statuses: ['manutencao'] },
  { key: 'pronto', label: 'Prontas', color: '#16A34A', statuses: ['pronto'] },
  { key: 'entregue', label: 'Entregues', color: '#8B5CF6', statuses: ['entregue'] },
  { key: 'cancelado', label: 'Canceladas', color: '#EF4444', statuses: ['cancelado'] },
]

interface Bucket {
  key: string
  label: string
  start: number
  end: number
}

function periodStart(period: Period, oldest: number): Date {
  const now = new Date()
  if (period === '30d') { const d = new Date(now); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d }
  if (period === '3m') { const d = new Date(now); d.setMonth(d.getMonth() - 3); d.setHours(0, 0, 0, 0); return d }
  if (period === '12m') { const d = new Date(now.getFullYear(), now.getMonth() - 11, 1); return d }
  return new Date(oldest)
}

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function buildBuckets(period: Period, start: Date): Bucket[] {
  const now = new Date()
  const buckets: Bucket[] = []

  if (period === '30d') {
    for (let i = 0; i < 30; i++) {
      const day = new Date(start); day.setDate(start.getDate() + i)
      const end = new Date(day); end.setDate(day.getDate() + 1)
      buckets.push({
        key: day.toISOString().slice(0, 10),
        label: `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`,
        start: day.getTime(),
        end: end.getTime(),
      })
    }
    return buckets
  }

  if (period === '3m') {
    // Semanas, da mais antiga para a atual
    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)
    while (cursor.getTime() <= now.getTime()) {
      const end = new Date(cursor); end.setDate(cursor.getDate() + 7)
      buckets.push({
        key: cursor.toISOString().slice(0, 10),
        label: `${String(cursor.getDate()).padStart(2, '0')}/${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        start: cursor.getTime(),
        end: end.getTime(),
      })
      cursor.setDate(cursor.getDate() + 7)
    }
    return buckets
  }

  if (period === '12m') {
    for (let i = 0; i < 12; i++) {
      const month = new Date(start.getFullYear(), start.getMonth() + i, 1)
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 1)
      buckets.push({
        key: `${month.getFullYear()}-${month.getMonth()}`,
        label: MONTH_SHORT[month.getMonth()],
        start: month.getTime(),
        end: end.getTime(),
      })
    }
    return buckets
  }

  // Tudo: anos
  const firstYear = start.getFullYear()
  for (let year = firstYear; year <= now.getFullYear(); year++) {
    buckets.push({
      key: String(year),
      label: String(year),
      start: new Date(year, 0, 1).getTime(),
      end: new Date(year + 1, 0, 1).getTime(),
    })
  }
  return buckets
}

function fillBuckets(buckets: Bucket[], timestamps: number[], values?: number[]): number[] {
  const totals = new Array(buckets.length).fill(0)
  if (buckets.length === 0) return totals
  const first = buckets[0].start
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i]
    if (t < first) continue
    // Buckets sao contiguos e ordenados — busca binaria
    let lo = 0; let hi = buckets.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (t < buckets[mid].start) hi = mid - 1
      else if (t >= buckets[mid].end) lo = mid + 1
      else { totals[mid] += values ? values[i] : 1; break }
    }
  }
  return totals
}

export function DashboardCharts({ orders, deviceSales, canFinance }: {
  orders: ServiceOrder[]
  deviceSales: DeviceSale[]
  canFinance: boolean
}) {
  const [period, setPeriod] = useState<Period>('3m')

  const data = useMemo(() => {
    const createdTimes = orders.map((order) => Date.parse(order.created_at))
    const oldest = createdTimes.length > 0 ? Math.min(...createdTimes) : Date.now()
    const start = periodStart(period, oldest)
    const buckets = buildBuckets(period, start)

    const entradas = fillBuckets(buckets, createdTimes)

    // Faturamento: OS entregues (pela data de atualizacao) + vendas de aparelhos
    const revenueTimes: number[] = []
    const revenueValues: number[] = []
    for (const order of orders) {
      if (order.status === 'entregue' && order.valor_servico > 0) {
        revenueTimes.push(Date.parse(order.updated_at))
        revenueValues.push(order.valor_servico)
      }
    }
    for (const sale of deviceSales) {
      if (!sale.cancelled_at && sale.valor_final > 0) {
        revenueTimes.push(Date.parse(sale.sold_at))
        revenueValues.push(sale.valor_final)
      }
    }
    const faturamento = fillBuckets(buckets, revenueTimes, revenueValues)

    // Distribuicao por grupo de status (OS que entraram no periodo)
    const startTime = start.getTime()
    const groupCounts = STATUS_GROUPS.map(() => 0)
    let totalPeriodo = 0
    for (const order of orders) {
      if (Date.parse(order.created_at) < startTime) continue
      totalPeriodo++
      const idx = STATUS_GROUPS.findIndex((group) => group.statuses.includes(order.status))
      if (idx >= 0) groupCounts[idx]++
    }

    return { buckets, entradas, faturamento, groupCounts, totalPeriodo }
  }, [orders, deviceSales, period])

  const totalEntradas = data.entradas.reduce((sum, v) => sum + v, 0)
  const totalFaturamento = data.faturamento.reduce((sum, v) => sum + v, 0)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <BarChart3 size={15} className="text-brand" /> Visao geral
        </div>
        <div className="flex rounded-xl bg-surface-card border border-white/8 p-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setPeriod(option.key)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                period === option.key ? 'bg-brand text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="Entradas de OS"
          subtitle={`${totalEntradas.toLocaleString('pt-BR')} no periodo`}
          className="lg:col-span-2"
        >
          <BarChart buckets={data.buckets} values={data.entradas} color="#D71920" unit="OS" />
        </ChartCard>

        <ChartCard title="Situacao das OS" subtitle={`${data.totalPeriodo.toLocaleString('pt-BR')} que entraram no periodo`}>
          <StatusDonut counts={data.groupCounts} total={data.totalPeriodo} />
        </ChartCard>

        {canFinance && (
          <ChartCard
            title="Faturamento"
            subtitle={`${brl(totalFaturamento)} no periodo (OS entregues + vendas)`}
            className="lg:col-span-3"
          >
            <AreaChart buckets={data.buckets} values={data.faturamento} color="#16A34A" money />
          </ChartCard>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, className, children }: {
  title: string
  subtitle: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-[16px] bg-surface-card border border-white/8 p-4 ${className || ''}`}>
      <div className="mb-3">
        <h3 className="text-sm font-bold">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

// Tooltip proprio, posicionado sobre o grafico e reativo ao mouse
function ChartTooltip({ leftPct, topPct, title, value }: {
  leftPct: number
  topPct: number
  title: string
  value: string
}) {
  const clamped = Math.min(88, Math.max(12, leftPct))
  return (
    <div
      className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full"
      style={{ left: `${clamped}%`, top: `${Math.max(0, topPct)}%` }}
    >
      <div className="rounded-lg bg-[#1E1E22] border border-white/15 shadow-xl px-2.5 py-1.5 whitespace-nowrap">
        <div className="text-[10px] text-gray-400 leading-tight">{title}</div>
        <div className="text-xs font-bold tabular-nums leading-tight mt-0.5">{value}</div>
      </div>
      <div className="mx-auto h-0 w-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-[#1E1E22]" />
    </div>
  )
}

// Barra fina com topo arredondado ancorada na linha de base
function roundedBarPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(3, w / 2, h)
  if (h <= 0) return ''
  return `M ${x} ${y + h} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h} Z`
}

function BarChart({ buckets, values, color, unit }: { buckets: Bucket[]; values: number[]; color: string; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 620; const H = 190
  const padL = 8; const padR = 8; const padT = 16; const padB = 24
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const max = Math.max(1, ...values)
  const n = Math.max(1, buckets.length)
  const step = plotW / n
  const barW = Math.max(3, Math.min(26, step * 0.62))
  const labelEvery = Math.max(1, Math.ceil(n / 8))

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <ChartTooltip
          leftPct={((padL + hover * step + step / 2) / W) * 100}
          topPct={((padT + plotH - (values[hover] / max) * plotH) / H) * 100 - 4}
          title={buckets[hover].label}
          value={`${values[hover].toLocaleString('pt-BR')} ${unit}`}
        />
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${unit} por periodo`}>
        {[0.25, 0.5, 0.75].map((frac) => (
          <line key={frac} x1={padL} x2={W - padR} y1={padT + plotH * frac} y2={padT + plotH * frac} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />

        {/* Trilha de destaque da coluna sob o mouse */}
        {hover !== null && (
          <rect x={padL + hover * step} y={padT} width={step} height={plotH} fill="rgba(255,255,255,0.045)" rx="4" />
        )}

        {buckets.map((bucket, i) => {
          const h = (values[i] / max) * plotH
          const x = padL + i * step + (step - barW) / 2
          const y = padT + plotH - h
          const dimmed = hover !== null && hover !== i
          return (
            <g key={bucket.key}>
              <path
                d={roundedBarPath(x, y, barW, h)}
                fill={color}
                opacity={dimmed ? 0.35 : hover === i ? 1 : 0.88}
                className="transition-opacity duration-100 pointer-events-none"
              />
              {i % labelEvery === 0 && (
                <text x={padL + i * step + step / 2} y={H - 8} textAnchor="middle" fontSize="9.5" fill={hover === i ? '#D1D5DB' : '#6B7280'} className="pointer-events-none">
                  {bucket.label}
                </text>
              )}
              {/* Alvo de hover: a coluna inteira */}
              <rect
                x={padL + i * step} y={padT} width={step} height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function AreaChart({ buckets, values, color, money }: { buckets: Bucket[]; values: number[]; color: string; money?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 620; const H = 170
  const padL = 8; const padR = 8; const padT = 18; const padB = 24
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const max = Math.max(1, ...values)
  const n = buckets.length
  const xAt = (i: number) => n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW
  const yAt = (v: number) => padT + plotH - (v / max) * plotH
  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')
  const areaPath = n > 0
    ? `M ${xAt(0)} ${padT + plotH} L ${points.split(' ').join(' L ')} L ${xAt(n - 1)} ${padT + plotH} Z`
    : ''
  const labelEvery = Math.max(1, Math.ceil(n / 8))
  const fmt = (v: number) => money ? brl(v) : v.toLocaleString('pt-BR')
  const slotW = n <= 1 ? plotW : plotW / (n - 1)

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <ChartTooltip
          leftPct={(xAt(hover) / W) * 100}
          topPct={(yAt(values[hover]) / H) * 100 - 5}
          title={buckets[hover].label}
          value={fmt(values[hover])}
        />
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Faturamento por periodo">
        <defs>
          <linearGradient id="area-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((frac) => (
          <line key={frac} x1={padL} x2={W - padR} y1={padT + plotH * frac} y2={padT + plotH * frac} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />

        {areaPath && <path d={areaPath} fill="url(#area-fade)" className="pointer-events-none" />}
        {n > 1 && <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="pointer-events-none" />}

        {/* Crosshair + ponto no bucket sob o mouse */}
        {hover !== null && (
          <>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={padT + plotH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 3" className="pointer-events-none" />
            <circle cx={xAt(hover)} cy={yAt(values[hover])} r="4.5" fill={color} stroke="#141416" strokeWidth="2" className="pointer-events-none" />
          </>
        )}

        {buckets.map((bucket, i) => (
          <g key={bucket.key}>
            {i % labelEvery === 0 && (
              <text x={xAt(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fill={hover === i ? '#D1D5DB' : '#6B7280'} className="pointer-events-none">
                {bucket.label}
              </text>
            )}
            <rect
              x={xAt(i) - slotW / 2} y={padT} width={slotW} height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}

function StatusDonut({ counts, total }: { counts: number[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const R = 52; const STROKE = 15
  const C = 2 * Math.PI * R
  const gapPx = total > 0 ? 2 : 0
  let offset = 0

  const segments = STATUS_GROUPS.map((group, i) => {
    const frac = total > 0 ? counts[i] / total : 0
    const len = Math.max(0, frac * C - gapPx)
    const seg = { ...group, index: i, count: counts[i], frac, dash: `${len} ${C - len}`, offset }
    offset -= frac * C
    return seg
  }).filter((segment) => segment.count > 0)

  const active = hover !== null ? STATUS_GROUPS[hover] : null
  const activeCount = hover !== null ? counts[hover] : total
  const activePct = hover !== null && total > 0 ? Math.round((counts[hover] / total) * 100) : null

  return (
    <div className="flex items-center gap-4" onMouseLeave={() => setHover(null)}>
      <div className="relative shrink-0">
        <svg viewBox="0 0 140 140" width="128" height="128" role="img" aria-label="Distribuicao das OS por situacao">
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
          {segments.map((segment) => {
            const isActive = hover === segment.index
            const dimmed = hover !== null && !isActive
            return (
              <circle
                key={segment.key}
                cx="70" cy="70" r={R}
                fill="none"
                stroke={segment.color}
                strokeWidth={isActive ? STROKE + 4 : STROKE}
                strokeDasharray={segment.dash}
                strokeDashoffset={segment.offset}
                transform="rotate(-90 70 70)"
                opacity={dimmed ? 0.3 : 1}
                className="transition-all duration-100 cursor-pointer"
                onMouseEnter={() => setHover(segment.index)}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <span className="text-xl font-black tabular-nums" style={active ? { color: active.color } : undefined}>
            {activeCount.toLocaleString('pt-BR')}
          </span>
          <span className="text-[10px] text-gray-500 leading-tight">
            {active ? `${active.label}${activePct !== null ? ` · ${activePct}%` : ''}` : 'OS'}
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {STATUS_GROUPS.map((group, i) => {
          const dimmed = hover !== null && hover !== i
          return (
            <div
              key={group.key}
              className={`flex items-center gap-2 text-xs rounded-md px-1 -mx-1 py-0.5 cursor-default transition-opacity duration-100 ${dimmed ? 'opacity-40' : ''} ${hover === i ? 'bg-white/[0.05]' : ''}`}
              onMouseEnter={() => setHover(i)}
            >
              <span className="w-2.5 h-2.5 rounded-[4px] shrink-0" style={{ background: group.color }} />
              <span className="text-gray-400 truncate flex-1">{group.label}</span>
              <span className="font-semibold tabular-nums">{counts[i].toLocaleString('pt-BR')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
