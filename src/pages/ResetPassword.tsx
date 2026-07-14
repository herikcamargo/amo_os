import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { authAdapter } from '@/lib/storage-adapter'
import toast from 'react-hot-toast'

export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem')
      return
    }

    setLoading(true)
    try {
      await authAdapter.updatePassword(password)
      await authAdapter.signOut()
      setDone(true)
      toast.success('Senha atualizada! Faça login com a nova senha.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Não consegui atualizar a senha: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const goToLogin = () => {
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-10 grain">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-10">
          <div className="text-[32px] font-black tracking-tight">
            Amo<span className="text-brand">Celular</span>
            <span className="text-brand text-xl align-top ml-0.5">♥</span>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            {done ? 'Senha atualizada com sucesso' : 'Defina sua nova senha'}
          </p>
        </div>

        {done ? (
          <button
            onClick={goToLogin}
            className="w-full h-12 rounded-xl bg-brand font-semibold text-sm hover:scale-[1.02] active:scale-95 transition-all"
          >
            Ir para o login
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Nova senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
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

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Confirmar senha</label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full h-12 px-4 rounded-xl bg-surface-input border border-white/5 focus:border-brand outline-none text-sm placeholder:text-gray-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-brand font-semibold text-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
            >
              {loading ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
