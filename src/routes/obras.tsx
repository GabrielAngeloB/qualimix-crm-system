import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Pencil, Plus, RotateCcw, Archive, Search } from 'lucide-react'
import { useStore } from '../data/store'
import { loadManagedSites, saveManagedSite, setManagedSiteActive } from '../lib/crm.functions'
import { Badge, Button, Card, EmptyState, Field, PageHeader, cx, inputCls } from '../components/ui'

export const Route = createFileRoute('/obras')({
  head: () => ({ meta: [{ title: 'Obras — Qualimix CRM' }] }),
  component: Obras,
})

type ManagedSite = {
  id: string
  cliente_id: string
  cliente_nome: string
  nome: string
  endereco: string
  cidade: string
  regiao: string
  contato_nome: string
  contato_telefone: string
  tipo_servico: string
  observacoes_acesso: string
  restricoes: string
  ativa: boolean
}

type Draft = Omit<ManagedSite, 'id' | 'cliente_nome' | 'ativa'> & { id: string }
const emptyDraft = (): Draft => ({
  id: '', cliente_id: '', nome: '', endereco: '', cidade: '', regiao: '',
  contato_nome: '', contato_telefone: '', tipo_servico: '', observacoes_acesso: '', restricoes: '',
})

function Obras() {
  const { clients, currentRole, toast } = useStore()
  const canManage = ['admin', 'administrador', 'comercial', 'operacao'].includes(currentRole)
  const [rows, setRows] = useState<ManagedSite[]>([])
  const [filter, setFilter] = useState<'ativas' | 'inativas' | 'todas'>('ativas')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => setRows(await loadManagedSites() as ManagedSite[]), [])
  useEffect(() => { void refresh().catch((error) => toast({ tone: 'erro', title: 'Falha ao carregar obras', body: error instanceof Error ? error.message : 'Verifique a conexão.' })) }, [refresh, toast])

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return rows.filter((row) =>
      (filter === 'todas' || (filter === 'ativas' ? row.ativa : !row.ativa)) &&
      (!term || row.nome.toLocaleLowerCase('pt-BR').includes(term) ||
        row.cliente_nome.toLocaleLowerCase('pt-BR').includes(term) ||
        row.endereco.toLocaleLowerCase('pt-BR').includes(term) ||
        row.cidade.toLocaleLowerCase('pt-BR').includes(term)),
    )
  }, [rows, filter, search])

  const startNew = () => {
    setDraft({ ...emptyDraft(), cliente_id: clients.find((client) => client.active)?.id ?? '' })
    setFormOpen(true)
  }
  const startEdit = (row: ManagedSite) => {
    setDraft({
      id: row.id, cliente_id: row.cliente_id, nome: row.nome, endereco: row.endereco,
      cidade: row.cidade, regiao: row.regiao, contato_nome: row.contato_nome,
      contato_telefone: row.contato_telefone, tipo_servico: row.tipo_servico,
      observacoes_acesso: row.observacoes_acesso, restricoes: row.restricoes,
    })
    setFormOpen(true)
  }
  const save = async () => {
    setBusy(true)
    try {
      await saveManagedSite({ data: {
        id: draft.id, clientId: draft.cliente_id, name: draft.nome, address: draft.endereco,
        city: draft.cidade, region: draft.regiao, contactName: draft.contato_nome,
        contactPhone: draft.contato_telefone, serviceType: draft.tipo_servico,
        accessNotes: draft.observacoes_acesso, restrictions: draft.restricoes,
      } })
      await refresh()
      setFormOpen(false)
      setDraft(emptyDraft())
      toast({ tone: 'ok', title: draft.id ? 'Obra atualizada' : 'Obra cadastrada', body: 'Dados salvos sem alterar os vínculos históricos.' })
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível salvar a obra', body: error instanceof Error ? error.message : 'Revise os dados.' })
    } finally { setBusy(false) }
  }
  const toggleActive = async (row: ManagedSite) => {
    const action = row.ativa ? 'desativar' : 'reativar'
    if (!window.confirm(`Deseja ${action} a obra "${row.nome}"? Os pedidos, orçamentos e programações existentes serão preservados.`)) return
    try {
      await setManagedSiteActive({ data: { id: row.id, active: !row.ativa } })
      await refresh()
      toast({ tone: 'ok', title: row.ativa ? 'Obra desativada' : 'Obra reativada', body: row.nome })
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível alterar a obra', body: error instanceof Error ? error.message : 'Verifique os vínculos.' })
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Comercial e operação"
        title="Obras"
        description="Gerencie os locais de execução vinculados aos clientes. Desativar uma obra impede novos vínculos, mas preserva orçamentos, pedidos e agenda existentes."
        actions={canManage ? <Button variant="primary" onClick={startNew}><Plus className="h-4 w-4" /> Nova obra</Button> : undefined}
      />

      {formOpen && canManage && (
        <Card className="mb-6">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-xl font-bold uppercase">{draft.id ? 'Editar obra' : 'Cadastrar obra'}</h2>
            <p className="text-sm text-muted">O cliente de uma obra existente não pode ser trocado, para não quebrar os vínculos comerciais.</p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Cliente" required className="md:col-span-2">
              {(id) => <select id={id} className={inputCls()} value={draft.cliente_id} disabled={!!draft.id} onChange={(e) => setDraft((v) => ({ ...v, cliente_id: e.target.value }))}>
                <option value="">Selecione o cliente</option>
                {clients.filter((client) => client.active).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>}
            </Field>
            <Field label="Nome / identificação da obra" required>
              {(id) => <input id={id} className={inputCls()} maxLength={160} value={draft.nome} onChange={(e) => setDraft((v) => ({ ...v, nome: e.target.value }))} />}
            </Field>
            <Field label="Endereço" required className="md:col-span-2">
              {(id) => <input id={id} className={inputCls()} maxLength={200} value={draft.endereco} onChange={(e) => setDraft((v) => ({ ...v, endereco: e.target.value }))} />}
            </Field>
            <Field label="Cidade">{(id) => <input id={id} className={inputCls()} maxLength={100} value={draft.cidade} onChange={(e) => setDraft((v) => ({ ...v, cidade: e.target.value }))} />}</Field>
            <Field label="Região">{(id) => <input id={id} className={inputCls()} maxLength={80} value={draft.regiao} onChange={(e) => setDraft((v) => ({ ...v, regiao: e.target.value }))} />}</Field>
            <Field label="Contato na obra">{(id) => <input id={id} className={inputCls()} maxLength={120} value={draft.contato_nome} onChange={(e) => setDraft((v) => ({ ...v, contato_nome: e.target.value }))} />}</Field>
            <Field label="Telefone do contato">{(id) => <input id={id} className={inputCls()} maxLength={30} value={draft.contato_telefone} onChange={(e) => setDraft((v) => ({ ...v, contato_telefone: e.target.value }))} />}</Field>
            <Field label="Tipo de serviço">{(id) => <input id={id} className={inputCls()} maxLength={120} value={draft.tipo_servico} onChange={(e) => setDraft((v) => ({ ...v, tipo_servico: e.target.value }))} />}</Field>
            <Field label="Observações de acesso" className="md:col-span-2">{(id) => <textarea id={id} rows={2} className={cx(inputCls(), 'h-auto py-2')} maxLength={1000} value={draft.observacoes_acesso} onChange={(e) => setDraft((v) => ({ ...v, observacoes_acesso: e.target.value }))} />}</Field>
            <Field label="Restrições" className="md:col-span-2">{(id) => <textarea id={id} rows={2} className={cx(inputCls(), 'h-auto py-2')} maxLength={1000} value={draft.restricoes} onChange={(e) => setDraft((v) => ({ ...v, restricoes: e.target.value }))} />}</Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button onClick={() => { setFormOpen(false); setDraft(emptyDraft()) }}>Cancelar</Button>
            <Button variant="primary" disabled={busy || !draft.cliente_id || draft.nome.trim().length < 3 || !draft.endereco.trim()} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar obra'}</Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input aria-label="Pesquisar obras" className={cx(inputCls(), 'pl-9')} placeholder="Obra, cliente, endereço ou cidade" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select aria-label="Situação das obras" className={cx(inputCls(), 'w-auto')} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="ativas">Ativas</option><option value="inativas">Inativas</option><option value="todas">Todas</option>
          </select>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={<Building2 className="h-6 w-6" />} title="Nenhuma obra encontrada">Cadastre uma obra ou ajuste os filtros da pesquisa.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase text-muted">
                <tr><th className="px-4 py-3">Obra</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Localização</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3">Status</th>{canManage && <th className="px-4 py-3 text-right">Ações</th>}</tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3"><strong>{row.nome}</strong><span className="block text-xs text-muted">{row.tipo_servico || 'Serviço não informado'}</span></td>
                    <td className="px-4 py-3">{row.cliente_nome}</td>
                    <td className="px-4 py-3">{row.endereco}<span className="block text-xs text-muted">{[row.cidade,row.regiao].filter(Boolean).join(' · ')}</span></td>
                    <td className="px-4 py-3">{row.contato_nome || '—'}<span className="block text-xs text-muted">{row.contato_telefone || 'Sem telefone'}</span></td>
                    <td className="px-4 py-3"><Badge tone={row.ativa ? 'ok' : 'neutral'}>{row.ativa ? 'Ativa' : 'Inativa'}</Badge></td>
                    {canManage && <td className="px-4 py-3"><div className="flex justify-end gap-2">
                      <Button size="sm" onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /> Editar</Button>
                      <Button size="sm" variant={row.ativa ? 'danger' : 'secondary'} onClick={() => void toggleActive(row)}>
                        {row.ativa ? <><Archive className="h-4 w-4" /> Desativar</> : <><RotateCcw className="h-4 w-4" /> Reativar</>}
                      </Button>
                    </div></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
