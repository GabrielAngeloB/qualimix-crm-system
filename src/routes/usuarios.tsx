import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createUser, listUsers, setUserActive } from '../lib/auth.functions'

type UserRow = { id: string; nome: string; username: string; perfil: 'admin' | 'user'; ativo: boolean; created_at: string }

export const Route = createFileRoute('/usuarios')({
  head: () => ({ meta: [{ title: 'Usuários — Qualimix CRM' }] }),
  component: UsersPage,
})

function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try { setUsers(await listUsers() as UserRow[]) }
    catch (err) { setError(err instanceof Error ? err.message : 'Falha ao carregar usuários.') }
  }
  useEffect(() => { void refresh() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      await createUser({ data: { name, username, password } })
      setName(''); setUsername(''); setPassword('')
      setNotice('Usuário criado. Compartilhe a senha inicial por um canal seguro.')
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível criar o usuário.') }
    finally { setBusy(false) }
  }

  async function toggle(user: UserRow) {
    setError(''); setNotice('')
    try { await setUserActive({ data: { id: user.id, active: !user.ativo } }); await refresh() }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar o usuário.') }
  }



  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-widest text-brand">Administração</p><h1 className="font-display text-4xl font-extrabold uppercase">Usuários</h1><p className="mt-1 text-sm text-muted">Somente administradores podem criar e gerenciar contas. A desativação preserva o histórico comercial.</p></header>
      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-line bg-surface p-5 md:grid-cols-4">
        <label className="text-sm font-semibold md:col-span-2">Nome<input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" /></label>
        <label className="text-sm font-semibold">Usuário<input required minLength={3} maxLength={30} value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" /></label>
        <label className="text-sm font-semibold">Senha inicial<input required minLength={12} maxLength={128} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" /></label>
        <div className="md:col-span-4"><button disabled={busy} className="h-10 rounded-md bg-brand px-4 font-semibold text-white disabled:opacity-60">{busy ? 'Criando…' : 'Criar usuário comum'}</button></div>
      </form>
      {error && <p role="alert" className="rounded-md border border-brand/30 bg-brand-soft p-3 text-sm text-brand">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-ok/30 bg-ok-soft p-3 text-sm text-ok">{notice}</p>}
      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase text-muted"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Papel</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id} className="border-b border-line last:border-0">
            <td className="px-4 py-3"><strong>{user.nome}</strong><span className="block text-xs text-muted">@{user.username}</span></td>
            <td className="px-4 py-3">{user.perfil === 'admin' ? 'Administrador' : 'Usuário'}</td>
            <td className="px-4 py-3">{user.ativo ? 'Ativo' : 'Desativado'}</td>
            <td className="px-4 py-3 text-right"><button onClick={() => void toggle(user)} className="font-semibold text-brand hover:underline">{user.ativo ? 'Desativar e revogar sessões' : 'Ativar'}</button></td>
          </tr>)}</tbody>
        </table>
        {!users.length && <p className="p-5 text-sm text-muted">Nenhum usuário encontrado.</p>}
      </section>
    </div>
  )
}
