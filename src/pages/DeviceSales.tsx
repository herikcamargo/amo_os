import { useMemo, useState } from 'react'
import {
  ArrowLeft, Check, Package, Plus, Receipt, Search, Smartphone, XCircle, Printer,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { brl, MARCAS } from '@/lib/constants'
import { generateId } from '@/lib/utils'
import { defaultFiscalDocument } from '@/lib/fiscal'
import { downloadSaleReceiptPdf } from '@/lib/generate-pdf'
import type { Customer, DeviceSale, DeviceSaleType, ProductCategory, SaleDevice } from '@/types/database'
import toast from 'react-hot-toast'

const CATEGORIES: { key: ProductCategory; label: string }[] = [
  { key: 'celular', label: 'Celulares' },
  { key: 'carregador', label: 'Carregadores' },
  { key: 'pelicula', label: 'Peliculas' },
  { key: 'capa', label: 'Capas' },
  { key: 'acessorio', label: 'Acessorios' },
  { key: 'outro', label: 'Outros' },
]

const initialProduct = {
  product_category: 'celular' as ProductCategory,
  tipo: 'seminovo' as DeviceSaleType,
  marca: 'Apple',
  modelo: '',
  cor: '',
  armazenamento: '',
  memoria_ram: '',
  imei1: '',
  imei2: '',
  serial: '',
  sku: '',
  barcode: '',
  stock_quantity: '1',
  custo_compra: '',
  preco_venda: '',
  fornecedor: '',
  data_compra: '',
  condicao: '',
  acessorios: '',
  garantia: '',
  observacoes: '',
}

export function DeviceSales() {
  const {
    customers, saleDevices, deviceSales, suppliers, user, nextSaleNumber,
    addCustomer, addSaleDevice, addDeviceSale, cancelDeviceSale, addAuditLog,
  } = useStore()
  const [tab, setTab] = useState<'rapida' | 'estoque' | 'historico'>('rapida')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [category, setCategory] = useState<ProductCategory>('celular')
  const [productQuery, setProductQuery] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [payment, setPayment] = useState<'Pix' | 'Cartao' | 'Parcelado'>('Pix')
  const [quantity, setQuantity] = useState('1')
  const [discount, setDiscount] = useState('')
  const [increase, setIncrease] = useState('')
  const [installments, setInstallments] = useState('1')
  const [entryValue, setEntryValue] = useState('')
  const [financePartner, setFinancePartner] = useState('')
  const [notes, setNotes] = useState('')
  const [productForm, setProductForm] = useState(initialProduct)
  const [quickCustomer, setQuickCustomer] = useState({ nome: '', telefone: '' })

  const selectedProduct = saleDevices.find((device) => device.id === selectedProductId)
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId)
  const qty = Math.max(1, Number(quantity) || 1)
  const originalPrice = (selectedProduct?.preco_venda || 0) * qty
  const total = Math.max(0, originalPrice - money(discount) + money(increase))

  const availableProducts = useMemo(() => {
    const term = productQuery.trim().toLowerCase()
    return saleDevices
      .filter((item) => item.status !== 'vendido' && item.status !== 'cancelado' && (item.stock_quantity ?? 1) > 0)
      .filter((item) => (item.product_category || 'celular') === category)
      .filter((item) => {
        if (!term) return true
        return [item.marca, item.modelo, item.imei1, item.serial, item.sku, item.barcode]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
  }, [saleDevices, category, productQuery])

  const visibleCustomers = useMemo(() => {
    const term = customerQuery.trim().toLowerCase()
    if (!term) return customers.slice(0, 8)
    return customers.filter((customer) => [customer.nome, customer.telefone, customer.cpf].filter(Boolean).join(' ').toLowerCase().includes(term))
  }, [customers, customerQuery])

  const duplicateIds = useMemo(() => new Set(
    saleDevices.flatMap((device) => [device.imei1, device.imei2, device.serial, device.sku, device.barcode].filter(Boolean) as string[]),
  ), [saleDevices])

  const canContinueProduct = Boolean(selectedProduct)
  const canContinueCustomer = Boolean(selectedCustomer)

  const resetSale = () => {
    setStep(1)
    setSelectedProductId('')
    setSelectedCustomerId('')
    setPayment('Pix')
    setQuantity('1')
    setDiscount('')
    setIncrease('')
    setInstallments('1')
    setEntryValue('')
    setFinancePartner('')
    setNotes('')
  }

  const createQuickCustomer = () => {
    if (!quickCustomer.nome.trim() || !quickCustomer.telefone.trim()) {
      toast.error('Nome e telefone do cliente sao obrigatorios')
      return
    }
    const customer: Customer = {
      id: generateId(),
      nome: quickCustomer.nome.trim(),
      telefone: quickCustomer.telefone.trim(),
      cpf: null,
      created_at: new Date().toISOString(),
    }
    addCustomer(customer)
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'criacao_cliente_venda_rapida',
      entity: 'customer',
      entity_id: customer.id,
      new_values: customer,
      created_at: new Date().toISOString(),
    })
    setSelectedCustomerId(customer.id)
    setQuickCustomer({ nome: '', telefone: '' })
    toast.success('Cliente cadastrado')
  }

  const completeSale = () => {
    if (!selectedProduct || selectedProduct.status === 'vendido') {
      toast.error('Selecione um produto disponivel')
      return
    }
    if ((selectedProduct.stock_quantity ?? 1) < qty) {
      toast.error('Estoque insuficiente')
      return
    }
    if (!selectedCustomer) {
      toast.error('Selecione um cliente')
      return
    }
    const now = new Date().toISOString()
    const sale: DeviceSale = {
      id: generateId(),
      numero: nextSaleNumber(),
      customer_id: selectedCustomer.id,
      device_id: selectedProduct.id,
      seller_id: user?.id || 'local',
      sold_at: now,
      preco_original: originalPrice,
      quantity: qty,
      desconto: money(discount),
      acrescimo: money(increase),
      valor_final: total,
      forma_pagamento: payment,
      parcelas: payment === 'Parcelado' ? Number(installments) || 1 : 1,
      valor_entrada: money(entryValue),
      financeira: financePartner || null,
      observacoes: notes || null,
      fiscal: defaultFiscalDocument,
      customer: selectedCustomer,
      device: selectedProduct,
    }
    addDeviceSale(sale)
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'criacao_venda_3_cliques',
      entity: 'device_sale',
      entity_id: sale.id,
      new_values: sale,
      created_at: now,
    })
    toast.success('Venda finalizada')
    resetSale()
  }

  const saveProduct = () => {
    if (!productForm.modelo.trim()) {
      toast.error(productForm.product_category === 'celular' ? 'Informe o modelo do aparelho' : 'Informe o nome do produto')
      return
    }
    const identifiers = [productForm.imei1, productForm.imei2, productForm.serial, productForm.sku, productForm.barcode].map((v) => v.trim()).filter(Boolean)
    if (identifiers.some((id) => duplicateIds.has(id))) {
      toast.error('IMEI, serie, SKU ou codigo de barras ja cadastrado')
      return
    }
    const now = new Date().toISOString()
    const product: SaleDevice = {
      id: generateId(),
      product_category: productForm.product_category,
      tipo: productForm.tipo,
      marca: productForm.product_category === 'celular' ? productForm.marca : categoryLabel(productForm.product_category),
      modelo: productForm.modelo.trim(),
      cor: productForm.cor || null,
      armazenamento: productForm.armazenamento || null,
      memoria_ram: productForm.memoria_ram || null,
      imei1: productForm.product_category === 'celular' ? productForm.imei1 || null : null,
      imei2: productForm.product_category === 'celular' ? productForm.imei2 || null : null,
      serial: productForm.serial || null,
      sku: productForm.sku || null,
      barcode: productForm.barcode || null,
      custo_compra: money(productForm.custo_compra),
      preco_venda: money(productForm.preco_venda),
      stock_quantity: productForm.product_category === 'celular' ? 1 : Math.max(1, Number(productForm.stock_quantity) || 1),
      supplier_id: productForm.fornecedor || null,
      data_compra: productForm.data_compra || null,
      condicao: productForm.condicao || null,
      acessorios: productForm.acessorios || null,
      garantia: productForm.garantia || null,
      observacoes: productForm.observacoes || null,
      status: 'disponivel',
      created_at: now,
      updated_at: now,
    }
    addSaleDevice(product)
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'cadastro_produto_venda',
      entity: 'sale_device',
      entity_id: product.id,
      new_values: product,
      created_at: now,
    })
    setProductForm(initialProduct)
    toast.success('Produto cadastrado')
  }

  const cancelSale = (sale: DeviceSale) => {
    const reason = window.prompt('Justificativa do cancelamento')
    if (!reason) return
    const returnToStock = window.confirm('Devolver item ao estoque?')
    cancelDeviceSale(sale.id, reason, returnToStock)
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'cancelamento_venda',
      entity: 'device_sale',
      entity_id: sale.id,
      new_values: { reason, returnToStock },
      created_at: new Date().toISOString(),
    })
    toast.success('Venda cancelada')
  }

  return (
    <div className="px-5 pt-3 pb-24">
      <div className="pt-2 mb-4">
        <h1 className="text-xl font-bold tracking-tight">Vendas em 3 cliques</h1>
        <p className="text-xs text-gray-500 mt-1">Celulares, carregadores, peliculas, capas e acessorios</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <TabButton active={tab === 'rapida'} onClick={() => setTab('rapida')}>Venda</TabButton>
        <TabButton active={tab === 'estoque'} onClick={() => setTab('estoque')}>Estoque</TabButton>
        <TabButton active={tab === 'historico'} onClick={() => setTab('historico')}>Historico</TabButton>
      </div>

      {tab === 'rapida' && (
        <div className="space-y-4">
          <StepHeader step={step} />
          {step === 1 && (
            <Panel title="1. Selecione o produto" icon={Smartphone}>
              <CategoryTabs category={category} setCategory={setCategory} />
              <SearchBox value={productQuery} onChange={setProductQuery} placeholder="Buscar produto, IMEI, SKU..." />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                {availableProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    active={selectedProductId === product.id}
                    onClick={() => setSelectedProductId(product.id)}
                  />
                ))}
              </div>
              {availableProducts.length === 0 && <EmptyText>Nenhum item disponivel nessa categoria.</EmptyText>}
              <FooterAction disabled={!canContinueProduct} onClick={() => setStep(2)}>Continuar</FooterAction>
            </Panel>
          )}

          {step === 2 && (
            <Panel title="2. Escolha o cliente" icon={Receipt}>
              <button onClick={() => setStep(1)} className="text-xs text-gray-400 flex items-center gap-1 mb-3"><ArrowLeft size={14} /> Trocar produto</button>
              <SearchBox value={customerQuery} onChange={setCustomerQuery} placeholder="Buscar cliente..." />
              <div className="rounded-2xl bg-white/5 border border-white/8 p-3 mt-3">
                <div className="text-sm font-semibold mb-2">Novo cliente</div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                  <Field value={quickCustomer.nome} onChange={(v) => setQuickCustomer((current) => ({ ...current, nome: v }))} placeholder="Nome" />
                  <Field value={quickCustomer.telefone} onChange={(v) => setQuickCustomer((current) => ({ ...current, telefone: v }))} placeholder="Telefone" />
                  <button onClick={createQuickCustomer} className="h-11 px-4 rounded-xl bg-white/8 border border-white/10 text-sm font-semibold flex items-center justify-center gap-2">
                    <Plus size={16} /> Criar
                  </button>
                </div>
              </div>
              <div className="space-y-2 mt-3">
                {visibleCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left ${selectedCustomerId === customer.id ? 'border-brand bg-brand/10' : 'border-white/5 bg-white/5'}`}
                  >
                    <Avatar name={customer.nome} />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{customer.nome}</div>
                      <div className="text-xs text-gray-500">{customer.telefone}</div>
                    </div>
                    {selectedCustomerId === customer.id && <Check size={18} className="text-brand" />}
                  </button>
                ))}
              </div>
              <FooterAction disabled={!canContinueCustomer} onClick={() => setStep(3)}>Continuar</FooterAction>
            </Panel>
          )}

          {step === 3 && selectedProduct && selectedCustomer && (
            <Panel title="3. Confirme e finalize" icon={Receipt}>
              <button onClick={() => setStep(2)} className="text-xs text-gray-400 flex items-center gap-1 mb-3"><ArrowLeft size={14} /> Trocar cliente</button>
              <SummaryRow label="Produto" value={`${selectedProduct.marca} ${selectedProduct.modelo}`} sub={brl(selectedProduct.preco_venda)} />
              <SummaryRow label="Cliente" value={selectedCustomer.nome} sub={selectedCustomer.telefone} />
              <div className="grid grid-cols-3 gap-2 mt-4">
                {(['Pix', 'Cartao', 'Parcelado'] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setPayment(item)}
                    className={`rounded-xl border p-3 text-left ${payment === item ? 'border-brand bg-brand/10' : 'border-white/8 bg-white/5'}`}
                  >
                    <div className="text-sm font-semibold">{item}</div>
                    <div className="text-[11px] text-gray-500">{item === 'Parcelado' ? 'Em ate 12x' : 'A vista'}</div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                <LabeledField label="Quantidade" value={quantity} onChange={setQuantity} placeholder="1" />
                <LabeledField label="Desconto" value={discount} onChange={setDiscount} placeholder="R$ 0,00" />
                <LabeledField label="Acrescimo" value={increase} onChange={setIncrease} placeholder="R$ 0,00" />
                <LabeledField label="Parcelas" value={installments} onChange={setInstallments} placeholder="1" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <LabeledField label="Entrada" value={entryValue} onChange={setEntryValue} placeholder="R$ 0,00" />
                <LabeledField label="Financeira/parceira" value={financePartner} onChange={setFinancePartner} placeholder="Opcional" />
              </div>
              <Field value={notes} onChange={setNotes} placeholder="Observacoes" className="mt-2" />
              <div className="rounded-2xl bg-white/5 border border-white/8 p-4 mt-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="text-sm text-gray-400">Qtd {qty}</div>
                </div>
                <div className="text-2xl font-bold">{brl(total)}</div>
              </div>
              <FooterAction onClick={completeSale}>Finalizar venda</FooterAction>
              <button onClick={resetSale} className="w-full h-11 text-sm text-gray-500">Cancelar</button>
            </Panel>
          )}
        </div>
      )}

      {tab === 'estoque' && (
        <div className="space-y-4">
          <Panel title="Cadastrar produto" icon={Plus}>
            <ProductForm
              form={productForm}
              setForm={setProductForm}
              suppliers={suppliers}
              onSave={saveProduct}
            />
          </Panel>
          <DeviceList devices={saleDevices} />
        </div>
      )}

      {tab === 'historico' && (
        <Panel title="Vendas realizadas" icon={Receipt}>
          <div className="space-y-2">
            {deviceSales.map((sale) => (
              <div key={sale.id} className="rounded-xl bg-white/5 border border-white/5 p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{sale.numero} - {sale.customer?.nome}</div>
                    <div className="text-xs text-gray-500">{sale.device?.marca} {sale.device?.modelo} | {brl(sale.valor_final)}</div>
                    <div className="text-[11px] text-gray-600">Qtd {sale.quantity || 1} | Fiscal: {sale.fiscal.status}</div>
                  </div>
                  <button onClick={() => downloadSaleReceiptPdf(sale)} className="h-9 w-9 rounded-lg bg-white/8 flex items-center justify-center"><Printer size={15} /></button>
                  {!sale.cancelled_at && <button onClick={() => cancelSale(sale)} className="h-9 w-9 rounded-lg bg-red-500/10 text-red-300 flex items-center justify-center"><XCircle size={15} /></button>}
                </div>
                {sale.cancelled_at && <div className="text-xs text-red-300 mt-2">Cancelada: {sale.cancel_reason}</div>}
              </div>
            ))}
            {deviceSales.length === 0 && <EmptyText>Nenhuma venda registrada.</EmptyText>}
          </div>
        </Panel>
      )}
    </div>
  )
}

function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {['Produto', 'Cliente', 'Confirmar'].map((label, index) => {
        const active = step === index + 1
        const done = step > index + 1
        return (
          <div key={label} className={`rounded-2xl border p-3 ${active ? 'border-brand bg-brand/10' : done ? 'border-green-500/30 bg-green-500/10' : 'border-white/5 bg-white/5'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${active ? 'bg-brand' : 'bg-white/10'}`}>{done ? <Check size={15} /> : index + 1}</span>
              <span className="text-xs font-semibold">{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryTabs({ category, setCategory }: { category: ProductCategory; setCategory: (category: ProductCategory) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {CATEGORIES.map((item) => (
        <button
          key={item.key}
          onClick={() => setCategory(item.key)}
          className={`shrink-0 h-9 px-3 rounded-full text-xs font-semibold border ${category === item.key ? 'bg-brand border-brand text-white' : 'bg-white/5 border-white/8 text-gray-400'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function ProductCard({ product, active, onClick }: { product: SaleDevice; active: boolean; onClick: () => void }) {
  const isPhone = (product.product_category || 'celular') === 'celular'
  return (
    <button onClick={onClick} className={`relative text-left rounded-2xl border p-3 min-h-[150px] bg-white/5 ${active ? 'border-brand bg-brand/10' : 'border-white/5'}`}>
      {active && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-brand flex items-center justify-center"><Check size={14} /></span>}
      <div className="w-12 h-12 rounded-xl bg-black/30 border border-white/8 flex items-center justify-center mb-3">
        {isPhone ? <Smartphone size={26} className="text-brand" /> : <Package size={24} className="text-brand" />}
      </div>
      <div className="font-semibold text-sm leading-tight">{product.marca} {product.modelo}</div>
      <div className="text-xs text-gray-500 mt-1">{product.armazenamento || categoryLabel(product.product_category || 'celular')}</div>
      <div className="font-bold mt-2">{brl(product.preco_venda)}</div>
      <div className="text-[11px] text-gray-500 mt-1">Estoque: {product.stock_quantity ?? 1}</div>
    </button>
  )
}

function ProductForm({
  form,
  setForm,
  suppliers,
  onSave,
}: {
  form: typeof initialProduct
  setForm: React.Dispatch<React.SetStateAction<typeof initialProduct>>
  suppliers: { id: string; nome: string }[]
  onSave: () => void
}) {
  const set = (key: keyof typeof initialProduct, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const isPhone = form.product_category === 'celular'
  return (
    <div className="grid gap-3">
      <select value={form.product_category} onChange={(e) => set('product_category', e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
        {CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>
      {isPhone && (
        <>
          <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
            <option value="novo">Novo</option>
            <option value="seminovo">Seminovo</option>
            <option value="usado">Usado</option>
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={form.marca} onChange={(e) => set('marca', e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
              {MARCAS.map((marca) => <option key={marca}>{marca}</option>)}
            </select>
            <Field value={form.modelo} onChange={(v) => set('modelo', v)} placeholder="Modelo" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field value={form.cor} onChange={(v) => set('cor', v)} placeholder="Cor" />
            <Field value={form.armazenamento} onChange={(v) => set('armazenamento', v)} placeholder="GB" />
            <Field value={form.memoria_ram} onChange={(v) => set('memoria_ram', v)} placeholder="RAM" />
          </div>
          <Field value={form.imei1} onChange={(v) => set('imei1', v)} placeholder="IMEI 1" />
          <Field value={form.imei2} onChange={(v) => set('imei2', v)} placeholder="IMEI 2" />
        </>
      )}
      {!isPhone && <Field value={form.modelo} onChange={(v) => set('modelo', v)} placeholder="Nome do produto" />}
      <div className="grid grid-cols-2 gap-3">
        <Field value={form.sku} onChange={(v) => set('sku', v)} placeholder="SKU" />
        <Field value={form.barcode} onChange={(v) => set('barcode', v)} placeholder="Codigo barras" />
      </div>
      <Field value={form.serial} onChange={(v) => set('serial', v)} placeholder="Numero de serie" />
      <div className="grid grid-cols-3 gap-2">
        <Field value={form.stock_quantity} onChange={(v) => set('stock_quantity', v)} placeholder="Estoque" />
        <Field value={form.custo_compra} onChange={(v) => set('custo_compra', v)} placeholder="Custo" />
        <Field value={form.preco_venda} onChange={(v) => set('preco_venda', v)} placeholder="Venda" />
      </div>
      <select value={form.fornecedor} onChange={(e) => set('fornecedor', e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
        <option value="">Fornecedor</option>
        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.nome}</option>)}
      </select>
      <Field value={form.garantia} onChange={(v) => set('garantia', v)} placeholder="Garantia" />
      <Field value={form.observacoes} onChange={(v) => set('observacoes', v)} placeholder="Observacoes" />
      <button onClick={onSave} className="h-12 rounded-xl bg-brand font-semibold">Salvar produto</button>
    </div>
  )
}

function DeviceList({ devices }: { devices: SaleDevice[] }) {
  return (
    <Panel title="Produtos cadastrados" icon={Package}>
      <div className="space-y-2">
        {devices.map((device) => (
          <div key={device.id} className="rounded-xl bg-white/5 border border-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">{device.marca} {device.modelo}</div>
                <div className="text-xs text-gray-500">{device.imei1 || device.serial || device.sku || 'Sem identificador'} | {brl(device.preco_venda)}</div>
              </div>
              <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-white/8">Estoque {device.stock_quantity ?? 1}</span>
            </div>
          </div>
        ))}
        {devices.length === 0 && <EmptyText>Nenhum produto cadastrado.</EmptyText>}
      </div>
    </Panel>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Package; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card rounded-[18px] border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-brand" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`h-10 rounded-xl text-sm font-semibold ${active ? 'bg-brand' : 'bg-white/8'}`}>{children}</button>
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="relative mt-3">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600" />
    </div>
  )
}

function Field({ value, onChange, placeholder, className = '' }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm placeholder:text-gray-600 ${className}`} />
  )
}

function LabeledField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-500 mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full px-3 rounded-xl bg-surface-input border border-white/5 text-sm placeholder:text-gray-600"
      />
    </label>
  )
}

function FooterAction({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full h-12 rounded-xl bg-brand font-semibold mt-4 disabled:opacity-50 disabled:cursor-not-allowed">
      {children}
    </button>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">{initials || '?'}</div>
}

function SummaryRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-3">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-semibold text-sm">{value}</div>
      </div>
      <div className="text-sm text-gray-400">{sub}</div>
    </div>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-sm text-gray-500 py-8">{children}</div>
}

function categoryLabel(category: ProductCategory) {
  return CATEGORIES.find((item) => item.key === category)?.label || 'Produto'
}

function money(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0
}
