import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, Phone, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'

export function Clients() {
  const navigate = useNavigate()
  const { orders } = useStore()
  const [q, setQ] = useState('')

  const clients = useMemo(() => {
    const map = new Map<string, { nome: string; telefone: string; cpf?: string | null; orderCount: number; lastOrder?: string }>()
    orders.forEach((o) => {
      if (!o.customer) return
      const key = o.customer.telefone
      const existing = map.get(key)
      if (existing) {
        existing.orderCount++
      } else {
        map.set(key, {
          nome: o.customer.nome,
          telefone: o.customer.telefone,
          cpf: o.customer.cpf,
          orderCount: 1,
          lastOrder: o.numero,
        })
      }
    })
    const list = Array.from(map.values())
    if (!q.trim()) return list
    const t = q.trim().toLowerCase()
    return list.filter((c) => [c.nome, c.telefone, c.cpf || ''].join(' ').toLowerCase().includes(t))
  }, [orders, q])

  return (
    <div className="px-5 pt-3">
      <div className="pt-2 mb-4">
        <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
        <p className="text-xs text-gray-500 mt-1">{clients.length} clientes registrados</p>
      </div>

      <div className="relative mb-4">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, telefone ou CPF..."
          className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
        />
      </div>

      <div className="space-y-2">
        {clients.map((c) => (
          <div
            key={c.telefone}
            className="bg-surface-card rounded-[16px] border border-white/5 p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
              <User size={18} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{c.nome}</div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                <Phone size={11} /> {c.telefone}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-gray-500">{c.orderCount} OS</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
