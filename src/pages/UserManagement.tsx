import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, UsersRound, Plus, Shield, Edit2, Trash2,
  Mail, Phone, X, Check, Lock,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { can, normalizeRole, roleLabel, roleColor, roleDescription } from '@/lib/permissions'
import { isSupabaseEnabled, usersAdapter } from '@/lib/storage-adapter'
import type { AppUser, UserRole } from '@/types/database'
import toast from 'react-hot-toast'

interface UserFormData extends Partial<AppUser> {
  password?: string
}

export function UserManagement() {
  const navigate = useNavigate()
  const { user, users, setUsers, addUser, updateUser, removeUser } = useStore()
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!can(user, 'manage_users') || !isSupabaseEnabled) return

    setLoading(true)
    usersAdapter.list()
      .then(setUsers)
      .catch((err) => {
        console.error('Falha ao carregar usuarios:', err)
        toast.error('Nao consegui carregar os usuarios')
      })
      .finally(() => setLoading(false))
  }, [setUsers, user])

  if (!can(user, 'manage_users')) {
    return (
      <div className="px-5 md:px-0 pt-3 md:pt-8">
        <div className="flex items-center gap-3 pt-2 mb-6">
          <IconBtn onClick={() => navigate('/ajustes')}><ChevronLeft size={22} /></IconBtn>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex-1">Acesso restrito</h1>
        </div>
        <div className="bg-surface-card rounded-[20px] border border-red-500/20 p-8 text-center">
          <Lock size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Apenas administradores podem gerenciar usuarios.</p>
        </div>
      </div>
    )
  }

  const handleDelete = async (id: string, nome: string) => {
    if (id === user?.id) {
      toast.error('Voce nao pode excluir a si mesmo')
      return
    }

    if (!confirm(`Excluir o usuario "${nome}"? Esta acao nao pode ser desfeita.`)) return

    try {
      if (isSupabaseEnabled) await usersAdapter.delete(id)
      removeUser(id)
      toast.success(`Usuario ${nome} removido`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Nao consegui excluir: ${message}`)
    }
  }

  const handleToggleActive = async (u: AppUser) => {
    if (u.id === user?.id) {
      toast.error('Voce nao pode desativar a si mesmo')
      return
    }

    try {
      const updates = { ativo: !u.ativo }
      const saved = isSupabaseEnabled ? await usersAdapter.update(u.id, updates) : { ...u, ...updates }
      updateUser(u.id, saved)
      toast.success(u.ativo ? `${u.nome} desativado` : `${u.nome} ativado`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Nao consegui atualizar: ${message}`)
    }
  }

  const handleSave = async (data: UserFormData) => {
    try {
      if (editing) {
        const saved = isSupabaseEnabled ? await usersAdapter.update(editing.id, data) : { ...editing, ...data }
        updateUser(editing.id, saved)
        toast.success('Usuario atualizado')
      } else {
        if (isSupabaseEnabled && !data.password) {
          toast.error('Senha inicial obrigatoria')
          return
        }

        const newUser = isSupabaseEnabled
          ? await usersAdapter.create({
            nome: data.nome || '',
            email: data.email || '',
            password: data.password || '',
            role: data.role || 'funcionario',
            telefone: data.telefone,
          })
          : {
            id: crypto.randomUUID(),
            nome: data.nome || '',
            email: data.email || '',
            role: data.role || 'funcionario',
            ativo: true,
            telefone: data.telefone,
            created_at: new Date().toISOString(),
          }

        addUser(newUser)
        toast.success('Usuario criado')
      }

      setEditing(null)
      setCreating(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Nao consegui salvar: ${message}`)
    }
  }

  return (
    <div className="px-5 md:px-0 pt-3 md:pt-8 pb-8">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <IconBtn onClick={() => navigate('/ajustes')}><ChevronLeft size={22} /></IconBtn>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {loading ? 'Carregando usuarios...' : `${users.length} usuario(s) cadastrado(s)`}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="h-11 px-4 rounded-xl bg-brand font-semibold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {(['admin', 'funcionario'] as UserRole[]).map((role) => (
          <div
            key={role}
            className="bg-surface-card rounded-[16px] border p-3"
            style={{ borderColor: roleColor(role) + '30' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Shield size={14} style={{ color: roleColor(role) }} />
              <span className="text-sm font-bold" style={{ color: roleColor(role) }}>
                {roleLabel(role)}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">{roleDescription(role)}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-card rounded-[20px] border border-white/5 divide-y divide-white/5">
        {users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isMe={u.id === user?.id}
            onEdit={() => setEditing(u)}
            onDelete={() => handleDelete(u.id, u.nome)}
            onToggle={() => handleToggleActive(u)}
          />
        ))}
      </div>

      {(editing || creating) && (
        <UserModal
          user={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function UserRow({ user, isMe, onEdit, onDelete, onToggle }: {
  user: AppUser
  isMe: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const color = roleColor(user.role)
  return (
    <div className={`flex items-center gap-3 p-4 ${!user.ativo ? 'opacity-50' : ''}`}>
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
        style={{ background: color + '22', color }}
      >
        {user.nome.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{user.nome}</span>
          {isMe && (
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-brand/20 text-brand">
              Voce
            </span>
          )}
          {!user.ativo && (
            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
              Inativo
            </span>
          )}
          <span
            className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
            style={{ background: color + '22', color }}
          >
            {roleLabel(user.role)}
          </span>
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1"><Mail size={11} /> {user.email}</span>
          {user.telefone && (
            <span className="flex items-center gap-1"><Phone size={11} /> {user.telefone}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggle}
          disabled={isMe}
          title={user.ativo ? 'Desativar' : 'Ativar'}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            user.ativo ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {user.ativo ? <Check size={14} /> : <X size={14} />}
        </button>
        <button
          onClick={onEdit}
          title="Editar"
          className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={onDelete}
          disabled={isMe}
          title="Excluir"
          className="w-9 h-9 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function UserModal({ user, onClose, onSave }: {
  user: AppUser | null
  onClose: () => void
  onSave: (data: UserFormData) => void | Promise<void>
}) {
  const [nome, setNome] = useState(user?.nome || '')
  const [email, setEmail] = useState(user?.email || '')
  const [telefone, setTelefone] = useState(user?.telefone || '')
  const [role, setRole] = useState<UserRole>(user ? normalizeRole(user.role) : 'funcionario')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!nome.trim() || !email.trim()) {
      toast.error('Nome e e-mail sao obrigatorios')
      return
    }
    if (!user && password.length < 6) {
      toast.error('A senha inicial precisa ter pelo menos 6 caracteres')
      return
    }

    setSaving(true)
    await onSave({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone.trim() || undefined,
      role,
      password: password || undefined,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="w-full max-w-[440px] bg-surface-elevated rounded-t-[24px] md:rounded-[24px] border-t md:border border-white/10 p-5 pb-8 md:pb-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4 md:hidden" />
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{user ? 'Editar usuario' : 'Novo usuario'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Nome *" value={nome} onChange={setNome} placeholder="Nome completo" />
          <Field label="E-mail *" value={email} onChange={setEmail} placeholder="usuario@amocelular.com" type="email" />
          <Field label="Telefone" value={telefone} onChange={setTelefone} placeholder="(16) 99999-9999 (opcional)" />
          {!user && (
            <Field label="Senha inicial *" value={password} onChange={setPassword} placeholder="Minimo 6 caracteres" type="password" />
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Perfil de acesso</label>
            <div className="space-y-2">
              {(['admin', 'funcionario'] as UserRole[]).map((r) => {
                const color = roleColor(r)
                const active = role === r
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      active ? 'bg-white/5' : 'bg-white/[0.02] hover:bg-white/[0.04]'
                    }`}
                    style={{ borderColor: active ? color : 'rgba(255,255,255,0.05)' }}
                  >
                    <Shield size={16} style={{ color }} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-sm" style={{ color }}>{roleLabel(r)}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        {roleDescription(r)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 hover:scale-[1.02] transition-all disabled:opacity-60"
          >
            <UsersRound size={16} /> {saving ? 'Salvando...' : user ? 'Salvar alteracoes' : 'Criar usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm"
      />
    </div>
  )
}
