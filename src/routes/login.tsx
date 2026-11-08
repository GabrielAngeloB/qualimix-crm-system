import { useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LockKeyhole, LogIn } from 'lucide-react'
import { login } from '../lib/auth.functions'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Entrar — Qualimix CRM' }] }),
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login({ data: { username, password } })
      await navigate({ to: '/' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface-2 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-line bg-surface p-8 shadow-xl">
        <div className="mb-8">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-ink text-white"><LockKeyhole className="h-6 w-6" /></div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-brand">Qualimix</p>
          <h1 className="mt-1 font-display text-4xl font-extrabold uppercase">Acessar o CRM</h1>
          <p className="mt-2 text-sm text-muted">Entre com seu nome de usuário e senha.</p>
        </div>
        <label className="mb-4 block text-sm font-semibold">Nome de usuário
          <input autoComplete="username" required minLength={3} maxLength={30} value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-ink" />
        </label>
        <label className="mb-5 block text-sm font-semibold">Senha
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 outline-none focus:border-ink" />
        </label>
        {error && <p role="alert" className="mb-4 rounded-md border border-brand/30 bg-brand-soft p-3 text-sm text-brand">{error}</p>}
        <button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-white hover:bg-brand-strong disabled:opacity-60">
          <LogIn className="h-4 w-4" /> {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="mt-5 text-center text-xs text-muted">Acesso restrito a usuários cadastrados pelo administrador.</p>
      </form>
    </main>
  )
}
