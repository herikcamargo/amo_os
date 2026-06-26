import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type UserRole = 'admin' | 'atendente' | 'tecnico'

interface UserInput {
  nome?: string
  email?: string
  password?: string
  role?: UserRole
  telefone?: string
  ativo?: boolean
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function cleanUser(input: UserInput) {
  return {
    nome: input.nome?.trim(),
    email: input.email?.trim().toLowerCase(),
    password: input.password,
    role: input.role || 'atendente',
    telefone: input.telefone?.trim() || null,
    ativo: input.ativo ?? true,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Login obrigatorio' }, 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Sessao invalida' }, 401)

    const { data: adminProfile, error: profileError } = await adminClient
      .from('users')
      .select('id, role, ativo')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (profileError) throw profileError
    if (!adminProfile || adminProfile.role !== 'admin' || !adminProfile.ativo) {
      return json({ error: 'Apenas administradores podem gerenciar usuarios' }, 403)
    }

    const payload = await req.json()
    const action = payload.action as 'create' | 'update' | 'delete'

    if (action === 'create') {
      const input = cleanUser(payload.user || {})
      if (!input.nome || !input.email || !input.password) {
        return json({ error: 'Nome, e-mail e senha sao obrigatorios' }, 400)
      }
      if (input.password.length < 6) {
        return json({ error: 'A senha precisa ter pelo menos 6 caracteres' }, 400)
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { nome: input.nome },
      })
      if (createError) throw createError
      if (!created.user) return json({ error: 'Usuario nao criado' }, 500)

      const profile = {
        id: created.user.id,
        nome: input.nome,
        email: input.email,
        role: input.role,
        telefone: input.telefone,
        ativo: input.ativo,
      }

      const { data: user, error: insertError } = await adminClient
        .from('users')
        .upsert(profile, { onConflict: 'id' })
        .select('*')
        .single()

      if (insertError) throw insertError
      return json({ user })
    }

    if (action === 'update') {
      const userId = payload.userId as string | undefined
      const input = cleanUser(payload.updates || {})
      if (!userId) return json({ error: 'ID do usuario obrigatorio' }, 400)

      const profileUpdates: Record<string, unknown> = {}
      if (input.nome) profileUpdates.nome = input.nome
      if (input.email) profileUpdates.email = input.email
      if (input.role) profileUpdates.role = input.role
      if ('telefone' in (payload.updates || {})) profileUpdates.telefone = input.telefone
      if ('ativo' in (payload.updates || {})) profileUpdates.ativo = input.ativo

      const authUpdates: { email?: string; password?: string; user_metadata?: Record<string, string> } = {}
      if (input.email) authUpdates.email = input.email
      if (payload.updates?.password) authUpdates.password = payload.updates.password
      if (input.nome) authUpdates.user_metadata = { nome: input.nome }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, authUpdates)
        if (authUpdateError) throw authUpdateError
      }

      const { data: user, error: updateError } = await adminClient
        .from('users')
        .update(profileUpdates)
        .eq('id', userId)
        .select('*')
        .single()

      if (updateError) throw updateError
      return json({ user })
    }

    if (action === 'delete') {
      const userId = payload.userId as string | undefined
      if (!userId) return json({ error: 'ID do usuario obrigatorio' }, 400)
      if (userId === authData.user.id) return json({ error: 'Voce nao pode excluir a si mesmo' }, 400)

      await adminClient.from('users').delete().eq('id', userId)
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
      if (deleteError) throw deleteError

      return json({ ok: true })
    }

    return json({ error: 'Acao invalida' }, 400)
  } catch (err) {
    console.error('manage-user error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
