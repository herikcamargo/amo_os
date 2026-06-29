import { useMemo, useState } from 'react'
import { Package, Plus, Receipt, XCircle, Printer } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { brl, MARCAS } from '@/lib/constants'
import { generateId } from '@/lib/utils'
import { defaultFiscalDocument } from '@/lib/fiscal'
import { downloadSaleReceiptPdf } from '@/lib/generate-pdf'
import type { DeviceSale, DeviceSaleType, SaleDevice } from '@/types/database'
import toast from 'react-hot-toast'

const initialDevice = {
  tipo: 'seminovo' as DeviceSaleType,
  marca: 'Apple',
  modelo: '',
  cor: '',
  armazenamento: '',
  memoria_ram: '',
  imei1: '',
  imei2: '',
  serial: '',
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
    addSaleDevice, addDeviceSale, cancelDeviceSale, addAuditLog,
  } = useStore()
  const [tab, setTab] = useState<'estoque' | 'vendas'>('estoque')
  const [deviceForm, setDeviceForm] = useState(initialDevice)
  const [saleDeviceId, setSaleDeviceId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [payment, setPayment] = useState('Pix')
  const [discount, setDiscount] = useState('0')
  const [increase, setIncrease] = useState('0')
  const [installments, setInstallments] = useState('1')
  const [entryValue, setEntryValue] = useState('0')
  const [financePartner, setFinancePartner] = useState('')
  const [notes, setNotes] = useState('')

  const availableDevices = saleDevices.filter((device) => device.status === 'disponivel' || device.status === 'reservado')
  const selectedDevice = saleDevices.find((device) => device.id === saleDeviceId)
  const originalPrice = selectedDevice?.preco_venda || 0
  const finalPrice = Math.max(0, originalPrice - money(discount) + money(increase))

  const duplicateIds = useMemo(() => new Set(
    saleDevices.flatMap((device) => [device.imei1, device.imei2, device.serial].filter(Boolean) as string[]),
  ), [saleDevices])

  const setDevice = (key: keyof typeof initialDevice, value: string) => {
    setDeviceForm((current) => ({ ...current, [key]: value }))
  }

  const saveDevice = () => {
    if (!deviceForm.modelo.trim()) {
      toast.error('Informe o modelo do aparelho')
      return
    }
    const identifiers = [deviceForm.imei1, deviceForm.imei2, deviceForm.serial].map((v) => v.trim()).filter(Boolean)
    if (identifiers.some((id) => duplicateIds.has(id))) {
      toast.error('IMEI ou numero de serie ja cadastrado')
      return
    }
    const now = new Date().toISOString()
    const device: SaleDevice = {
      id: generateId(),
      tipo: deviceForm.tipo,
      marca: deviceForm.marca,
      modelo: deviceForm.modelo.trim(),
      cor: deviceForm.cor || null,
      armazenamento: deviceForm.armazenamento || null,
      memoria_ram: deviceForm.memoria_ram || null,
      imei1: deviceForm.imei1 || null,
      imei2: deviceForm.imei2 || null,
      serial: deviceForm.serial || null,
      custo_compra: money(deviceForm.custo_compra),
      preco_venda: money(deviceForm.preco_venda),
      supplier_id: deviceForm.fornecedor || null,
      data_compra: deviceForm.data_compra || null,
      condicao: deviceForm.condicao || null,
      acessorios: deviceForm.acessorios || null,
      garantia: deviceForm.garantia || null,
      observacoes: deviceForm.observacoes || null,
      status: 'disponivel',
      created_at: now,
      updated_at: now,
    }
    addSaleDevice(device)
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'cadastro_aparelho_venda',
      entity: 'sale_device',
      entity_id: device.id,
      new_values: device,
      created_at: now,
    })
    setDeviceForm(initialDevice)
    toast.success('Aparelho cadastrado')
  }

  const completeSale = () => {
    if (!selectedDevice || selectedDevice.status === 'vendido') {
      toast.error('Selecione um aparelho disponivel')
      return
    }
    const customer = customers.find((item) => item.id === customerId)
    if (!customer) {
      toast.error('Selecione um cliente')
      return
    }
    const now = new Date().toISOString()
    const sale: DeviceSale = {
      id: generateId(),
      numero: nextSaleNumber(),
      customer_id: customer.id,
      device_id: selectedDevice.id,
      seller_id: user?.id || 'local',
      sold_at: now,
      preco_original: originalPrice,
      desconto: money(discount),
      acrescimo: money(increase),
      valor_final: finalPrice,
      forma_pagamento: payment,
      parcelas: Number(installments) || 1,
      valor_entrada: money(entryValue),
      financeira: financePartner || null,
      observacoes: notes || null,
      fiscal: defaultFiscalDocument,
      customer,
      device: selectedDevice,
    }
    addDeviceSale(sale)
    addAuditLog({
      id: generateId(),
      user_id: user?.id,
      user_name: user?.nome,
      action: 'criacao_venda',
      entity: 'device_sale',
      entity_id: sale.id,
      new_values: sale,
      created_at: now,
    })
    toast.success('Venda concluida')
  }

  const cancelSale = (sale: DeviceSale) => {
    const reason = window.prompt('Justificativa do cancelamento')
    if (!reason) return
    const returnToStock = window.confirm('Devolver aparelho ao estoque?')
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
        <h1 className="text-xl font-bold tracking-tight">Vendas de Aparelhos</h1>
        <p className="text-xs text-gray-500 mt-1">Estoque, venda e recibos</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setTab('estoque')} className={`h-10 rounded-xl text-sm font-semibold ${tab === 'estoque' ? 'bg-brand' : 'bg-white/8'}`}>Estoque</button>
        <button onClick={() => setTab('vendas')} className={`h-10 rounded-xl text-sm font-semibold ${tab === 'vendas' ? 'bg-brand' : 'bg-white/8'}`}>Vendas</button>
      </div>

      {tab === 'estoque' ? (
        <div className="space-y-4">
          <Panel title="Cadastrar aparelho" icon={Plus}>
            <div className="grid gap-3">
              <select value={deviceForm.tipo} onChange={(e) => setDevice('tipo', e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
                <option value="novo">Novo</option>
                <option value="seminovo">Seminovo</option>
                <option value="usado">Usado</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select value={deviceForm.marca} onChange={(e) => setDevice('marca', e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
                  {MARCAS.map((marca) => <option key={marca}>{marca}</option>)}
                </select>
                <Field value={deviceForm.modelo} onChange={(v) => setDevice('modelo', v)} placeholder="Modelo" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field value={deviceForm.cor} onChange={(v) => setDevice('cor', v)} placeholder="Cor" />
                <Field value={deviceForm.armazenamento} onChange={(v) => setDevice('armazenamento', v)} placeholder="GB" />
                <Field value={deviceForm.memoria_ram} onChange={(v) => setDevice('memoria_ram', v)} placeholder="RAM" />
              </div>
              <Field value={deviceForm.imei1} onChange={(v) => setDevice('imei1', v)} placeholder="IMEI 1" />
              <Field value={deviceForm.imei2} onChange={(v) => setDevice('imei2', v)} placeholder="IMEI 2" />
              <Field value={deviceForm.serial} onChange={(v) => setDevice('serial', v)} placeholder="Numero de serie" />
              <div className="grid grid-cols-2 gap-3">
                <Field value={deviceForm.custo_compra} onChange={(v) => setDevice('custo_compra', v)} placeholder="Custo" />
                <Field value={deviceForm.preco_venda} onChange={(v) => setDevice('preco_venda', v)} placeholder="Venda" />
              </div>
              <select value={deviceForm.fornecedor} onChange={(e) => setDevice('fornecedor', e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
                <option value="">Fornecedor</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.nome}</option>)}
              </select>
              <Field value={deviceForm.garantia} onChange={(v) => setDevice('garantia', v)} placeholder="Garantia" />
              <Field value={deviceForm.observacoes} onChange={(v) => setDevice('observacoes', v)} placeholder="Observacoes" />
              <button onClick={saveDevice} className="h-12 rounded-xl bg-brand font-semibold">Salvar aparelho</button>
            </div>
          </Panel>
          <DeviceList devices={saleDevices} />
        </div>
      ) : (
        <div className="space-y-4">
          <Panel title="Registrar venda" icon={Receipt}>
            <div className="grid gap-3">
              <select value={saleDeviceId} onChange={(e) => setSaleDeviceId(e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
                <option value="">Aparelho disponivel</option>
                {availableDevices.map((device) => <option key={device.id} value={device.id}>{device.marca} {device.modelo} - {brl(device.preco_venda)}</option>)}
              </select>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm">
                <option value="">Cliente</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.nome}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <Field value={discount} onChange={setDiscount} placeholder="Desconto" />
                <Field value={increase} onChange={setIncrease} placeholder="Acrescimo" />
                <Field value={installments} onChange={setInstallments} placeholder="Parcelas" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field value={payment} onChange={setPayment} placeholder="Forma pgto" />
                <Field value={entryValue} onChange={setEntryValue} placeholder="Entrada" />
              </div>
              <Field value={financePartner} onChange={setFinancePartner} placeholder="Financeira/parceira" />
              <Field value={notes} onChange={setNotes} placeholder="Observacoes" />
              <div className="rounded-xl bg-white/5 p-3">
                <div className="text-xs text-gray-500">Valor final</div>
                <div className="text-2xl font-bold">{brl(finalPrice)}</div>
              </div>
              <button onClick={completeSale} className="h-12 rounded-xl bg-brand font-semibold">Concluir venda</button>
            </div>
          </Panel>
          <Panel title="Vendas realizadas" icon={Receipt}>
            <div className="space-y-2">
              {deviceSales.map((sale) => (
                <div key={sale.id} className="rounded-xl bg-white/5 border border-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{sale.numero} - {sale.customer?.nome}</div>
                      <div className="text-xs text-gray-500">{sale.device?.marca} {sale.device?.modelo} | {brl(sale.valor_final)}</div>
                      <div className="text-[11px] text-gray-600">Fiscal: {sale.fiscal.status}</div>
                    </div>
                    <button onClick={() => downloadSaleReceiptPdf(sale)} className="h-9 w-9 rounded-lg bg-white/8 flex items-center justify-center"><Printer size={15} /></button>
                    {!sale.cancelled_at && <button onClick={() => cancelSale(sale)} className="h-9 w-9 rounded-lg bg-red-500/10 text-red-300 flex items-center justify-center"><XCircle size={15} /></button>}
                  </div>
                  {sale.cancelled_at && <div className="text-xs text-red-300 mt-2">Cancelada: {sale.cancel_reason}</div>}
                </div>
              ))}
              {deviceSales.length === 0 && <div className="text-xs text-gray-500">Nenhuma venda registrada.</div>}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

function DeviceList({ devices }: { devices: SaleDevice[] }) {
  return (
    <Panel title="Aparelhos cadastrados" icon={Package}>
      <div className="space-y-2">
        {devices.map((device) => (
          <div key={device.id} className="rounded-xl bg-white/5 border border-white/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">{device.marca} {device.modelo}</div>
                <div className="text-xs text-gray-500">{device.imei1 || device.serial || 'Sem identificador'} | {brl(device.preco_venda)}</div>
              </div>
              <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-white/8">{device.status}</span>
            </div>
          </div>
        ))}
        {devices.length === 0 && <div className="text-xs text-gray-500">Nenhum aparelho cadastrado.</div>}
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

function Field({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 px-3 rounded-xl bg-surface-input border border-white/5 text-sm placeholder:text-gray-600" />
  )
}

function money(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.')) || 0
}
