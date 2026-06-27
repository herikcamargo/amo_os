import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, User, Smartphone, Wrench, CheckCircle2, Camera,
  ClipboardCheck, Save, ChevronDown, X, ImageIcon, ScanLine,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { CHECK_ENTRADA, CONDICAO_ESTETICA_LABELS, ACESSORIOS_OPTIONS, MARCAS, MODELOS_POR_MARCA } from '@/lib/constants'
import { generateId } from '@/lib/utils'
import { compressImage, formatFileSize } from '@/lib/image-compressor'
import { formatOsPhotoFileName, uploadToDrive } from '@/lib/google-drive'
import { scanOsImage } from '@/lib/os-scanner'
import { customersAdapter, devicesAdapter, isSupabaseEnabled, ordersAdapter } from '@/lib/storage-adapter'
import type { ServiceOrder, Customer, Device, CondicaoEstetica } from '@/types/database'
import toast from 'react-hot-toast'

interface PhotoSlot {
  label: string
  preview?: string
  blob?: Blob
  compressedSize?: number
  originalSize?: number
  uploading?: boolean
}

type Step = 'cliente' | 'aparelho' | 'problema' | 'checklist' | 'fotos' | 'resumo'

const STEPS: { key: Step; label: string; icon: typeof User }[] = [
  { key: 'cliente', label: 'Cliente', icon: User },
  { key: 'aparelho', label: 'Aparelho', icon: Smartphone },
  { key: 'problema', label: 'Problema', icon: Wrench },
  { key: 'checklist', label: 'Checklist', icon: CheckCircle2 },
  { key: 'fotos', label: 'Fotos', icon: Camera },
  { key: 'resumo', label: 'Resumo', icon: ClipboardCheck },
]

export function NewOrder() {
  const navigate = useNavigate()
  const { addOrder, nextOsNumber, user } = useStore()
  const [step, setStep] = useState<Step>('cliente')
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)

  // Cliente
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [endereco, setEndereco] = useState('')
  const [dataHoraOrigem, setDataHoraOrigem] = useState('')

  // Aparelho
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [cor, setCor] = useState('')
  const [imei, setImei] = useState('')
  const [senhaDesbloqueio, setSenhaDesbloqueio] = useState('')
  const [acessorios, setAcessorios] = useState<string[]>([])

  // Problema
  const [problema, setProblema] = useState('')
  const [condicao, setCondicao] = useState<CondicaoEstetica>({})
  const [descCondicao, setDescCondicao] = useState('')

  // Fotos
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scannerInputRef = useRef<HTMLInputElement>(null)
  const [activePhotoSlot, setActivePhotoSlot] = useState<number | null>(null)
  const [photos, setPhotos] = useState<PhotoSlot[]>([
    { label: 'Frente' }, { label: 'Traseira' }, { label: 'Lateral E' },
    { label: 'Lateral D' }, { label: 'IMEI' }, { label: 'Defeito' },
  ])

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || activePhotoSlot === null) return

    try {
      const compressed = await compressImage(file)
      const preview = URL.createObjectURL(compressed.blob)

      setPhotos((prev) => prev.map((p, i) =>
        i === activePhotoSlot
          ? { ...p, preview, blob: compressed.blob, compressedSize: compressed.compressedSize, originalSize: compressed.originalSize }
          : p
      ))

      toast.success(`Foto comprimida: ${formatFileSize(compressed.originalSize)} → ${formatFileSize(compressed.compressedSize)} (${compressed.ratio})`)
    } catch {
      toast.error('Erro ao processar foto')
    }

    e.target.value = ''
    setActivePhotoSlot(null)
  }

  const handleScannerCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanning(true)
    toast.loading('Lendo foto da OS antiga...', { id: 'scanner' })
    try {
      const scanned = await scanOsImage(file)
      if (scanned.nome) setNome(scanned.nome)
      if (scanned.telefone) setTelefone(scanned.telefone)
      if (scanned.endereco) setEndereco(scanned.endereco)
      if (scanned.marca) setMarca(scanned.marca)
      if (scanned.modelo) setModelo(scanned.modelo)
      if (scanned.problema) setProblema(scanned.problema)
      if (scanned.dataHora) setDataHoraOrigem(scanned.dataHora)

      const found = [
        scanned.nome && 'nome',
        scanned.telefone && 'telefone',
        scanned.endereco && 'endereco',
        scanned.modelo && 'modelo',
        scanned.problema && 'problema',
        scanned.dataHora && 'data/hora',
      ].filter(Boolean)

      toast.success(
        found.length ? `Scanner preencheu: ${found.join(', ')}` : 'Li a imagem, mas nao encontrei campos claros',
        { id: 'scanner' },
      )
      setStep('cliente')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Scanner falhou: ${message}`, { id: 'scanner' })
    } finally {
      setScanning(false)
      e.target.value = ''
    }
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.map((p, i) =>
      i === index ? { label: p.label } : p
    ))
  }

  const openCamera = (index: number) => {
    setActivePhotoSlot(index)
    fileInputRef.current?.click()
  }

  // Checklist
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const obj: Record<string, boolean> = {}
    CHECK_ENTRADA.forEach((c) => obj[c] = true)
    return obj
  })
  const [obsChecklist, setObsChecklist] = useState('')

  const stepIndex = STEPS.findIndex((s) => s.key === step)
  const modeloQuery = modelo.trim().toLowerCase()
  const modelosSugeridos = (MODELOS_POR_MARCA[marca] || [])
    .filter((m) => !modeloQuery || m.toLowerCase().includes(modeloQuery))
    .slice(0, 12)

  const canNext = () => {
    if (step === 'cliente') return nome.trim() && telefone.trim()
    return true
  }

  const next = () => {
    const i = stepIndex + 1
    if (i < STEPS.length) setStep(STEPS[i].key)
  }
  const prev = () => {
    const i = stepIndex - 1
    if (i >= 0) setStep(STEPS[i].key)
    else navigate(-1)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const dadosMigrados = [
        endereco.trim() ? `Endereco: ${endereco.trim()}` : '',
        dataHoraOrigem.trim() ? `Data/hora da OS antiga: ${dataHoraOrigem.trim()}` : '',
      ].filter(Boolean).join('\n')
      const problemaFinal = [problema.trim(), dadosMigrados].filter(Boolean).join('\n\n')
      const condicaoEstetica = { ...condicao, descricao: descCondicao || undefined }
      let savedOrder: ServiceOrder

      if (isSupabaseEnabled) {
        toast.loading('Salvando OS na nuvem...', { id: 'save-os' })

        const customer = await customersAdapter.create({
          nome: nome.trim(),
          telefone: telefone.trim(),
          cpf: cpf.trim() || null,
        })

        const device = await devicesAdapter.create({
          customer_id: customer.id,
          marca: marca.trim(),
          modelo: modelo.trim(),
          cor: cor.trim(),
          imei: imei.trim() || null,
          senha_desbloqueio: senhaDesbloqueio.trim() || null,
          acessorios,
        })

        const order = await ordersAdapter.create({
          customer_id: customer.id,
          device_id: device.id,
          status: 'recebido',
          problema_relatado: problemaFinal,
          condicao_estetica: condicaoEstetica,
          valor_servico: 0,
          garantia_dias: 0,
          created_by: user?.id || null,
          customer,
          device,
        })

        savedOrder = { ...order, customer, device }
        toast.success(`OS ${savedOrder.numero} salva na nuvem!`, { id: 'save-os' })
      } else {
        const customerId = generateId()
        const deviceId = generateId()
        const orderId = generateId()
        const orderNum = nextOsNumber()

        const customer: Customer = {
          id: customerId,
          nome: nome.trim(),
          telefone: telefone.trim(),
          cpf: cpf.trim() || null,
          created_at: now,
        }
        const device: Device = {
          id: deviceId,
          customer_id: customerId,
          marca: marca.trim(),
          modelo: modelo.trim(),
          cor: cor.trim(),
          imei: imei.trim() || null,
          senha_desbloqueio: senhaDesbloqueio.trim() || null,
          acessorios,
          created_at: now,
        }

        savedOrder = {
          id: orderId,
          numero: orderNum,
          customer_id: customerId,
          device_id: deviceId,
          status: 'recebido',
          problema_relatado: problemaFinal,
          condicao_estetica: condicaoEstetica,
          valor_servico: 0,
          garantia_dias: 0,
          created_by: user?.id || 'u1',
          created_at: now,
          updated_at: now,
          customer,
          device,
        }
      }

      addOrder(savedOrder)

      const photosWithBlob = photos.filter((p) => p.blob)
      if (photosWithBlob.length > 0) {
        toast.loading(`Enviando ${photosWithBlob.length} foto(s)...`, { id: 'upload' })
        for (const [index, photo] of photosWithBlob.entries()) {
          try {
            await uploadToDrive(
              photo.blob!,
              formatOsPhotoFileName(savedOrder.numero, photo.label, index),
              savedOrder.numero,
            )
          } catch {
            console.warn(`Falha ao enviar foto ${photo.label}`)
          }
        }
        toast.success(`${photosWithBlob.length} foto(s) salva(s)!`, { id: 'upload' })
      }

      if (!isSupabaseEnabled) toast.success(`OS ${savedOrder.numero} criada!`)
      navigate(`/os/${savedOrder.id}`)
    } catch (err) {
      console.error('Falha ao criar OS:', err)
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Nao consegui salvar a OS: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleAcessorio = (a: string) => {
    setAcessorios((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a])
  }

  const toggleCondicao = (key: string) => {
    setCondicao((prev) => ({ ...prev, [key]: !prev[key as keyof CondicaoEstetica] }))
  }

  return (
    <div className="px-5 pt-3 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2 mb-4">
        <IconBtn onClick={prev}><ChevronLeft size={22} /></IconBtn>
        <h1 className="text-xl font-bold tracking-tight flex-1">Nova OS</h1>
        <span className="text-xs text-gray-500">{stepIndex + 1}/{STEPS.length}</span>
      </div>

      <input
        ref={scannerInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleScannerCapture}
      />

      <button
        onClick={() => scannerInputRef.current?.click()}
        disabled={scanning}
        className="w-full h-11 mb-4 rounded-xl bg-white/8 border border-white/10 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
      >
        <ScanLine size={16} /> {scanning ? 'Lendo foto...' : 'Scanner OS antiga'}
      </button>

      {/* Step indicators */}
      <div className="flex gap-1.5 mb-6">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`h-1 rounded-full flex-1 transition-colors ${i <= stepIndex ? 'bg-brand' : 'bg-white/10'}`}
          />
        ))}
      </div>

      {/* Steps */}
      {step === 'cliente' && (
        <Section title="Dados do cliente" icon={User}>
          <Input label="Nome *" value={nome} onChange={setNome} placeholder="Nome completo do cliente" />
          <Input label="Telefone *" value={telefone} onChange={setTelefone} placeholder="(16) 99999-9999" />
          <Input label="Endereco" value={endereco} onChange={setEndereco} placeholder="Endereco encontrado na OS antiga" />
          <Input label="CPF" value={cpf} onChange={setCpf} placeholder="000.000.000-00 (opcional)" />
          {dataHoraOrigem && (
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <div className="text-[11px] text-gray-500">Data/hora encontrada</div>
              <div className="text-sm text-gray-200">{dataHoraOrigem}</div>
            </div>
          )}
        </Section>
      )}

      {step === 'aparelho' && (
        <Section title="Dados do aparelho" icon={Smartphone}>
          <div className="space-y-3">
            <label className="block text-sm text-gray-400 mb-1">Marca</label>
            <div className="flex flex-wrap gap-2">
              {MARCAS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMarca(m)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    marca === m
                      ? 'bg-brand/20 border-brand text-white'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Input label="Modelo" value={modelo} onChange={setModelo} placeholder="Ex: iPhone 13, Galaxy S22" />
          {marca && modelosSugeridos.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Modelos sugeridos</label>
              <div className="flex flex-wrap gap-2">
                {modelosSugeridos.map((m) => (
                  <button
                    key={m}
                    onClick={() => setModelo(m)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      modelo === m
                        ? 'bg-brand/20 border-brand text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-brand/40 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input label="Cor" value={cor} onChange={setCor} placeholder="Cor do aparelho" />
          <Input label="IMEI" value={imei} onChange={setImei} placeholder="15 dígitos (opcional)" />
          <Input label="Senha de desbloqueio" value={senhaDesbloqueio} onChange={setSenhaDesbloqueio} placeholder="PIN, padrão ou senha" type="password" />

          <div className="space-y-2 mt-2">
            <label className="block text-sm text-gray-400">Acessórios deixados</label>
            <div className="flex flex-wrap gap-2">
              {ACESSORIOS_OPTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => toggleAcessorio(a)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    acessorios.includes(a)
                      ? 'bg-brand/20 border-brand text-white'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {step === 'problema' && (
        <Section title="Problema & condição" icon={Wrench}>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Problema relatado *</label>
            <textarea
              value={problema}
              onChange={(e) => setProblema(e.target.value)}
              placeholder="Descreva o problema relatado pelo cliente..."
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600 resize-none"
            />
          </div>

          <div className="space-y-2 mt-2">
            <label className="block text-sm text-gray-400">Condição estética</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CONDICAO_ESTETICA_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleCondicao(key)}
                  className={`text-xs px-3 py-2 rounded-xl border text-left transition-colors ${
                    condicao[key as keyof CondicaoEstetica]
                      ? 'bg-red-500/15 border-red-500/40 text-red-300'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Descrição adicional"
            value={descCondicao}
            onChange={setDescCondicao}
            placeholder="Detalhes adicionais sobre a condição..."
          />
        </Section>
      )}

      {step === 'checklist' && (
        <Section title="Checklist de entrada" icon={CheckCircle2}>
          <p className="text-xs text-gray-500 mb-3">Toque para alternar OK / NOK</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {CHECK_ENTRADA.map((item) => {
              const ok = checklist[item]
              return (
                <button
                  key={item}
                  onClick={() => setChecklist((prev) => ({ ...prev, [item]: !prev[item] }))}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-[11px] shrink-0 transition-colors"
                    style={{ background: ok ? '#14532D' : '#7F1D1D', color: ok ? '#4ADE80' : '#FCA5A5' }}
                  >
                    {ok ? '✓' : '✕'}
                  </span>
                  <span className="text-gray-300 text-left">{item}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4">
            <label className="block text-sm text-gray-400 mb-1">Observações do checklist</label>
            <textarea
              value={obsChecklist}
              onChange={(e) => setObsChecklist(e.target.value)}
              placeholder="Algo a observar..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600 resize-none"
            />
          </div>
        </Section>
      )}

      {step === 'fotos' && (
        <Section title="Fotos de entrada" icon={Camera}>
          <p className="text-xs text-gray-500 mb-3">Toque para tirar foto ou selecionar da galeria</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoCapture}
          />
          <div className="grid grid-cols-3 gap-3">
            {photos.map((photo, i) => (
              <div key={photo.label} className="relative">
                {photo.preview ? (
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-white/10">
                    <img src={photo.preview} alt={photo.label} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5">
                      <span className="text-[9px] text-white">{photo.label}</span>
                      {photo.compressedSize && (
                        <span className="text-[8px] text-green-400 ml-1">{formatFileSize(photo.compressedSize)}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => openCamera(i)}
                    className="w-full aspect-square rounded-xl bg-surface-muted border border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-brand/40 transition-colors active:scale-95"
                  >
                    <Camera size={20} />
                    <span className="text-[10px]">{photo.label}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
          {photos.some((p) => p.blob) && (
            <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
              <ImageIcon size={14} className="text-green-400" />
              <span className="text-xs text-green-300">
                {photos.filter((p) => p.blob).length} foto(s) · Comprimidas automaticamente em JPEG
              </span>
            </div>
          )}
        </Section>
      )}

      {step === 'resumo' && (
        <Section title="Resumo da OS" icon={ClipboardCheck}>
          <div className="space-y-2">
            <SummaryRow label="Cliente" value={nome} />
            <SummaryRow label="Telefone" value={telefone} />
            {endereco && <SummaryRow label="Endereco" value={endereco} />}
            {cpf && <SummaryRow label="CPF" value={cpf} />}
            <div className="border-t border-white/5 my-2" />
            <SummaryRow label="Aparelho" value={`${marca} ${modelo}`} />
            <SummaryRow label="Cor" value={cor} />
            {imei && <SummaryRow label="IMEI" value={imei} />}
            {acessorios.length > 0 && <SummaryRow label="Acessórios" value={acessorios.join(', ')} />}
            <div className="border-t border-white/5 my-2" />
            <SummaryRow label="Problema" value={problema || '—'} />
            {dataHoraOrigem && <SummaryRow label="Data/hora OS antiga" value={dataHoraOrigem} />}
            <SummaryRow
              label="Checklist"
              value={`${Object.values(checklist).filter(Boolean).length}/${CHECK_ENTRADA.length} OK`}
            />
            <SummaryRow
              label="Fotos"
              value={`${photos.filter((p) => p.blob).length} de ${photos.length}`}
            />
          </div>
        </Section>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-6">
        {stepIndex > 0 && (
          <button
            onClick={prev}
            className="flex-1 h-12 rounded-xl bg-white/5 border border-white/10 font-semibold text-sm active:scale-95 transition-transform"
          >
            Voltar
          </button>
        )}
        {step !== 'resumo' ? (
          <button
            onClick={next}
            disabled={!canNext()}
            className="flex-1 h-12 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100"
          >
            Próximo <ChevronDown size={16} className="rotate-[-90deg]" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-12 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Criar OS'}
          </button>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card rounded-[18px] border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-brand" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
      />
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  )
}
