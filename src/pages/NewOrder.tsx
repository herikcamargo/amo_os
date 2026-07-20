import { useMemo, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, User, Smartphone, Wrench, CheckCircle2, Camera,
  ClipboardCheck, Save, X, ImageIcon, ScanLine, ChevronDown, Printer, Search, UserCheck,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { CHECK_ENTRADA, CONDICAO_ESTETICA_LABELS, ACESSORIOS_OPTIONS, MARCAS, MODELOS_POR_MARCA } from '@/lib/constants'
import { generateId } from '@/lib/utils'
import { compressImage, formatFileSize } from '@/lib/image-compressor'
import { formatOsPhotoFileName, uploadToDrive } from '@/lib/google-drive'
import { scanOsImage } from '@/lib/os-scanner'
import { customersAdapter, devicesAdapter, isSupabaseEnabled, ordersAdapter } from '@/lib/storage-adapter'
import { isValidCep, lookupCep, maskCep } from '@/lib/cep'
import { printEntradaA4 } from '@/lib/print-entrada'
import { saveChecklist } from '@/lib/checklists'
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

type SectionKey = 'cliente' | 'aparelho' | 'problema' | 'checklist' | 'fotos'

export function NewOrder() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addOrder, nextOsNumber, user, customers, updateCustomer, addNotification, addServiceOrderPhoto, settings } = useStore()
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)

  // Secoes abertas (mobile). No desktop todas ficam visiveis.
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    cliente: true, aparelho: false, problema: false, checklist: false, fotos: false,
  })
  const fotosRef = useRef<HTMLDivElement>(null)
  const toggleSection = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  // Cliente
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [cep, setCep] = useState('')
  const [endereco, setEndereco] = useState('')
  const [numeroEndereco, setNumeroEndereco] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [dataHoraOrigem, setDataHoraOrigem] = useState('')
  const [loadingCep, setLoadingCep] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const customerSuggestions = useMemo(() => {
    const term = normalizeCustomerSearch(customerSearch)
    if (term.length < 2) return []
    const digits = customerSearch.replace(/\D/g, '')
    return customers
      .filter((customer) => (
        normalizeCustomerSearch(customer.nome).includes(term)
        || (digits.length >= 3 && (customer.cpf || '').replace(/\D/g, '').includes(digits))
      ))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .slice(0, 8)
  }, [customerSearch, customers])

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id)
    setCustomerSearch(customer.nome)
    setNome(customer.nome)
    setTelefone(customer.telefone)
    setCpf(customer.cpf || '')
    setCep(customer.cep || '')
    setEndereco(customer.logradouro || '')
    setNumeroEndereco(customer.numero || '')
    setComplemento(customer.complemento || '')
    setBairro(customer.bairro || '')
    setCidade(customer.cidade || '')
    setUf(customer.uf || '')
  }

  const clearCustomer = () => {
    setSelectedCustomerId(null)
    setCustomerSearch('')
    setNome('')
    setTelefone('')
    setCpf('')
    setCep('')
    setEndereco('')
    setNumeroEndereco('')
    setComplemento('')
    setBairro('')
    setCidade('')
    setUf('')
  }

  // Aparelho
  const [marca, setMarca] = useState(() => searchParams.get('marca') || '')
  const [modelo, setModelo] = useState(() => searchParams.get('modelo') || '')
  const [cor, setCor] = useState('')
  const [imei, setImei] = useState('')
  const [senhaDesbloqueio, setSenhaDesbloqueio] = useState('')
  const [acessorios, setAcessorios] = useState<string[]>([])

  // Problema
  const [problema, setProblema] = useState(() => {
    const servico = searchParams.get('servico')
    return servico ? `Serviço solicitado: ${servico}` : ''
  })
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
      setOpenSections((prev) => ({ ...prev, cliente: true, aparelho: true, problema: true }))
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

  const modeloQuery = modelo.trim().toLowerCase()
  const modelosSugeridos = (MODELOS_POR_MARCA[marca] || [])
    .filter((m) => !modeloQuery || m.toLowerCase().includes(modeloQuery))
    .slice(0, 12)

  const photosCount = photos.filter((p) => p.blob).length
  const canSave = Boolean(nome.trim() && telefone.trim())

  const handleSave = async (printAfter = false) => {
    if (!canSave) {
      toast.error('Nome e telefone do cliente sao obrigatorios')
      setOpenSections((prev) => ({ ...prev, cliente: true }))
      return
    }

    const photosWithBlob = photos.filter((p) => p.blob)
    if (photosWithBlob.length === 0) {
      toast.error('Adicione pelo menos 1 foto de entrada do aparelho antes de abrir a OS')
      setOpenSections((prev) => ({ ...prev, fotos: true }))
      fotosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()
      const dadosMigrados = [
        endereco.trim() ? `Endereco: ${endereco.trim()}` : '',
        dataHoraOrigem.trim() ? `Data/hora da OS antiga: ${dataHoraOrigem.trim()}` : '',
      ].filter(Boolean).join('\n')
      const problemaFinal = [problema.trim(), dadosMigrados].filter(Boolean).join('\n\n')
      const condicaoEstetica = { ...condicao, descricao: descCondicao || undefined }
      const customerData = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        cpf: cpf.trim() || null,
        cep: cep.trim() || null,
        logradouro: endereco.trim() || null,
        numero: numeroEndereco.trim() || null,
        complemento: complemento.trim() || null,
        bairro: bairro.trim() || null,
        cidade: cidade.trim() || null,
        uf: uf.trim() || null,
      }
      let savedOrder: ServiceOrder

      if (isSupabaseEnabled) {
        toast.loading('Salvando OS na nuvem...', { id: 'save-os' })

        const customer = selectedCustomerId
          ? await customersAdapter.update(selectedCustomerId, customerData)
          : await customersAdapter.create(customerData)

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
        const customerId = selectedCustomerId || generateId()
        const deviceId = generateId()
        const orderId = generateId()
        const orderNum = nextOsNumber()

        const customer: Customer = {
          id: customerId,
          ...customerData,
          created_at: customers.find((item) => item.id === customerId)?.created_at || now,
        }
        if (selectedCustomerId) updateCustomer(selectedCustomerId, customerData)
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

      // Persiste o checklist de entrada — impresso na OS e exibido no detalhe
      try {
        await saveChecklist(savedOrder.id, 'entrada', checklist, obsChecklist)
      } catch {
        console.warn('Falha ao salvar checklist de entrada')
      }

      addOrder(savedOrder)
      addNotification({
        id: generateId(),
        title: 'Nova OS aberta',
        body: `${savedOrder.numero} - ${savedOrder.customer?.nome || nome.trim()} (${[savedOrder.device?.marca || marca.trim(), savedOrder.device?.modelo || modelo.trim()].filter(Boolean).join(' ') || 'aparelho'}). Verificar necessidade de pedir peca.`,
        read: false,
        created_at: new Date().toISOString(),
        order_id: savedOrder.id,
        target_role: 'admin',
      })

      toast.loading(`Enviando ${photosWithBlob.length} foto(s)...`, { id: 'upload' })
      for (const [index, photo] of photosWithBlob.entries()) {
        try {
          const fileName = formatOsPhotoFileName(savedOrder.numero, `entrada_${photo.label}`, index)
          const uploaded = await uploadToDrive(
            photo.blob!,
            fileName,
            savedOrder.numero,
          )
          addServiceOrderPhoto({
            id: generateId(),
            service_order_id: savedOrder.id,
            kind: 'entrada',
            storage_path: uploaded.fileId || fileName,
            legenda: photo.label,
            url: uploaded.thumbnailLink || uploaded.webViewLink,
            created_at: new Date().toISOString(),
          })
        } catch {
          console.warn(`Falha ao enviar foto ${photo.label}`)
        }
      }
      toast.success(`${photosWithBlob.length} foto(s) salva(s)!`, { id: 'upload' })

      if (!isSupabaseEnabled) toast.success(`OS ${savedOrder.numero} criada!`)

      if (printAfter) {
        try {
          printEntradaA4(savedOrder, settings, undefined, { itens: checklist, observacoes: obsChecklist })
          toast.success('Impressao de entrada gerada (2 vias)')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erro desconhecido'
          toast.error(`Nao consegui imprimir: ${message}`)
        }
      }

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

  const handleCepLookup = async () => {
    if (!cep || !isValidCep(cep)) return
    setLoadingCep(true)
    try {
      const address = await lookupCep(cep)
      setCep(address.cep)
      setEndereco(address.logradouro)
      setBairro(address.bairro)
      setCidade(address.cidade)
      setUf(address.uf)
      toast.success('Endereco preenchido pelo CEP')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel consultar o CEP'
      toast.error(message)
    } finally {
      setLoadingCep(false)
    }
  }

  return (
    <div className="px-5 md:px-0 pt-3 md:pt-6 pb-32 lg:pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2 mb-4">
        <IconBtn onClick={() => navigate(-1)}><ChevronLeft size={22} /></IconBtn>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Nova OS</h1>
          <p className="text-xs text-gray-400 mt-0.5 hidden md:block">Preencha as secoes e salve — tudo em uma tela</p>
        </div>
        <button
          onClick={() => scannerInputRef.current?.click()}
          disabled={scanning}
          className="h-11 px-4 rounded-xl bg-white/8 border border-white/10 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-white/12 transition-colors disabled:opacity-60"
        >
          <ScanLine size={16} /> {scanning ? 'Lendo...' : 'Scanner OS antiga'}
        </button>
      </div>

      <input
        ref={scannerInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleScannerCapture}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 lg:items-start">
        {/* Coluna de secoes — todas visiveis no desktop, accordion no mobile */}
        <div className="space-y-3">
          <CollapsibleSection
            title="Dados do cliente"
            icon={User}
            open={openSections.cliente}
            onToggle={() => toggleSection('cliente')}
            summary={nome ? `${nome}${telefone ? ` · ${telefone}` : ''}` : 'Nome e telefone obrigatorios'}
            done={Boolean(nome.trim() && telefone.trim())}
          >
            <div className="relative">
              <label className="block text-sm text-gray-400 mb-1.5">Buscar cliente cadastrado</label>
              <Search size={16} className="absolute left-3 top-[39px] -translate-y-1/2 text-gray-500" />
              <input
                value={customerSearch}
                onChange={(event) => {
                  if (selectedCustomerId) clearCustomer()
                  setCustomerSearch(event.target.value)
                  setSelectedCustomerId(null)
                }}
                placeholder="Digite nome ou CPF..."
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm"
              />
              {!selectedCustomerId && customerSuggestions.length > 0 && (
                <div className="absolute z-30 top-full mt-1 w-full rounded-xl bg-surface-elevated border border-white/10 shadow-2xl overflow-hidden">
                  {customerSuggestions.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="w-full px-3 py-2.5 flex items-center gap-3 text-left border-b border-white/5 last:border-0 hover:bg-white/5"
                    >
                      <div className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
                        <User size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{customer.nome}</div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {[customer.cpf, customer.telefone].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomerId && (
              <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-2.5 flex items-center gap-2">
                <UserCheck size={16} className="text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-300 flex-1">Cadastro existente selecionado</span>
                <button type="button" onClick={clearCustomer} className="text-xs font-semibold text-white hover:text-brand">Novo cliente</button>
              </div>
            )}
            <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
              <Input label="Nome *" value={nome} onChange={setNome} placeholder="Nome completo do cliente" />
              <Input label="Telefone *" value={telefone} onChange={setTelefone} placeholder="(16) 99999-9999" />
            </div>
            <div className="md:grid md:grid-cols-[140px_1fr] md:gap-3 space-y-3 md:space-y-0">
              <div>
                <Input label="CEP" value={cep} onChange={(value) => setCep(maskCep(value))} onBlur={handleCepLookup} placeholder="00000-000" />
                {loadingCep && <div className="text-xs text-brand mt-1">Consultando CEP...</div>}
              </div>
              <Input label="Rua / logradouro" value={endereco} onChange={setEndereco} placeholder="Preenchido pelo CEP" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Input label="Numero" value={numeroEndereco} onChange={setNumeroEndereco} placeholder="Numero" />
              <Input label="Complemento" value={complemento} onChange={setComplemento} placeholder="Apto, bloco..." />
              <Input label="Bairro" value={bairro} onChange={setBairro} placeholder="Bairro" />
              <div className="grid grid-cols-[1fr_64px] gap-2">
                <Input label="Cidade" value={cidade} onChange={setCidade} placeholder="Cidade" />
                <Input label="UF" value={uf} onChange={(value) => setUf(value.toUpperCase().slice(0, 2))} placeholder="UF" />
              </div>
            </div>
            <Input label="CPF" value={cpf} onChange={setCpf} placeholder="000.000.000-00 (opcional)" />
            {dataHoraOrigem && (
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-[11px] text-gray-500">Data/hora encontrada</div>
                <div className="text-sm text-gray-200">{dataHoraOrigem}</div>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Dados do aparelho"
            icon={Smartphone}
            open={openSections.aparelho}
            onToggle={() => toggleSection('aparelho')}
            summary={marca || modelo ? [marca, modelo, cor].filter(Boolean).join(' · ') : 'Marca, modelo, IMEI, acessorios'}
            done={Boolean(marca && modelo)}
          >
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Marca</label>
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
            <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
              <Input label="Modelo" value={modelo} onChange={setModelo} placeholder="Ex: iPhone 13, Galaxy S22" />
              <Input label="Cor" value={cor} onChange={setCor} placeholder="Cor do aparelho" />
            </div>
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
            <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
              <Input label="IMEI" value={imei} onChange={setImei} placeholder="15 dígitos (opcional)" />
              <Input label="Senha de desbloqueio" value={senhaDesbloqueio} onChange={setSenhaDesbloqueio} placeholder="PIN, padrão ou senha" type="password" />
            </div>
            <div className="space-y-2">
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
          </CollapsibleSection>

          <CollapsibleSection
            title="Problema & condição"
            icon={Wrench}
            open={openSections.problema}
            onToggle={() => toggleSection('problema')}
            summary={problema ? problema.slice(0, 60) : 'Problema relatado e condicao estetica'}
            done={Boolean(problema.trim())}
          >
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
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Condição estética</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
          </CollapsibleSection>

          <CollapsibleSection
            title="Checklist de entrada"
            icon={CheckCircle2}
            open={openSections.checklist}
            onToggle={() => toggleSection('checklist')}
            summary={`${Object.values(checklist).filter(Boolean).length}/${CHECK_ENTRADA.length} itens OK`}
            done
          >
            <p className="text-xs text-gray-500">Toque para alternar OK / NOK</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
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
            <div>
              <label className="block text-sm text-gray-400 mb-1">Observações do checklist</label>
              <textarea
                value={obsChecklist}
                onChange={(e) => setObsChecklist(e.target.value)}
                placeholder="Algo a observar..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600 resize-none"
              />
            </div>
          </CollapsibleSection>

          <div ref={fotosRef}>
            <CollapsibleSection
              title="Fotos de entrada *"
              icon={Camera}
              open={openSections.fotos}
              onToggle={() => toggleSection('fotos')}
              summary={photosCount > 0 ? `${photosCount} de ${photos.length} fotos` : 'Pelo menos 1 foto obrigatoria'}
              done={photosCount > 0}
            >
              <p className="text-xs text-gray-500">Toque para tirar foto ou selecionar da galeria</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
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
                        className="w-full aspect-square rounded-xl bg-surface-muted border border-dashed border-white/10 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:border-brand/40 transition-colors"
                      >
                        <Camera size={20} />
                        <span className="text-[10px]">{photo.label}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {photosCount > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
                  <ImageIcon size={14} className="text-green-400" />
                  <span className="text-xs text-green-300">
                    {photosCount} foto(s) · Comprimidas automaticamente em JPEG
                  </span>
                </div>
              )}
            </CollapsibleSection>
          </div>
        </div>

        {/* Painel lateral — resumo + comandos (desktop) */}
        <aside className="hidden lg:block sticky top-6">
          <div className="bg-surface-card rounded-[18px] border border-white/8 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
              <ClipboardCheck size={15} className="text-brand" />
              <span className="text-sm font-bold">Resumo da OS</span>
            </div>
            <div className="p-4 space-y-1.5">
              <SummaryRow label="Cliente" value={nome || '—'} />
              <SummaryRow label="Telefone" value={telefone || '—'} />
              {endereco && <SummaryRow label="Endereco" value={endereco} />}
              <SummaryRow label="Aparelho" value={[marca, modelo].filter(Boolean).join(' ') || '—'} />
              {imei && <SummaryRow label="IMEI" value={imei} />}
              {acessorios.length > 0 && <SummaryRow label="Acessorios" value={acessorios.join(', ')} />}
              <SummaryRow label="Problema" value={problema ? `${problema.slice(0, 42)}${problema.length > 42 ? '...' : ''}` : '—'} />
              <SummaryRow label="Checklist" value={`${Object.values(checklist).filter(Boolean).length}/${CHECK_ENTRADA.length} OK`} />
              <SummaryRow label="Fotos" value={`${photosCount} de ${photos.length}`} />
            </div>
            <div className="px-4 pb-4 space-y-2">
              <button
                onClick={() => handleSave(false)}
                disabled={saving || !canSave}
                className="w-full h-12 rounded-xl bg-brand hover:bg-brand-dark transition-colors font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar OS'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving || !canSave}
                className="w-full h-12 rounded-xl bg-white/8 border border-white/10 hover:bg-white/12 transition-colors font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Printer size={16} /> Salvar e imprimir (2 vias)
              </button>
              <button
                onClick={() => navigate(-1)}
                className="w-full h-10 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Voltar sem salvar
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Barra de comandos fixa — mobile (sobrepoe o BottomNav durante o cadastro) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] px-4 pb-4 pt-6 bg-gradient-to-t from-surface via-surface to-transparent">
        <div className="flex gap-2 max-w-[440px] mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="h-12 px-4 rounded-xl bg-white/8 border border-white/10 font-semibold text-sm"
          >
            Voltar
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !canSave}
            className="h-12 w-12 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center disabled:opacity-40"
            title="Salvar e imprimir"
          >
            <Printer size={18} />
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !canSave}
            className="flex-1 h-12 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar OS'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CollapsibleSection({ title, icon: Icon, open, onToggle, summary, done, children }: {
  title: string
  icon: typeof User
  open: boolean
  onToggle: () => void
  summary?: string
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-card rounded-[18px] border border-white/5">
      {/* Cabecalho: toggle apenas no mobile; no desktop as secoes ficam sempre abertas */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 p-4 text-left lg:cursor-default"
      >
        <Icon size={16} className="text-brand shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold">{title}</h2>
          {summary && (
            <p className={`text-[11px] truncate mt-0.5 lg:hidden ${done ? 'text-green-400' : 'text-gray-500'}`}>{summary}</p>
          )}
        </div>
        {done && <CheckCircle2 size={15} className="text-green-400 shrink-0 lg:hidden" />}
        <ChevronDown
          size={16}
          className={`text-gray-500 shrink-0 transition-transform lg:hidden ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div className={`px-4 pb-4 space-y-3 ${open ? 'block' : 'hidden lg:block'}`}>
        {children}
      </div>
    </div>
  )
}

function normalizeCustomerSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

function Input({ label, value, onChange, placeholder, type = 'text', onBlur }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; onBlur?: () => void
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
      />
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-xs font-medium text-right truncate">{value}</span>
    </div>
  )
}
