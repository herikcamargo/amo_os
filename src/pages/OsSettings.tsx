import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Lock, Save, Building2, Clock3, MessageSquare,
  FileText, ShieldCheck, Printer, ListChecks,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { IconBtn } from '@/components/ui/IconBtn'
import { can } from '@/lib/permissions'
import { STATUS_CONFIG, STATUS_FLOW } from '@/lib/constants'
import {
  ALWAYS_ON_STATUSES, getOsConfig, saveOsConfig, type OsConfig,
} from '@/lib/os-config'
import type { OsStatus } from '@/types/database'
import toast from 'react-hot-toast'

const ALL_STATUSES: OsStatus[] = [...STATUS_FLOW, 'cancelado']

export function OsSettings() {
  const navigate = useNavigate()
  const { user, settings, updateSettings } = useStore()
  const [config, setConfig] = useState<OsConfig>(() => getOsConfig())
  const [entryTerms, setEntryTerms] = useState(settings.os_entry_terms || '')
  const [warrantyTerms, setWarrantyTerms] = useState(settings.warranty_terms || '')

  if (!can(user, 'manage_settings')) {
    return (
      <div className="px-5 md:px-0 pt-3 md:pt-8">
        <div className="flex items-center gap-3 pt-2 mb-6">
          <IconBtn onClick={() => navigate('/ajustes')}><ChevronLeft size={22} /></IconBtn>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex-1">Acesso restrito</h1>
        </div>
        <div className="bg-surface-card rounded-[20px] border border-red-500/20 p-8 text-center">
          <Lock size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Apenas administradores podem alterar as configuracoes da OS.</p>
        </div>
      </div>
    )
  }

  const set = (updates: Partial<OsConfig>) => setConfig((current) => ({ ...current, ...updates }))

  const toggleStatus = (status: OsStatus) => {
    if (ALWAYS_ON_STATUSES.includes(status)) {
      toast.error('Este status e obrigatorio no fluxo')
      return
    }
    set({
      enabledStatuses: config.enabledStatuses.includes(status)
        ? config.enabledStatuses.filter((s) => s !== status)
        : [...config.enabledStatuses, status],
    })
  }

  const handleSave = () => {
    saveOsConfig(config)
    updateSettings({ os_entry_terms: entryTerms, warranty_terms: warrantyTerms })
    toast.success('Configuracoes da OS salvas')
  }

  return (
    <div className="px-5 md:px-0 pt-3 md:pt-8 pb-28 lg:pb-10 max-w-[860px]">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <IconBtn onClick={() => navigate('/ajustes')}><ChevronLeft size={22} /></IconBtn>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Configuracoes da OS</h1>
          <p className="text-xs text-gray-400 mt-0.5">Status, mensagens, impressao e textos padrao</p>
        </div>
        <button
          onClick={handleSave}
          className="h-11 px-5 rounded-xl bg-brand font-semibold text-sm flex items-center gap-2 hover:bg-brand-dark transition-colors"
        >
          <Save size={16} /> Salvar
        </button>
      </div>

      <div className="space-y-4">
        {/* Empresa */}
        <Panel title="Informacoes da empresa (cabecalho e rodape da impressao)" icon={Building2}>
          <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
            <Field label="Nome da empresa" value={config.companyName} onChange={(v) => set({ companyName: v })} />
            <Field label="Telefone" value={config.companyPhone} onChange={(v) => set({ companyPhone: v })} />
          </div>
          <Field label="Endereco" value={config.companyAddress} onChange={(v) => set({ companyAddress: v })} />
          <Field label="Rodape da impressao" value={config.companyFooter} onChange={(v) => set({ companyFooter: v })} />
        </Panel>

        {/* Prazo */}
        <Panel title="Prazo padrao" icon={Clock3}>
          <label className="block">
            <span className="block text-sm text-gray-400 mb-1">Previsao de entrega (dias apos a entrada)</span>
            <input
              type="number"
              min={0}
              value={config.defaultDeadlineDays}
              onChange={(e) => set({ defaultDeadlineDays: Math.max(0, Number(e.target.value) || 0) })}
              className="h-11 w-32 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm"
            />
          </label>
        </Panel>

        {/* Status disponiveis */}
        <Panel title="Status disponiveis no fluxo" icon={ListChecks}>
          <p className="text-xs text-gray-500 mb-1">Recebido, Entregue e Cancelado sao obrigatorios.</p>
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map((status) => {
              const cfg = STATUS_CONFIG[status]
              const enabled = config.enabledStatuses.includes(status)
              const locked = ALWAYS_ON_STATUSES.includes(status)
              return (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                    enabled ? 'bg-white/8 border-white/15 text-white' : 'bg-white/[0.02] border-white/5 text-gray-500'
                  } ${locked ? 'opacity-80 cursor-not-allowed' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: enabled ? cfg.dot : '#555' }} />
                  {cfg.label}
                  {locked && <Lock size={10} className="text-gray-500" />}
                </button>
              )
            })}
          </div>
        </Panel>

        {/* Mensagens WhatsApp */}
        <Panel title="Mensagem de WhatsApp por status" icon={MessageSquare}>
          <p className="text-xs text-gray-500 mb-1">
            Placeholders: <code className="text-gray-300">{'{cliente}'}</code> <code className="text-gray-300">{'{numero}'}</code> <code className="text-gray-300">{'{aparelho}'}</code> <code className="text-gray-300">{'{loja}'}</code>
          </p>
          <div className="space-y-3">
            {ALL_STATUSES.map((status) => (
              <label key={status} className="block">
                <span className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_CONFIG[status].dot }} />
                  {STATUS_CONFIG[status].label}
                </span>
                <textarea
                  value={config.whatsappMessages[status] || ''}
                  onChange={(e) => set({ whatsappMessages: { ...config.whatsappMessages, [status]: e.target.value } })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm resize-none"
                />
              </label>
            ))}
          </div>
        </Panel>

        {/* Condicoes de servico */}
        <Panel title="Condicoes de servico (impressas na OS de entrada)" icon={FileText}>
          <textarea
            value={entryTerms}
            onChange={(e) => setEntryTerms(e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm resize-none"
          />
        </Panel>

        {/* Garantia */}
        <Panel title="Texto de garantia" icon={ShieldCheck}>
          <textarea
            value={warrantyTerms}
            onChange={(e) => setWarrantyTerms(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm resize-none"
          />
        </Panel>

        {/* Impressao */}
        <Panel title="Impressao" icon={Printer}>
          <ToggleRow
            label="Imprimir 2 vias na entrada (cliente + assistencia)"
            checked={config.printTwoVias}
            onChange={(v) => set({ printTwoVias: v })}
          />
          <ToggleRow
            label="Mostrar valores na impressao da OS"
            checked={config.printShowValues}
            onChange={(v) => set({ printShowValues: v })}
          />
        </Panel>

        <button
          onClick={handleSave}
          className="w-full h-12 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors"
        >
          <Save size={16} /> Salvar configuracoes
        </button>
      </div>
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Save; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card rounded-[18px] border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} className="text-brand" />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-400 mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm"
      />
    </label>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-1 text-left"
    >
      <span className="text-sm text-gray-300">{label}</span>
      <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-brand' : 'bg-white/10'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </span>
    </button>
  )
}
