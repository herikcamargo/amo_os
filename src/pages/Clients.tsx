import { useMemo, useState } from 'react'
import { Search, User, Phone, MapPin, Pencil, Plus, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { generateId } from '@/lib/utils'
import { isValidCep, lookupCep, maskCep } from '@/lib/cep'
import type { Customer } from '@/types/database'
import toast from 'react-hot-toast'

const emptyCustomer = {
  nome: '',
  telefone: '',
  cpf: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
}

export function Clients() {
  const { customers, orders, addCustomer, updateCustomer, user, addAuditLog } = useStore()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyCustomer)
  const [loadingCep, setLoadingCep] = useState(false)

  const clients = useMemo(() => {
    const fromOrders = orders.map((order) => order.customer).filter(Boolean) as Customer[]
    const map = new Map<string, Customer>()
    ;[...customers, ...fromOrders].forEach((customer) => map.set(customer.id, customer))
    const list = Array.from(map.values())
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter((c) => [
      c.nome, c.telefone, c.cpf, c.cep, c.logradouro, c.bairro, c.cidade, c.uf,
    ].filter(Boolean).join(' ').toLowerCase().includes(term))
  }, [customers, orders, q])

  const orderCount = (customer: Customer) => orders.filter((order) => (
    order.customer_id === customer.id || order.customer?.telefone === customer.telefone
  )).length

  const openForm = (customer?: Customer) => {
    setEditing(customer || null)
    setForm(customer ? {
      nome: customer.nome || '',
      telefone: customer.telefone || '',
      cpf: customer.cpf || '',
      cep: customer.cep || '',
      logradouro: customer.logradouro || '',
      numero: customer.numero || '',
      complemento: customer.complemento || '',
      bairro: customer.bairro || '',
      cidade: customer.cidade || '',
      uf: customer.uf || '',
    } : emptyCustomer)
  }

  const setField = (key: keyof typeof emptyCustomer, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleCepLookup = async () => {
    if (!form.cep || !isValidCep(form.cep)) {
      toast.error('Informe um CEP valido')
      return
    }
    setLoadingCep(true)
    try {
      const address = await lookupCep(form.cep)
      setForm((current) => ({
        ...current,
        cep: address.cep,
        logradouro: address.logradouro,
        bairro: address.bairro,
        cidade: address.cidade,
        uf: address.uf,
      }))
      addAuditLog({
        id: generateId(),
        user_id: user?.id,
        user_name: user?.nome,
        action: 'alteracao_endereco_cep',
        entity: 'customer',
        entity_id: editing?.id || 'novo',
        new_values: address,
        created_at: new Date().toISOString(),
      })
      toast.success('Endereco preenchido pelo CEP')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel consultar o CEP'
      toast.error(message)
    } finally {
      setLoadingCep(false)
    }
  }

  const save = () => {
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error('Nome e telefone sao obrigatorios')
      return
    }

    const data = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      cpf: form.cpf.trim() || null,
      cep: form.cep.trim() || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim().toUpperCase() || null,
    }

    if (editing) {
      updateCustomer(editing.id, data)
      addAuditLog({
        id: generateId(),
        user_id: user?.id,
        user_name: user?.nome,
        action: 'edicao_cliente',
        entity: 'customer',
        entity_id: editing.id,
        previous_values: editing,
        new_values: data,
        created_at: new Date().toISOString(),
      })
      toast.success('Cliente atualizado')
    } else {
      const customer: Customer = { id: generateId(), ...data, created_at: new Date().toISOString() }
      addCustomer(customer)
      addAuditLog({
        id: generateId(),
        user_id: user?.id,
        user_name: user?.nome,
        action: 'criacao_cliente',
        entity: 'customer',
        entity_id: customer.id,
        new_values: customer,
        created_at: new Date().toISOString(),
      })
      toast.success('Cliente cadastrado')
    }
    setEditing(null)
    setForm(emptyCustomer)
  }

  const formOpen = editing !== null || form !== emptyCustomer

  return (
    <div className="px-5 pt-3 pb-24">
      <div className="pt-2 mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
          <p className="text-xs text-gray-500 mt-1">{clients.length} clientes registrados</p>
        </div>
        <button onClick={() => openForm()} className="h-10 px-3 rounded-xl bg-brand font-semibold text-sm flex items-center gap-2">
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, telefone, CPF ou endereco..."
          className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
        />
      </div>

      <div className="space-y-2">
        {clients.map((c) => (
          <div key={c.id} className="bg-surface-card rounded-[16px] border border-white/5 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/15 flex items-center justify-center shrink-0">
              <User size={18} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{c.nome}</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5"><Phone size={11} /> {c.telefone}</div>
              {(c.logradouro || c.cidade) && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5 truncate">
                  <MapPin size={11} /> {[c.logradouro, c.numero, c.bairro, c.cidade, c.uf].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-500 mb-2">{orderCount(c)} OS</div>
              <button onClick={() => openForm(c)} className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center">
                <Pencil size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => { setEditing(null); setForm(emptyCustomer) }}>
          <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-surface-elevated rounded-t-[24px] border-t border-white/10 p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? 'Editar cliente' : 'Novo cliente'}</h2>
              <button onClick={() => { setEditing(null); setForm(emptyCustomer) }} className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="grid gap-3">
              <Field label="Nome *" value={form.nome} onChange={(v) => setField('nome', v)} />
              <Field label="Telefone *" value={form.telefone} onChange={(v) => setField('telefone', v)} />
              <Field label="CPF/CNPJ" value={form.cpf} onChange={(v) => setField('cpf', v)} />
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <Field label="CEP" value={form.cep} onChange={(v) => setField('cep', maskCep(v))} />
                <button onClick={handleCepLookup} disabled={loadingCep} className="h-11 px-4 rounded-xl bg-white/8 border border-white/10 text-sm font-semibold disabled:opacity-60">
                  {loadingCep ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              <Field label="Rua / logradouro" value={form.logradouro} onChange={(v) => setField('logradouro', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Numero" value={form.numero} onChange={(v) => setField('numero', v)} />
                <Field label="Complemento" value={form.complemento} onChange={(v) => setField('complemento', v)} />
              </div>
              <Field label="Bairro" value={form.bairro} onChange={(v) => setField('bairro', v)} />
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <Field label="Cidade" value={form.cidade} onChange={(v) => setField('cidade', v)} />
                <Field label="UF" value={form.uf} onChange={(v) => setField('uf', v.toUpperCase().slice(0, 2))} />
              </div>
              <button onClick={save} className="h-12 rounded-xl bg-brand font-semibold mt-2">
                Salvar cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-400 mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm"
      />
    </label>
  )
}
