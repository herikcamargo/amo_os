import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Cloud, CheckCircle2, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { IconBtn } from '@/components/ui/IconBtn'
import {
  authenticateGoogleDrive,
  clearDriveConfig,
  getDriveConfig,
  isDriveConfigured,
  saveDriveConfig,
} from '@/lib/google-drive'
import toast from 'react-hot-toast'

export function GoogleDriveSetup() {
  const navigate = useNavigate()
  const current = getDriveConfig()
  const [clientId, setClientId] = useState(current.clientId)
  const [apiKey, setApiKey] = useState(current.apiKey)
  const [folderId, setFolderId] = useState(current.folderId)
  const [connected, setConnected] = useState(isDriveConfigured())
  const [testing, setTesting] = useState(false)

  const save = () => {
    if (!clientId.trim() || !apiKey.trim() || !folderId.trim()) {
      toast.error('Preencha Client ID, API Key e ID da pasta')
      return
    }

    saveDriveConfig({
      clientId: clientId.trim(),
      apiKey: apiKey.trim(),
      folderId: folderId.trim(),
    })
    setConnected(true)
    toast.success('Google Drive configurado')
  }

  const test = async () => {
    save()
    setTesting(true)
    try {
      await authenticateGoogleDrive()
      toast.success('Conexao com Google Drive autorizada')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Nao consegui conectar: ${message}`)
    } finally {
      setTesting(false)
    }
  }

  const reset = () => {
    clearDriveConfig()
    setClientId('')
    setApiKey('')
    setFolderId('')
    setConnected(false)
    toast.success('Configuracao removida')
  }

  return (
    <div className="px-5 md:px-0 pt-3 md:pt-8 pb-8">
      <div className="flex items-center gap-3 pt-2 mb-6">
        <IconBtn onClick={() => navigate('/ajustes')}><ChevronLeft size={22} /></IconBtn>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Google Drive</h1>
          <p className="text-xs text-gray-500 mt-0.5">Upload automatico das fotos das OS</p>
        </div>
      </div>

      <div className={`rounded-[18px] border p-4 mb-5 ${
        connected ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
      }`}>
        <div className="flex items-start gap-3">
          <Cloud size={20} className={connected ? 'text-green-400' : 'text-yellow-400'} />
          <div>
            <div className={`font-bold text-sm ${connected ? 'text-green-300' : 'text-yellow-300'}`}>
              {connected ? 'Drive configurado' : 'Drive ainda nao configurado'}
            </div>
            <div className="text-xs text-gray-400 mt-1 leading-relaxed">
              As fotos sao enviadas para uma subpasta por OS e renomeadas como
              <span className="font-mono text-gray-300"> os_numero_01_frente.jpg</span>.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-card rounded-[18px] border border-white/5 p-4 space-y-4">
        <Field
          label="Google Client ID"
          value={clientId}
          onChange={setClientId}
          placeholder="000000000000-xxxx.apps.googleusercontent.com"
        />
        <Field
          label="Google API Key"
          value={apiKey}
          onChange={setApiKey}
          placeholder="AIza..."
        />
        <Field
          label="ID da pasta no Drive"
          value={folderId}
          onChange={setFolderId}
          placeholder="Cole o ID da pasta principal"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            onClick={save}
            className="h-11 rounded-xl bg-brand font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <CheckCircle2 size={16} /> Salvar
          </button>
          <button
            onClick={test}
            disabled={testing}
            className="h-11 rounded-xl bg-white/8 border border-white/10 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
          >
            <Cloud size={16} /> {testing ? 'Conectando...' : 'Testar conexao'}
          </button>
        </div>

        <button
          onClick={reset}
          className="w-full h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Trash2 size={15} /> Remover configuracao
        </button>
      </div>

      <div className="mt-5 bg-surface-card rounded-[18px] border border-white/5 p-4">
        <div className="text-sm font-bold mb-2">Onde pegar esses dados</div>
        <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
          <p>1. No Google Cloud, ative a API Google Drive e crie credenciais OAuth do tipo Web.</p>
          <p>2. Em Authorized JavaScript origins, adicione o dominio da Vercel.</p>
          <p>3. Crie uma pasta no Drive e copie o ID que aparece na URL.</p>
        </div>
        <div className="flex gap-2 mt-4">
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-3 rounded-xl bg-white/8 border border-white/10 text-sm flex items-center gap-2"
          >
            Google Cloud <ExternalLink size={14} />
          </a>
          <button
            onClick={() => navigator.clipboard.writeText(window.location.origin)}
            className="h-10 px-3 rounded-xl bg-white/8 border border-white/10 text-sm flex items-center gap-2"
          >
            Copiar dominio <Copy size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
      />
    </div>
  )
}
