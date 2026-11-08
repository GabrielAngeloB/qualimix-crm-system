import { createServerFn } from '@tanstack/react-start'
import { createAdminSupabase, createRequestSupabase, usernameEmail } from './supabase/server'

type Profile = { id: string; nome: string; username: string; perfil: 'admin' | 'user'; ativo: boolean }

const loginFailures = new Map<string, { count: number; blockedUntil: number }>()
function assertLoginAllowed(username: string) {
  const state = loginFailures.get(username)
  if (state && state.blockedUntil > Date.now()) throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
}
function recordLoginFailure(username: string) {
  const current = loginFailures.get(username) ?? { count: 0, blockedUntil: 0 }
  current.count += 1
  if (current.count >= 5) {
    current.blockedUntil = Date.now() + 15 * 60 * 1000
    current.count = 0
  }
  loginFailures.set(username, current)
}

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,29}$/

function normalizeUsername(value: unknown) {
  if (typeof value !== 'string') throw new Error('Informe o nome de usuário.')
  const username = value.trim().toLowerCase()
  if (!usernamePattern.test(username)) throw new Error('Use de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.')
  return username
}

function requireText(value: unknown, label: string, min = 1, max = 120) {
  if (typeof value !== 'string') throw new Error(`Informe ${label}.`)
  const result = value.trim()
  if (result.length < min || result.length > max) throw new Error(`${label} deve ter entre ${min} e ${max} caracteres.`)
  return result
}

function requirePassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw new Error('A senha deve ter entre 12 e 128 caracteres.')
  }
  return value
}

async function currentProfile(): Promise<{ supabase: ReturnType<typeof createRequestSupabase>; profile: Profile }> {
  const supabase = createRequestSupabase()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('Sua sessão expirou. Entre novamente.')
  const { data, error } = await supabase.from('perfis')
    .select('id,nome,username,perfil,ativo')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error || !data || !data.ativo) throw new Error('Usuário sem perfil ativo.')
  return { supabase, profile: data as Profile }
}

async function requireAdmin() {
  const current = await currentProfile()
  if (current.profile.perfil !== 'admin') throw new Error('Acesso restrito ao administrador.')
  return current
}

export const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const { profile } = await currentProfile()
    return { authenticated: true, profile }
  } catch {
    return { authenticated: false, profile: null }
  }
})

export const login = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados de login inválidos.')
    const data = input as Record<string, unknown>
    return { username: normalizeUsername(data.username), password: requirePassword(data.password) }
  })
  .handler(async ({ data }) => {
    assertLoginAllowed(data.username)
    const admin = createAdminSupabase()
    const { data: profile, error: lookupError } = await admin.from('perfis')
      .select('id,ativo')
      .eq('username', data.username)
      .maybeSingle()
    if (lookupError || !profile || !profile.ativo) { recordLoginFailure(data.username); throw new Error('Usuário ou senha inválidos.') }

    const supabase = createRequestSupabase()
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameEmail(data.username),
      password: data.password,
    })
    if (error) { recordLoginFailure(data.username); throw new Error('Usuário ou senha inválidos.') }
    loginFailures.delete(data.username)

    const { profile: signedIn } = await currentProfile()
    return { profile: signedIn }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = createRequestSupabase()
  await supabase.auth.signOut()
  return { success: true }
})

export const listUsers = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdmin()
  const admin = createAdminSupabase()
  const { data, error } = await admin.from('perfis')
    .select('id,nome,username,perfil,ativo,created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error('Não foi possível carregar os usuários.')
  return data ?? []
})

export const createUser = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados inválidos.')
    const data = input as Record<string, unknown>
    return {
      username: normalizeUsername(data.username),
      name: requireText(data.name, 'o nome', 2, 100),
      password: requirePassword(data.password),
    }
  })
  .handler(async ({ data }) => {
    await requireAdmin()
    const admin = createAdminSupabase()
    const email = usernameEmail(data.username)
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name },
    })
    if (createError || !created.user) {
      if (createError?.code === 'email_exists') throw new Error('Esse nome de usuário já está em uso.')
      throw new Error('Não foi possível criar o usuário.')
    }

    const { error: profileError } = await admin.from('perfis').upsert({
      id: created.user.id,
      nome: data.name,
      username: data.username,
      perfil: 'user',
      ativo: true,
    }, { onConflict: 'id' })
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id)
      if (profileError.code === '23505') throw new Error('Esse nome de usuário já está em uso.')
      throw new Error('A conta foi criada, mas não foi possível configurar o perfil. A operação foi revertida.')
    }
    return { id: created.user.id, nome: data.name, username: data.username, perfil: 'user', ativo: true }
  })

export const setUserActive = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados inválidos.')
    const data = input as Record<string, unknown>
    if (typeof data.id !== 'string' || !data.id) throw new Error('Usuário inválido.')
    if (typeof data.active !== 'boolean') throw new Error('Estado inválido.')
    return { id: data.id, active: data.active }
  })
  .handler(async ({ data }) => {
    const { profile } = await requireAdmin()
    if (profile.id === data.id && !data.active) throw new Error('Você não pode desativar sua própria conta.')
    const admin = createAdminSupabase()
    const { data: target } = await admin.from('perfis').select('perfil,ativo').eq('id', data.id).maybeSingle()
    if (!target) throw new Error('Usuário não encontrado.')
    if (!data.active && target.perfil === 'admin' && target.ativo) {
      const { count } = await admin.from('perfis').select('id', { count: 'exact', head: true }).eq('perfil', 'admin').eq('ativo', true)
      if ((count ?? 0) <= 1) throw new Error('Não é possível desativar o último administrador ativo.')
    }
    const { error } = await admin.from('perfis').update({ ativo: data.active }).eq('id', data.id)
    if (error) throw new Error('Não foi possível atualizar o usuário.')
    return { success: true }
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object' || typeof (input as Record<string, unknown>).id !== 'string') throw new Error('Usuário inválido.')
    return { id: (input as { id: string }).id }
  })
  .handler(async ({ data }) => {
    const { profile } = await requireAdmin()
    if (profile.id === data.id) throw new Error('Você não pode excluir sua própria conta.')
    const admin = createAdminSupabase()
    const { data: target } = await admin.from('perfis').select('perfil,ativo').eq('id', data.id).maybeSingle()
    if (!target) throw new Error('Usuário não encontrado.')
    const [clientRefs, opportunityRefs, quoteRefs] = await Promise.all([
      admin.from('clientes').select('id', { count:'exact', head:true }).eq('responsavel_id',data.id),
      admin.from('oportunidades').select('id', { count:'exact', head:true }).eq('responsavel_id',data.id),
      admin.from('orcamentos').select('id', { count:'exact', head:true }).eq('responsavel_id',data.id),
    ])
    if ((clientRefs.count ?? 0) + (opportunityRefs.count ?? 0) + (quoteRefs.count ?? 0) > 0) throw new Error('Este usuário possui registros vinculados. Desative a conta em vez de excluí-la.')
    if (target.perfil === 'admin' && target.ativo) {
      const { count } = await admin.from('perfis').select('id', { count: 'exact', head: true }).eq('perfil', 'admin').eq('ativo', true)
      if ((count ?? 0) <= 1) throw new Error('Não é possível excluir o último administrador ativo.')
    }
    const { error } = await admin.auth.admin.deleteUser(data.id)
    if (error) throw new Error('Não foi possível excluir o usuário.')
    return { success: true }
  })

export const bootstrapAdmin = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados inválidos.')
    const data = input as Record<string, unknown>
    return {
      secret: requireText(data.secret, 'o segredo de inicialização', 24, 256),
      username: normalizeUsername(data.username),
      name: requireText(data.name, 'o nome', 2, 100),
      password: requirePassword(data.password),
    }
  })
  .handler(async ({ data }) => {
    const expected = process.env.BOOTSTRAP_ADMIN_SECRET
    if (!expected || data.secret !== expected) throw new Error('Inicialização não autorizada.')
    const admin = createAdminSupabase()
    const { count, error: countError } = await admin.from('perfis').select('id', { count: 'exact', head: true }).eq('perfil', 'admin')
    if (countError) throw new Error('Não foi possível verificar o estado inicial.')
    if ((count ?? 0) > 0) throw new Error('O administrador inicial já foi criado.')
    const { data: created, error } = await admin.auth.admin.createUser({
      email: usernameEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name },
    })
    if (error || !created.user) throw new Error('Não foi possível criar o administrador inicial.')
    const { error: profileError } = await admin.from('perfis').upsert({
      id: created.user.id, nome: data.name, username: data.username, perfil: 'admin', ativo: true, bootstrap_claim: true,
    }, { onConflict: 'id' })
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id)
      throw new Error('Não foi possível configurar o perfil administrativo; a conta foi revertida.')
    }
    return { success: true }
  })
