import { useNavigate } from 'react-router-dom'
import {
  User, Bell, Shield, Database, Smartphone, Palette,
  ChevronRight, LogOut, Info, MessageSquare,
} from 'lucide-react'
import { useStore } from '@/store/useStore'

export function Settings() {
  const { user } = useStore()

  const sections = [
    {
      title: 'Conta',
      items: [
        { icon: User, label: 'Perfil', sub: user?.nome || 'Usuário', action: () => {} },
        { icon: Shield, label: 'Permissões', sub: user?.role === 'admin' ? 'Administrador' : user?.role === 'tecnico' ? 'Técnico' : 'Atendente', action: () => {} },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { icon: Bell, label: 'Notificações', sub: 'Lembretes e alertas', action: () => {} },
        { icon: MessageSquare, label: 'WhatsApp', sub: 'Relatórios automáticos', action: () => {} },
        { icon: Database, label: 'Banco de dados', sub: 'Supabase', action: () => {} },
      ],
    },
    {
      title: 'Aparência',
      items: [
        { icon: Palette, label: 'Tema', sub: 'Dark (padrão)', action: () => {} },
        { icon: Smartphone, label: 'Sobre o AMO OS', sub: 'v1.0.0', action: () => {} },
      ],
    },
  ]

  return (
    <div className="px-5 pt-3">
      <div className="pt-2 mb-6">
        <h1 className="text-xl font-bold tracking-tight">Ajustes</h1>
      </div>

      {/* User card */}
      <div className="bg-surface-card rounded-[18px] border border-white/5 p-4 mb-5 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-brand/20 flex items-center justify-center">
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
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-1">
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

      <button className="w-full h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform mb-8">
        <LogOut size={16} /> Sair da conta
      </button>

      <div className="text-center text-[11px] text-gray-600 pb-4">
        AMO OS v1.0.0 · AmoCelular · Araraquara/SP
      </div>
    </div>
  )
}
