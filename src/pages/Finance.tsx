import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, Landmark, Pencil, Plus,
  Search, Trash2, WalletCards, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { can } from '@/lib/permissions'
import { financialTransactionsAdapter, isSupabaseEnabled } from '@/lib/storage-adapter'
import type { FinancialTransaction, FinancialTransactionType } from '@/types/database'

const LOCAL_KEY = 'amo-os-financial-transactions'
const ENTRY_CATEGORIES = ['Venda aparelho', 'Venda acessório', 'Assistência técnica', 'Recebimento', 'Outros']
const EXIT_CATEGORIES = ['Fornecedor', 'Peças', 'Aluguel', 'Internet', 'Energia', 'Água', 'Funcionários', 'Marketing', 'Impostos', 'Retirada', 'Combustível', 'Outros']
const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Outro']
const ACCOUNTS = ['Caixa da loja', 'Conta bancária', 'Carteira digital']

type Period = 'todos' | 'hoje' | 'semana' | 'mes'
type FormState = {
  type: FinancialTransactionType
  category: string
  description: string
  amount: string
  payment_method: string
  account: string
  transaction_date: string
  notes: string
}

export function Finance() {
  const user = useStore((state) => state.user)
  const [items, setItems] = useState<FinancialTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialTransaction | null>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'todos' | FinancialTransactionType>('todos')
  const [period, setPeriod] = useState<Period>('todos')
  const [category, setCategory] = useState('')
  const [account, setAccount] = useState('')

  useEffect(() => {
    void loadTransactions()
  }, [])

  const loadTransactions = async () => {
    setLoading(true)
    try {
      const data = isSupabaseEnabled
        ? await financialTransactionsAdapter.list()
        : JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as FinancialTransaction[]
      setItems(data)
    } catch {
      toast.error('Não foi possível carregar o caixa')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => items.filter((item) => {
    const clean = query.trim().toLocaleLowerCase('pt-BR')
    if (type !== 'todos' && item.type !== type) return false
    if (category && item.category !== category) return false
    if (account && item.account !== account) return false
    if (clean && !`${item.description} ${item.category} ${item.payment_method}`.toLocaleLowerCase('pt-BR').includes(clean)) return false
    return inPeriod(item.transaction_date, period)
  }), [account, category, items, period, query, type])

  const todayItems = useMemo(() => items.filter((item) => inPeriod(item.transaction_date, 'hoje')), [items])
  const entriesToday = sum(todayItems.filter((item) => item.type === 'entrada'))
  const exitsToday = sum(todayItems.filter((item) => item.type === 'saida'))
  const balance = sum(items.filter((item) => item.type === 'entrada')) - sum(items.filter((item) => item.type === 'saida'))
  const categories = Array.from(new Set(items.map((item) => item.category))).sort()
  const accounts = Array.from(new Set([...ACCOUNTS, ...items.map((item) => item.account)])).sort()

  if (!can(user, 'view_financial')) {
    return <div className="px-5 pt-12 text-sm text-gray-400">Acesso restrito ao administrador.</div>
  }

  const startCreate = () => {
    setEditing(null)
    setOpen(true)
  }

  const remove = async (item: FinancialTransaction) => {
    if (!confirm(`Excluir "${item.description}" do caixa?`)) return
    try {
      if (isSupabaseEnabled) await financialTransactionsAdapter.delete(item.id)
      const next = items.filter((entry) => entry.id !== item.id)
      setItems(next)
      if (!isSupabaseEnabled) localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      toast.success('Movimentação excluída')
    } catch {
      toast.error('Não foi possível excluir')
    }
  }

  return (
    <div className="px-4 md:px-0 pt-5 md:pt-8 pb-8">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Financeiro / Caixa</h1>
          <p className="text-xs text-gray-500 mt-1">Controle de entradas e saídas</p>
        </div>
        <button onClick={startCreate} className="hidden md:flex h-10 px-4 rounded-[10px] bg-brand hover:bg-brand-dark items-center gap-2 text-sm font-semibold">
          <Plus size={16} /> Nova movimentação
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <SummaryCard label="Saldo atual" value={money(balance)} icon={WalletCards} />
        <SummaryCard label="Entradas do dia" value={money(entriesToday)} icon={ArrowDownLeft} tone="text-emerald-400" />
        <SummaryCard label="Saídas do dia" value={money(exitsToday)} icon={ArrowUpRight} tone="text-red-400" />
      </div>

      <div className="bg-surface-card border border-white/6 rounded-[12px] overflow-hidden">
        <div className="p-3 border-b border-white/6 space-y-3">
          <div className="grid md:grid-cols-[minmax(240px,1fr)_auto_auto] gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar descrição..." className="w-full h-10 pl-9 pr-3 rounded-[10px] bg-surface-input border border-white/6 outline-none focus:border-brand text-sm" />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 px-3 rounded-[10px] bg-surface-input border border-white/6 text-sm outline-none">
              <option value="">Todas as categorias</option>
              {categories.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="h-10 px-3 rounded-[10px] bg-surface-input border border-white/6 text-sm outline-none">
              <option value="">Todas as contas</option>
              {accounts.map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {([
              ['todos', 'Todos'], ['entrada', 'Entradas'], ['saida', 'Saídas'],
            ] as const).map(([value, label]) => (
              <FilterChip key={value} active={type === value} onClick={() => setType(value)}>{label}</FilterChip>
            ))}
            <span className="w-px bg-white/8 mx-1 shrink-0" />
            {([
              ['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'],
            ] as const).map(([value, label]) => (
              <FilterChip key={value} active={period === value} onClick={() => setPeriod(period === value ? 'todos' : value)}>{label}</FilterChip>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {loading ? (
            <Empty text="Carregando movimentações..." />
          ) : filtered.length === 0 ? (
            <Empty text="Nenhuma movimentação encontrada." />
          ) : filtered.map((item) => (
            <TransactionRow
              key={item.id}
              item={item}
              onEdit={() => { setEditing(item); setOpen(true) }}
              onDelete={() => void remove(item)}
            />
          ))}
        </div>
      </div>

      <button onClick={startCreate} title="Nova movimentação" className="md:hidden fixed right-5 bottom-24 z-40 w-14 h-14 rounded-full bg-brand shadow-lg shadow-brand/30 flex items-center justify-center">
        <Plus size={25} />
      </button>

      {open && (
        <TransactionForm
          item={editing}
          userId={user?.id || ''}
          onClose={() => setOpen(false)}
          onSaved={(saved) => {
            const next = editing
              ? items.map((item) => item.id === saved.id ? saved : item)
              : [saved, ...items]
            setItems(next)
            if (!isSupabaseEnabled) localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, tone = 'text-white' }: {
  label: string
  value: string
  icon: typeof Landmark
  tone?: string
}) {
  return (
    <div className="bg-surface-card border border-white/6 rounded-[12px] p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className={`text-xl font-bold tabular-nums mt-1 ${tone}`}>{value}</div>
      </div>
      <div className={`w-9 h-9 rounded-[10px] bg-white/5 flex items-center justify-center shrink-0 ${tone}`}><Icon size={17} /></div>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button onClick={onClick} className={`h-8 px-3 rounded-lg text-xs font-medium shrink-0 ${active ? 'bg-brand text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>{children}</button>
}

function TransactionRow({ item, onEdit, onDelete }: { item: FinancialTransaction; onEdit: () => void; onDelete: () => void }) {
  const entry = item.type === 'entrada'
  const Icon = entry ? ArrowDownLeft : ArrowUpRight
  return (
    <div className="p-3 md:p-4 flex items-center gap-3 hover:bg-white/[0.02]">
      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${entry ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}><Icon size={18} /></div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{item.description}</div>
        <div className="text-[11px] text-gray-500 truncate mt-0.5">{item.category} · {item.payment_method} · {formatDate(item.transaction_date)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-bold text-sm tabular-nums ${entry ? 'text-emerald-400' : 'text-red-400'}`}>{entry ? '+' : '-'} {money(item.amount)}</div>
        <div className="text-[10px] text-gray-500 capitalize mt-0.5">{item.type}</div>
      </div>
      <div className="hidden sm:flex gap-1 shrink-0">
        <button onClick={onEdit} title="Editar" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"><Pencil size={14} /></button>
        <button onClick={onDelete} title="Excluir" className="w-9 h-9 rounded-lg bg-red-500/8 hover:bg-red-500/15 text-red-400 flex items-center justify-center"><Trash2 size={14} /></button>
      </div>
      <div className="sm:hidden flex gap-1">
        <button onClick={onEdit} title="Editar" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center"><Pencil size={13} /></button>
        <button onClick={onDelete} title="Excluir" className="w-8 h-8 rounded-lg bg-red-500/8 text-red-400 flex items-center justify-center"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

function TransactionForm({ item, userId, onClose, onSaved }: {
  item: FinancialTransaction | null
  userId: string
  onClose: () => void
  onSaved: (item: FinancialTransaction) => void
}) {
  const [form, setForm] = useState<FormState>(() => item ? toForm(item) : emptyForm())
  const [saving, setSaving] = useState(false)
  const categories = form.type === 'entrada' ? ENTRY_CATEGORIES : EXIT_CATEGORIES
  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    const amount = Number(form.amount.replace(',', '.'))
    if (!form.category || !form.description.trim() || !amount || !form.payment_method || !form.account || !form.transaction_date) {
      toast.error('Preencha os campos obrigatórios')
      return
    }
    setSaving(true)
    try {
      const payload = {
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        amount,
        payment_method: form.payment_method,
        account: form.account,
        transaction_date: new Date(form.transaction_date).toISOString(),
        notes: form.notes.trim() || null,
        created_by: userId,
      }
      const saved = isSupabaseEnabled
        ? item
          ? await financialTransactionsAdapter.update(item.id, payload)
          : await financialTransactionsAdapter.create(payload)
        : {
            ...payload,
            id: item?.id || crypto.randomUUID(),
            created_at: item?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as FinancialTransaction
      onSaved(saved)
      toast.success(item ? 'Movimentação atualizada' : 'Movimentação registrada')
    } catch {
      toast.error('Não foi possível salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-stretch md:justify-end" onClick={onClose}>
      <div className="w-full md:w-[420px] max-h-[92vh] md:max-h-none overflow-y-auto bg-surface-elevated border border-white/10 rounded-t-[18px] md:rounded-none p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold">{item ? 'Editar movimentação' : 'Nova movimentação'}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <TypeButton active={form.type === 'entrada'} onClick={() => setForm((current) => ({ ...current, type: 'entrada', category: '' }))} type="entrada" />
          <TypeButton active={form.type === 'saida'} onClick={() => setForm((current) => ({ ...current, type: 'saida', category: '' }))} type="saida" />
        </div>
        <div className="space-y-3">
          <SelectField label="Categoria" value={form.category} onChange={(value) => set('category', value)} options={categories} />
          <TextField label="Descrição" value={form.description} onChange={(value) => set('description', value)} placeholder="Ex: Venda iPhone 11" />
          <TextField label="Valor" value={form.amount} onChange={(value) => set('amount', value)} type="number" placeholder="R$ 0,00" />
          <SelectField label="Forma de pagamento" value={form.payment_method} onChange={(value) => set('payment_method', value)} options={PAYMENT_METHODS} />
          <SelectField label="Conta" value={form.account} onChange={(value) => set('account', value)} options={ACCOUNTS} />
          <TextField label="Data" value={form.transaction_date} onChange={(value) => set('transaction_date', value)} type="datetime-local" />
          <label className="block">
            <span className="block text-xs text-gray-400 mb-1.5">Observação (opcional)</span>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className="w-full px-3 py-2.5 rounded-[10px] bg-surface-input border border-white/6 outline-none focus:border-brand text-sm resize-none" />
          </label>
          <button onClick={() => void save()} disabled={saving} className="w-full h-11 rounded-[10px] bg-brand hover:bg-brand-dark font-semibold text-sm disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
          {item && <button onClick={onClose} className="w-full h-10 text-sm text-gray-400">Cancelar</button>}
        </div>
      </div>
    </div>
  )
}

function TypeButton({ active, onClick, type }: { active: boolean; onClick: () => void; type: FinancialTransactionType }) {
  const entry = type === 'entrada'
  return <button onClick={onClick} className={`h-11 rounded-[10px] border text-sm font-semibold flex items-center justify-center gap-2 ${active ? entry ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-white/4 border-white/6 text-gray-500'}`}>{entry ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}{entry ? 'Entrada' : 'Saída'}</button>
}

function TextField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className="block text-xs text-gray-400 mb-1.5">{label}</span><input type={type} step={type === 'number' ? '0.01' : undefined} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full h-10 px-3 rounded-[10px] bg-surface-input border border-white/6 outline-none focus:border-brand text-sm" /></label>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="block text-xs text-gray-400 mb-1.5">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-10 px-3 rounded-[10px] bg-surface-input border border-white/6 outline-none focus:border-brand text-sm"><option value="">Selecione</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}

function Empty({ text }: { text: string }) {
  return <div className="py-14 text-center text-sm text-gray-500">{text}</div>
}

function emptyForm(): FormState {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return { type: 'entrada', category: '', description: '', amount: '', payment_method: '', account: '', transaction_date: now.toISOString().slice(0, 16), notes: '' }
}

function toForm(item: FinancialTransaction): FormState {
  const date = new Date(item.transaction_date)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return { type: item.type, category: item.category, description: item.description, amount: String(item.amount), payment_method: item.payment_method, account: item.account, transaction_date: date.toISOString().slice(0, 16), notes: item.notes || '' }
}

function inPeriod(value: string, period: Period) {
  if (period === 'todos') return true
  const date = new Date(value)
  const now = new Date()
  if (period === 'hoje') return date.toDateString() === now.toDateString()
  if (period === 'mes') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  return date >= start && date <= now
}

function sum(items: FinancialTransaction[]) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0)
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
