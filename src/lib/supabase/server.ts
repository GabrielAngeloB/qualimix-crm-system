import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { appendResponseHeader, getRequestHeader } from '@tanstack/react-start/server'

type CookieOptions = {
  domain?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  secure?: boolean
}

function cookieHeader() {
  return getRequestHeader('cookie') ?? ''
}

function readCookies() {
  return cookieHeader().split(';').flatMap((part) => {
    const index = part.indexOf('=')
    if (index < 0) return []
    return [{ name: part.slice(0, index).trim(), value: part.slice(index + 1).trim() }]
  })
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${value}`, `Path=${options.path ?? '/'}`]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure ?? process.env.NODE_ENV === 'production') parts.push('Secure')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite === true ? 'Strict' : options.sameSite}`)
  return parts.join('; ')
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Configuração do servidor ausente: ${name}`)
  return value
}

export function createRequestSupabase(): SupabaseClient {
  return createServerClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll: readCookies,
        setAll: (cookies) => {
          for (const cookie of cookies) {
            appendResponseHeader('Set-Cookie', serializeCookie(cookie.name, cookie.value, cookie.options))
          }
        },
      },
      cookieOptions: {
        name: 'qmx-auth',
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
      },
    },
  )
}

export function createAdminSupabase(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export function usernameEmail(username: string) {
  return `${username.toLowerCase()}@auth.qualimix.invalid`
}
