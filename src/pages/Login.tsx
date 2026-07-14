import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Shield } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { roleColor, roleLabel } from '@/lib/permissions'
import { authAdapter } from '@/lib/storage-adapter'
import toast from 'react-hot-toast'

export function Login() {
  const navigate = useNavigate()
  const { setUser, users, isCloudConnected } = useStore()
  const allowDemoLogin = !isCloudConnected && !import.meta.env.PROD
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    try {
      await authAdapter.requestPasswordReset(resetEmail)
      setResetSent(true)
      toast.success('Link de recuperação enviado! Verifique seu e-mail.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Não consegui enviar o link: ${message}`)
    } finally {
      setResetLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (isCloudConnected) {
      try {
        const profile = await authAdapter.signIn(email, password)
        setUser(profile)
        toast.success(`Bem-vindo, ${profile.nome}!`)
        navigate('/')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido'
        toast.error(`Nao consegui entrar: ${message}`)
      } finally {
        setLoading(false)
      }
      return
    }

    if (!allowDemoLogin) {
      toast.error('Supabase nao configurado. Verifique as variaveis na Vercel.')
      setLoading(false)
      return
    }

    setTimeout(() => {
      const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.ativo)
      if (match) {
        setUser(match)
        toast.success(`Bem-vindo, ${match.nome}!`)
      } else {
        setUser({
          id: 'u1',
          nome: email.split('@')[0] || 'Usuário',
          email,
          role: 'admin',
          ativo: true,
          created_at: new Date().toISOString(),
        })
        toast.success('Bem-vindo ao AMO OS!')
      }
      setLoading(false)
      navigate('/')
    }, 500)
  }

  const quickLogin = (userId: string) => {
    const u = users.find((x) => x.id === userId)
    if (!u) return
    setUser(u)
    toast.success(`Entrou como ${u.nome}`)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-10 grain">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-10">
          <div className="text-[32px] font-black tracking-tight">
            Amo<span className="text-brand">Celular</span>
            <span className="text-brand text-xl align-top ml-0.5">♥</span>
          </div>
          <div className="text-[10px] tracking-wide text-gray-500 font-medium mt-1">
            Assistência técnica
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-brand font-semibold text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {isCloudConnected && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setResetEmail(email)
                setResetSent(false)
                setShowForgot(true)
              }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>
        )}

        {showForgot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70" onClick={() => setShowForgot(false)}>
            <div
              className="w-full max-w-[340px] bg-surface-card border border-white/10 rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {resetSent ? (
                <div className="text-center">
                  <p className="text-sm text-gray-300 mb-4">
                    Se o e-mail <span className="font-semibold text-white">{resetEmail}</span> estiver cadastrado, você vai receber um link para redefinir a senha.
                  </p>
                  <button
                    onClick={() => setShowForgot(false)}
                    className="w-full h-11 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold hover:bg-white/10 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <h2 className="text-base font-bold mb-1">Recuperar senha</h2>
                  <p className="text-xs text-gray-500 mb-4">
                    Enviaremos um link de redefinição para o seu e-mail cadastrado.
                  </p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoFocus
                    className="w-full h-11 px-4 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600 mb-3"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowForgot(false)}
                      className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold hover:bg-white/10 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 h-11 rounded-xl bg-brand text-sm font-semibold hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
                    >
                      {resetLoading ? 'Enviando...' : 'Enviar link'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {allowDemoLogin && (
          <div className="mt-8">
            <div className="text-center mb-3">
              <div className="text-[11px] text-gray-500 font-medium">
                Modo demonstração — entrar como:
              </div>
            </div>
            <div className="space-y-2">
              {users.filter((u) => u.ativo).map((u) => {
                const color = roleColor(u.role)
                return (
                  <button
                    key={u.id}
                    onClick={() => quickLogin(u.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0"
                      style={{ background: color + '22', color }}
                    >
                      {u.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-semibold truncate">{u.nome}</div>
                      <div className="text-[10px] text-gray-500 truncate">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Shield size={11} style={{ color }} />
                      <span className="text-[10px] font-bold" style={{ color }}>
                        {roleLabel(u.role)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="text-center mt-8 text-[11px] text-gray-600">
          AMO OS v1.0.0 · AmoCelular
        </div>
      </div>
    </div>
  )
}
