import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Download, Wrench, User, Smartphone, CheckCircle2,
  Camera, ShieldCheck, History, AlertTriangle, Phone, MessageSquare,
  Package, Save, Plus, CreditCard, X, ImageIcon, Copy, Printer, Send,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { CardBox } from '@/components/ui/CardBox'
import { Row } from '@/components/ui/Row'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { STATUS_CONFIG, brl, STATUS_FLOW } from '@/lib/constants'
import { daysSince, formatDate } from '@/lib/utils'
import { openOsPdf } from '@/lib/generate-pdf'
import { can } from '@/lib/permissions'
import { calculateWarrantyUntil, isPartWarrantyActive, partWarrantyLabel } from '@/lib/warranty'
import { printEntradaA4, type PrintChecklist } from '@/lib/print-entrada'
import { applyMessageTemplate, buildWhatsappMessage, getOsConfig, resolveOsConfig } from '@/lib/os-config'
import { getChecklist } from '@/lib/checklists'
import { isLegacyOrder } from '@/lib/legacy'
import { generateId } from '@/lib/utils'
import { compressImage, formatFileSize } from '@/lib/image-compressor'
import { formatOsPhotoFileName, getDemoPhotos, uploadToDrive } from '@/lib/google-drive'
import { appSettingsAdapter, isSupabaseEnabled, serviceOrderPhotosAdapter } from '@/lib/storage-adapter'
import type { OsStatus, PartWarranty, WarrantyUnit, Supplier, ServiceOrderPhoto } from '@/types/database'
import toast from 'react-hot-toast'

const DEMO_LOGS = [
  { user: 'Atendente · Bia', data: '26/06 09:12', txt: 'OS criada' },
  { user: 'Técnico · Léo', data: '26/06 10:40', txt: 'Orçamento enviado · Status → Aguardando aprovação' },
]

export function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    orders, updateOrder, user, suppliers, addSupplier, addAuditLog, settings, serviceOrderPhotos, addServiceOrderPhoto,
  } = useStore()
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [entryChecklist, setEntryChecklist] = useState<PrintChecklist | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [pieceOpen, setPieceOpen] = useState(false)
  const [quickSupplier, setQuickSupplier] = useState('')
  const exitFileInputRef = useRef<HTMLInputElement>(null)
  const [exitPhoto, setExitPhoto] = useState<{ blob: Blob; preview: string; compressedSize: number; originalSize: number } | null>(null)
  const [finishPayment, setFinishPayment] = useState('Pix')
  const [finishValue, setFinishValue] = useState('')
  const [finishReceiver, setFinishReceiver] = useState('')
  const [finishReceiverDocument, setFinishReceiverDocument] = useState('')
  const [finishNotes, setFinishNotes] = useState('')
  const [finishing, setFinishing] = useState(false)
  const canFinance = can(user, 'view_financial')
  const canExportPdf = can(user, 'export_pdf')
  const canUpdateStatus = can(user, 'update_status')

  const order = useMemo(() => orders.find((o) => o.id === id), [orders, id])

  // Checklist real registrado na abertura da OS (Supabase ou localStorage)
  useEffect(() => {
    if (!id) return
    let cancelled = false
    getChecklist(id, 'entrada')
      .then((data) => { if (!cancelled) setEntryChecklist(data) })
      .catch(() => { if (!cancelled) setEntryChecklist(null) })
    return () => { cancelled = true }
  }, [id])

  const photos = useMemo(() => {
    if (!order) return []
    const fromState = serviceOrderPhotos.filter((photo) => photo.service_order_id === order.id)
    const demo = getDemoPhotos(order.numero).map<ServiceOrderPhoto>((photo) => ({
      id: photo.fileId,
      service_order_id: order.id,
      kind: photo.fileName.includes('saida') ? 'saida' : 'entrada',
      storage_path: photo.fileId,
      legenda: photo.fileName,
      url: photo.thumbnailLink || photo.webViewLink,
      created_at: order.created_at,
    }))
    const map = new Map<string, ServiceOrderPhoto>()
    ;[...fromState, ...demo].forEach((photo) => map.set(photo.id, photo))
    return Array.from(map.values())
  }, [serviceOrderPhotos, order])

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
  const entryPhotos = photos.filter((photo) => photo.kind === 'entrada')
  const exitPhotos = photos.filter((photo) => photo.kind === 'saida')

  const handleStatusChange = (newStatus: OsStatus) => {
    if (newStatus === 'entregue') {
      setShowStatusModal(false)
      setFinishValue(String(order.valor_servico || ''))
      setFinishOpen(true)
      return
    }
    updateOrder(order.id, { status: newStatus, updated_at: new Date().toISOString() })
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'alteracao_status_os',
      entity: 'service_order',
      entity_id: order.id,
      previous_values: { status: order.status },
      new_values: { status: newStatus },
      created_at: new Date().toISOString(),
    })
    setShowStatusModal(false)
  }

  const handleExitPhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImage(file)
      setExitPhoto({
        blob: compressed.blob,
        preview: URL.createObjectURL(compressed.blob),
        compressedSize: compressed.compressedSize,
        originalSize: compressed.originalSize,
      })
      toast.success(`Foto de saida pronta: ${formatFileSize(compressed.originalSize)} -> ${formatFileSize(compressed.compressedSize)}`)
    } catch {
      toast.error('Erro ao processar foto de saida')
    } finally {
      e.target.value = ''
    }
  }

  const finishOrder = async () => {
    if (!finishPayment) {
      toast.error('Selecione a forma de pagamento')
      return
    }
    if (!finishReceiver.trim()) {
      toast.error('Informe quem retirou o aparelho')
      return
    }
    if (!exitPhoto && exitPhotos.length === 0) {
      toast.error('Adicione pelo menos 1 foto de saida antes de finalizar a OS')
      return
    }

    setFinishing(true)
    try {
      const now = new Date().toISOString()
      let uploadedPhoto: ServiceOrderPhoto | null = null
      if (exitPhoto) {
        const fileName = formatOsPhotoFileName(order.numero, 'saida_retirada', exitPhotos.length)
        const uploaded = isSupabaseEnabled
          ? await serviceOrderPhotosAdapter.upload(exitPhoto.blob, `${order.id}/${fileName}`)
          : await uploadToDrive(exitPhoto.blob, fileName, order.numero)
        uploadedPhoto = {
          id: generateId(),
          service_order_id: order.id,
          kind: 'saida',
          storage_path: 'storagePath' in uploaded ? uploaded.storagePath : uploaded.fileId || fileName,
          legenda: 'Saida / retirada',
          url: 'url' in uploaded ? uploaded.url : uploaded.thumbnailLink || uploaded.webViewLink,
          created_at: now,
        }
        addServiceOrderPhoto(uploadedPhoto)
      }

      const nextValue = money(finishValue)
      const updates = {
        status: 'entregue' as OsStatus,
        updated_at: now,
        payment_method: finishPayment,
        payment_status: 'pago',
        delivery_receiver: finishReceiver.trim(),
        delivery_receiver_document: finishReceiverDocument.trim() || null,
        delivery_notes: finishNotes.trim() || order.delivery_notes || null,
        valor_servico: nextValue > 0 ? nextValue : order.valor_servico,
      }
      updateOrder(order.id, updates)
      addAuditLog({
        id: generateId(),
        user_id: user?.id,
        user_name: user?.nome,
        action: 'finalizacao_os_caixa',
        entity: 'service_order',
        entity_id: order.id,
        previous_values: { status: order.status, payment_method: order.payment_method, valor_servico: order.valor_servico },
        new_values: { ...updates, photo_id: uploadedPhoto?.id || null },
        created_at: now,
      })
      toast.success('OS finalizada e registrada para o caixa')
      setFinishOpen(false)
      setExitPhoto(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Nao consegui finalizar: ${message}`)
    } finally {
      setFinishing(false)
    }
  }

  const handlePrint = async (kind: 'entrada' | 'saida') => {
    const mobile = window.matchMedia('(max-width: 767px)').matches || window.matchMedia('(pointer: coarse)').matches
    const preview = mobile ? window.open('', '_blank') : null
    try {
      const currentSettings = isSupabaseEnabled
        ? await appSettingsAdapter.get() || settings
        : settings
      if (kind === 'entrada') {
        printEntradaA4(order, currentSettings, resolveOsConfig(currentSettings.os_config), entryChecklist, preview)
      } else {
        await openOsPdf(order, kind, currentSettings, preview)
      }
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
      toast.success(kind === 'entrada' ? 'OS de entrada pronta para imprimir' : 'OS de saida pronta para imprimir')
    } catch (error) {
      preview?.close()
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel preparar a impressao')
    }
  }

  const copyMessage = async (message: string) => {
    try {
      await navigator.clipboard.writeText(message)
      toast.success('Mensagem copiada! Cole no WhatsApp do cliente.')
    } catch {
      // Fallback para contextos sem Clipboard API (HTTP, foco perdido, navegadores antigos)
      const textarea = document.createElement('textarea')
      textarea.value = message
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (ok) {
        toast.success('Mensagem copiada! Cole no WhatsApp do cliente.')
      } else {
        toast.error('Nao consegui copiar a mensagem')
      }
    }
  }

  // Opcoes de mensagem: a do status atual + templates configurados em Ajustes > OS
  const whatsappConfig = getOsConfig()
  const whatsappOptions = [
    {
      id: 'status-atual',
      label: `Status atual (${STATUS_CONFIG[order.status]?.label || order.status})`,
      text: buildWhatsappMessage(order, whatsappConfig),
    },
    ...whatsappConfig.whatsappTemplates.map((template) => ({
      id: template.id,
      label: template.label,
      text: applyMessageTemplate(order, template.text, whatsappConfig),
    })),
  ]

  const whatsappSendUrl = (message: string) => {
    const phone = (order.customer?.telefone || '').replace(/\D/g, '')
    return phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}` : null
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

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={order.status} />
          {isLegacyOrder(order) && (
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-purple-500/15 text-purple-300">
              FPQ (sistema antigo)
            </span>
          )}
        </div>

        <div className="mt-2.5 text-sm text-gray-300">
          <span className="text-gray-500">Data de entrada:</span>{' '}
          <span className="font-semibold tabular-nums">{formatDate(order.created_at)}</span>
        </div>

        {readyDays >= 3 && (
          <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
            <span className="text-xs text-yellow-300">
              Pronto há {readyDays} dias — avisar o cliente!
            </span>
          </div>
        )}

        <div className="flex gap-2.5 mt-4">
          {canUpdateStatus && !['entregue', 'cancelado'].includes(order.status) && (
            <button
              onClick={() => {
                setFinishValue(String(order.valor_servico || ''))
                setFinishOpen(true)
              }}
              className="flex-1 h-11 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <CreditCard size={16} /> Finalizar OS
            </button>
          )}
          {canExportPdf && (
            <button
              onClick={() => handlePrint('entrada')}
              className="flex-1 h-11 rounded-xl bg-white/8 border border-white/10 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Printer size={16} /> Imprimir entrada
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
            <Download size={16} /> Comprovante de saida
          </button>
        )}

        {/* Templates de mensagem — copiar ou enviar direto no WhatsApp */}
        <button
          onClick={() => setWhatsappOpen(true)}
          className="w-full h-11 mt-2 rounded-xl bg-[#25D366]/10 border border-[#25D366]/25 font-semibold text-sm flex items-center justify-center gap-2 text-[#25D366] active:scale-95 transition-transform"
        >
          <MessageSquare size={15} /> Mensagem para WhatsApp
        </button>

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
          {entryChecklist && Object.keys(entryChecklist.itens).length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {Object.entries(entryChecklist.itens).map(([item, ok]) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <span
                      className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0"
                      style={{ background: ok ? '#14532D' : '#7F1D1D', color: ok ? '#4ADE80' : '#FCA5A5' }}
                    >
                      {ok ? '✓' : '✕'}
                    </span>
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
              {entryChecklist.observacoes && (
                <div className="text-xs text-gray-400 mt-3">
                  <span className="text-gray-500">Obs:</span> {entryChecklist.observacoes}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Checklist nao registrado nesta OS{isLegacyOrder(order) ? ' (importada do sistema antigo)' : ''}.
            </p>
          )}
        </CardBox>

        {/* Fotos */}
        <CardBox title="Fotos de entrada" icon={Camera}>
          <PhotoGrid photos={entryPhotos} emptyText="Nenhuma foto de entrada registrada nesta OS." />
        </CardBox>

        <CardBox title="Fotos de saida" icon={Camera}>
          <PhotoGrid photos={exitPhotos} emptyText="A foto de saida sera obrigatoria ao finalizar a OS." />
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

        {/* Condicoes de pagamento */}
        {(order.payment_method || order.payment_status) && (
          <CardBox title="Condicoes de pagamento" icon={CreditCard}>
            {order.payment_method && <Row k="Forma de pagamento" v={order.payment_method} />}
            {order.payment_status && <Row k="Situacao" v={order.payment_status === 'pago' ? 'Pago' : order.payment_status} />}
            {order.delivery_receiver && <Row k="Retirado por" v={order.delivery_receiver} />}
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
      {whatsappOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center" onClick={() => setWhatsappOpen(false)}>
          <div
            className="w-full max-w-[480px] max-h-[85vh] overflow-y-auto bg-surface-elevated rounded-t-[24px] md:rounded-[24px] border-t md:border border-white/10 p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">Mensagem para o cliente</h2>
              <button onClick={() => setWhatsappOpen(false)} className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center"><X size={16} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Escolha o modelo. Edite os textos em Ajustes &gt; Configuracoes da OS.
            </p>
            <div className="space-y-3">
              {whatsappOptions.map((option) => {
                const sendUrl = whatsappSendUrl(option.text)
                return (
                  <div key={option.id} className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
                    <div className="text-sm font-semibold mb-1.5">{option.label}</div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-2.5">{option.text}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyMessage(option.text)}
                        className="flex-1 h-9 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-white/10 transition-colors"
                      >
                        <Copy size={13} /> Copiar
                      </button>
                      {sendUrl && (
                        <a
                          href={sendUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 h-9 rounded-lg bg-[#25D366]/15 border border-[#25D366]/30 text-xs font-semibold text-[#25D366] flex items-center justify-center gap-1.5 hover:bg-[#25D366]/25 transition-colors"
                        >
                          <Send size={13} /> Enviar no WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setShowStatusModal(false)}>
          <div
            className="w-full max-w-[440px] bg-surface-elevated rounded-t-[24px] border-t border-white/10 p-5 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-4">Atualizar status</h2>
            <div className="space-y-2">
              {STATUS_FLOW.filter((s) => getOsConfig().enabledStatuses.includes(s)).map((s) => {
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
      {finishOpen && (
        <FinishOrderModal
          payment={finishPayment}
          setPayment={setFinishPayment}
          value={finishValue}
          setValue={setFinishValue}
          receiver={finishReceiver}
          setReceiver={setFinishReceiver}
          receiverDocument={finishReceiverDocument}
          setReceiverDocument={setFinishReceiverDocument}
          notes={finishNotes}
          setNotes={setFinishNotes}
          exitPhoto={exitPhoto}
          existingExitPhotos={exitPhotos.length}
          onPickPhoto={() => exitFileInputRef.current?.click()}
          onRemovePhoto={() => setExitPhoto(null)}
          onClose={() => setFinishOpen(false)}
          onSave={finishOrder}
          saving={finishing}
        />
      )}
      <input ref={exitFileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleExitPhotoCapture} />
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

function PhotoGrid({ photos, emptyText }: { photos: ServiceOrderPhoto[]; emptyText: string }) {
  if (photos.length === 0) {
    return (
      <div className="rounded-xl bg-surface-muted border border-dashed border-white/10 px-3 py-5 text-center">
        <Camera size={18} className="mx-auto text-gray-500 mb-2" />
        <div className="text-xs text-gray-500">{emptyText}</div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {photos.map((photo) => (
        <a
          key={photo.id}
          href={photo.url || legacyDriveUrl(photo.storage_path)}
          target="_blank"
          rel="noopener noreferrer"
          className="relative aspect-square rounded-xl overflow-hidden bg-surface-muted border border-white/5 flex items-center justify-center"
        >
          {photo.url ? (
            <img src={photo.url} alt={photo.legenda || 'Foto da OS'} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-gray-500" />
          )}
          <span className="absolute bottom-0 left-0 right-0 bg-black/65 px-1.5 py-1 text-[9px] text-white truncate">
            {photo.legenda || photo.kind}
          </span>
        </a>
      ))}
    </div>
  )
}

function legacyDriveUrl(storagePath: string) {
  if (/^(https?:|data:)/.test(storagePath)) return storagePath
  return `https://drive.google.com/file/d/${encodeURIComponent(storagePath)}/view`
}

function FinishOrderModal({
  payment,
  setPayment,
  value,
  setValue,
  receiver,
  setReceiver,
  receiverDocument,
  setReceiverDocument,
  notes,
  setNotes,
  exitPhoto,
  existingExitPhotos,
  onPickPhoto,
  onRemovePhoto,
  onClose,
  onSave,
  saving,
}: {
  payment: string
  setPayment: (value: string) => void
  value: string
  setValue: (value: string) => void
  receiver: string
  setReceiver: (value: string) => void
  receiverDocument: string
  setReceiverDocument: (value: string) => void
  notes: string
  setNotes: (value: string) => void
  exitPhoto: { preview: string; compressedSize: number; originalSize: number } | null
  existingExitPhotos: number
  onPickPhoto: () => void
  onRemovePhoto: () => void
  onClose: () => void
  onSave: () => void
  saving: boolean
}) {
  const paymentOptions = ['Pix', 'Cartao', 'Dinheiro', 'Parcelado', 'Transferencia']
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-[520px] max-h-[92vh] overflow-y-auto bg-surface-elevated rounded-t-[24px] border-t border-white/10 p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">Finalizar OS</h2>
            <p className="text-xs text-gray-500 mt-0.5">Registre o pagamento, retirada e foto de saida.</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Forma de pagamento *</label>
            <div className="grid grid-cols-2 gap-2">
              {paymentOptions.map((item) => (
                <button
                  key={item}
                  onClick={() => setPayment(item)}
                  className={`h-11 rounded-xl border text-sm font-semibold ${payment === item ? 'bg-brand/15 border-brand text-white' : 'bg-white/5 border-white/8 text-gray-400'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <InputLine label="Valor recebido / servico" value={value} onChange={setValue} />
          <InputLine label="Quem retirou *" value={receiver} onChange={setReceiver} />
          <InputLine label="Documento de quem retirou" value={receiverDocument} onChange={setReceiverDocument} />
          <InputLine label="Observacoes da retirada" value={notes} onChange={setNotes} />

          <div>
            <label className="block text-sm text-gray-400 mb-2">Foto de saida *</label>
            {exitPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                <img src={exitPhoto.preview} alt="Foto de saida" className="w-full h-48 object-cover" />
                <button onClick={onRemovePhoto} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/70 flex items-center justify-center">
                  <X size={14} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2 text-xs text-green-300">
                  {formatFileSize(exitPhoto.originalSize)} &gt; {formatFileSize(exitPhoto.compressedSize)}
                </div>
              </div>
            ) : (
              <button
                onClick={onPickPhoto}
                className="w-full h-24 rounded-xl bg-surface-muted border border-dashed border-white/12 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-brand/40"
              >
                <Camera size={20} />
                <span className="text-xs">{existingExitPhotos > 0 ? `${existingExitPhotos} foto(s) ja registrada(s). Adicionar outra` : 'Tirar foto de saida'}</span>
              </button>
            )}
          </div>

          <button onClick={onSave} disabled={saving} className="w-full h-12 rounded-xl bg-brand font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            <Save size={16} /> {saving ? 'Finalizando...' : 'Finalizar e enviar ao caixa'}
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

function money(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0
}
