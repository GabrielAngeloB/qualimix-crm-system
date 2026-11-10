import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Archive, Building2, FileText, MapPin, MessageCircle, Pencil, Phone, Plus, RotateCcw, Search, Users } from 'lucide-react'
import { useStore } from '../data/store'
import { clientTypes, leadSources, regions } from '../data/settings'
import { today, userName, type Client, type Site } from '../data/fixtures'
import { formatDocument, formatPhone, onlyDigits, whatsappUrl } from '../lib/documents'
import { normalizeBrazilPhone, validateClientFields } from '../lib/crm-validation'
import { brlCents, dateBR, daysBetween } from '../lib/format'
import { Badge, Button, Card, Drawer, EmptyState, Field, PageHeader, cx, inputCls } from '../components/ui'
import { Pagination, SortTh, useSortPage } from '../components/table'
import { MiniStat, statusTone } from '../components/bits'
import { newId } from '../components/MeasureCalculator'

export const Route = createFileRoute('/clientes')({
  validateSearch: (s: Record<string, unknown>): { id?: string; novo?: string } => ({
    id: typeof s.id === 'string' ? s.id : undefined,
    novo: typeof s.novo === 'string' ? s.novo : undefined,
  }),
  head: () => ({ meta: [{ title: 'Clientes e obras — Qualimix CRM' }] }),
  component: Clientes,
})

function Clientes() {
  const { id, novo } = Route.useSearch()
  const navigate = useNavigate()
  const { clients, sites, quotes, currentRole, views, archiveClient, restoreClient, toast } = useStore()
  const canCreate = currentRole === 'admin' || currentRole === 'administrador'
  const clientSummaryById = useMemo(() => new Map(views.clients.map((row) => [String(row.id), row])), [views.clients])
  const totalSitesForClient = (clientId: string) => {
    const summary = clientSummaryById.get(clientId)
    return summary ? Number(summary.total_obras ?? 0) : sites.filter((site) => site.clientId === clientId).length
  }
  const totalQuotesForClient = (clientId: string) => {
    const summary = clientSummaryById.get(clientId)
    return summary ? Number(summary.total_orcamentos ?? 0) : quotes.filter((quote) => quote.clientId === clientId).length
  }
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [region, setRegion] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('ativos')
  const [creating, setCreating] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  useEffect(() => {
    if (novo && canCreate) setCreating(true)
  }, [novo, canCreate])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const d = onlyDigits(t)
    return clients.filter(
      (c) =>
        (!type || c.type === type) &&
        (!region || c.region === region) &&
        (!source || c.source === source) &&
        (status === 'todos' || (status === 'ativos' ? c.active : !c.active)) &&
        (!t || c.name.toLowerCase().includes(t) || c.tradeName.toLowerCase().includes(t) || (d.length >= 3 && (c.document.includes(d) || c.phone.includes(d) || c.whatsapp.includes(d)))),
    )
  }, [clients, q, type, region, source, status])

  const t = useSortPage(filtered, { name: (c) => c.name, city: (c) => c.city, type: (c) => c.type, created: (c) => c.createdAt, sites: (c) => totalSitesForClient(c.id) }, { key: 'name', dir: 'asc' })
  const selected = clients.find((c) => c.id === id)
  const closeDetail = () => navigate({ to: '/clientes', search: {} })

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Clientes e obras"
        description="Localize clientes pelo nome, CPF/CNPJ ou telefone. Cada cliente pode ter várias obras."
        actions={canCreate ? (
          <Button variant="primary" onClick={() => navigate({ to: '/clientes/novo' })}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        ) : undefined}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Clientes ativos" value={String(clients.filter((c) => c.active).length)} />
        <MiniStat label="Obras cadastradas" value={String(sites.length)} />
        <MiniStat label="Novos nos últimos 30 dias" value={String(clients.filter((c) => daysBetween(c.createdAt, today) <= 30).length)} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input aria-label="Pesquisar clientes" className={cx(inputCls(), 'pl-9')} placeholder="Nome, CPF/CNPJ ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Sel label="Tipo" value={type} onChange={setType} options={[...clientTypes]} />
          <Sel label="Região" value={region} onChange={setRegion} options={regions} />
          <Sel label="Origem" value={source} onChange={setSource} options={[...leadSources]} />
          <select aria-label="Situação" className={cx(inputCls(), 'w-auto')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        {t.total === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title={clients.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'} action={canCreate ? <Button variant="primary" onClick={() => navigate({ to: '/clientes/novo' })}><Plus className="h-4 w-4" /> Cadastrar cliente</Button> : undefined}>
            {clients.length ? 'Ajuste a pesquisa ou os filtros.' : 'Cadastre o primeiro cliente para começar a orçar.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                <tr>
                  <SortTh label="Cliente" k="name" sort={t.sort} toggle={t.toggle} />
                  <th className="px-4 py-3 font-bold uppercase tracking-wide">Contato</th>
                  <SortTh label="Cidade / região" k="city" sort={t.sort} toggle={t.toggle} />
                  <SortTh label="Tipo" k="type" sort={t.sort} toggle={t.toggle} />
                  <SortTh label="Obras" k="sites" sort={t.sort} toggle={t.toggle} />
                  <th className="px-4 py-3 font-bold uppercase tracking-wide">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {t.pageRows.map((c) => (
                  <tr key={c.id} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60" onClick={() => navigate({ to: '/clientes', search: { id: c.id } })}>
                    <td className="max-w-[280px] px-4 py-3">
                      <Link to="/clientes" search={{ id: c.id }} className="block truncate font-semibold hover:text-brand" onClick={(e) => e.stopPropagation()}>{c.name}</Link>
                      <span className="block truncate text-xs text-muted">
                        {c.document ? formatDocument(c.document) : 'Sem documento'} {!c.active && '· inativo'} {c.demo && '· demo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular">
                      {formatPhone(c.whatsapp || c.phone)}
                      <span className="block text-xs text-muted">Origem: {c.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.city}
                      <span className="block text-xs text-muted">{c.region}</span>
                    </td>
                    <td className="px-4 py-3"><Badge>{c.type}</Badge></td>
                    <td className="px-4 py-3 tabular">
                      {totalSitesForClient(c.id)}
                      <span className="block text-xs text-muted">{totalQuotesForClient(c.id)} orçamentos</span>
                    </td>
                    <td className="px-4 py-3">{userName(c.ownerId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination {...t} />
      </Card>

      {canCreate && <ClientForm
        open={creating}
        onClose={() => {
          setCreating(false)
          if (novo) navigate({ to: '/clientes', search: {} })
        }}
        onCreated={(cid) => navigate({ to: '/clientes', search: { id: cid } })}
      />}
      {editingClient && <ClientForm
        open
        initialClient={editingClient}
        onClose={() => setEditingClient(null)}
        onUpdated={() => { const editedId = editingClient.id; setEditingClient(null); navigate({ to: '/clientes', search: { id: editedId } }) }}
      />}
      {selected && <ClientDetail
        client={selected}
        canManage={canCreate}
        onEdit={() => { setEditingClient(selected); closeDetail() }}
        onArchive={async () => {
          const confirmed = window.confirm(`Tem certeza que deseja arquivar ${selected.name}? Ele sairá da lista de ativos, mas obras, orçamentos, pedidos e histórico serão preservados. Você poderá reativá-lo em Inativos.`)
          if (!confirmed) return
          await archiveClient(selected.id)
          closeDetail()
        }}
        onRestore={async () => {
          await restoreClient(selected.id)
          closeDetail()
          setStatus('ativos')
        }}
        onClose={closeDetail}
      />}
    </>
  )
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <select aria-label={`Filtrar por ${label.toLowerCase()}`} className={cx(inputCls(), 'w-auto')} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}: todos</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
}

const emptyForm = {
  name: '', tradeName: '', type: '', document: '', phone: '', whatsapp: '', sameWa: true, email: '', address: '', city: '', region: '', source: '', notes: '',
  siteName: '', siteAddress: '', siteContact: '', sitePhone: '', siteRestrictions: '',
}

function ClientForm({ open, onClose, onCreated, initialClient, onUpdated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void; initialClient?: Client; onUpdated?: () => void }) {
  const { clients, addClient, updateClient, toast, team, currentUserId } = useStore()
  const initialForm = initialClient ? {
    ...emptyForm, name: initialClient.name, tradeName: initialClient.tradeName, type: initialClient.type,
    document: initialClient.document, phone: initialClient.phone, whatsapp: initialClient.whatsapp,
    sameWa: initialClient.whatsapp === initialClient.phone, email: initialClient.email, address: initialClient.address,
    city: initialClient.city, region: initialClient.region, source: initialClient.source, notes: initialClient.notes,
  } : emptyForm
  const [f, setF] = useState(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tried, setTried] = useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(initialForm)
  const up = (k: keyof typeof emptyForm, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))

  const docDigits = onlyDigits(f.document)
  const phoneDigits = normalizeBrazilPhone(f.phone)
  const dupDoc = docDigits ? clients.find((c) => c.id !== initialClient?.id && c.document === docDigits) : undefined
  const dupPhone = phoneDigits.length >= 10 ? clients.find((c) => c.id !== initialClient?.id && (c.phone === phoneDigits || c.whatsapp === phoneDigits)) : undefined

  const validate = () => validateClientFields({
    ...f,
    whatsapp: f.sameWa ? f.phone : f.whatsapp,
  }, clients.filter((client) => client.id !== initialClient?.id))
  const liveErrors = tried ? validate() : errors

  const close = () => {
    if (dirty && !confirm('Descartar o cadastro em andamento?')) return
    setF(initialForm)
    setErrors({})
    setTried(false)
    onClose()
  }

  const submit = async () => {
    setTried(true)
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      toast({ tone: 'erro', title: 'Revise os campos destacados', body: `${Object.keys(e).length} campo(s) com pendência.` })
      return
    }
    const id = initialClient?.id ?? newId()
    const client: Client = {
      id, name: f.name.trim(), tradeName: f.tradeName.trim(), document: docDigits, phone: phoneDigits, whatsapp: f.sameWa ? phoneDigits : normalizeBrazilPhone(f.whatsapp), email: f.email.trim(), address: f.address.trim(), city: f.city.trim(), region: f.region, type: f.type, source: f.source, ownerId: initialClient?.ownerId ?? currentUserId, notes: f.notes.trim(), createdAt: initialClient?.createdAt ?? today, active: initialClient?.active ?? true, demo: initialClient?.demo ?? false,
    }
    const site: Site | undefined = !initialClient && f.siteName.trim()
      ? { id: newId(), clientId: id, name: f.siteName.trim(), address: f.siteAddress.trim(), city: f.city.trim(), region: f.region, contactName: f.siteContact.trim(), contactPhone: normalizeBrazilPhone(f.sitePhone), serviceType: '', accessNotes: '', restrictions: f.siteRestrictions.trim(), demo: false }
      : undefined
    try {
      if (initialClient) await updateClient(client)
      else await addClient(client, site)
    } catch (error) {
      toast({ tone: 'erro', title: initialClient ? 'Falha ao atualizar cliente' : 'Falha ao cadastrar cliente', body: error instanceof Error ? error.message : 'Erro ao salvar no banco.' })
      return
    }
    setF(initialForm)
    setTried(false)
    onClose()
    if (initialClient) onUpdated?.()
    else onCreated?.(id)
  }

  return (
    <Drawer open={open} onClose={close} title={initialClient ? "Editar cliente" : "Novo cliente"} wide footer={<><Button onClick={close}>Cancelar</Button><Button variant="primary" onClick={submit}>{initialClient ? "Salvar alterações" : "Salvar cliente"}</Button></>}>
      <div className="space-y-6">
        <p className="text-sm text-muted">Campos com <span className="text-brand">*</span> são obrigatórios. O restante pode ser completado depois.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome ou razão social" required error={liveErrors.name} hint="Nome oficial da pessoa ou empresa. Ex.: Construtora Almeida Ltda." className="sm:col-span-2">{(id) => <input id={id} required maxLength={160} autoComplete="organization" className={inputCls(!!liveErrors.name)} value={f.name} placeholder="Ex.: Construtora Almeida Ltda." onChange={(e) => up('name', e.target.value)} autoFocus />}</Field>
          <Field label="Nome fantasia" error={liveErrors.tradeName} hint="Nome pelo qual a empresa é conhecida. Ex.: Camaleão.">{(id) => <input id={id} maxLength={120} className={inputCls(!!liveErrors.tradeName)} value={f.tradeName} placeholder="Ex.: Camaleão" onChange={(e) => up('tradeName', e.target.value)} />}</Field>
          <Field label="Tipo de cliente" required error={liveErrors.type}>
            {(id) => (
              <select id={id} className={inputCls(!!liveErrors.type)} value={f.type} onChange={(e) => up('type', e.target.value)}>
                <option value="">Selecione…</option>
                {clientTypes.map((x) => <option key={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label="CPF ou CNPJ" error={liveErrors.document ?? (dupDoc ? `Já cadastrado: ${dupDoc.name}` : null)} hint="Opcional. Digite somente números ou use a máscara. Ex.: 00.000.000/0000-00.">
            {(id) => <input id={id} inputMode="numeric" maxLength={18} autoComplete="off" className={inputCls(!!liveErrors.document || !!dupDoc)} value={f.document} placeholder="00.000.000/0000-00" onChange={(e) => up('document', e.target.value)} onBlur={() => up('document', formatDocument(f.document))} />}
          </Field>
          <Field label="Telefone" required error={liveErrors.phone} hint={dupPhone ? `Atenção: telefone já usado por ${dupPhone.name}` : undefined}>
            {(id) => <input id={id} required inputMode="tel" maxLength={20} autoComplete="tel" className={inputCls(!!liveErrors.phone)} value={f.phone} placeholder="(61) 99999-9999" onChange={(e) => up('phone', e.target.value)} onBlur={() => up('phone', formatPhone(f.phone))} />}
          </Field>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--brand)]" checked={f.sameWa} onChange={(e) => up('sameWa', e.target.checked)} />
              O WhatsApp é o mesmo número do telefone
            </label>
            {!f.sameWa && (
              <Field label="WhatsApp" error={liveErrors.whatsapp} hint="Quando for diferente do telefone. Ex.: (61) 98888-7777." className="mt-3 sm:w-1/2">{(id) => <input id={id} inputMode="tel" maxLength={20} className={inputCls(!!liveErrors.whatsapp)} value={f.whatsapp} placeholder="(61) 98888-7777" onChange={(e) => up('whatsapp', e.target.value)} onBlur={() => up('whatsapp', formatPhone(f.whatsapp))} />}</Field>
            )}
          </div>
          <Field label="E-mail" error={liveErrors.email} hint="Ex.: compras@empresa.com.br. Campo opcional.">{(id) => <input id={id} type="email" maxLength={254} autoComplete="email" className={inputCls(!!liveErrors.email)} value={f.email} placeholder="compras@empresa.com.br" onChange={(e) => up('email', e.target.value)} />}</Field>
          <Field label="Origem do lead" required error={liveErrors.source} hint="Registre o canal por onde o primeiro contato chegou. Ex.: WhatsApp 1, Instagram ou Indicação.">
            {(id) => (
              <select id={id} className={inputCls(!!liveErrors.source)} value={f.source} onChange={(e) => up('source', e.target.value)}>
                <option value="">Selecione…</option>
                {leadSources.map((x) => <option key={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label="Endereço" error={liveErrors.address} hint="Ex.: Quadra 00, Conjunto 00, Lote 00, Setor Norte." className="sm:col-span-2">{(id) => <input id={id} maxLength={200} className={inputCls(!!liveErrors.address)} value={f.address} placeholder="Ex.: Quadra 00, Conjunto 00, Lote 00" onChange={(e) => up('address', e.target.value)} />}</Field>
          <Field label="Cidade" error={liveErrors.city} hint="Inclua a UF para evitar cidades com o mesmo nome. Ex.: Sobradinho - DF.">{(id) => <input id={id} maxLength={100} className={inputCls(!!liveErrors.city)} value={f.city} placeholder="Ex.: Sobradinho - DF" onChange={(e) => up('city', e.target.value)} />}</Field>
          <Field label="Região de atendimento" required error={liveErrors.region} hint="Escolha a região comercial atendida pela empresa, não o bairro do endereço.">
            {(id) => (
              <select id={id} className={inputCls(!!liveErrors.region)} value={f.region} onChange={(e) => up('region', e.target.value)}>
                <option value="">Selecione…</option>
                {regions.map((x) => <option key={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <div className="sm:col-span-2 rounded-md border border-line bg-surface-2 p-3 text-sm">
            <p className="font-semibold">Responsável comercial</p>
            <p className="mt-1 text-muted">{team.find((member) => member.id === currentUserId)?.name ?? 'Usuário autenticado'} — atribuído automaticamente à conta que está cadastrando este cliente.</p>
          </div>
          <Field label="Observações" error={liveErrors.notes} hint="Ex.: prefere contato pela manhã; falar com o setor de compras." className="sm:col-span-2">{(id) => <textarea id={id} rows={2} maxLength={2000} className={cx(inputCls(!!liveErrors.notes), 'h-auto py-2')} value={f.notes} placeholder="Ex.: Prefere contato pela manhã; falar com compras." onChange={(e) => up('notes', e.target.value)} />}</Field>
        </div>

        {!initialClient && <div className="rounded-lg border border-dashed border-line p-4">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold uppercase"><Building2 className="h-5 w-5 text-brand" /> Primeira obra (opcional)</h3>
          <p className="mb-4 text-sm text-muted">Já cadastre a obra para orçar em seguida.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome ou identificação da obra" error={liveErrors.siteName} hint="Use o nome do empreendimento ou uma identificação fácil de localizar. Ex.: Residencial Jardim das Flores — Bloco A." className="sm:col-span-2">{(id) => <input id={id} maxLength={160} className={inputCls(!!liveErrors.siteName)} value={f.siteName} placeholder="Ex.: Residencial Jardim das Flores — Bloco A" onChange={(e) => up('siteName', e.target.value)} />}</Field>
            <Field label="Endereço da obra" error={liveErrors.siteAddress} hint="Informe o endereço de entrega/execução, não o endereço da sede do cliente. Ex.: Rua das Acácias, 500, portão 2." className="sm:col-span-2">{(id) => <input id={id} maxLength={200} className={inputCls(!!liveErrors.siteAddress)} value={f.siteAddress} placeholder="Ex.: Rua das Acácias, 500, portão 2" onChange={(e) => up('siteAddress', e.target.value)} />}</Field>
            <Field label="Contato na obra" error={liveErrors.siteContact} hint="Ex.: João Silva — mestre de obras.">{(id) => <input id={id} maxLength={120} className={inputCls(!!liveErrors.siteContact)} value={f.siteContact} placeholder="Ex.: João Silva — mestre de obras" onChange={(e) => up('siteContact', e.target.value)} />}</Field>
            <Field label="Telefone do contato" error={liveErrors.sitePhone} hint="Opcional. Ex.: (61) 98888-7777.">{(id) => <input id={id} inputMode="tel" maxLength={20} className={inputCls(!!liveErrors.sitePhone)} value={f.sitePhone} placeholder="(61) 98888-7777" onChange={(e) => up('sitePhone', e.target.value)} onBlur={() => up('sitePhone', formatPhone(f.sitePhone))} />}</Field>
            <Field label="Restrições de acesso e descarga" error={liveErrors.siteRestrictions} hint="Anote regras que afetam a entrada do caminhão ou o horário de serviço." className="sm:col-span-2">{(id) => <input id={id} maxLength={500} className={inputCls(!!liveErrors.siteRestrictions)} value={f.siteRestrictions} placeholder="Ex.: descarga até 16h; entrada pela Rua B; altura máxima 3,5 m." onChange={(e) => up('siteRestrictions', e.target.value)} />}</Field>
          </div>
        </div>}
      </div>
    </Drawer>
  )
}

function ClientDetail({ client, canManage, onEdit, onArchive, onRestore, onClose }: { client: Client; canManage: boolean; onEdit: () => void; onArchive: () => Promise<void>; onRestore: () => Promise<void>; onClose: () => void }) {
  const { sites, quotes, receivables, opportunities, toast } = useStore()
  const own = sites.filter((s) => s.clientId === client.id)
  const cq = quotes.filter((q) => q.clientId === client.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const accepted = cq.filter((q) => q.status === 'Aceito')
  const contracted = accepted.reduce((s, q) => s + (q.result.totalCents ?? 0), 0)
  const open = receivables.filter((r) => r.clientId === client.id && r.status !== 'Pago' && r.status !== 'Cancelado')
  const openCents = open.reduce((s, r) => s + r.openCents, 0)
  const overdue = open.some((r) => r.status === 'Vencido')
  const history = opportunities.filter((o) => o.clientId === client.id).flatMap((o) => o.history.map((h) => ({ ...h, title: o.title }))).sort((a, b) => b.at.localeCompare(a.at))
  const wa = whatsappUrl(client.whatsapp || client.phone, `Olá, ${client.name.split(' ')[0]}! Tudo bem?`)

  return (
    <Drawer open onClose={onClose} title="Cliente" wide footer={canManage ? <div className="flex flex-wrap justify-between gap-2">{client.active ? <Button variant="danger" onClick={() => { void onArchive().catch((error) => toast({ tone: 'erro', title: 'Não foi possível arquivar o cliente', body: error instanceof Error ? error.message : 'Erro ao atualizar o banco.' })) }}><Archive className="h-4 w-4" /> Arquivar cliente</Button> : <Button onClick={() => { void onRestore().catch((error) => toast({ tone: 'erro', title: 'Não foi possível reativar o cliente', body: error instanceof Error ? error.message : 'Erro ao atualizar o banco.' })) }}><RotateCcw className="h-4 w-4" /> Reativar cliente</Button>}<div className="flex gap-2"><Button onClick={onClose}>Fechar</Button><Button variant="primary" onClick={onEdit}><Pencil className="h-4 w-4" /> Editar cliente</Button></div></div> : <Button onClick={onClose}>Fechar</Button>}>
      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-3xl font-extrabold uppercase leading-none">{client.name}</h3>
            {!client.active && <Badge tone="red">Inativo</Badge>}
            {client.demo && <Badge tone="warn">Demo</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">{client.tradeName && `${client.tradeName} · `}{client.type} · {client.document ? formatDocument(client.document) : 'Sem documento'} · Cliente desde {dateBR(client.createdAt)}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1 rounded border border-line px-2 py-1"><Phone className="h-3.5 w-3.5" /> {formatPhone(client.phone)}</span>
            {client.address && <span className="inline-flex items-center gap-1 rounded border border-line px-2 py-1"><MapPin className="h-3.5 w-3.5" /> {client.address}, {client.city}</span>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-[#1f9d55] px-2 py-1 font-semibold text-white"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>}
            <Link to="/orcamentos/novo" className="inline-flex items-center gap-1 rounded bg-brand px-2 py-1 font-semibold text-white"><FileText className="h-3.5 w-3.5" /> Novo orçamento</Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Orçamentos" value={String(cq.length)} sub={`${accepted.length} aceitos`} />
          <MiniStat label="Contratado" value={brlCents(contracted)} sub="Orçamentos aceitos" />
          <MiniStat label="Em aberto" value={brlCents(openCents)} sub={overdue ? 'Há parcelas vencidas' : 'A receber'} tone={overdue ? 'red' : undefined} />
        </div>

        <section>
          <h4 className="mb-2 text-lg font-bold uppercase">Obras ({own.length})</h4>
          {own.length === 0 ? <p className="text-sm text-muted">Nenhuma obra cadastrada.</p> : (
            <ul className="space-y-2">
              {own.map((s) => (
                <li key={s.id} className="rounded-md border border-line p-3 text-sm">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-muted">{s.address} — {s.city} · {s.region}</p>
                  <p className="text-muted">Contato: {s.contactName || '—'} {s.contactPhone && `· ${formatPhone(s.contactPhone)}`} {s.serviceType && `· ${s.serviceType}`}</p>
                  {s.restrictions && <p className="text-warn">Restrição: {s.restrictions}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-lg font-bold uppercase">Orçamentos e compras</h4>
          {cq.length === 0 ? <p className="text-sm text-muted">Nenhum orçamento para este cliente.</p> : (
            <ul className="divide-y divide-line rounded-md border border-line text-sm">
              {cq.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-semibold tabular">{q.number} <span className="font-normal text-muted">· {dateBR(q.createdAt)}</span></p>
                    <p className="text-xs text-muted">{sites.find((s) => s.id === q.siteId)?.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular">{brlCents(q.result.totalCents)}</span>
                    <Badge tone={statusTone(q.status)}>{q.status}</Badge>
                    <Link to="/orcamentos/novo" search={{ origem: q.id }} className="text-xs font-semibold text-brand hover:underline">Recomprar</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 text-lg font-bold uppercase">Histórico de contatos</h4>
          {history.length === 0 ? <p className="text-sm text-muted">Sem registros.</p> : (
            <ol className="space-y-2 border-l-2 border-line pl-4 text-sm">
              {history.map((h, i) => (
                <li key={i}>
                  <p><span className="font-semibold">{h.text}</span> <span className="text-muted">— {h.title}</span></p>
                  <p className="text-xs text-muted">{dateBR(h.at)} · {userName(h.by)}</p>
                </li>
              ))}
            </ol>
          )}
          {client.notes && <p className="mt-3 rounded bg-surface-2 p-3 text-sm"><strong>Observações:</strong> {client.notes}</p>}
        </section>
      </div>
    </Drawer>
  )
}
