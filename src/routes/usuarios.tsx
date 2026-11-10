import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Check, Pencil, X } from 'lucide-react'
import { createUser, getAuthSession, listUsers, setUserActive, updateUserProfile } from '../lib/auth.functions'

type UserRole = 'comercial' | 'operacao' | 'financeiro' | 'consulta'
type UserRow = { id: string; nome: string; username: string; perfil: 'admin' | 'user'; role: UserRole | 'admin' | 'administrador'; ativo: boolean; created_at: string }

export const Route = createFileRoute('/usuarios')({
  beforeLoad: async () => {
    const session = await getAuthSession()
    if (session.profile?.perfil !== 'admin') throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Usuários — Qualimix CRM' }] }),
  component: UsersPage,
})

function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('comercial')
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('comercial')
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
      await createUser({ data: { name, username, password, role } })
      setName(''); setUsername(''); setPassword(''); setRole('comercial')
      setNotice('Usuário criado. Compartilhe a senha inicial por um canal seguro.')
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível criar o usuário.') }
    finally { setBusy(false) }
  }

  function startEdit(user: UserRow) {
    setEditing(user)
    setEditName(user.nome)
    setEditRole(user.role === 'admin' || user.role === 'administrador' ? 'comercial' : user.role)
    setError(''); setNotice('')
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setBusy(true); setError(''); setNotice('')
    try {
      await updateUserProfile({ data: {
        id: editing.id,
        name: editName,
        role: editing.perfil === 'admin' ? null : editRole,
      } })
      setNotice('Dados do usuário atualizados. Mudanças de perfil revogam as sessões ativas.')
      setEditing(null)
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar o usuário.') }
    finally { setBusy(false) }
  }

  async function toggle(user: UserRow) {
    setError(''); setNotice('')
    try {
      await setUserActive({ data: { id: user.id, active: !user.ativo } })
      setNotice(user.ativo ? 'Conta desativada e sessões revogadas.' : 'Conta reativada.')
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível atualizar o usuário.') }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-brand">Administração</p>
        <h1 className="font-display text-4xl font-extrabold uppercase">Usuários</h1>
        <p className="mt-1 text-sm text-muted">Edite nome e perfil, ou desative contas. O histórico de autoria é preservado; não existe exclusão física de usuários.</p>
      </header>

      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-line bg-surface p-5 md:grid-cols-5">
        <label className="text-sm font-semibold md:col-span-2">Nome<input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" /></label>
        <label className="text-sm font-semibold">Usuário<input required minLength={3} maxLength={30} value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" /></label>
        <label className="text-sm font-semibold">Senha inicial<input required minLength={12} maxLength={128} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" /></label>
        <label className="text-sm font-semibold">Perfil de acesso<select required value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3"><option value="comercial">Comercial</option><option value="operacao">Operação</option><option value="financeiro">Financeiro</option><option value="consulta">Consulta (somente leitura)</option></select></label>
        <div className="md:col-span-5"><button disabled={busy} className="h-10 rounded-md bg-brand px-4 font-semibold text-white disabled:opacity-60">{busy ? 'Criando…' : 'Criar usuário'}</button></div>
      </form>

      {editing && (
        <form onSubmit={saveEdit} className="grid gap-3 rounded-lg border border-line bg-surface p-5 md:grid-cols-3">
          <div className="md:col-span-3"><h2 className="font-bold uppercase">Editar usuário · @{editing.username}</h2><p className="text-sm text-muted">A alteração de perfil encerra as sessões existentes para aplicar as novas permissões.</p></div>
          <label className="text-sm font-semibold md:col-span-2">Nome<input required minLength={2} maxLength={100} value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3" /></label>
          <label className="text-sm font-semibold">Perfil de acesso
            {editing.perfil === 'admin'
              ? <input disabled value="Administrador (protegido)" className="mt-1 h-10 w-full rounded-md border border-line bg-surface-2 px-3" />
              : <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3"><option value="comercial">Comercial</option><option value="operacao">Operação</option><option value="financeiro">Financeiro</option><option value="consulta">Consulta (somente leitura)</option></select>}
          </label>
          <div className="flex justify-end gap-2 md:col-span-3">
            <button type="button" onClick={() => setEditing(null)} className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold"><X className="h-4 w-4" /> Cancelar</button>
            <button disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"><Check className="h-4 w-4" /> Salvar alterações</button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="rounded-md border border-brand/30 bg-brand-soft p-3 text-sm text-brand">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-ok/30 bg-ok-soft p-3 text-sm text-ok">{notice}</p>}
      <section className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase text-muted"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Papel</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id} className="border-b border-line last:border-0">
            <td className="px-4 py-3"><strong>{user.nome}</strong><span className="block text-xs text-muted">@{user.username}</span></td>
            <td className="px-4 py-3">{user.perfil === 'admin' ? 'Administrador' : user.role === 'operacao' ? 'Operação' : user.role === 'financeiro' ? 'Financeiro' : user.role === 'consulta' ? 'Consulta' : 'Comercial'}</td>
            <td className="px-4 py-3">{user.ativo ? 'Ativo' : 'Desativado'}{user.username === 'admin' && <span className="ml-2 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold uppercase text-brand">Conta protegida</span>}</td>
            <td className="px-4 py-3 text-right"><div className="inline-flex flex-wrap justify-end gap-3">
              <button onClick={() => startEdit(user)} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><Pencil className="h-3.5 w-3.5" /> Editar</button>
              {user.username === 'admin' ? (
                <span className="text-xs font-semibold text-muted" title="A conta principal não pode ser desativada nem excluída.">Conta principal protegida</span>
              ) : (
                <button onClick={() => void toggle(user)} className="font-semibold text-brand hover:underline">{user.ativo ? 'Desativar e revogar sessões' : 'Ativar'}</button>
              )}
            </div></td>
          </tr>)}</tbody>
        </table>
        {!users.length && <p className="p-5 text-sm text-muted">Nenhum usuário encontrado.</p>}
      </section>
    </div>
  )
}
