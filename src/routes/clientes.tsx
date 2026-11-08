import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Building2, FileText, MapPin, MessageCircle, Phone, Plus, Search, Users } from 'lucide-react'
import { useStore } from '../data/store'
import type { Client, Site } from '../data/fixtures'
import { today } from '../lib/clock'
import { displayUserName, localUserId } from '../data/session'
import { formatDocument, formatPhone, onlyDigits, validateDocument, whatsappUrl } from '../lib/documents'
import { brlCents, dateBR, daysBetween } from '../lib/format'
import { Badge, Button, Card, Drawer, EmptyState, Field, PageHeader, cx, inputCls } from '../components/ui'
import { Pagination, SortTh, useSortPage } from '../components/table'
import { MiniStat, statusTone } from '../components/bits'
import { newId } from '../components/MeasureCalculator'
import { createOpportunityFromClient } from '../lib/client-lead'

export const Route = createFileRoute('/clientes')({
  validateSearch: (s: Record<string, unknown>): { id?: string; novo?: string } => ({
    id: typeof s.id === 'string' ? s.id : undefined,
    novo: typeof s.novo === 'string' ? s.novo : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Clientes e obras — Qualimix CRM' },
      { name: 'description', content: 'Pesquise clientes por nome, CPF/CNPJ ou telefone e veja obras, orçamentos e histórico.' },
      { property: 'og:title', content: 'Clientes e obras — Qualimix CRM' },
      { property: 'og:description', content: 'Cadastro e visão consolidada de clientes e obras da Qualimix.' },
    ],
  }),
  component: Clientes,
})

function Clientes() {
  const { id, novo } = Route.useSearch()
  const navigate = useNavigate()
  const { clients, sites, quotes, settings } = useStore()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [region, setRegion] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('ativos')
  const [creating, setCreating] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  useEffect(() => {
    if (novo) setCreating(true)
  }, [novo])

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

  const t = useSortPage(filtered, { name: (c) => c.name, city: (c) => c.city, type: (c) => c.type, created: (c) => c.createdAt, sites: (c) => sites.filter((s) => s.clientId === c.id).length }, { key: 'name', dir: 'asc' })
  const selected = clients.find((c) => c.id === id)
  const closeDetail = () => navigate({ to: '/clientes', search: {} })

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Clientes e obras"
        description="Localize clientes pelo nome, CPF/CNPJ ou telefone. Cada cliente pode ter várias obras."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
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
          <Sel label="Tipo" value={type} onChange={setType} options={[...settings.clientTypes]} />
          <Sel label="Região" value={region} onChange={setRegion} options={settings.regions} />
          <Sel label="Origem" value={source} onChange={setSource} options={[...settings.leadSources]} />
          <select aria-label="Situação" className={cx(inputCls(), 'w-auto')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        {t.total === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title={clients.length ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'} action={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Cadastrar cliente</Button>}>
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
                      {sites.filter((s) => s.clientId === c.id).length}
                      <span className="block text-xs text-muted">{quotes.filter((x) => x.clientId === c.id).length} orçamentos</span>
                    </td>
                    <td className="px-4 py-3">{displayUserName(c.ownerId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination {...t} />
      </Card>

      <ClientForm
        open={creating || !!editingClient}
        client={editingClient ?? undefined}
        onClose={() => {
          setCreating(false)
          setEditingClient(null)
          if (novo) navigate({ to: '/clientes', search: {} })
        }}
        onCreated={(cid) => navigate({ to: '/clientes', search: { id: cid } })}
      />
      {selected && <ClientDetail client={selected} onClose={closeDetail} onEdit={() => { setEditingClient(selected); closeDetail() }} />}
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
  name: '', tradeName: '', type: '', document: '', phone: '', whatsapp: '', sameWa: true, email: '', address: '', city: '', region: '', source: '', ownerId: localUserId, notes: '',
  siteName: '', siteAddress: '', siteContact: '', sitePhone: '', siteRestrictions: '',
}

function clientFormFromRecord(client: Client) {
  return {
    ...emptyForm,
    name: client.name,
    tradeName: client.tradeName,
    type: client.type === 'Não informado' ? '' : client.type,
    document: client.document,
    phone: client.phone,
    whatsapp: client.whatsapp,
    sameWa: client.whatsapp === client.phone,
    email: client.email,
    address: client.address,
    city: client.city,
    region: client.region,
    source: client.source === 'Não informado' ? '' : client.source,
    ownerId: client.ownerId,
    notes: client.notes,
  }
}

function ClientForm({ open, client, onClose, onCreated }: { open: boolean; client?: Client; onClose: () => void; onCreated: (id: string) => void }) {
  const { clients, registerClientWithLead, updateClient, toast, settings } = useStore()
  const initialForm = useMemo(() => client ? clientFormFromRecord(client) : emptyForm, [client])
  const [f, setF] = useState(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tried, setTried] = useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(initialForm)
  useEffect(() => {
    if (!open) return
    setF(initialForm)
    setErrors({})
    setTried(false)
  }, [open, initialForm])
  const up = (k: keyof typeof emptyForm, v: string | boolean) => setF((x) => ({ ...x, [k]: v }))

  const docDigits = onlyDigits(f.document)
  const phoneDigits = onlyDigits(f.phone)
  const dupDoc = docDigits ? clients.find((c) => c.id !== client?.id && c.document === docDigits) : undefined
  const dupPhone = phoneDigits.length >= 10 ? clients.find((c) => c.id !== client?.id && (c.phone === phoneDigits || c.whatsapp === phoneDigits)) : undefined

  const validate = () => {
    const e: Record<string, string> = {}
    if (f.document.trim()) {
      const documentError = validateDocument(f.document)
      if (documentError) e.document = documentError
      if (dupDoc) e.document = 'Documento já cadastrado para ' + dupDoc.name
    }
    if (phoneDigits && ![10, 11].includes(phoneDigits.length)) {
      e.phone = 'Telefone deve ter DDD e 10 ou 11 dígitos'
    }
    const whatsappDigits = onlyDigits(f.whatsapp)
    if (!f.sameWa && whatsappDigits && ![10, 11].includes(whatsappDigits.length)) {
      e.whatsapp = 'WhatsApp deve ter DDD e 10 ou 11 dígitos'
    }
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) {
      e.email = 'E-mail inválido'
    }
    return e
  }
  const liveErrors = tried ? validate() : errors

  const close = () => {
    if (dirty && !confirm('Descartar o cadastro em andamento?')) return
    setF(initialForm)
    setErrors({})
    setTried(false)
    onClose()
  }

  const submit = () => {
    setTried(true)
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      toast({ tone: 'erro', title: 'Confira os dados informados', body: Object.keys(validationErrors).length + ' campo(s) precisam de correção.' })
      return
    }

    const source = f.source.trim() || 'Não informado'
    if (client) {
      const updated: Client = {
        ...client,
        name: f.name.trim() || f.tradeName.trim() || 'Cliente sem identificação',
        tradeName: f.tradeName.trim(),
        document: docDigits,
        phone: phoneDigits,
        whatsapp: f.sameWa ? phoneDigits : onlyDigits(f.whatsapp),
        email: f.email.trim(),
        address: f.address.trim(),
        city: f.city.trim(),
        region: f.region.trim(),
        type: f.type.trim() || 'Não informado',
        source,
        ownerId: f.ownerId || localUserId,
        notes: f.notes.trim(),
      }
      try {
        updateClient(updated)
      } catch (error) {
        toast({ tone: 'erro', title: 'Não foi possível atualizar o cliente', body: error instanceof Error ? error.message : 'Revise os dados e tente novamente.' })
        return
      }
      toast({ tone: 'ok', title: 'Cliente atualizado', body: updated.name })
      setF(initialForm)
      setErrors({})
      setTried(false)
      onClose()
      onCreated(client.id)
      return
    }

    const id = newId()
    const newClient: Client = {
      id,
      name: f.name.trim() || f.tradeName.trim() || 'Cliente sem identificação',
      tradeName: f.tradeName.trim(),
      document: docDigits,
      phone: phoneDigits,
      whatsapp: f.sameWa ? phoneDigits : onlyDigits(f.whatsapp),
      email: f.email.trim(),
      address: f.address.trim(),
      city: f.city.trim(),
      region: f.region.trim(),
      type: f.type.trim() || 'Não informado',
      source,
      ownerId: f.ownerId || localUserId,
      notes: f.notes.trim(),
      createdAt: today,
      active: true,
      demo: false,
    }

    const siteFields = [f.siteName, f.siteAddress, f.siteContact, f.sitePhone, f.siteRestrictions]
    const hasSiteDetails = siteFields.some((value) => value.trim())
    const site: Site | undefined = hasSiteDetails
      ? {
          id: newId(),
          clientId: id,
          name: f.siteName.trim() || 'Obra sem identificação',
          address: f.siteAddress.trim(),
          city: f.city.trim(),
          region: f.region.trim(),
          contactName: f.siteContact.trim(),
          contactPhone: onlyDigits(f.sitePhone),
          serviceType: '',
          accessNotes: '',
          restrictions: f.siteRestrictions.trim(),
          demo: false,
        }
      : undefined

    const opportunity = createOpportunityFromClient(newClient, newId(), today)
    try {
      registerClientWithLead(newClient, site, opportunity)
    } catch (error) {
      toast({ tone: 'erro', title: 'Não foi possível cadastrar', body: error instanceof Error ? error.message : 'Revise os dados e tente novamente.' })
      return
    }

    toast({ tone: 'ok', title: 'Cliente cadastrado e enviado ao funil', body: 'Oportunidade criada automaticamente em Novo lead.' })
    setF(initialForm)
    setTried(false)
    setErrors({})
    onClose()
    onCreated(id)
  }

  return (
    <Drawer open={open} onClose={close} title={client ? 'Editar cliente' : 'Novo cliente'} wide footer={<><Button onClick={close}>Cancelar</Button><Button variant="primary" onClick={submit}>{client ? 'Salvar alterações' : 'Salvar cliente'}</Button></>}>
      <div className="space-y-6">
        <p className="text-sm text-muted">{client ? 'Atualize os dados sem alterar o identificador do cliente. Orçamentos, pedidos, obras e financeiro continuam vinculados ao mesmo registro.' : 'Todos os campos são opcionais. Cadastre apenas o que já souber e complete as informações depois.'}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome ou razão social" error={liveErrors.name} hint="Opcional. Sem nome, o CRM cria o registro como Cliente sem identificação." className="sm:col-span-2">{(id) => <input id={id} className={inputCls(!!liveErrors.name)} value={f.name} onChange={(e) => up('name', e.target.value)} autoFocus />}</Field>
          <Field label="Nome fantasia">{(id) => <input id={id} className={inputCls()} value={f.tradeName} onChange={(e) => up('tradeName', e.target.value)} />}</Field>
          <Field label="Tipo de cliente" error={liveErrors.type}>
            {(id) => (
              <select id={id} className={inputCls(!!liveErrors.type)} value={f.type} onChange={(e) => up('type', e.target.value)}>
                <option value="">Selecione…</option>
                {settings.clientTypes.map((x) => <option key={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label="CPF ou CNPJ" error={liveErrors.document ?? (dupDoc ? `Já cadastrado: ${dupDoc.name}` : null)} hint="Opcional. Validamos os dígitos verificadores.">
            {(id) => <input id={id} inputMode="numeric" className={inputCls(!!liveErrors.document || !!dupDoc)} value={f.document} onChange={(e) => up('document', e.target.value)} onBlur={() => up('document', formatDocument(f.document))} />}
          </Field>
          <Field label="Telefone" error={liveErrors.phone} hint={dupPhone ? `Atenção: telefone já usado por ${dupPhone.name}` : "Opcional. Pode ser informado depois."}>
            {(id) => <input id={id} inputMode="tel" className={inputCls(!!liveErrors.phone)} value={f.phone} placeholder="(00) 00000-0000" onChange={(e) => up('phone', e.target.value)} onBlur={() => up('phone', formatPhone(f.phone))} />}
          </Field>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--brand)]" checked={f.sameWa} onChange={(e) => up('sameWa', e.target.checked)} />
              O WhatsApp é o mesmo número do telefone
            </label>
            {!f.sameWa && (
              <Field label="WhatsApp" error={liveErrors.whatsapp} className="mt-3 sm:w-1/2">{(id) => <input id={id} inputMode="tel" className={inputCls(!!liveErrors.whatsapp)} value={f.whatsapp} onChange={(e) => up('whatsapp', e.target.value)} />}</Field>
            )}
          </div>
          <Field label="E-mail" error={liveErrors.email}>{(id) => <input id={id} type="email" className={inputCls(!!liveErrors.email)} value={f.email} onChange={(e) => up('email', e.target.value)} />}</Field>
          <Field label="Origem do lead" error={liveErrors.source}>
            {(id) => (
              <select id={id} className={inputCls(!!liveErrors.source)} value={f.source} onChange={(e) => up('source', e.target.value)}>
                <option value="">Selecione (opcional)…</option>
                {settings.leadSources.map((x) => <option key={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label="Endereço" className="sm:col-span-2">{(id) => <input id={id} className={inputCls()} value={f.address} onChange={(e) => up('address', e.target.value)} />}</Field>
          <Field label="Cidade">{(id) => <input id={id} className={inputCls()} value={f.city} onChange={(e) => up('city', e.target.value)} />}</Field>
          <Field label="Região de atendimento" error={liveErrors.region}>
            {(id) => (
              <select id={id} className={inputCls(!!liveErrors.region)} value={f.region} onChange={(e) => up('region', e.target.value)}>
                <option value="">Não informado</option>
                {settings.regions.map((x) => <option key={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label="Responsável comercial">
            {(id) => (
              <select id={id} className={inputCls()} value={f.ownerId} onChange={(e) => up('ownerId', e.target.value)}>
                <option value={localUserId}>Sessão local</option>
              </select>
            )}
          </Field>
          <Field label="Observações" className="sm:col-span-2">{(id) => <textarea id={id} rows={2} className={cx(inputCls(), 'h-auto py-2')} value={f.notes} onChange={(e) => up('notes', e.target.value)} />}</Field>
        </div>

        {!client && <div className="rounded-lg border border-dashed border-line p-4">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-bold uppercase"><Building2 className="h-5 w-5 text-brand" /> Primeira obra (opcional)</h3>
          <p className="mb-4 text-sm text-muted">Já cadastre a obra para orçar em seguida.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome ou identificação da obra" error={liveErrors.siteName} className="sm:col-span-2">{(id) => <input id={id} className={inputCls(!!liveErrors.siteName)} value={f.siteName} onChange={(e) => up('siteName', e.target.value)} />}</Field>
            <Field label="Endereço da obra" error={liveErrors.siteAddress} className="sm:col-span-2">{(id) => <input id={id} className={inputCls(!!liveErrors.siteAddress)} value={f.siteAddress} onChange={(e) => up('siteAddress', e.target.value)} />}</Field>
            <Field label="Contato na obra">{(id) => <input id={id} className={inputCls()} value={f.siteContact} onChange={(e) => up('siteContact', e.target.value)} />}</Field>
            <Field label="Telefone do contato">{(id) => <input id={id} inputMode="tel" className={inputCls()} value={f.sitePhone} onChange={(e) => up('sitePhone', e.target.value)} />}</Field>
            <Field label="Restrições de acesso e descarga" className="sm:col-span-2">{(id) => <input id={id} className={inputCls()} value={f.siteRestrictions} placeholder="Ex.: descarga até 16h, rua estreita" onChange={(e) => up('siteRestrictions', e.target.value)} />}</Field>
          </div>
        </div>}
      </div>
    </Drawer>
  )
}

function ClientDetail({ client, onClose, onEdit }: { client: Client; onClose: () => void; onEdit: () => void }) {
  const { sites, quotes, receivables, opportunities, updateClient, toast } = useStore()
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
    <Drawer open onClose={onClose} title="Cliente" wide>
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
            <Button size="sm" onClick={onEdit}>Editar cadastro</Button>
            <Button size="sm" variant={client.active ? 'danger' : 'secondary'} onClick={() => {
              const nextActive = !client.active
              const label = nextActive ? 'reativar' : 'inativar'
              if (!confirm(`Deseja ${label} este cliente? O histórico e os vínculos serão preservados.`)) return
              try {
                updateClient({ ...client, active: nextActive })
                toast({ tone: 'ok', title: nextActive ? 'Cliente reativado' : 'Cliente inativado', body: client.name })
              } catch (error) {
                toast({ tone: 'erro', title: 'Não foi possível atualizar a situação', body: error instanceof Error ? error.message : 'Tente novamente.' })
              }
            }}>{client.active ? 'Inativar cliente' : 'Reativar cliente'}</Button>
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
                  <p className="text-xs text-muted">{dateBR(h.at)} · {displayUserName(h.by)}</p>
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
