import { createServerFn } from '@tanstack/react-start'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import { getRequestHeader } from '@tanstack/react-start/server'
import { getPool, withTransaction } from './db.server'
import {
  assertSameOrigin,
  clearSessionCookie,
  getBootstrapToken,
  getCurrentProfile,
  hashPassword,
  requireCurrentProfile,
  setAuthenticatedSession,
  verifyPassword,
} from './auth.server'

const usernamePattern = /^[a-z0-9][a-z0-9._-]{2,29}$/
const loginFailures = new Map<string, { count: number; blockedUntil: number }>()

function normalizeUsername(value: unknown) {
  if (typeof value !== 'string') throw new Error('Informe o nome de usuário.')
  const username = value.trim().toLowerCase()
  if (!usernamePattern.test(username)) {
    throw new Error('Use de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.')
  }
  return username
}

function requireText(value: unknown, label: string, min = 1, max = 120) {
  if (typeof value !== 'string') throw new Error('Informe ' + label + '.')
  const result = value.trim()
  if (result.length < min || result.length > max) {
    throw new Error(label + ' deve ter entre ' + min + ' e ' + max + ' caracteres.')
  }
  return result
}

function requirePassword(value: unknown, minimum = 12) {
  if (typeof value !== 'string' || value.length < minimum || value.length > 128) {
    throw new Error('A senha deve ter entre ' + minimum + ' e 128 caracteres.')
  }
  return value
}

function requireAdmin(profile: Awaited<ReturnType<typeof requireCurrentProfile>>) {
  if (profile.perfil !== 'admin') throw new Error('Acesso restrito ao administrador.')
  return profile
}

function rateKey(username: string) {
  const forwarded = getRequestHeader('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  return ip + ':' + username
}

function assertLoginAllowed(key: string) {
  const state = loginFailures.get(key)
  if (state && state.blockedUntil > Date.now()) {
    throw new Error('Muitas tentativas. Aguarde 15 minutos e tente novamente.')
  }
  if (state && state.blockedUntil <= Date.now()) loginFailures.delete(key)
}

function recordLoginFailure(key: string) {
  const current = loginFailures.get(key) ?? { count: 0, blockedUntil: 0 }
  current.count += 1
  if (current.count >= 5) {
    current.blockedUntil = Date.now() + 15 * 60 * 1000
    current.count = 0
  }
  loginFailures.set(key, current)
}

function clearLoginFailures(key: string) {
  loginFailures.delete(key)
}

export const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const profile = await getCurrentProfile()
    return { authenticated: Boolean(profile), profile }
  } catch {
    return { authenticated: false, profile: null }
  }
})

export const login = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados de login inválidos.')
    const data = input as Record<string, unknown>
    return {
      username: normalizeUsername(data.username),
      password: requirePassword(data.password, 1),
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const key = rateKey(data.username)
    assertLoginAllowed(key)

    const result = await getPool().query<{
      id: string
      username: string
      senha_hash: string | null
      session_version: number
      nome: string
      perfil: string
      ativo: boolean
    }>(
      'SELECT u.id::text, u.username, u.senha_hash, u.session_version, p.nome, p.perfil, p.ativo ' +
      'FROM public.usuarios u JOIN public.perfis p ON p.id = u.id ' +
      'WHERE u.username = $1 LIMIT 1',
      [data.username],
    )
    const user = result.rows[0]
    const validPassword = await verifyPassword(data.password, user?.senha_hash ?? null)

    if (!user || !user.ativo || !user.senha_hash || !validPassword) {
      recordLoginFailure(key)
      throw new Error('Usuário ou senha inválidos.')
    }

    clearLoginFailures(key)
    await setAuthenticatedSession(user.id, Number(user.session_version))
    return {
      profile: {
        id: user.id,
        nome: user.nome,
        username: user.username,
        perfil: user.perfil === 'admin' || user.perfil === 'administrador' ? 'admin' as const : 'user' as const,
        role: user.perfil,
        ativo: user.ativo,
      },
    }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  assertSameOrigin()
  const profile = await getCurrentProfile()
  if (profile) {
    await getPool().query(
      'UPDATE public.usuarios SET session_version = session_version + 1, updated_at = now() WHERE id = $1',
      [profile.id],
    )
  }
  clearSessionCookie()
  return { success: true }
})

export const listUsers = createServerFn({ method: 'GET' }).handler(async () => {
  requireAdmin(await requireCurrentProfile())
  const result = await getPool().query(
    'SELECT u.id::text, u.username, p.nome, p.perfil, p.ativo, p.created_at, ' +
    '(u.senha_hash IS NULL) AS senha_pendente ' +
    'FROM public.usuarios u JOIN public.perfis p ON p.id = u.id ' +
    'ORDER BY p.created_at DESC, p.nome ASC',
  )
  return result.rows.map((row) => ({
    ...row,
    perfil: row.perfil === 'admin' || row.perfil === 'administrador' ? 'admin' : 'user',
  }))
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
    assertSameOrigin()
    requireAdmin(await requireCurrentProfile())
    const id = randomUUID()
    const passwordHash = await hashPassword(data.password)

    try {
      await withTransaction(async (client) => {
        await client.query(
          'INSERT INTO public.usuarios (id, username, senha_hash) VALUES ($1, $2, $3)',
          [id, data.username, passwordHash],
        )
        await client.query(
          'INSERT INTO public.perfis (id, nome, perfil, ativo) VALUES ($1, $2, $3, true)',
          [id, data.name, 'comercial'],
        )
      })
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new Error('Esse nome de usuário já está em uso.')
      }
      throw new Error('Não foi possível criar o usuário. Confira a configuração do banco.')
    }

    return { id, nome: data.name, username: data.username, perfil: 'user' as const, ativo: true, senha_pendente: false }
  })

export const setUserActive = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados inválidos.')
    const data = input as Record<string, unknown>
    if (typeof data.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.id)) throw new Error('Usuário inválido.')
    if (typeof data.active !== 'boolean') throw new Error('Estado inválido.')
    return { id: data.id, active: data.active }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = requireAdmin(await requireCurrentProfile())
    if (profile.id === data.id && !data.active) throw new Error('Você não pode desativar sua própria conta.')

    await withTransaction(async (client) => {
      const targetResult = await client.query(
        'SELECT p.perfil, p.ativo FROM public.perfis p WHERE p.id = $1 FOR UPDATE',
        [data.id],
      )
      const target = targetResult.rows[0]
      if (!target) throw new Error('Usuário não encontrado.')

      const isAdmin = target.perfil === 'admin' || target.perfil === 'administrador'
      if (!data.active && isAdmin && target.ativo) {
        const countResult = await client.query(
          "SELECT count(*)::int AS count FROM public.perfis WHERE ativo = true AND perfil IN ('admin', 'administrador')",
        )
        if (Number(countResult.rows[0]?.count ?? 0) <= 1) {
          throw new Error('Não é possível desativar o último administrador ativo.')
        }
      }

      await client.query('UPDATE public.perfis SET ativo = $2, updated_at = now() WHERE id = $1', [data.id, data.active])
      await client.query(
        'UPDATE public.usuarios SET session_version = session_version + 1, updated_at = now() WHERE id = $1',
        [data.id],
      )
    })
    return { success: true }
  })

/** Exclusão é lógica: preserva o histórico e as referências do CRM. */
export const deleteUser = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object' || typeof (input as Record<string, unknown>).id !== 'string') {
      throw new Error('Usuário inválido.')
    }
    return { id: String((input as Record<string, unknown>).id) }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const profile = requireAdmin(await requireCurrentProfile())
    if (profile.id === data.id) throw new Error('Você não pode excluir sua própria conta.')

    await withTransaction(async (client) => {
      const targetResult = await client.query(
        'SELECT p.perfil, p.ativo FROM public.perfis p WHERE p.id = $1 FOR UPDATE',
        [data.id],
      )
      const target = targetResult.rows[0]
      if (!target) throw new Error('Usuário não encontrado.')
      if (target.perfil === 'admin' || target.perfil === 'administrador') {
        const countResult = await client.query(
          "SELECT count(*)::int AS count FROM public.perfis WHERE ativo = true AND perfil IN ('admin', 'administrador')",
        )
        if (target.ativo && Number(countResult.rows[0]?.count ?? 0) <= 1) {
          throw new Error('Não é possível desativar o último administrador ativo.')
        }
      }
      await client.query('UPDATE public.perfis SET ativo = false, updated_at = now() WHERE id = $1', [data.id])
      await client.query(
        'UPDATE public.usuarios SET session_version = session_version + 1, updated_at = now() WHERE id = $1',
        [data.id],
      )
    })
    return { success: true }
  })

export const bootstrapAdmin = createServerFn({ method: 'POST' })
  .validator((input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Dados inválidos.')
    const data = input as Record<string, unknown>
    return {
      token: requireText(data.secret, 'o token de inicialização', 32, 128),
      username: normalizeUsername(data.username),
      name: requireText(data.name, 'o nome', 2, 100),
      password: requirePassword(data.password),
    }
  })
  .handler(async ({ data }) => {
    assertSameOrigin()
    const expected = Buffer.from(getBootstrapToken(), 'hex')
    const supplied = Buffer.from(data.token, 'hex')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new Error('Token de inicialização inválido.')
    }

    const id = randomUUID()
    const passwordHash = await hashPassword(data.password)

    try {
      await withTransaction(async (client) => {
        // Serializa o bootstrap: duas requisições simultâneas não podem criar dois admins.
        await client.query('SELECT pg_advisory_xact_lock($1, $2)', [741911, 1])
        const existing = await client.query(
          "SELECT 1 FROM public.usuarios u JOIN public.perfis p ON p.id = u.id " +
          "WHERE p.perfil IN ('admin', 'administrador') AND u.senha_hash IS NOT NULL LIMIT 1",
        )
        if (existing.rowCount) throw new Error('O administrador inicial já foi criado.')

        await client.query(
          'INSERT INTO public.usuarios (id, username, senha_hash) VALUES ($1, $2, $3)',
          [id, data.username, passwordHash],
        )
        await client.query(
          'INSERT INTO public.perfis (id, nome, perfil, ativo) VALUES ($1, $2, $3, true)',
          [id, data.name, 'administrador'],
        )
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'O administrador inicial já foi criado.') throw error
      if ((error as { code?: string })?.code === '23505') throw new Error('Esse nome de usuário já está em uso.')
      throw new Error('Não foi possível criar o administrador inicial. Confira a configuração do banco.')
    }
    return { success: true }
  })
