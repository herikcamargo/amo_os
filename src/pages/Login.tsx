import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useStore } from '@/store/useStore'
import toast from 'react-hot-toast'

export function Login() {
  const navigate = useNavigate()
  const { setUser } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Demo mode — accept any credentials
    setTimeout(() => {
      setUser({
        id: 'u1',
        nome: email.split('@')[0] || 'Usuário',
        email,
        role: 'admin',
        ativo: true,
        created_at: new Date().toISOString(),
      })
      toast.success('Bem-vindo ao AMO OS!')
      setLoading(false)
      navigate('/')
    }, 800)
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-10">
          <div className="text-[32px] font-black tracking-tight">
            Amo<span className="text-brand">Celular</span>
            <span className="text-brand text-xl align-top ml-0.5">♥</span>
          </div>
          <div className="text-[10px] tracking-[0.25em] text-gray-500 font-medium mt-1.5">
            ASSISTÊNCIA TÉCNICA
          </div>
          <p className="text-gray-500 text-sm mt-4">Entre na sua conta para continuar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full h-12 px-4 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-12 px-4 pr-12 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-brand font-semibold text-sm active:scale-95 transition-transform disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="text-center mt-8 text-[11px] text-gray-600">
          AMO OS v1.0.0 · AmoCelular
        </div>
      </div>
    </div>
  )
}
