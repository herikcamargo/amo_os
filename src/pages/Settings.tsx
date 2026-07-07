import { useNavigate } from 'react-router-dom'
import {
  User, Bell, Shield, Database, Smartphone, Palette,
  ChevronRight, LogOut, MessageSquare, Cloud, UsersRound, HardDrive, Tags, Package, Save,
  ClipboardList,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { can, roleLabel } from '@/lib/permissions'
import { generateId } from '@/lib/utils'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function Settings() {
  const navigate = useNavigate()
  const {
    user, isCloudConnected, signOut, settings, updateSettings, suppliers, addSupplier, updateSupplier, addAuditLog,
  } = useStore()
  const [terms, setTerms] = useState(settings)
  const [supplierName, setSupplierName] = useState('')
  const canManageUsers = can(user, 'manage_users')
  const canManageDb = can(user, 'manage_database')
  const canManageIntegrations = can(user, 'manage_integrations')

  const sistemaItems = [
    { icon: Bell, label: 'Notificações', sub: 'Lembretes e alertas', action: () => {}, show: true },
    {
      icon: ClipboardList, label: 'Configurações da OS',
      sub: 'Status, mensagens WhatsApp, impressão e textos',
      action: () => navigate('/ajustes/os'),
      show: can(user, 'manage_settings'),
    },
    {
      icon: UsersRound, label: 'Gerenciar usuários',
      sub: 'Criar e definir perfis',
      action: () => navigate('/usuarios'),
      show: canManageUsers,
    },
    {
      icon: Cloud, label: 'Conectar à nuvem',
      sub: isCloudConnected ? 'Conectado ao Supabase' : 'Modo local — clique para conectar',
      action: () => navigate('/conectar-nuvem'),
      show: canManageDb,
    },
    {
      icon: HardDrive, label: 'Google Drive',
      sub: 'Upload de fotos das OS',
      action: () => navigate('/google-drive'),
      show: canManageIntegrations,
    },
    {
      icon: Tags, label: 'Preços e orçamento',
      sub: 'Desconto, prazo e parcelas',
      action: () => navigate('/precos?config=1'),
      show: can(user, 'manage_settings'),
    },
    {
      icon: MessageSquare, label: 'WhatsApp',
      sub: 'Relatórios automáticos', action: () => {},
      show: canManageIntegrations,
    },
    {
      icon: Database, label: 'Banco de dados',
      sub: isCloudConnected ? 'Supabase ativo' : 'Local (localStorage)',
      action: () => navigate('/conectar-nuvem'),
      show: canManageDb,
    },
  ].filter((i) => i.show)

  const sections = [
    {
      title: 'Conta',
      items: [
        { icon: User, label: 'Perfil', sub: user?.nome || 'Usuário', action: () => {} },
        { icon: Shield, label: 'Permissões', sub: user ? roleLabel(user.role) : '', action: () => {} },
      ],
    },
    { title: 'Sistema', items: sistemaItems },
    {
      title: 'Aparência',
      items: [
        { icon: Palette, label: 'Tema', sub: 'Dark (padrão)', action: () => {} },
        { icon: Smartphone, label: 'Sobre o AMO OS', sub: 'v1.0.0', action: () => {} },
      ],
    },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const saveTerms = () => {
    updateSettings(terms)
    toast.success('Termos atualizados')
  }

  const saveSupplier = () => {
    if (!supplierName.trim()) {
      toast.error('Informe o nome do fornecedor')
      return
    }
    const now = new Date().toISOString()
    const supplier = {
      id: generateId(),
      nome: supplierName.trim(),
      status: 'ativo' as const,
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
    setSupplierName('')
    toast.success('Fornecedor cadastrado')
  }

  return (
    <div className="px-5 pt-3">
      <div className="pt-2 mb-6">
        <h1 className="text-xl font-bold tracking-tight">Ajustes</h1>
      </div>

      {/* User card */}
      <div className="bg-surface-card rounded-[18px] border border-white/5 p-4 mb-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
          <User size={22} className="text-brand" />
        </div>
        <div className="flex-1">
          <div className="font-bold">{user?.nome || 'Usuário'}</div>
          <div className="text-xs text-gray-500">{user?.email}</div>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-brand/15 text-brand">
          {user?.role}
        </span>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="mb-5">
          <div className="text-xs font-semibold text-gray-500 mb-2 px-1">
            {section.title}
          </div>
          <div className="bg-surface-card rounded-[18px] border border-white/5 divide-y divide-white/5">
            {section.items.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/5 transition-colors first:rounded-t-[18px] last:rounded-b-[18px]"
              >
                <item.icon size={18} className="text-gray-400" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[11px] text-gray-500">{item.sub}</div>
                </div>
                <ChevronRight size={16} className="text-gray-600" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {can(user, 'manage_settings') && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-gray-500 mb-2 px-1">Configuracao OS</div>
          <div className="bg-surface-card rounded-[18px] border border-white/5 p-4 space-y-3">
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Termos de servico da OS de entrada</span>
              <textarea value={terms.os_entry_terms || ''} onChange={(e) => setTerms((current) => ({ ...current, os_entry_terms: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-xl bg-surface-input border border-white/5 text-sm resize-none" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Termos de servico da OS de saida</span>
              <textarea value={terms.os_exit_terms || ''} onChange={(e) => setTerms((current) => ({ ...current, os_exit_terms: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-xl bg-surface-input border border-white/5 text-sm resize-none" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Termos de garantia da OS de saida</span>
              <textarea value={terms.warranty_terms} onChange={(e) => setTerms((current) => ({ ...current, warranty_terms: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-xl bg-surface-input border border-white/5 text-sm resize-none" />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-400 mb-1">Termos de venda de aparelho</span>
              <textarea value={terms.sale_terms} onChange={(e) => setTerms((current) => ({ ...current, sale_terms: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-xl bg-surface-input border border-white/5 text-sm resize-none" />
            </label>
            <button onClick={saveTerms} className="h-10 px-4 rounded-xl bg-brand font-semibold text-sm flex items-center gap-2">
              <Save size={15} /> Salvar termos
            </button>
          </div>
        </div>
      )}

      {can(user, 'manage_settings') && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-gray-500 mb-2 px-1">Fornecedores</div>
          <div className="bg-surface-card rounded-[18px] border border-white/5 p-4">
            <div className="grid grid-cols-[1fr_auto] gap-2 mb-3">
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nome do fornecedor" className="h-10 px-3 rounded-xl bg-surface-input border border-white/5 text-sm" />
              <button onClick={saveSupplier} className="h-10 px-3 rounded-xl bg-white/8 border border-white/10"><Package size={16} /></button>
            </div>
            <div className="space-y-2">
              {suppliers.map((supplier) => (
                <div key={supplier.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{supplier.nome}</div>
                    <div className="text-[11px] text-gray-500">{supplier.status}</div>
                  </div>
                  <button
                    onClick={() => updateSupplier(supplier.id, { status: supplier.status === 'ativo' ? 'inativo' : 'ativo' })}
                    className="text-xs px-2 py-1 rounded-lg bg-white/8"
                  >
                    {supplier.status === 'ativo' ? 'Inativar' : 'Ativar'}
                  </button>
                </div>
              ))}
              {suppliers.length === 0 && <div className="text-xs text-gray-500">Nenhum fornecedor cadastrado.</div>}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSignOut}
        className="w-full h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform mb-8"
      >
        <LogOut size={16} /> Sair da conta
      </button>

      <div className="text-center text-[11px] text-gray-600 pb-4">
        AMO OS v1.0.0 · AmoCelular · Araraquara/SP
      </div>
    </div>
  )
}
