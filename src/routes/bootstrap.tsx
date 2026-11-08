import { useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { bootstrapAdmin } from '../lib/auth.functions'

export const Route = createFileRoute('/bootstrap')({
  head: () => ({ meta: [{ title: 'Inicializar administrador — Qualimix CRM' }] }),
  component: BootstrapPage,
})

function BootstrapPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await bootstrapAdmin({ data: { name, username, password, secret } })
      await navigate({ to: '/login' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível inicializar o administrador.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface-2 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-line bg-surface p-8 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-brand">Configuração inicial</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold uppercase">Criar administrador</h1>
        <p className="mb-6 mt-2 text-sm text-muted">Disponível somente enquanto não existir um administrador. Gere o token localmente a partir da DATABASE_URL seguindo DATABASE_AND_AUTH_SETUP.md.</p>
        <label className="mb-3 block text-sm font-semibold">Nome completo<input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3" /></label>
        <label className="mb-3 block text-sm font-semibold">Nome de usuário<input required minLength={3} maxLength={30} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3" /></label>
        <label className="mb-3 block text-sm font-semibold">Senha (mínimo 12 caracteres)<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3" /></label>
        <label className="mb-5 block text-sm font-semibold">Token de inicialização<input required minLength={24} type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3" /></label>
        {error && <p role="alert" className="mb-4 rounded-md border border-brand/30 bg-brand-soft p-3 text-sm text-brand">{error}</p>}
        <button disabled={busy} className="h-11 w-full rounded-md bg-brand px-4 font-semibold text-white disabled:opacity-60">{busy ? 'Criando…' : 'Criar primeiro administrador'}</button>
      </form>
    </main>
  )
}
