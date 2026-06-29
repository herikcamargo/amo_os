import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Download, Wrench, User, Smartphone, CheckCircle2,
  Camera, ShieldCheck, History, AlertTriangle, Phone, MessageSquare,
  Package, Save, Plus,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { CardBox } from '@/components/ui/CardBox'
import { Row } from '@/components/ui/Row'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { STATUS_CONFIG, CHECK_ENTRADA, brl, STATUS_FLOW } from '@/lib/constants'
import { daysSince } from '@/lib/utils'
import { downloadOsPdf } from '@/lib/generate-pdf'
import { can } from '@/lib/permissions'
import { calculateWarrantyUntil, isPartWarrantyActive, partWarrantyLabel } from '@/lib/warranty'
import { generateId } from '@/lib/utils'
import type { OsStatus, PartWarranty, WarrantyUnit, Supplier } from '@/types/database'
import toast from 'react-hot-toast'

const DEMO_LOGS = [
  { user: 'Atendente · Bia', data: '26/06 09:12', txt: 'OS criada' },
  { user: 'Técnico · Léo', data: '26/06 10:40', txt: 'Orçamento enviado · Status → Aguardando aprovação' },
]

export function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    orders, updateOrder, user, suppliers, addSupplier, addAuditLog, settings,
  } = useStore()
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [pieceOpen, setPieceOpen] = useState(false)
  const [quickSupplier, setQuickSupplier] = useState('')
  const canFinance = can(user, 'view_financial')
  const canExportPdf = can(user, 'export_pdf')
  const canUpdateStatus = can(user, 'update_status')

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

  const readyDays = order.status === 'pronto' ? daysSince(order.updated_at) : 0
  const part = order.part_warranty
  const partActive = isPartWarrantyActive(part)

  const handleStatusChange = (newStatus: OsStatus) => {
    updateOrder(order.id, { status: newStatus, updated_at: new Date().toISOString() })
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: newStatus === 'entregue' ? 'finalizacao_os' : 'alteracao_status_os',
      entity: 'service_order',
      entity_id: order.id,
      previous_values: { status: order.status },
      new_values: { status: newStatus },
      created_at: new Date().toISOString(),
    })
    setShowStatusModal(false)
  }

  const handlePrint = (kind: 'entrada' | 'saida') => {
    downloadOsPdf(order, kind, settings)
    updateOrder(order.id, {
      [kind === 'entrada' ? 'printed_entrada_at' : 'printed_saida_at']: new Date().toISOString(),
    })
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: kind === 'entrada' ? 'impressao_os_entrada' : 'impressao_os_saida',
      entity: 'service_order',
      entity_id: order.id,
      created_at: new Date().toISOString(),
    })
    toast.success(kind === 'entrada' ? 'OS de entrada gerada' : 'OS de saida gerada')
  }

  const savePiece = (piece: PartWarranty) => {
    if (piece.has_part && (!piece.supplier_name || !piece.warranty_time || !piece.warranty_unit)) {
      toast.error('Fornecedor e prazo de garantia sao obrigatorios quando houver peca')
      return
    }
    updateOrder(order.id, { part_warranty: piece, pecas_utilizadas: piece.description || order.pecas_utilizadas })
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'garantia_peca',
      entity: 'service_order',
      entity_id: order.id,
      previous_values: order.part_warranty,
      new_values: piece,
      created_at: new Date().toISOString(),
    })
    setPieceOpen(false)
    toast.success('Dados da peca salvos')
  }

  const createQuickSupplier = () => {
    if (!quickSupplier.trim()) return
    const now = new Date().toISOString()
    const supplier: Supplier = {
      id: generateId(),
      nome: quickSupplier.trim(),
      status: 'ativo',
      created_at: now,
      updated_at: now,
    }
    addSupplier(supplier)
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'inclusao_fornecedor',
      entity: 'supplier',
      entity_id: supplier.id,
      new_values: supplier,
      created_at: now,
    })
    setQuickSupplier('')
    toast.success('Fornecedor cadastrado')
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
          {canExportPdf && (
            <button
              onClick={() => handlePrint('entrada')}
              className="flex-1 h-11 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Download size={16} /> OS entrada
            </button>
          )}
          {canUpdateStatus && (
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex-1 h-11 rounded-xl bg-white/8 border border-white/10 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Wrench size={16} /> Atualizar status
            </button>
          )}
        </div>

        {canExportPdf && (
          <button
            onClick={() => handlePrint('saida')}
            className="w-full h-11 mt-2 rounded-xl bg-white/8 border border-white/10 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Download size={16} /> Imprimir OS de saida
          </button>
        )}

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

        {/* Serviço & Garantia (financeiro — admin) ou só garantia (atendente/técnico) */}
        {canFinance && (order.valor_servico > 0 || order.garantia_dias > 0) && (
          <CardBox title="Serviço & garantia" icon={ShieldCheck}>
            <Row k="Valor do serviço" v={brl(order.valor_servico)} />
            <Row k="Garantia" v={`${order.garantia_dias} dias`} />
          </CardBox>
        )}
        {!canFinance && order.garantia_dias > 0 && (
          <CardBox title="Garantia" icon={ShieldCheck}>
            <Row k="Garantia" v={`${order.garantia_dias} dias`} />
          </CardBox>
        )}

        <CardBox title="Dados da peca utilizada" icon={Package}>
          {part?.has_part ? (
            <div className={`rounded-xl border p-3 mb-3 ${partActive ? 'bg-green-500/10 border-green-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
              <div className={`font-semibold text-sm ${partActive ? 'text-green-300' : 'text-red-300'}`}>{partWarrantyLabel(part)}</div>
              <div className="text-xs text-gray-400 mt-1">
                {part.supplier_name || 'Fornecedor nao informado'} | garantia ate {part.warranty_until || '--'}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-3">Nenhuma peca substituida informada.</p>
          )}
          {part?.description && <Row k="Peca" v={part.description} />}
          {part?.order_ref && <Row k="Pedido/ref." v={part.order_ref} />}
          {canUpdateStatus && (
            <button onClick={() => setPieceOpen(true)} className="w-full h-10 rounded-xl bg-white/8 border border-white/10 text-sm font-semibold mt-3">
              Editar dados da peca
            </button>
          )}
        </CardBox>

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
      {pieceOpen && (
        <PieceModal
          part={order.part_warranty}
          suppliers={suppliers}
          quickSupplier={quickSupplier}
          setQuickSupplier={setQuickSupplier}
          createQuickSupplier={createQuickSupplier}
          onClose={() => setPieceOpen(false)}
          onSave={savePiece}
        />
      )}
    </div>
  )
}

function PieceModal({
  part,
  suppliers,
  quickSupplier,
  setQuickSupplier,
  createQuickSupplier,
  onClose,
  onSave,
}: {
  part?: PartWarranty | null
  suppliers: Supplier[]
  quickSupplier: string
  setQuickSupplier: (value: string) => void
  createQuickSupplier: () => void
  onClose: () => void
  onSave: (piece: PartWarranty) => void
}) {
  const [form, setForm] = useState<PartWarranty>(() => part || {
    has_part: false,
    warranty_unit: 'dias',
    warranty_time: 90,
  })

  const set = (updates: Partial<PartWarranty>) => {
    setForm((current) => {
      const next = { ...current, ...updates }
      return {
        ...next,
        warranty_until: calculateWarrantyUntil(
          next.purchase_date || new Date().toISOString().slice(0, 10),
          next.warranty_time,
          next.warranty_unit as WarrantyUnit,
        ),
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-surface-elevated rounded-t-[24px] border-t border-white/10 p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Dados da peca utilizada</h2>
        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={form.has_part} onChange={(e) => set({ has_part: e.target.checked })} />
          Houve peca substituida
        </label>
        <div className="grid gap-3">
          <select
            value={form.supplier_id || ''}
            onChange={(e) => {
              const supplier = suppliers.find((item) => item.id === e.target.value)
              set({ supplier_id: supplier?.id || null, supplier_name: supplier?.nome || '' })
            }}
            className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm"
          >
            <option value="">Selecione fornecedor</option>
            {suppliers.filter((supplier) => supplier.status === 'ativo').map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.nome}</option>
            ))}
          </select>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input value={quickSupplier} onChange={(e) => setQuickSupplier(e.target.value)} placeholder="Cadastrar fornecedor rapido" className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm" />
            <button onClick={createQuickSupplier} className="h-11 px-3 rounded-xl bg-white/8 border border-white/10"><Plus size={16} /></button>
          </div>
          <InputLine label="Codigo/pedido" value={form.order_ref || ''} onChange={(value) => set({ order_ref: value })} />
          <InputLine label="Descricao da peca" value={form.description || ''} onChange={(value) => set({ description: value })} />
          <InputLine label="Valor de custo" value={String(form.cost || '')} onChange={(value) => set({ cost: Number(value.replace(',', '.')) || null })} />
          <InputLine label="Data da compra" type="date" value={form.purchase_date || ''} onChange={(value) => set({ purchase_date: value })} />
          <div className="grid grid-cols-2 gap-3">
            <InputLine label="Tempo garantia" value={String(form.warranty_time || '')} onChange={(value) => set({ warranty_time: Number(value) || null })} />
            <label>
              <span className="block text-sm text-gray-400 mb-1">Unidade</span>
              <select value={form.warranty_unit || 'dias'} onChange={(e) => set({ warranty_unit: e.target.value as WarrantyUnit })} className="h-11 w-full px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
                <option value="dias">Dias</option>
                <option value="meses">Meses</option>
              </select>
            </label>
          </div>
          <InputLine label="Garantia ate" type="date" value={form.warranty_until || ''} onChange={(value) => set({ warranty_until: value })} />
          <InputLine label="Observacoes" value={form.notes || ''} onChange={(value) => set({ notes: value })} />
          <button onClick={() => onSave(form)} className="h-12 rounded-xl bg-brand font-semibold flex items-center justify-center gap-2">
            <Save size={16} /> Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function InputLine({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label>
      <span className="block text-sm text-gray-400 mb-1">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full px-3 rounded-xl bg-surface-input border border-white/5 text-sm" />
    </label>
  )
}
