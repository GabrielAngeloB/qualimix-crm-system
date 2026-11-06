import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Copy, Eye, FileText, MessageCircle, Plus, Search } from 'lucide-react'
import { useStore } from '../data/store'
import { paymentMethods, quoteStatuses } from '../data/settings'
import { today, userName } from '../data/fixtures'
import type { EvaluatedQuote } from '../data/derived'
import { summarizeMeasures } from '../lib/quote'
import { brlCents, dateBR, daysBetween, num } from '../lib/format'
import { Badge, Card, EmptyState, PageHeader, cx, inputCls } from '../components/ui'
import { MiniStat, statusTone } from '../components/bits'
import { Pagination, SortTh, useSortPage } from '../components/table'
import { ProposalModal, WhatsAppDialog } from '../components/QuoteShare'
import type { ProposalData } from '../components/ProposalDocument'

export const Route = createFileRoute('/orcamentos/')({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({ q: typeof s.q === 'string' ? s.q : undefined }),
  head: () => ({ meta: [{ title: 'Orçamentos — Qualimix CRM' }] }),
  component: Orcamentos,
})

function Orcamentos() {
  const { q: initialQ } = Route.useSearch()
  const { quotes, clients, sites, demoMode } = useStore()
  const [q, setQ] = useState(initialQ ?? '')
  const [status, setStatus] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [preview, setPreview] = useState<ProposalData | null>(null)
  const [wa, setWa] = useState<ProposalData | null>(null)
  useEffect(() => setQ(initialQ ?? ''), [initialQ])

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—'
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name ?? '—'

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return quotes.filter(
      (x) =>
        (!status || x.status === status) &&
        (!type || x.type === type) &&
        (!t || x.number.toLowerCase().includes(t) || clientName(x.clientId).toLowerCase().includes(t) || siteName(x.siteId).toLowerCase().includes(t)),
    )
  }, [quotes, q, status, type]) // eslint-disable-line react-hooks/exhaustive-deps

  const t = useSortPage(filtered, { number: (x) => x.number, date: (x) => x.createdAt, client: (x) => clientName(x.clientId), total: (x) => x.result.totalCents ?? -1, status: (x) => x.status }, { key: 'number', dir: 'desc' })

  const toProposal = (x: EvaluatedQuote): ProposalData => ({
    number: x.number,
    version: x.version,
    issueDate: x.createdAt,
    validUntil: x.validUntil,
    client: clients.find((c) => c.id === x.clientId),
    site: sites.find((s) => s.id === x.siteId),
    ownerName: userName(x.ownerId),
    lines: x.lines,
    result: x.result,
    volume: summarizeMeasures(x.volumeElements, x.volumeMargin, 'volume'),
    area: summarizeMeasures(x.areaElements, x.areaMargin, 'area'),
    payments: x.paymentMethodIds.map((id) => paymentMethods.find((m) => m.id === id)?.label ?? id),
    paymentTerms: x.paymentTerms,
    executionDeadline: x.executionDeadline,
    notes: x.notes,
    preview: !x.result.canIssue || x.result.needsApproval,
    demo: x.demo,
  })

  const open = quotes.filter((x) => x.status === 'Enviado ao cliente' || x.status === 'Em negociação')
  const openCents = open.reduce((s, x) => s + (x.result.totalCents ?? 0), 0)
  const waiting = quotes.filter((x) => x.status === 'Aguardando aprovação').length
  const expiring = quotes.filter((x) => (x.status === 'Enviado ao cliente' || x.status === 'Em negociação') && daysBetween(today, x.validUntil) <= 3).length

  return (
    <>
      <PageHeader
        eyebrow="Comercial"
        title="Orçamentos"
        description="Concreto usinado, pisos e orçamentos combinados. Cada número é contado uma única vez, independentemente das versões."
        actions={
          <Link to="/orcamentos/novo" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-white shadow-sm shadow-brand/20 hover:bg-brand-strong">
            <Plus className="h-4 w-4" /> Novo orçamento
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Em aberto com clientes" value={brlCents(openCents)} sub={`${open.length} enviados ou em negociação`} />
        <MiniStat label="Aguardando aprovação" value={String(waiting)} sub="Descontos ou preços manuais" tone={waiting ? 'warn' : undefined} />
        <MiniStat label="Vencem em até 3 dias" value={String(expiring)} sub="Propostas próximas da validade" tone={expiring ? 'red' : undefined} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input aria-label="Pesquisar orçamentos" className={cx(inputCls(), 'pl-9')} placeholder="Número, cliente ou obra" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select aria-label="Filtrar por status" className={cx(inputCls(), 'w-auto')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {quoteStatuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Filtrar por tipo" className={cx(inputCls(), 'w-auto')} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="concreto">Concreto</option>
            <option value="piso">Piso</option>
            <option value="combinado">Combinado</option>
          </select>
        </div>

        {t.total === 0 ? (
          <EmptyState icon={<FileText className="h-6 w-6" />} title={quotes.length ? 'Nenhum orçamento encontrado' : 'Nenhum orçamento ainda'} action={<Link to="/orcamentos/novo" className="font-semibold text-brand hover:underline">Criar o primeiro orçamento</Link>}>
            {quotes.length ? 'Ajuste a pesquisa ou os filtros.' : demoMode ? '' : 'Os dados de demonstração estão ocultos. Crie um orçamento para começar.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs text-muted">
                <tr>
                  <SortTh label="Número" k="number" sort={t.sort} toggle={t.toggle} />
                  <SortTh label="Data" k="date" sort={t.sort} toggle={t.toggle} />
                  <SortTh label="Cliente / obra" k="client" sort={t.sort} toggle={t.toggle} />
                  <th className="px-4 py-3 font-bold uppercase tracking-wide">Qtd.</th>
                  <SortTh label="Total" k="total" sort={t.sort} toggle={t.toggle} right />
                  <SortTh label="Status" k="status" sort={t.sort} toggle={t.toggle} />
                  <th className="px-4 py-3 text-right font-bold uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {t.pageRows.map((x) => {
                  const p = toProposal(x)
                  return (
                    <tr key={x.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                      <td className="px-4 py-3">
                        <span className="font-display text-lg font-bold tabular">{x.number}</span>
                        <span className="block text-xs text-muted">v{x.version} · {x.type === 'concreto' ? 'Concreto' : x.type === 'piso' ? 'Piso' : 'Combinado'}{x.demo && ' · demo'}</span>
                      </td>
                      <td className="px-4 py-3 tabular">
                        {dateBR(x.createdAt)}
                        <span className="block text-xs text-muted">Válido até {dateBR(x.validUntil)}</span>
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        <span className="block truncate font-semibold">{clientName(x.clientId)}</span>
                        <span className="block truncate text-xs text-muted">{siteName(x.siteId)}</span>
                      </td>
                      <td className="px-4 py-3 tabular text-muted">
                        {x.result.concreteVolume > 0 && <span className="block">{num(x.result.concreteVolume, 2)} m³{x.fck ? ` · FCK ${x.fck}` : ''}</span>}
                        {x.result.floorArea > 0 && <span className="block">{num(x.result.floorArea, 2)} m²</span>}
                      </td>
                      <td className={cx('px-4 py-3 text-right font-display text-lg font-bold tabular', x.result.totalCents === null && 'text-warn')}>{brlCents(x.result.totalCents)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={statusTone(x.status)}>{x.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <IconBtn label="Ver proposta" onClick={() => setPreview(p)}><Eye className="h-4 w-4" /></IconBtn>
                          <IconBtn label="Compartilhar no WhatsApp" onClick={() => setWa(p)}><MessageCircle className="h-4 w-4" /></IconBtn>
                          <Link to="/orcamentos/novo" search={{ origem: x.id }} title="Duplicar com preços atuais" aria-label="Duplicar com preços atuais" className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
                            <Copy className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination {...t} />
      </Card>

      {preview && <ProposalModal open onClose={() => setPreview(null)} data={preview} />}
      {wa && <WhatsAppDialog open onClose={() => setWa(null)} data={wa} />}
    </>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2">
      {children}
    </button>
  )
}
