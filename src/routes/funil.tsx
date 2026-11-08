import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Bell, Clock, KanbanSquare, List, Plus, SquareKanban, TriangleAlert } from 'lucide-react'
import { useStore } from '../data/store'
import { funnelStages, leadSources, lossReasons, type StageId } from '../data/settings'
import type { Opportunity } from '../data/fixtures'
import { today } from '../lib/clock'
import { displayUserName, localUserId } from '../data/session'
import { brl, dateBR, daysBetween, parseDecimal } from '../lib/format'
import { Badge, Button, Card, Drawer, EmptyState, Field, Modal, PageHeader, SegTabs, cx, inputCls } from '../components/ui'
import { Pagination, SortTh, useSortPage } from '../components/table'

export const Route = createFileRoute('/funil')({
  head: () => ({
    meta: [
      { title: 'Funil comercial — Qualimix CRM' },
      { name: 'description', content: 'Oportunidades por etapa, follow-ups atrasados e do dia, motivos de perda e histórico.' },
      { property: 'og:title', content: 'Funil comercial — Qualimix CRM' },
      { property: 'og:description', content: 'Acompanhe as oportunidades comerciais da Qualimix etapa por etapa.' },
    ],
  }),
  component: Funil,
})

const STALE_DAYS = 7
const stageLabel = (id: StageId) => funnelStages.find((s) => s.id === id)?.label ?? id
const isOpen = (o: Opportunity) => o.stage !== 'fechado' && o.stage !== 'perdido'

function followUp(o: Opportunity) {
  if (!isOpen(o)) return null
  if (o.nextContact && daysBetween(today, o.nextContact) < 0) return { tone: 'red' as const, text: `Atrasado ${-daysBetween(today, o.nextContact)}d` }
  if (o.nextContact && daysBetween(today, o.nextContact) === 0) return { tone: 'warn' as const, text: 'Hoje' }
  if (!o.lastContact || daysBetween(o.lastContact, today) >= STALE_DAYS) return { tone: 'warn' as const, text: 'Sem retorno' }
  return null
}

function Funil() {
  const { opportunities, clients, sites, addOpportunity, updateOpportunity, toast } = useStore()
  const [view, setView] = useState<'kanban' | 'tabela'>('kanban')
  const [owner, setOwner] = useState('')
  const [source, setSource] = useState('')
  const [period, setPeriod] = useState('')
  const [stage, setStage] = useState('')
  const [losing, setLosing] = useState<{ id: string; reason: string; note: string } | null>(null)
  const [closing, setClosing] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newLead, setNewLead] = useState({ title: '', clientId: '', siteId: '', value: '', source: leadSources[0], nextContact: today, nextAction: 'Realizar primeiro contato' })

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—'

  const filtered = useMemo(
    () =>
      opportunities.filter(
        (o) => (!owner || o.ownerId === owner) && (!source || o.source === source) && (!stage || o.stage === stage) && (!period || daysBetween(o.enteredAt, today) <= Number(period)),
      ),
    [opportunities, owner, source, period, stage],
  )

  const overdue = filtered.filter((o) => isOpen(o) && o.nextContact && daysBetween(today, o.nextContact) < 0)
  const todayList = filtered.filter((o) => isOpen(o) && o.nextContact && daysBetween(today, o.nextContact) === 0)
  const stale = filtered.filter((o) => isOpen(o) && (!o.lastContact || daysBetween(o.lastContact, today) >= STALE_DAYS))

  const move = (o: Opportunity, to: StageId) => {
    if (to === o.stage) return
    if (to === 'perdido') return setLosing({ id: o.id, reason: '', note: '' })
    if (to === 'fechado') return setClosing(o.id)
    updateOpportunity(o.id, { stage: to, lossReason: null }, `Etapa alterada: ${stageLabel(o.stage)} → ${stageLabel(to)}`)
    toast({ tone: 'ok', title: 'Etapa atualizada', body: `${o.title}: ${stageLabel(to)}` })
  }

  const t = useSortPage(filtered, { title: (o) => o.title, stage: (o) => funnelStages.findIndex((s) => s.id === o.stage), value: (o) => o.estimatedValue ?? -1, next: (o) => o.nextContact ?? '9999', entered: (o) => o.enteredAt }, { key: 'next', dir: 'asc' }, 10)
  const selected = opportunities.find((o) => o.id === detail)

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Funil comercial"
        description="Acompanhe cada oportunidade do primeiro contato ao fechamento. O fechamento é sempre uma ação explícita."
        actions={
          <>
            <SegTabs label="Visualização" value={view} onChange={setView} options={[{ value: 'kanban', label: <span className="inline-flex items-center gap-1"><SquareKanban className="h-4 w-4" /> Colunas</span> }, { value: 'tabela', label: <span className="inline-flex items-center gap-1"><List className="h-4 w-4" /> Tabela</span> }]} />
            <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Novo lead</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <AlertBox icon={<TriangleAlert className="h-4 w-4" />} tone="red" title="Follow-ups atrasados" items={overdue} onOpen={setDetail} clientName={clientName} />
        <AlertBox icon={<Bell className="h-4 w-4" />} tone="warn" title="Para hoje" items={todayList} onOpen={setDetail} clientName={clientName} />
        <AlertBox icon={<Clock className="h-4 w-4" />} tone="neutral" title={`Sem contato há ${STALE_DAYS}+ dias`} items={stale} onOpen={setDetail} clientName={clientName} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Responsável" className={cx(inputCls(), 'w-auto')} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Responsável: todos</option>
          {[...new Set([localUserId, ...opportunities.map((opportunity) => opportunity.ownerId)])].map((ownerId) => <option key={ownerId} value={ownerId}>{displayUserName(ownerId)}</option>)}
        </select>
        <select aria-label="Origem" className={cx(inputCls(), 'w-auto')} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Origem: todas</option>
          {leadSources.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select aria-label="Período de entrada" className={cx(inputCls(), 'w-auto')} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">Entrada: qualquer data</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
        {view === 'tabela' && (
          <select aria-label="Etapa" className={cx(inputCls(), 'w-auto')} value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Etapa: todas</option>
            {funnelStages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
      </div>

      {opportunities.length === 0 ? (
        <Card><EmptyState icon={<KanbanSquare className="h-6 w-6" />} title="Funil vazio">Nenhuma oportunidade registrada. Os leads cadastrados aparecerão aqui.</EmptyState></Card>
      ) : view === 'kanban' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
          <div className="grid auto-cols-[270px] grid-flow-col gap-3">
            {funnelStages.map((s, idx) => {
              const items = filtered.filter((o) => o.stage === s.id)
              const total = items.reduce((a, o) => a + (o.estimatedValue ?? 0), 0)
              return (
                <section key={s.id} aria-label={s.label} className={cx('flex min-h-[320px] flex-col rounded-lg border border-line bg-surface-2', s.id === 'fechado' && 'border-ok/30', s.id === 'perdido' && 'opacity-80')}>
                  <header className="border-b border-line px-3 py-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold uppercase leading-tight">
                        <span className="mr-1 text-muted">{idx + 1}.</span>
                        {s.label}
                      </h2>
                      <span className="rounded bg-ink px-1.5 text-xs font-bold text-bg">{items.length}</span>
                    </div>
                    <p className="text-xs text-muted tabular">{total ? `${brl(total)} estimados` : '—'}</p>
                  </header>
                  <div className="flex-1 space-y-2 p-2">
                    {items.map((o) => {
                      const f = followUp(o)
                      return (
                        <article key={o.id} className="anim-fade rounded-md border border-line bg-surface p-3 shadow-sm">
                          <button onClick={() => setDetail(o.id)} className="block w-full text-left">
                            <p className="font-semibold leading-tight hover:text-brand">{o.title}</p>
                            <p className="truncate text-xs text-muted">{clientName(o.clientId)}</p>
                          </button>
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <span className="font-display text-lg font-bold tabular">{o.estimatedValue === null ? <span className="text-sm font-semibold text-muted">Valor a definir</span> : brl(o.estimatedValue)}</span>
                            {f && <Badge tone={f.tone} className="ml-auto">{f.text}</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {o.source} · {displayUserName(o.ownerId).split(' ')[0]}
                          </p>
                          {isOpen(o) && <p className="mt-1 text-xs"><span className="font-semibold">Próx.:</span> {o.nextAction} {o.nextContact && `(${dateBR(o.nextContact)})`}</p>}
                          {o.lossReason && <p className="mt-1 text-xs text-brand">Motivo: {o.lossReason}</p>}
                          <select aria-label={`Mover ${o.title}`} className={cx(inputCls(), 'mt-2 h-8 text-xs')} value={o.stage} onChange={(e) => move(o, e.target.value as StageId)}>
                            {funnelStages.map((x) => <option key={x.id} value={x.id}>{x.id === o.stage ? `Etapa: ${x.label}` : `Mover para: ${x.label}`}</option>)}
                          </select>
                        </article>
                      )
                    })}
                    {!items.length && <p className="px-2 py-6 text-center text-xs text-muted">Nenhuma oportunidade</p>}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                <tr>
                  <SortTh label="Oportunidade" k="title" sort={t.sort} toggle={t.toggle} />
                  <SortTh label="Etapa" k="stage" sort={t.sort} toggle={t.toggle} />
                  <SortTh label="Valor estimado" k="value" sort={t.sort} toggle={t.toggle} right />
                  <th className="px-4 py-3 font-bold uppercase tracking-wide">Último contato</th>
                  <SortTh label="Próximo contato" k="next" sort={t.sort} toggle={t.toggle} />
                  <SortTh label="Entrada" k="entered" sort={t.sort} toggle={t.toggle} />
                </tr>
              </thead>
              <tbody>
                {t.pageRows.map((o) => {
                  const f = followUp(o)
                  return (
                    <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <button onClick={() => setDetail(o.id)} className="text-left font-semibold hover:text-brand">{o.title}</button>
                        <span className="block text-xs text-muted">{clientName(o.clientId)} · {o.source} · {displayUserName(o.ownerId)}</span>
                      </td>
                      <td className="px-4 py-3"><Badge tone={o.stage === 'fechado' ? 'ok' : o.stage === 'perdido' ? 'red' : 'neutral'}>{stageLabel(o.stage)}</Badge></td>
                      <td className="px-4 py-3 text-right font-semibold tabular">{o.estimatedValue === null ? '—' : brl(o.estimatedValue)}</td>
                      <td className="px-4 py-3 tabular">{dateBR(o.lastContact)}</td>
                      <td className="px-4 py-3 tabular">
                        {dateBR(o.nextContact)} {f && <Badge tone={f.tone}>{f.text}</Badge>}
                      </td>
                      <td className="px-4 py-3 tabular">{dateBR(o.enteredAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination {...t} />
        </Card>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nova oportunidade"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={!newLead.title.trim() || !newLead.clientId}
              onClick={() => {
                const parsed = newLead.value.trim() ? parseDecimal(newLead.value) : null
                if (parsed && (!parsed.ok || parsed.value === null || parsed.value <= 0)) {
                  toast({ tone: 'erro', title: 'Valor estimado inválido', body: 'Informe um valor maior que zero ou deixe o campo vazio.' })
                  return
                }
                const opportunity: Opportunity = {
                  id: `lead-${crypto.randomUUID()}`,
                  title: newLead.title.trim(),
                  clientId: newLead.clientId,
                  siteId: newLead.siteId || null,
                  stage: 'novo',
                  estimatedValue: parsed?.value === null || parsed === null ? null : parsed.value,
                  ownerId: localUserId,
                  source: newLead.source,
                  enteredAt: today,
                  lastContact: null,
                  nextContact: newLead.nextContact || null,
                  nextAction: newLead.nextAction.trim() || 'Realizar primeiro contato',
                  lossReason: null,
                  quoteId: null,
                  history: [{ at: new Date().toISOString(), by: localUserId, text: 'Oportunidade criada' }],
                  demo: false,
                }
                try {
                  addOpportunity(opportunity)
                  toast({ tone: 'ok', title: 'Oportunidade cadastrada', body: opportunity.title })
                  setNewLead({ title: '', clientId: '', siteId: '', value: '', source: leadSources[0], nextContact: today, nextAction: 'Realizar primeiro contato' })
                  setCreating(false)
                  setDetail(opportunity.id)
                } catch (error) {
                  toast({ tone: 'erro', title: 'Não foi possível cadastrar', body: error instanceof Error ? error.message : 'Revise os dados.' })
                }
              }}
            >
              Salvar oportunidade
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome da oportunidade" required>
            {(id) => <input id={id} className={inputCls()} value={newLead.title} onChange={(event) => setNewLead((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Concretagem da laje — etapa 2" />}
          </Field>
          <Field label="Cliente" required hint={<Link to="/clientes" search={{ novo: '1' }} className="font-semibold text-brand hover:underline">Cadastrar cliente real</Link>}>
            {(id) => <select id={id} className={inputCls()} value={newLead.clientId} onChange={(event) => setNewLead((current) => ({ ...current, clientId: event.target.value, siteId: '' }))}>
              <option value="">Selecione um cliente real…</option>
              {clients.filter((client) => !client.demo).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>}
          </Field>
          <Field label="Obra (opcional)">
            {(id) => <select id={id} className={inputCls()} value={newLead.siteId} onChange={(event) => setNewLead((current) => ({ ...current, siteId: event.target.value }))}>
              <option value="">Sem obra definida</option>
              {sites.filter((site) => site.clientId === newLead.clientId && !site.demo).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor estimado (R$)">
              {(id) => <input id={id} inputMode="decimal" className={inputCls()} placeholder="Opcional" value={newLead.value} onChange={(event) => setNewLead((current) => ({ ...current, value: event.target.value }))} />}
            </Field>
            <Field label="Origem do lead">
              {(id) => <select id={id} className={inputCls()} value={newLead.source} onChange={(event) => setNewLead((current) => ({ ...current, source: event.target.value as typeof newLead.source }))}>{leadSources.map((source) => <option key={source}>{source}</option>)}</select>}
            </Field>
            <Field label="Próxima ação">
              {(id) => <input id={id} className={inputCls()} value={newLead.nextAction} onChange={(event) => setNewLead((current) => ({ ...current, nextAction: event.target.value }))} />}
            </Field>
            <Field label="Próximo contato">
              {(id) => <input id={id} type="date" min={today} className={inputCls()} value={newLead.nextContact} onChange={(event) => setNewLead((current) => ({ ...current, nextContact: event.target.value }))} />}
            </Field>
          </div>
          {clients.filter((client) => !client.demo).length === 0 && <p className="rounded-md bg-warn-soft p-3 text-sm text-warn">Cadastre pelo menos um cliente antes de criar uma oportunidade.</p>}
        </div>
      </Modal>

      <Modal
        open={!!losing}
        onClose={() => setLosing(null)}
        title="Registrar perda"
        footer={
          <>
            <Button onClick={() => setLosing(null)}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={!losing?.reason}
              onClick={() => {
                if (!losing) return
                const o = opportunities.find((x) => x.id === losing.id)!
                updateOpportunity(o.id, { stage: 'perdido', lossReason: losing.reason, nextContact: null }, `Marcada como perdida — motivo: ${losing.reason}${losing.note ? ` (${losing.note})` : ''}`)
                toast({ tone: 'ok', title: 'Perda registrada', body: o.title })
                setLosing(null)
              }}
            >
              Confirmar perda
            </Button>
          </>
        }
      >
        {losing && (
          <div className="space-y-4">
            <Field label="Motivo da perda" required>
              {(id) => (
                <select id={id} className={inputCls()} value={losing.reason} onChange={(e) => setLosing({ ...losing, reason: e.target.value })}>
                  <option value="">Selecione…</option>
                  {lossReasons.map((r) => <option key={r}>{r}</option>)}
                </select>
              )}
            </Field>
            <Field label="Detalhes (opcional)">{(id) => <textarea id={id} rows={3} className={cx(inputCls(), 'h-auto py-2')} value={losing.note} onChange={(e) => setLosing({ ...losing, note: e.target.value })} />}</Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!closing}
        onClose={() => setClosing(null)}
        title="Confirmar fechamento"
        footer={
          <>
            <Button onClick={() => setClosing(null)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => {
                const o = opportunities.find((x) => x.id === closing)!
                updateOpportunity(o.id, { stage: 'fechado', nextContact: null, lossReason: null }, `Fechamento confirmado: ${stageLabel(o.stage)} → Fechado`)
                toast({ tone: 'ok', title: 'Oportunidade fechada', body: o.title })
                setClosing(null)
              }}
            >
              Confirmar fechamento
            </Button>
          </>
        }
      >
        <p className="text-sm">Confirme que o cliente aceitou a proposta. Gerar ou enviar um orçamento não fecha a oportunidade automaticamente.</p>
      </Modal>

      {selected && <OpportunityDrawer o={selected} onClose={() => setDetail(null)} clientName={clientName(selected.clientId)} onMove={(to) => move(selected, to)} />}
    </>
  )
}

function AlertBox({ title, items, tone, icon, onOpen, clientName }: { title: string; items: Opportunity[]; tone: 'red' | 'warn' | 'neutral'; icon: React.ReactNode; onOpen: (id: string) => void; clientName: (id: string) => string }) {
  return (
    <div className={cx('rounded-lg border bg-surface p-4', tone === 'red' && items.length ? 'border-brand/40' : tone === 'warn' && items.length ? 'border-warn/40' : 'border-line')}>
      <p className={cx('mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide', tone === 'red' ? 'text-brand' : tone === 'warn' ? 'text-warn' : 'text-muted')}>
        {icon} {title} <span className="ml-auto font-display text-2xl text-ink">{items.length}</span>
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nada pendente.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.slice(0, 3).map((o) => (
            <li key={o.id}>
              <button onClick={() => onOpen(o.id)} className="w-full truncate text-left hover:text-brand">
                <span className="font-semibold">{o.title}</span> <span className="text-muted">· {clientName(o.clientId)}</span>
              </button>
            </li>
          ))}
          {items.length > 3 && <li className="text-xs text-muted">+ {items.length - 3} outras</li>}
        </ul>
      )}
    </div>
  )
}

function OpportunityDrawer({ o, onClose, clientName, onMove }: { o: Opportunity; onClose: () => void; clientName: string; onMove: (to: StageId) => void }) {
  const { updateOpportunity, toast, quotes } = useStore()
  const quoteNumber = quotes.find((q) => q.id === o.quoteId)?.number
  const [next, setNext] = useState(o.nextContact ?? '')
  const [action, setAction] = useState(o.nextAction)
  const [note, setNote] = useState('')

  return (
    <Drawer open onClose={onClose} title="Oportunidade">
      <div className="space-y-5">
        <div>
          <h3 className="text-3xl font-extrabold uppercase leading-none">{o.title}</h3>
          <p className="mt-1 text-sm text-muted">{clientName} · {o.source} · {displayUserName(o.ownerId)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={o.stage === 'fechado' ? 'ok' : o.stage === 'perdido' ? 'red' : 'dark'}>{stageLabel(o.stage)}</Badge>
            <Badge>{o.estimatedValue === null ? 'Valor a definir' : brl(o.estimatedValue)}</Badge>
            {quoteNumber && <Link to="/orcamentos" search={{ q: quoteNumber }} className="text-xs font-semibold text-brand hover:underline">Ver orçamento {quoteNumber}</Link>}
            {!quoteNumber && <Link to="/orcamentos/novo" search={{ oportunidade: o.id }} className="inline-flex items-center gap-1 rounded bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-strong">Criar rascunho de orçamento</Link>}
          </div>
          <div className="mt-3">
            <Link to="/tarefas" search={{ oportunidade: o.id }} className="text-sm font-semibold text-brand hover:underline">Agendar tarefa ou retorno para esta oportunidade</Link>
          </div>
        </div>
        <Field label="Etapa">
          {(id) => (
            <select id={id} className={inputCls()} value={o.stage} onChange={(e) => onMove(e.target.value as StageId)}>
              {funnelStages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </Field>
        <div className="rounded-md border border-line p-4">
          <h4 className="mb-3 text-lg font-bold uppercase">Registrar contato e próximo passo</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Próxima ação">{(id) => <input id={id} className={inputCls()} value={action} onChange={(e) => setAction(e.target.value)} />}</Field>
            <Field label="Data do próximo contato">{(id) => <input id={id} type="date" className={inputCls()} value={next} min={today} onChange={(e) => setNext(e.target.value)} />}</Field>
            <Field label="Resumo do contato de hoje (opcional)" className="sm:col-span-2">{(id) => <textarea id={id} rows={2} className={cx(inputCls(), 'h-auto py-2')} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          </div>
          <Button
            variant="primary"
            className="mt-3"
            onClick={() => {
              updateOpportunity(o.id, { lastContact: today, nextContact: next || null, nextAction: action }, `Contato registrado${note ? `: ${note}` : ''}${next ? ` · próximo em ${dateBR(next)}` : ''}`)
              setNote('')
              toast({ tone: 'ok', title: 'Contato registrado' })
            }}
          >
            Registrar contato
          </Button>
        </div>
        <section>
          <h4 className="mb-2 text-lg font-bold uppercase">Histórico</h4>
          <ol className="space-y-2 border-l-2 border-line pl-4 text-sm">
            {o.history.map((h, i) => (
              <li key={i}>
                <p className="font-medium">{h.text}</p>
                <p className="text-xs text-muted">{dateBR(h.at)} · {displayUserName(h.by)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Drawer>
  )
}
