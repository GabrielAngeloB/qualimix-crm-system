import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Building2,
  Calculator,
  CircleAlert,
  CircleCheck,
  Eye,
  FileText,
  Info,
  MessageCircle,
  Plus,
  Ruler,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Undo2,
} from 'lucide-react'
import {
  computeQuote,
  defaultExtras,
  summarizeMeasures,
  type Issue,
  type MeasureElement,
  type QuoteExtras,
  type QuoteLine,
} from '../lib/quote'
import { addDays, brl, brlCents, dateBR, num, parseDecimal } from '../lib/format'
import { formatPhone } from '../lib/documents'
import { useStore } from '../data/store'
import { catalog, categoryLabel, paymentMethods } from '../data/settings'
import { currentUser, today, userName, type QuoteRecord, type QuoteType } from '../data/fixtures'
import { MeasureCalculator, blankElement, newId } from './MeasureCalculator'
import { ProposalModal, WhatsAppDialog } from './QuoteShare'
import type { ProposalData } from './ProposalDocument'
import { Badge, Button, Card, CardHeader, Field, PageHeader, SegTabs, cx, inputCls } from './ui'

export interface Draft {
  type: QuoteType
  clientId: string
  siteId: string
  ownerId: string
  volumeElements: MeasureElement[]
  volumeMargin: string
  areaElements: MeasureElement[]
  areaMargin: string
  lines: QuoteLine[]
  extras: QuoteExtras
  paymentMethodIds: string[]
  paymentTerms: string
  validityDays: string
  executionDeadline: string
  notes: string
  origin: string | null
}

const DRAFT_KEY = 'qmx-orcamento-rascunho-v1'

function makeLine(catalogId: string | null, quantityMode: QuoteLine['quantityMode'] = 'manual'): QuoteLine {
  const c = catalog.find((x) => x.id === catalogId)
  return {
    id: newId(),
    catalogId,
    description: c?.name ?? 'Item livre',
    unit: c?.unit ?? 'un',
    category: c?.category ?? 'servico',
    quantityMode,
    quantity: '',
    unitPriceInput: '',
    discountPct: '',
  }
}

function templateFor(type: QuoteType): Pick<Draft, 'lines' | 'volumeElements' | 'areaElements'> {
  const lines: QuoteLine[] = []
  if (type !== 'piso') lines.push(makeLine('c-fck25', 'volume'))
  if (type !== 'concreto') lines.push(makeLine('p-polido', 'area'))
  return {
    lines,
    volumeElements: type !== 'piso' ? [blankElement('volume')] : [],
    areaElements: type !== 'concreto' ? [blankElement('area')] : [],
  }
}

function emptyDraft(validityDays: number | null): Draft {
  return {
    type: 'concreto',
    clientId: '',
    siteId: '',
    ownerId: currentUser.id,
    volumeMargin: '',
    areaMargin: '',
    extras: defaultExtras(),
    paymentMethodIds: [],
    paymentTerms: '',
    validityDays: validityDays?.toString() ?? '',
    executionDeadline: '',
    notes: '',
    origin: null,
    ...templateFor('concreto'),
  }
}

function fromRecord(q: QuoteRecord, validityDays: number | null): Draft {
  return {
    type: q.type,
    clientId: q.clientId,
    siteId: q.siteId,
    ownerId: q.ownerId,
    volumeElements: q.volumeElements.map((e) => ({ ...e, id: newId() })),
    volumeMargin: q.volumeMargin,
    areaElements: q.areaElements.map((e) => ({ ...e, id: newId() })),
    areaMargin: q.areaMargin,
    // Preços manuais não são herdados: a cópia usa as condições atuais do catálogo
    lines: q.lines.map((l) => ({ ...l, id: newId(), unitPriceInput: '' })),
    extras: structuredClone(q.extras),
    paymentMethodIds: [...q.paymentMethodIds],
    paymentTerms: q.paymentTerms,
    validityDays: validityDays?.toString() ?? '',
    executionDeadline: q.executionDeadline,
    notes: q.notes,
    origin: q.number,
  }
}

export function QuoteBuilder({ origin }: { origin?: string }) {
  const { clients, sites, quotes, ctx, demoMode, toast } = useStore()
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(ctx.rules.validityDays))
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [showProposal, setShowProposal] = useState(false)
  const [showWa, setShowWa] = useState(false)

  // Carrega duplicação ou rascunho guardado neste navegador
  useEffect(() => {
    const src = origin ? quotes.find((q) => q.id === origin) : undefined
    if (src) {
      setDraft(fromRecord(src, ctx.rules.validityDays))
      toast({ tone: 'info', title: `Cópia de ${src.number}`, body: 'Os preços foram atualizados para as condições atuais do catálogo. Revise antes de gerar a proposta.' })
    } else {
      try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (raw) {
          setDraft({ ...emptyDraft(ctx.rules.validityDays), ...(JSON.parse(raw) as Draft) })
          toast({ tone: 'info', title: 'Rascunho recuperado', body: 'Continuamos de onde você parou.' })
        }
      } catch {
        localStorage.removeItem(DRAFT_KEY)
      }
    }
    setLoaded(true)
  }, [origin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Autosalvamento local (prevenção de perda de dados)
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      const d = new Date()
      setSavedAt(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    }, 500)
    return () => clearTimeout(t)
  }, [draft, loaded])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setExtras = (p: Partial<QuoteExtras>) => setDraft((d) => ({ ...d, extras: { ...d.extras, ...p } }))
  const patchLine = (id: string, p: Partial<QuoteLine>) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...p } : l)) }))

  const volume = useMemo(() => summarizeMeasures(draft.volumeElements, draft.volumeMargin, 'volume'), [draft.volumeElements, draft.volumeMargin])
  const area = useMemo(() => summarizeMeasures(draft.areaElements, draft.areaMargin, 'area'), [draft.areaElements, draft.areaMargin])
  const result = useMemo(
    () =>
      computeQuote(
        { clientId: draft.clientId || null, siteId: draft.siteId || null, lines: draft.lines, volume, area, extras: draft.extras, paymentMethodIds: draft.paymentMethodIds },
        ctx,
      ),
    [draft.clientId, draft.siteId, draft.lines, volume, area, draft.extras, draft.paymentMethodIds, ctx],
  )

  const validity = parseDecimal(draft.validityDays)
  const validDays = validity.ok && validity.value !== null && Number.isInteger(validity.value) && validity.value > 0 ? validity.value : null
  const validUntil = validDays ? addDays(today, validDays) : null
  const issues: Issue[] = [...result.issues]
  if (!validUntil) issues.unshift({ level: 'bloqueio', message: 'Defina a validade da proposta (dias inteiros)' })
  const blockers = issues.filter((i) => i.level === 'bloqueio')
  const approvals = issues.filter((i) => i.level === 'aprovacao')
  const warnings = issues.filter((i) => i.level === 'aviso')
  const canIssue = result.canIssue && !blockers.length && !approvals.length

  const client = clients.find((c) => c.id === draft.clientId)
  const clientSites = sites.filter((s) => s.clientId === draft.clientId)
  const site = sites.find((s) => s.id === draft.siteId)

  const nextNumber = useMemo(() => {
    const year = today.slice(0, 4)
    const max = quotes.reduce((m, q) => Math.max(m, Number(q.number.split('-')[2]) || 0), 0)
    return `ORC-${year}-${String(max + 1).padStart(4, '0')}`
  }, [quotes])

  const proposal: ProposalData = {
    number: nextNumber,
    version: 1,
    issueDate: today,
    validUntil,
    client,
    site,
    ownerName: userName(draft.ownerId),
    lines: draft.lines,
    result,
    volume,
    area,
    payments: draft.paymentMethodIds.map((id) => paymentMethods.find((m) => m.id === id)?.label ?? id),
    paymentTerms: draft.paymentTerms,
    executionDeadline: draft.executionDeadline,
    notes: draft.notes,
    preview: !canIssue,
    demo: demoMode,
  }

  const changeType = (type: QuoteType) => {
    setDraft((d) => {
      const pristine = d.lines.every((l) => l.quantity === '' && l.unitPriceInput === '') && [...d.volumeElements, ...d.areaElements].every((e) => !e.length && !e.width && !e.informed)
      if (pristine) return { ...d, type, ...templateFor(type) }
      return {
        ...d,
        type,
        volumeElements: type !== 'piso' && !d.volumeElements.length ? [blankElement('volume')] : d.volumeElements,
        areaElements: type !== 'concreto' && !d.areaElements.length ? [blankElement('area')] : d.areaElements,
      }
    })
  }

  const discard = () => {
    if (!confirm('Descartar este rascunho? Os dados preenchidos serão apagados.')) return
    localStorage.removeItem(DRAFT_KEY)
    setDraft(emptyDraft(ctx.rules.validityDays))
    toast({ tone: 'ok', title: 'Rascunho descartado' })
  }

  const r = ctx.rules
  const showVolume = draft.type !== 'piso'
  const showArea = draft.type !== 'concreto'

  return (
    <>
      <PageHeader
        eyebrow="Orçamentos"
        title="Novo orçamento"
        description={draft.origin ? <>Cópia do orçamento <strong className="text-ink">{draft.origin}</strong> com preços atualizados.</> : 'Calcule volume e área, monte os itens e gere a proposta comercial.'}
        actions={
          <>
            <Button variant="ghost" onClick={discard}>
              <Undo2 className="h-4 w-4" /> Descartar
            </Button>
            <Link to="/orcamentos" className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
              Ver orçamentos
            </Link>
          </>
        }
      />

      <div className={cx('mb-5 flex items-start gap-3 rounded-lg border p-4 text-sm', demoMode ? 'border-warn/30 bg-warn-soft' : 'border-info/30 bg-info-soft')}>
        <Info className={cx('mt-0.5 h-5 w-5 shrink-0', demoMode ? 'text-warn' : 'text-info')} />
        {demoMode ? (
          <p>
            <strong>Preços e regras de demonstração ativos (valores fictícios).</strong> A tabela oficial da Qualimix ainda não foi configurada. Desative os dados de demonstração no menu para trabalhar somente com preços oficiais.
          </p>
        ) : (
          <p>
            <strong>Preços oficiais pendentes de configuração.</strong> Itens sem preço bloqueiam a proposta definitiva. Você pode informar um preço manualmente — ele fica registrado como exceção que exige aprovação.
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {/* 1. Cliente e obra */}
          <Card>
            <CardHeader step={1} title="Cliente e obra" subtitle="Dados já cadastrados são preenchidos automaticamente." action={<SegTabs label="Tipo de orçamento" value={draft.type} onChange={changeType} options={[{ value: 'concreto', label: 'Concreto m³' }, { value: 'piso', label: 'Piso m²' }, { value: 'combinado', label: 'Combinado' }]} />} />
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Cliente" required hint={<Link to="/clientes" search={{ novo: '1' }} className="font-semibold text-brand hover:underline">+ Cadastrar novo cliente</Link>}>
                {(id) => (
                  <select
                    id={id}
                    className={inputCls()}
                    value={draft.clientId}
                    onChange={(e) => {
                      const cid = e.target.value
                      const own = sites.filter((s) => s.clientId === cid)
                      setDraft((d) => ({ ...d, clientId: cid, siteId: own.length === 1 ? own[0].id : '' }))
                    }}
                  >
                    <option value="">Selecione…</option>
                    {clients.filter((c) => c.active).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Obra" required hint={draft.clientId && !clientSites.length ? 'Este cliente ainda não tem obras cadastradas.' : undefined}>
                {(id) => (
                  <select id={id} className={inputCls()} value={draft.siteId} disabled={!draft.clientId} onChange={(e) => set('siteId', e.target.value)}>
                    <option value="">{draft.clientId ? 'Selecione…' : 'Escolha o cliente primeiro'}</option>
                    {clientSites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              {(client || site) && (
                <div className="grid gap-3 rounded-md bg-surface-2 p-4 text-sm md:col-span-2 md:grid-cols-2">
                  {client && (
                    <div>
                      <p className="font-semibold">{client.name}</p>
                      <p className="text-muted">{client.type} · {client.region} · Origem: {client.source}</p>
                      <p className="text-muted">WhatsApp: {client.whatsapp ? formatPhone(client.whatsapp) : <span className="font-semibold text-warn">não cadastrado</span>}</p>
                    </div>
                  )}
                  {site && (
                    <div className="flex gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      <div>
                        <p className="font-semibold">{site.address} — {site.city}</p>
                        <p className="text-muted">Contato: {site.contactName || <span className="text-warn">não informado</span>} {site.contactPhone && `· ${formatPhone(site.contactPhone)}`}</p>
                        {site.accessNotes && <p className="text-muted">Acesso: {site.accessNotes}</p>}
                        {site.restrictions && <p className="font-medium text-warn">Restrição: {site.restrictions}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* 2. Medições */}
          {showVolume && (
            <Card>
              <CardHeader step={2} title="Calculadora de volume" subtitle="Some lajes, vigas, pilares ou etapas de concretagem. Ou informe o volume passado pelo cliente." action={<Calculator className="h-6 w-6 text-brand" />} />
              <div className="p-5">
                <MeasureCalculator kind="volume" elements={draft.volumeElements} margin={draft.volumeMargin} summary={volume} onChange={(v) => set('volumeElements', v)} onMargin={(v) => set('volumeMargin', v)} />
              </div>
            </Card>
          )}
          {showArea && (
            <Card>
              <CardHeader step={showVolume ? 3 : 2} title="Calculadora de área de piso" subtitle="Polido ou sarrafeado: some ambientes, ou informe a área." action={<Ruler className="h-6 w-6 text-brand" />} />
              <div className="p-5">
                <MeasureCalculator kind="area" elements={draft.areaElements} margin={draft.areaMargin} summary={area} onChange={(v) => set('areaElements', v)} onMargin={(v) => set('areaMargin', v)} />
              </div>
            </Card>
          )}

          {/* Itens */}
          <Card>
            <CardHeader step={draft.type === 'combinado' ? 4 : 3} title="Produtos e serviços" subtitle="Quantidades podem vir da calculadora. Preço vazio usa o catálogo." />
            <div className="p-5">
              <div className="hidden grid-cols-[minmax(0,2.2fr)_1.4fr_1.1fr_0.7fr_1fr_auto] gap-3 border-b border-line pb-2 text-xs font-bold uppercase tracking-wide text-muted md:grid">
                <span>Item</span>
                <span>Quantidade</span>
                <span>Preço unit. (R$)</span>
                <span>Desc. %</span>
                <span className="text-right">Subtotal</span>
                <span className="w-8" />
              </div>
              {draft.lines.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhum item. Adicione produtos ou serviços abaixo.</p>}
              {draft.lines.map((l, i) => {
                const c = result.lines[i]
                const item = catalog.find((x) => x.id === l.catalogId)
                const canVolume = l.unit === 'm³'
                const canArea = l.unit === 'm²'
                const ref = item?.basePrice ?? (demoMode ? item?.demoPrice : null)
                return (
                  <div key={l.id} className={cx('grid grid-cols-2 gap-3 border-b border-line py-3 md:grid-cols-[minmax(0,2.2fr)_1.4fr_1.1fr_0.7fr_1fr_auto] md:items-start', c?.errors.length && 'bg-brand-soft/30')}>
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      {l.catalogId ? (
                        <>
                          <p className="font-semibold leading-tight">{l.description}</p>
                          <p className="text-xs text-muted">{item?.code} · {categoryLabel[l.category]} · {l.unit}</p>
                        </>
                      ) : (
                        <input aria-label="Descrição do item livre" className={inputCls()} value={l.description} onChange={(e) => patchLine(l.id, { description: e.target.value })} />
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted md:hidden">Quantidade ({l.unit})</label>
                      {(canVolume || canArea) && (
                        <select aria-label="Origem da quantidade" className={cx(inputCls(), 'mb-1 h-8 text-xs')} value={l.quantityMode} onChange={(e) => patchLine(l.id, { quantityMode: e.target.value as QuoteLine['quantityMode'] })}>
                          <option value="manual">Digitar quantidade</option>
                          {canVolume && <option value="volume">Volume calculado</option>}
                          {canArea && <option value="area">Área calculada</option>}
                        </select>
                      )}
                      {l.quantityMode === 'manual' ? (
                        <input aria-label={`Quantidade de ${l.description}`} inputMode="decimal" className={inputCls()} value={l.quantity} placeholder="0" onChange={(e) => patchLine(l.id, { quantity: e.target.value })} />
                      ) : (
                        <div className="flex h-10 items-center rounded-md border border-dashed border-line px-3 font-semibold tabular">{c?.quantity != null ? `${num(c.quantity, 2)} ${l.unit}` : '—'}</div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted md:hidden">Preço unitário</label>
                      <input aria-label={`Preço unitário de ${l.description}`} inputMode="decimal" className={inputCls()} value={l.unitPriceInput} placeholder={ref != null ? num(ref, 2) : 'Pendente'} onChange={(e) => patchLine(l.id, { unitPriceInput: e.target.value })} />
                      <div className="mt-1">
                        {c?.priceSource === 'tabela' && <Badge tone="ok">Tabela oficial</Badge>}
                        {c?.priceSource === 'demonstracao' && <Badge tone="warn">Fictício (demo)</Badge>}
                        {c?.priceSource === 'manual' && <Badge tone="info">Manual · exige aprovação</Badge>}
                        {c?.priceSource === 'pendente' && <Badge tone="red">Preço pendente</Badge>}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted md:hidden">Desconto %</label>
                      <input aria-label={`Desconto de ${l.description}`} inputMode="decimal" className={inputCls()} value={l.discountPct} placeholder="0" onChange={(e) => patchLine(l.id, { discountPct: e.target.value })} />
                    </div>
                    <div className="text-right">
                      <label className="mb-1 block text-xs font-semibold text-muted md:hidden">Subtotal</label>
                      <p className={cx('font-display text-xl font-bold tabular md:pt-1.5', c?.netCents == null && 'text-warn')}>{brlCents(c?.netCents ?? null)}</p>
                      {c && c.discountCents > 0 && <p className="text-xs text-muted tabular">− {brlCents(c.discountCents)}</p>}
                    </div>
                    <div className="col-span-2 flex justify-end md:col-span-1">
                      <Button variant="ghost" size="sm" aria-label={`Remover ${l.description}`} onClick={() => set('lines', draft.lines.filter((x) => x.id !== l.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {c?.errors.length ? <p className="col-span-2 text-xs font-semibold text-brand md:col-span-6">{c.errors.join(' · ')}</p> : null}
                  </div>
                )
              })}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Plus className="h-4 w-4 text-muted" />
                <select
                  aria-label="Adicionar item"
                  className={cx(inputCls(), 'max-w-sm')}
                  value=""
                  onChange={(e) => {
                    const v = e.target.value
                    if (!v) return
                    const it = catalog.find((x) => x.id === v)
                    const mode = it?.unit === 'm³' && it.category === 'concreto' ? 'volume' : it?.unit === 'm²' ? 'area' : 'manual'
                    set('lines', [...draft.lines, makeLine(v === 'livre' ? null : v, mode)])
                  }}
                >
                  <option value="">Adicionar produto ou serviço…</option>
                  {(Object.keys(categoryLabel) as (keyof typeof categoryLabel)[]).map((cat) => {
                    const items = catalog.filter((x) => x.category === cat && x.active)
                    return items.length ? (
                      <optgroup key={cat} label={categoryLabel[cat]}>
                        {items.map((x) => (
                          <option key={x.id} value={x.id}>{x.name} ({x.unit})</option>
                        ))}
                      </optgroup>
                    ) : null
                  })}
                  <option value="livre">Item livre (descrição e preço manuais)</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Adicionais */}
          <Card>
            <CardHeader step={draft.type === 'combinado' ? 5 : 4} title="Frete, bombeamento e adicionais" subtitle="Regras configuradas pela administração. Valores não configurados ficam pendentes." />
            <div className="grid gap-6 p-5 lg:grid-cols-2">
              <RuleBlock title="Frete">
                <SegTabs label="Frete" value={draft.extras.freight.mode} onChange={(mode) => setExtras({ freight: { ...draft.extras.freight, mode } })} options={[{ value: 'nao', label: 'Sem cobrança' }, { value: 'fixo', label: 'Fixo' }, { value: 'km', label: 'Por km' }, { value: 'regiao', label: 'Por região' }]} />
                {draft.extras.freight.mode === 'fixo' && <RuleValue label="Valor fixo" v={r.freight.fixed} />}
                {draft.extras.freight.mode === 'km' && (
                  <div className="mt-3 flex items-end gap-3">
                    <Field label="Distância (km)" className="w-32">{(id) => <input id={id} inputMode="decimal" className={inputCls()} value={draft.extras.freight.km} onChange={(e) => setExtras({ freight: { ...draft.extras.freight, km: e.target.value } })} />}</Field>
                    <RuleValue label="Valor por km" v={r.freight.perKm} />
                  </div>
                )}
                {draft.extras.freight.mode === 'regiao' && (
                  <Field label="Região" className="mt-3">
                    {(id) => (
                      <select id={id} className={inputCls()} value={draft.extras.freight.regionId} onChange={(e) => setExtras({ freight: { ...draft.extras.freight, regionId: e.target.value } })}>
                        <option value="">Selecione…</option>
                        {r.freight.regions.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.price === null ? 'pendente' : brl(x.price)}</option>)}
                      </select>
                    )}
                  </Field>
                )}
              </RuleBlock>

              <RuleBlock title="Bombeamento">
                <SegTabs label="Bombeamento" value={draft.extras.pumping.mode} onChange={(mode) => setExtras({ pumping: { ...draft.extras.pumping, mode } })} options={[{ value: 'nao', label: 'Não incluído' }, { value: 'fixo', label: 'Fixo' }, { value: 'm3', label: 'Por m³' }, { value: 'hora', label: 'Por hora' }]} />
                {draft.extras.pumping.mode !== 'nao' && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    {draft.extras.pumping.mode === 'fixo' && <RuleValue label="Valor fixo" v={r.pumping.fixed} />}
                    {draft.extras.pumping.mode === 'm3' && <RuleValue label={`Por m³ × ${num(result.concreteVolume, 2)} m³`} v={r.pumping.perM3} />}
                    {draft.extras.pumping.mode === 'hora' && (
                      <>
                        <Field label="Horas" className="w-24">{(id) => <input id={id} inputMode="decimal" className={inputCls()} value={draft.extras.pumping.hours} onChange={(e) => setExtras({ pumping: { ...draft.extras.pumping, hours: e.target.value } })} />}</Field>
                        <RuleValue label="Por hora" v={r.pumping.perHour} />
                      </>
                    )}
                    <RuleValue label="Valor mínimo" v={r.pumping.minimum} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-[var(--brand)]" checked={draft.extras.pumping.partner} onChange={(e) => setExtras({ pumping: { ...draft.extras.pumping, partner: e.target.checked } })} />
                      Executado por parceiro
                    </label>
                  </div>
                )}
              </RuleBlock>

              <RuleBlock title="Estadia">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="accent-[var(--brand)]" checked={draft.extras.stay.include} onChange={(e) => setExtras({ stay: { ...draft.extras.stay, include: e.target.checked } })} />
                  Prever horas de estadia além da tolerância
                </label>
                <p className="mt-1 text-xs text-muted">Tolerância: {r.stay.toleranceMin === null ? 'não configurada' : `${r.stay.toleranceMin} min`}</p>
                {draft.extras.stay.include && (
                  <div className="mt-3 flex items-end gap-3">
                    <Field label="Horas adicionais" className="w-32">{(id) => <input id={id} inputMode="decimal" className={inputCls()} value={draft.extras.stay.hours} onChange={(e) => setExtras({ stay: { ...draft.extras.stay, hours: e.target.value } })} />}</Field>
                    <RuleValue label="Por hora" v={r.stay.perHour} />
                  </div>
                )}
              </RuleBlock>

              <RuleBlock title="Volume mínimo e desconto geral">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="accent-[var(--brand)]" checked={draft.extras.applyMinVolume} onChange={(e) => setExtras({ applyMinVolume: e.target.checked })} />
                  Aplicar regra de volume mínimo
                </label>
                <p className="mt-1 text-xs text-muted">
                  {r.minVolume.m3 === null ? 'Volume mínimo não configurado' : `Mínimo ${num(r.minVolume.m3, 1)} m³ · ${r.minVolume.chargeDifference ? 'cobra a diferença' : 'apenas alerta'}`}
                </p>
                <Field label="Desconto geral (R$)" className="mt-3 max-w-[200px]" hint={`Sem aprovação até ${r.maxDiscountPctWithoutApproval === null ? '— (não configurado)' : `${r.maxDiscountPctWithoutApproval}%`}`}>
                  {(id) => <input id={id} inputMode="decimal" className={inputCls()} value={draft.extras.globalDiscount} placeholder="0,00" onChange={(e) => setExtras({ globalDiscount: e.target.value })} />}
                </Field>
              </RuleBlock>
            </div>
          </Card>

          {/* Condições */}
          <Card>
            <CardHeader step={draft.type === 'combinado' ? 6 : 5} title="Condições comerciais" />
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="mb-2 text-[13px] font-semibold text-ink-2">Formas de pagamento</p>
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((m) => {
                    const enabled = ctx.enabledPaymentMethodIds.includes(m.id)
                    const on = draft.paymentMethodIds.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        disabled={!enabled}
                        title={enabled ? undefined : 'Forma ainda não habilitada nas configurações'}
                        aria-pressed={on}
                        onClick={() => set('paymentMethodIds', on ? draft.paymentMethodIds.filter((x) => x !== m.id) : [...draft.paymentMethodIds, m.id])}
                        className={cx('rounded-full border px-3 py-1.5 text-sm font-semibold transition', on ? 'border-ink bg-ink text-bg' : 'border-line hover:border-ink', !enabled && 'cursor-not-allowed opacity-40 line-through')}
                      >
                        {m.label}
                      </button>
                    )
                  })}
                </div>
                {ctx.enabledPaymentMethodIds.length === 0 && <p className="mt-2 text-xs text-warn">Nenhuma forma de pagamento habilitada. Confirme as modalidades aceitas em Configurações.</p>}
              </div>
              <Field label="Prazo e condições de pagamento" hint="Ex.: entrada, parcelamento, faturamento em 28 dias">
                {(id) => <input id={id} className={inputCls()} value={draft.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} />}
              </Field>
              <Field label="Validade da proposta (dias)" required hint={validUntil ? `Válida até ${dateBR(validUntil)}` : r.validityDays === null ? 'Validade padrão não configurada' : undefined}>
                {(id) => <input id={id} inputMode="numeric" className={inputCls(!validUntil && draft.validityDays !== '')} value={draft.validityDays} onChange={(e) => set('validityDays', e.target.value)} />}
              </Field>
              <Field label="Prazo de execução (opcional)">
                {(id) => <input id={id} className={inputCls()} value={draft.executionDeadline} placeholder="Ex.: concretagem prevista para a 2ª quinzena" onChange={(e) => set('executionDeadline', e.target.value)} />}
              </Field>
              <Field label="Observações comerciais">
                {(id) => <textarea id={id} rows={3} className={cx(inputCls(), 'h-auto py-2')} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />}
              </Field>
            </div>
          </Card>
        </div>

        {/* Resumo */}
        <aside id="resumo" className="min-w-0">
          <div className="space-y-4 xl:sticky xl:top-20">
            <Card className="overflow-hidden">
              <div className="bg-ink px-5 py-4 text-bg">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-bg/60">Resumo</span>
                  <Badge tone="neutral">Rascunho</Badge>
                </div>
                <p className="font-display mt-1 text-2xl font-extrabold tabular">{nextNumber} <span className="text-base font-semibold text-bg/60">· v1</span></p>
                <p className="text-xs text-bg/60">Número provisório, confirmado ao registrar o orçamento.</p>
              </div>
              <div className="space-y-1 p-5 text-sm">
                {result.concreteVolume > 0 && <SumRow k="Concreto" v={`${num(result.concreteVolume, 2)} m³`} />}
                {result.floorArea > 0 && <SumRow k="Piso" v={`${num(result.floorArea, 2)} m²`} />}
                <SumRow k="Subtotal dos itens" v={brlCents(result.itemsGrossCents)} />
                {result.lineDiscountCents > 0 && <SumRow k="Descontos nos itens" v={`− ${brlCents(result.lineDiscountCents)}`} />}
                {result.additionals.map((a) => (
                  <SumRow key={a.key} k={a.label} sub={a.detail} v={brlCents(a.cents)} />
                ))}
                {result.globalDiscountCents > 0 && <SumRow k="Desconto geral" v={`− ${brlCents(result.globalDiscountCents)}`} />}
                <div className="mt-3 border-t-2 border-ink pt-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Total geral</p>
                  {result.totalCents !== null ? (
                    <p className="font-display text-4xl font-extrabold tabular">{brlCents(result.totalCents)}</p>
                  ) : (
                    <>
                      <p className="font-display text-4xl font-extrabold text-warn">Pendente</p>
                      <p className="text-xs text-muted">{result.pendingCount} valor(es) sem preço. Valores conhecidos somam {brlCents(result.knownCents)} — não é o total.</p>
                    </>
                  )}
                  {validUntil && <p className="mt-1 text-xs text-muted">Validade: {dateBR(validUntil)}</p>}
                </div>
              </div>
              <div className="space-y-2 border-t border-line p-5">
                <Button variant={canIssue ? 'primary' : 'secondary'} className="w-full" onClick={() => setShowProposal(true)}>
                  {canIssue ? <FileText className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {canIssue ? 'Gerar proposta em PDF' : 'Pré-visualizar proposta'}
                </Button>
                <Button className="w-full" disabled={!client} onClick={() => setShowWa(true)}>
                  <MessageCircle className="h-4 w-4" /> Compartilhar no WhatsApp
                </Button>
                {!canIssue && (
                  <p className="text-center text-xs text-muted">
                    {blockers.length ? 'Proposta definitiva bloqueada até resolver as pendências abaixo.' : 'Proposta definitiva liberada após aprovação interna.'}
                  </p>
                )}
                <p className="pt-1 text-center text-[11px] text-muted">{savedAt ? `Rascunho guardado neste navegador às ${savedAt}` : 'Rascunho guardado automaticamente neste navegador'}</p>
              </div>
            </Card>

            <IssueList icon={<CircleAlert className="h-4 w-4" />} title="Bloqueios" tone="red" items={blockers} />
            <IssueList icon={<ShieldCheck className="h-4 w-4" />} title="Exigem aprovação interna" tone="info" items={approvals} />
            <IssueList icon={<TriangleAlert className="h-4 w-4" />} title="Avisos" tone="warn" items={warnings} />
            {!issues.length && (
              <div className="flex items-center gap-2 rounded-lg border border-ok/30 bg-ok-soft p-4 text-sm font-semibold text-ok">
                <CircleCheck className="h-5 w-5" /> Orçamento completo e pronto para emissão.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Barra de total no celular */}
      <div className="no-print sticky bottom-0 z-30 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur xl:hidden">
        <div>
          <p className="text-[11px] font-bold uppercase text-muted">Total</p>
          <p className="font-display text-2xl font-extrabold tabular">{result.totalCents === null ? 'Pendente' : brlCents(result.totalCents)}</p>
        </div>
        <Button variant="primary" onClick={() => document.getElementById('resumo')?.scrollIntoView({ behavior: 'smooth' })}>
          Ver resumo
        </Button>
      </div>

      <ProposalModal open={showProposal} onClose={() => setShowProposal(false)} data={proposal} />
      <WhatsAppDialog open={showWa} onClose={() => setShowWa(false)} data={proposal} />
    </>
  )
}

function RuleBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line p-4">
      <h3 className="mb-3 text-lg font-bold uppercase">{title}</h3>
      {children}
    </div>
  )
}

function RuleValue({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="mt-3 min-w-0">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={cx('font-semibold tabular', v === null && 'text-warn')}>{v === null ? 'Não configurado' : brl(v)}</p>
    </div>
  )
}

function SumRow({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="text-muted">
        {k}
        {sub && <span className="block text-[11px]">{sub}</span>}
      </span>
      <span className={cx('font-semibold tabular', v === 'Pendente' && 'text-warn')}>{v}</span>
    </div>
  )
}

function IssueList({ title, items, tone, icon }: { title: string; items: Issue[]; tone: 'red' | 'info' | 'warn'; icon: ReactNode }) {
  if (!items.length) return null
  return (
    <div className={cx('rounded-lg border p-4', tone === 'red' && 'border-brand/30 bg-brand-soft', tone === 'info' && 'border-info/30 bg-info-soft', tone === 'warn' && 'border-warn/30 bg-warn-soft')}>
      <p className={cx('mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide', tone === 'red' && 'text-brand', tone === 'info' && 'text-info', tone === 'warn' && 'text-warn')}>
        {icon} {title} ({items.length})
      </p>
      <ul className="space-y-1 text-sm">
        {items.map((i) => (
          <li key={i.level + i.message} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" />
            {i.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
