import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Cloud, CloudOff, CheckCircle2, ExternalLink,
  Copy, Database, Sparkles, AlertTriangle,
} from 'lucide-react'
import { IconBtn } from '@/components/ui/IconBtn'
import { CardBox } from '@/components/ui/CardBox'
import { useStore } from '@/store/useStore'
import toast from 'react-hot-toast'

export function CloudSetup() {
  const navigate = useNavigate()
  const { isCloudConnected } = useStore()
  const [step, setStep] = useState(1)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado!`)
  }

  return (
    <div className="px-5 md:px-0 pt-3 md:pt-8 pb-8">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <IconBtn onClick={() => navigate(-1)}><ChevronLeft size={22} /></IconBtn>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight flex-1">Conectar à nuvem</h1>
      </div>

      {/* Status atual */}
      <div className={`rounded-[18px] border p-4 mb-5 ${
        isCloudConnected
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-yellow-500/10 border-yellow-500/30'
      }`}>
        <div className="flex items-start gap-3">
          {isCloudConnected ? (
            <Cloud size={20} className="text-green-400 shrink-0 mt-0.5" />
          ) : (
            <CloudOff size={20} className="text-yellow-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className={`font-bold text-sm ${isCloudConnected ? 'text-green-300' : 'text-yellow-300'}`}>
              {isCloudConnected ? 'Conectado à nuvem' : 'Rodando em modo local'}
            </div>
            <div className="text-xs text-gray-400 mt-1 leading-relaxed">
              {isCloudConnected
                ? 'Seus dados estão sendo salvos no Supabase. Funciona em qualquer dispositivo.'
                : 'Seus dados estão salvos só neste navegador. Para acessar de qualquer lugar, conecte ao Supabase abaixo.'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Por que conectar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Benefit icon={Cloud} title="Acesso multi-dispositivo" desc="Use no PC, celular e tablet com os mesmos dados" />
        <Benefit icon={Database} title="Dados seguros" desc="Backup automático em nuvem profissional" />
        <Benefit icon={Sparkles} title="Lembretes ativos" desc="WhatsApp automático e notificações" />
      </div>

      {/* Passo a passo */}
      <CardBox title="Como conectar — passo a passo" icon={CheckCircle2}>
        <div className="space-y-4">
          {/* Step 1 */}
          <Step
            number={1}
            active={step === 1}
            onClick={() => setStep(1)}
            title="Criar projeto no Supabase"
          >
            <p className="text-sm text-gray-400 mb-3">
              Acesse o site do Supabase, crie uma conta (grátis) e um novo projeto.
            </p>
            <a
              href="https://supabase.com/dashboard/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand text-sm font-semibold hover:scale-105 active:scale-95 transition-all"
            >
              Abrir Supabase <ExternalLink size={14} />
            </a>
            <div className="mt-3 text-[11px] text-gray-500">
              ⚡ Recomendado: região "South America (São Paulo)" para melhor velocidade
            </div>
          </Step>

          {/* Step 2 */}
          <Step
            number={2}
            active={step === 2}
            onClick={() => setStep(2)}
            title="Rodar a migration SQL"
          >
            <p className="text-sm text-gray-400 mb-3">
              No painel do Supabase, vá em <b>SQL Editor</b> e cole o SQL abaixo.
              Ele cria todas as tabelas necessárias.
            </p>
            <button
              onClick={() => copyToClipboard(
                'Veja o arquivo supabase/migrations/001_initial.sql no repositório',
                'Caminho do SQL'
              )}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/15 active:scale-95 transition-all"
            >
              <Copy size={14} /> Copiar caminho do SQL
            </button>
            <div className="mt-3 text-[11px] text-gray-500">
              📄 Arquivo: <code className="text-gray-300">supabase/migrations/001_initial.sql</code>
            </div>
          </Step>

          {/* Step 3 */}
          <Step
            number={3}
            active={step === 3}
            onClick={() => setStep(3)}
            title="Copiar credenciais"
          >
            <p className="text-sm text-gray-400 mb-3">
              No painel do Supabase, vá em <b>Project Settings → API</b> e copie:
            </p>
            <ul className="text-sm text-gray-300 space-y-1.5 mb-3 ml-4 list-disc">
              <li><b>Project URL</b></li>
              <li><b>anon public</b> (a chave pública)</li>
            </ul>
          </Step>

          {/* Step 4 */}
          <Step
            number={4}
            active={step === 4}
            onClick={() => setStep(4)}
            title="Adicionar na Vercel"
          >
            <p className="text-sm text-gray-400 mb-3">
              No painel da Vercel, vá em <b>Settings → Environment Variables</b> e adicione:
            </p>
            <div className="space-y-2">
              <CodeRow
                label="VITE_SUPABASE_URL"
                value="https://seu-projeto.supabase.co"
                onCopy={() => copyToClipboard('VITE_SUPABASE_URL', 'Nome da variável')}
              />
              <CodeRow
                label="VITE_SUPABASE_ANON_KEY"
                value="eyJhbGc..."
                onCopy={() => copyToClipboard('VITE_SUPABASE_ANON_KEY', 'Nome da variável')}
              />
            </div>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 h-10 px-4 mt-3 rounded-xl bg-brand text-sm font-semibold hover:scale-105 active:scale-95 transition-all"
            >
              Abrir Vercel <ExternalLink size={14} />
            </a>
          </Step>

          {/* Step 5 */}
          <Step
            number={5}
            active={step === 5}
            onClick={() => setStep(5)}
            title="Fazer redeploy"
          >
            <p className="text-sm text-gray-400 mb-3">
              Na Vercel, vá em <b>Deployments</b>, clique nos três pontinhos do último deploy
              e escolha <b>Redeploy</b>. Pronto, vai estar conectado!
            </p>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-2 items-start mt-2">
              <AlertTriangle size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200">
                Dica: depois de conectar, importe seus dados do FPQ System usando a tela <b>Importar dados</b> em Ajustes.
              </div>
            </div>
          </Step>
        </div>
      </CardBox>
    </div>
  )
}

function Benefit({ icon: Icon, title, desc }: { icon: typeof Cloud; title: string; desc: string }) {
  return (
    <div className="bg-surface-card rounded-[16px] border border-white/5 p-4 hover:border-brand/30 hover:-translate-y-0.5 transition-all">
      <Icon size={20} className="text-brand mb-2" />
      <div className="font-bold text-sm">{title}</div>
      <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">{desc}</div>
    </div>
  )
}

function Step({
  number, active, onClick, title, children,
}: { number: number; active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${
      active ? 'border-brand/40 bg-brand/[0.03]' : 'border-white/5 bg-white/[0.02]'
    }`}>
      <button onClick={onClick} className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/[0.02]">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          active ? 'bg-brand text-white' : 'bg-white/10 text-gray-400'
        }`}>{number}</div>
        <span className="font-semibold text-sm flex-1">{title}</span>
      </button>
      {active && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}

function CodeRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-surface-input border border-white/5 rounded-xl px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gray-500 font-mono">{label}</div>
        <div className="text-xs text-gray-300 font-mono truncate">{value}</div>
      </div>
      <button onClick={onCopy} className="text-gray-400 hover:text-brand transition-colors shrink-0">
        <Copy size={14} />
      </button>
    </div>
  )
}
