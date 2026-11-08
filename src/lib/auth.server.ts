import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { appendResponseHeader, getRequestHeader } from '@tanstack/react-start/server'
import { getPool } from './db.server'

const COOKIE_NAME = 'qmx_session'
const SESSION_SECONDS = 60 * 60 * 24 * 7
const SCRYPT_N = 32_768
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 64
const DUMMY_SALT = Buffer.from('qualimix-crm-dummy-salt')

export type AuthProfile = {
  id: string
  nome: string
  username: string
  perfil: 'admin' | 'user'
  role: string
  ativo: boolean
}
type SessionPayload = { sub: string; exp: number; version: number }

function signingKey(): Buffer {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL não está configurada.')
  return createHmac('sha256', databaseUrl).update('qualimix-crm/session-signing/v1').digest()
}
function signatureFor(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url')
}
function setSessionCookie(value: string, maxAge = SESSION_SECONDS) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  appendResponseHeader('Set-Cookie', COOKIE_NAME + '=' + value + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + maxAge + secure)
}
export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  appendResponseHeader(
    'Set-Cookie',
    COOKIE_NAME + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT' + secure,
  )
}
function requestCookie(name: string): string | null {
  const header = getRequestHeader('cookie') ?? ''
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index >= 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return null
}
function readSession(): SessionPayload | null {
  const token = requestCookie(COOKIE_NAME)
  if (!token || token.length > 2048) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  try {
    const expected = Buffer.from(signatureFor(parts[0]), 'base64url')
    const supplied = Buffer.from(parts[1], 'base64url')
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null
    const parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Partial<SessionPayload>
    if (
      typeof parsed.sub !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(parsed.sub) ||
      !Number.isInteger(parsed.exp) ||
      !Number.isInteger(parsed.version) ||
      Number(parsed.exp) <= Math.floor(Date.now() / 1000) ||
      Number(parsed.version) < 0
    ) return null
    return { sub: parsed.sub, exp: Number(parsed.exp), version: Number(parsed.version) }
  } catch { return null }
}
export function setAuthenticatedSession(id: string, sessionVersion: number) {
  const payload: SessionPayload = {
    sub: id,
    version: sessionVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  setSessionCookie(encoded + '.' + signatureFor(encoded))
}
export async function getCurrentProfile(): Promise<AuthProfile | null> {
  const session = readSession()
  if (!session) return null
  const result = await getPool().query<{
    id: string; nome: string; username: string; perfil: string; ativo: boolean; session_version: number
  }>(
    'SELECT u.id::text, u.username, u.session_version, p.nome, p.perfil, p.ativo ' +
    'FROM public.usuarios u JOIN public.perfis p ON p.id = u.id WHERE u.id = $1 LIMIT 1',
    [session.sub],
  )
  const row = result.rows[0]
  if (!row || !row.ativo || Number(row.session_version) !== session.version) {
    clearSessionCookie()
    return null
  }
  const isAdmin = row.perfil === 'admin' || row.perfil === 'administrador'
  return {
    id: row.id, nome: row.nome, username: row.username,
    perfil: isAdmin ? 'admin' : 'user', role: row.perfil, ativo: row.ativo,
  }
}
export async function requireCurrentProfile(): Promise<AuthProfile> {
  const profile = await getCurrentProfile()
  if (!profile) throw new Error('Sua sessão expirou. Entre novamente.')
  return profile
}
export function assertSameOrigin() {
  const origin = getRequestHeader('origin')
  const forwardedHost = getRequestHeader('x-forwarded-host')
  const host = (forwardedHost || getRequestHeader('host') || '').split(',')[0]?.trim()
  if (!origin || !host) throw new Error('Solicitação inválida. Atualize a página e tente novamente.')
  let originHost = ''
  try { originHost = new URL(origin).host } catch { throw new Error('Solicitação de origem inválida.') }
  if (originHost.toLowerCase() !== host.toLowerCase()) throw new Error('Solicitação de origem diferente bloqueada.')
}
function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 128 * 1024 * 1024 },
      (error, derivedKey) => error ? reject(error) : resolve(derivedKey),
    )
  })
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derivedKey = await derivePasswordKey(password, salt)
  return 'scrypt$' + SCRYPT_N + '$' + salt.toString('base64url') + '$' + derivedKey.toString('base64url')
}
export async function verifyPassword(password: string, encodedHash: string | null): Promise<boolean> {
  let salt = DUMMY_SALT
  let expected = Buffer.alloc(KEY_LENGTH)
  let validFormat = false
  if (encodedHash) {
    const parts = encodedHash.split('$')
    if (parts.length === 4 && parts[0] === 'scrypt' && parts[1] === String(SCRYPT_N)) {
      try {
        const parsedSalt = Buffer.from(parts[2], 'base64url')
        const parsedHash = Buffer.from(parts[3], 'base64url')
        if (parsedSalt.length === 16 && parsedHash.length === KEY_LENGTH) {
          salt = parsedSalt
          expected = parsedHash
          validFormat = true
        }
      } catch { /* usa o hash fictício */ }
    }
  }
  const actual = await derivePasswordKey(password, salt)
  return validFormat && timingSafeEqual(actual, expected)
}
/** Token de bootstrap derivado da própria DATABASE_URL; não exige outra variável. */
export function getBootstrapToken(): string {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL não está configurada.')
  return createHmac('sha256', databaseUrl).update('qualimix-crm/first-admin/v1').digest('hex')
}
