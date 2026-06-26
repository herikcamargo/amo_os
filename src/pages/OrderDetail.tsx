import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Download, Wrench, User, Smartphone, CheckCircle2,
  Camera, ShieldCheck, History, AlertTriangle, Phone, MessageSquare,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { CardBox } from '@/components/ui/CardBox'
import { Row } from '@/components/ui/Row'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { STATUS_CONFIG, CHECK_ENTRADA, brl, STATUS_FLOW } from '@/lib/constants'
import { formatDateTime, daysSince } from '@/lib/utils'
import { downloadOsPdf } from '@/lib/generate-pdf'
import type { OsStatus } from '@/types/database'
import toast from 'react-hot-toast'

const DEMO_LOGS = [
  { user: 'Atendente · Bia', data: '26/06 09:12', txt: 'OS criada' },
  { user: 'Técnico · Léo', data: '26/06 10:40', txt: 'Orçamento enviado · Status → Aguardando aprovação' },
]

export function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { orders, updateOrder } = useStore()
  const [showStatusModal, setShowStatusModal] = useState(false)

  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id])
  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertTriangle size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Ordem não encontrada</p>
          <button onClick={() => navigate('/')} className="text-brand mt-2 text-sm font-semibold">Voltar</button>
        </div>
      </div>
    )
  }

  const st = STATUS_CONFIG[order.status]
  const readyDays = order.status === 'pronto' ? daysSince(order.updated_at) : 0

  const handleStatusChange = (newStatus: OsStatus) => {
    updateOrder(order.id, { status: newStatus, updated_at: new Date().toISOString() })
    setShowStatusModal(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-surface-card px-5 pt-5 pb-5 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4">
          <IconBtn onClick={() => navigate(-1)}><ChevronLeft size={22} /></IconBtn>
          <div className="flex-1">
            <div className="font-mono text-xs text-gray-500">{order.numero}</div>
            <div className="text-xl font-bold tracking-tight">{order.customer?.nome || '—'}</div>
          </div>
        </div>

        <StatusBadge status={order.status} />

        {readyDays >= 3 && (
          <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
            <span className="text-xs text-yellow-300">
              Pronto há {readyDays} dias — avisar o cliente!
            </span>
          </div>
        )}

        <div className="flex gap-2.5 mt-4">
          <button
            onClick={() => { downloadOsPdf(order); toast.success('PDF gerado!') }}
            className="flex-1 h-11 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Download size={16} /> Baixar PDF
          </button>
          <button
            onClick={() => setShowStatusModal(true)}
            className="flex-1 h-11 rounded-xl bg-white/8 border border-white/10 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Wrench size={16} /> Atualizar status
          </button>
        </div>

        {order.customer?.telefone && (
          <div className="flex gap-2.5 mt-2.5">
            <a
              href={`tel:${order.customer.telefone}`}
              className="flex-1 h-10 rounded-xl bg-white/5 border border-white/8 text-sm flex items-center justify-center gap-2 text-gray-300 active:scale-95 transition-transform"
            >
              <Phone size={15} /> Ligar
            </a>
            <a
              href={`https://wa.me/55${order.customer.telefone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 h-10 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-sm flex items-center justify-center gap-2 text-[#25D366] active:scale-95 transition-transform"
            >
              <MessageSquare size={15} /> WhatsApp
            </a>
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-3.5">
        {/* Cliente */}
        <CardBox title="Cliente" icon={User}>
          <Row k="Nome" v={order.customer?.nome || '—'} />
          <Row k="Telefone" v={order.customer?.telefone || '—'} />
          {order.customer?.cpf && <Row k="CPF" v={order.customer.cpf} />}
        </CardBox>

        {/* Aparelho */}
        <CardBox title="Aparelho" icon={Smartphone}>
          <Row k="Marca / Modelo" v={`${order.device?.marca || ''} ${order.device?.modelo || ''}`} />
          <Row k="Cor" v={order.device?.cor || '—'} />
          <Row k="IMEI" v={order.device?.imei || '—'} mono />
          <Row k="Acessórios" v={order.device?.acessorios?.length ? order.device.acessorios.join(', ') : '—'} />
        </CardBox>

        {/* Problema */}
        <CardBox title="Problema relatado" icon={Wrench}>
          <p className="text-sm text-gray-300 leading-relaxed">{order.problema_relatado}</p>
        </CardBox>

        {/* Checklist */}
        <CardBox title="Checklist de entrada" icon={CheckCircle2}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {CHECK_ENTRADA.slice(0, 10).map((c, i) => {
              const ok = i % 4 !== 0
              return (
                <div key={c} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center text-[10px]"
                    style={{ background: ok ? '#14532D' : '#7F1D1D', color: ok ? '#4ADE80' : '#FCA5A5' }}
                  >
                    {ok ? '✓' : '✕'}
                  </span>
                  <span className="text-gray-300">{c}</span>
                </div>
              )
            })}
          </div>
          <div className="text-xs text-gray-500 mt-3">+6 itens no checklist completo</div>
        </CardBox>

        {/* Fotos */}
        <CardBox title="Fotos de entrada" icon={Camera}>
          <div className="grid grid-cols-4 gap-2">
            {['Frente', 'Traseira', 'Lateral', 'IMEI'].map((f) => (
              <div key={f} className="aspect-square rounded-xl bg-surface-muted border border-white/5 flex flex-col items-center justify-center gap-1 text-gray-500">
                <Camera size={15} /><span className="text-[9px]">{f}</span>
              </div>
            ))}
          </div>
        </CardBox>

        {/* Serviço & Garantia */}
        {(order.valor_servico > 0 || order.garantia_dias > 0) && (
          <CardBox title="Serviço & garantia" icon={ShieldCheck}>
            <Row k="Valor do serviço" v={brl(order.valor_servico)} />
            <Row k="Garantia" v={`${order.garantia_dias} dias`} />
          </CardBox>
        )}

        {/* Histórico */}
        <CardBox title="Histórico" icon={History}>
          <div className="space-y-3">
            {DEMO_LOGS.map((l, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-brand mt-1.5" />
                  {i < DEMO_LOGS.length - 1 && <div className="w-px flex-1 bg-white/10 my-1" />}
                </div>
                <div className="pb-1">
                  <div className="text-sm text-gray-200">{l.txt}</div>
                  <div className="text-[11px] text-gray-500">{l.user} · {l.data}</div>
                </div>
              </div>
            ))}
          </div>
        </CardBox>
      </div>

      {/* Status change modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowStatusModal(false)}>
          <div
            className="w-full max-w-[440px] bg-surface-elevated rounded-t-[24px] border-t border-white/10 p-5 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-4">Atualizar status</h2>
            <div className="space-y-2">
              {STATUS_FLOW.map((s) => {
                const cfg = STATUS_CONFIG[s]
                const isCurrent = s === order.status
                return (
                  <button
                    key={s}
                    onClick={() => !isCurrent && handleStatusChange(s)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      isCurrent ? 'bg-brand/20 border border-brand/40' : 'bg-white/5 border border-white/5 active:bg-white/10'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ background: cfg.dot }} />
                    <span className="font-medium text-sm flex-1 text-left">{cfg.label}</span>
                    {isCurrent && <span className="text-[11px] text-brand font-semibold">ATUAL</span>}
                  </button>
                )
              })}
              <button
                onClick={() => handleStatusChange('cancelado')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 active:bg-red-500/20"
              >
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-medium text-sm flex-1 text-left text-red-400">Cancelado</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
