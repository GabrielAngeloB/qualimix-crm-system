import { useMemo, useState, type ReactNode } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarDays, CircleAlert, FileText, Plus, Settings, Truck, Wallet } from 'lucide-react'
import { useStore } from '../data/store'
import { computeDashboard, computeOperationalDashboard } from '../data/metrics'
import { today } from '../lib/clock'
import { pendingSettings } from '../data/settings'
import { brl, brlCents, dateBR, daysBetween, num, pct } from '../lib/format'
import { Badge, Card, CardHeader, EmptyState, PageHeader, cx, inputCls } from '../components/ui'
import { BarChart, ChartCard } from '../components/Charts'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Painel gerencial — Qualimix CRM' },
      { name: 'description', content: 'Leads, orçamentos, conversão, m³ e m² vendidos, próximas concretagens e contas a receber da Qualimix.' },
      { property: 'og:title', content: 'Painel gerencial — Qualimix CRM' },
      { property: 'og:description', content: 'Indicadores comerciais e operacionais da Qualimix em um só painel.' },
    ],
  }),
  component: Painel,
})

function Painel() {
  const { quotes, opportunities, receivables, clients, sites, scheduleEvents, workOrders, expenses, financialEntries, tasks } = useStore()
  const [days, setDays] = useState(90)
  const [ownerId, setOwnerId] = useState('')
  const d = useMemo(() => computeDashboard(quotes, opportunities, receivables, { today, days, ownerId }), [quotes, opportunities, receivables, days, ownerId])
  const pend = pendingSettings()
  const clientOf = (quoteId: string) => {
    const q = quotes.find((x) => x.id === quoteId)
    return { client: clients.find((c) => c.id === q?.clientId), site: sites.find((s) => s.id === q?.siteId), q }
  }
  const realSchedule = scheduleEvents
    .filter((event) => daysBetween(today, event.date) >= 0 && !['Cancelada', 'Concluída'].includes(event.status))
    .map((event) => ({
      id: event.id, date: event.date, time: event.time, volume: event.volumeM3, fck: event.fck, pump: event.pump, truck: event.truck, status: event.status,
      clientName: clients.find((client) => client.id === event.clientId)?.name ?? '—',
      siteName: sites.find((site) => site.id === event.siteId)?.name ?? event.service,
    }))
  const upcoming = [...realSchedule].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const pendingTasks = tasks
    .filter((task) => task.status === 'Pendente')
    .sort((a, b) => (a.dueDate + (a.dueTime ?? '23:59')).localeCompare(b.dueDate + (b.dueTime ?? '23:59')))
  const overdueTasks = pendingTasks.filter((task) => task.dueDate < today)
  const todayTasks = pendingTasks.filter((task) => task.dueDate === today)
  const ownerOptions = [...new Set(opportunities.map((opportunity) => opportunity.ownerId))].sort()
  const recentActivities = opportunities
    .flatMap((opportunity) => opportunity.history.map((event) => ({
      id: `${opportunity.id}-${event.at}-${event.text}`,
      text: event.text,
      ref: opportunity.title,
      by: event.by,
      at: event.at.slice(0, 10),
    })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)
  const operational = useMemo(
    () => computeOperationalDashboard(workOrders, expenses, financialEntries, scheduleEvents, today),
    [workOrders, expenses, financialEntries, scheduleEvents],
  )
  const hasData = clients.length > 0 || quotes.length > 0 || opportunities.length > 0 || workOrders.length > 0 || financialEntries.length > 0 || tasks.length > 0

  return (
    <>
      <PageHeader
        eyebrow={`Hoje, ${dateBR(today)}`}
        title="Painel gerencial"
        description="Indicadores comerciais e operacionais calculados a partir dos orçamentos, pedidos, agenda, despesas e lançamentos financeiros."
        actions={
          <>
            <select aria-label="Período" className={cx(inputCls(), 'w-auto')} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
              <option value={180}>Últimos 180 dias</option>
              <option value={365}>Últimos 12 meses</option>
            </select>
            <select aria-label="Responsável" className={cx(inputCls(), 'w-auto')} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Todos os responsáveis</option>
              {ownerOptions.map((ownerId) => <option key={ownerId} value={ownerId}>{ownerId === 'u-local' ? 'Sessão local' : ownerId}</option>)}
            </select>
            <Link to="/orcamentos/novo" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-white shadow-sm shadow-brand/20 hover:bg-brand-strong">
              <Plus className="h-4 w-4" /> Novo orçamento
            </Link>
          </>
        }
      />

      {pend.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-warn/30 bg-warn-soft p-4 text-sm">
          <Settings className="h-5 w-5 shrink-0 text-warn" />
          <p className="min-w-0 flex-1">
            <strong>Configuração comercial pendente:</strong> {pend.slice(0, 4).join(', ')}{pend.length > 4 && ` e mais ${pend.length - 4}`}. Propostas definitivas com preços oficiais dependem desses dados.
          </p>
          <Link to="/configuracoes" className="font-semibold text-warn underline">Ver pendências</Link>
        </div>
      )}

      {!hasData ? (
        <Card>
          <EmptyState icon={<FileText className="h-6 w-6" />} title="Nenhum dado ainda" action={<Link to="/clientes" search={{ novo: '1' }} className="font-semibold text-brand hover:underline">Cadastrar o primeiro cliente</Link>}>
            Os indicadores aparecem assim que houver clientes, oportunidades e orçamentos registrados. Nenhum número é exibido sem dados reais.
          </EmptyState>
        </Card>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Leads novos" value={String(d.leads)} def="Oportunidades que entraram no período" />
            <Kpi label="Orçamentos criados" value={String(d.createdCount)} def={`${d.sentCount} enviados · cada número conta uma vez`} />
            <Kpi label="Aceitos" value={String(d.acceptedCount)} def={`Conversão ${pct(d.conversion)} (aceitos ÷ enviados)`} />
            <Kpi label="Valor orçado" value={brlCents(d.quotedCents)} def="Total das propostas criadas no período" />
            <Kpi accent label="Valor contratado" value={brlCents(d.contractedCents)} def="Orçamentos aceitos — pedidos fechados" />
            <Kpi label="Pipeline em aberto" value={brlCents(d.pipelineCents)} def={d.opportunitiesWithoutQuote + ' sem orçamento · ' + d.opportunitiesWithQuote + ' com orçamento vinculado'} />
            <Kpi label="Concreto vendido" value={`${num(d.volumeM3, 1)} m³`} def="Volume dos orçamentos aceitos" />
            <Kpi label="Pisos vendidos" value={`${num(d.areaM2, 0)} m²`} def="Área dos orçamentos aceitos" />
            <Kpi label="Contas vencidas" value={brlCents(d.overdueCents)} def={`${d.overdue.length} parcela(s) em atraso`} tone={d.overdueCents > 0 ? 'red' : undefined} />
          </dl>

          <Card className="mt-6">
            <CardHeader
              title="Tarefas e retornos comerciais"
              subtitle={overdueTasks.length + ' atrasada(s) · ' + todayTasks.length + ' para hoje'}
              action={<Link to="/tarefas" search={{ oportunidade: undefined }} className="text-sm font-semibold text-brand hover:underline">Abrir tarefas</Link>}
            />
            {pendingTasks.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nenhuma tarefa pendente. Registre o próximo passo de uma oportunidade para acompanhar os retornos.</p>
            ) : (
              <ul className="divide-y divide-line">
                {pendingTasks.slice(0, 5).map((task) => {
                  const opportunity = opportunities.find((item) => item.id === task.opportunityId)
                  const client = clients.find((item) => item.id === opportunity?.clientId)
                  return (
                    <li key={task.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{task.title}</p>
                        <p className="truncate text-xs text-muted">{opportunity?.title ?? 'Tarefa geral'}{client ? ' · ' + client.name : ''}</p>
                      </div>
                      <span className="text-xs text-muted">{dateBR(task.dueDate)}{task.dueTime ? ' · ' + task.dueTime : ''}</span>
                      <Badge tone={task.dueDate < today ? 'red' : task.dueDate === today ? 'warn' : 'neutral'}>
                        {task.dueDate < today ? 'Atrasada' : task.dueDate === today ? 'Hoje' : 'Agendada'}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <ChartCard className="xl:col-span-2" title="Histórico de vendas" definition="Valor orçado × valor contratado por mês de criação do orçamento (últimos 6 meses)." columns={['Mês', 'Orçado', 'Contratado']} rows={d.months.map((m) => [m.label, brl(m.quoted), brl(m.contracted)])}>
              <BarChart ariaLabel="Histórico mensal de valor orçado e contratado" labels={d.months.map((m) => m.label)} series={[{ label: 'Orçado', data: d.months.map((m) => m.quoted), color: 'grey' }, { label: 'Contratado', data: d.months.map((m) => m.contracted) }]} format={(n) => brl(n).replace(',00', '')} />
            </ChartCard>
            <ChartCard title="Vendas por FCK" definition="m³ de concreto em orçamentos aceitos no período." columns={['FCK', 'm³']} rows={d.byFck.map((x) => [x.label, num(x.m3, 2)])}>
              {d.byFck.length ? (
                <BarChart horizontal ariaLabel="Volume vendido por FCK" labels={d.byFck.map((x) => x.label)} series={[{ label: 'm³', data: d.byFck.map((x) => x.m3) }]} format={(n) => `${num(n, 1)} m³`} />
              ) : (
                <p className="grid h-full place-items-center text-sm text-muted">Nenhuma venda de concreto no período.</p>
              )}
            </ChartCard>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <ChartCard title="Desempenho por origem" definition="Leads que entraram no período e quantos foram fechados." columns={['Origem', 'Leads', 'Fechados']} rows={d.bySource.map((x) => [x.source, x.leads, x.closed])}>
              {d.bySource.length ? (
                <BarChart horizontal ariaLabel="Leads e fechamentos por origem" labels={d.bySource.map((x) => x.source)} series={[{ label: 'Leads', data: d.bySource.map((x) => x.leads), color: 'grey' }, { label: 'Fechados', data: d.bySource.map((x) => x.closed) }]} format={(n) => num(n, 0)} />
              ) : (
                <p className="grid h-full place-items-center text-sm text-muted">Nenhum lead no período.</p>
              )}
            </ChartCard>

            <Card className="xl:col-span-2">
              <CardHeader title="Orçamentos aguardando retorno" subtitle="Enviados ou em negociação, ordenados pela validade." action={<Link to="/orcamentos" className="text-sm font-semibold text-brand hover:underline">Ver todos</Link>} />
              {d.pendingReturn.length === 0 ? (
                <p className="p-5 text-sm text-muted">Nenhum orçamento aguardando retorno.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {d.pendingReturn.slice(0, 5).map(({ q, idle, expiresIn }) => (
                    <li key={q.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                      <Link to="/orcamentos" search={{ q: q.number }} className="font-display text-lg font-bold tabular hover:text-brand">{q.number}</Link>
                      <span className="min-w-0 flex-1 truncate">{clients.find((c) => c.id === q.clientId)?.name}</span>
                      <span className="font-semibold tabular">{brlCents(q.result.totalCents)}</span>
                      <Badge tone={expiresIn < 0 ? 'red' : expiresIn <= 3 ? 'warn' : 'neutral'}>{expiresIn < 0 ? 'Validade vencida' : `Vence em ${expiresIn}d`}</Badge>
                      <span className="text-xs text-muted">{idle}d sem retorno</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="Próximas concretagens" subtitle={`${operational.scheduledCount} serviço(s) futuro(s)`} action={<Link to="/agenda" className="text-sm font-semibold text-brand hover:underline">Abrir agenda</Link>} />
              {upcoming.length === 0 ? (
                <p className="p-5 text-sm text-muted">Nenhuma concretagem programada.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {upcoming.map((e) => {
                    return (
                      <li key={e.id} className="flex gap-3 px-5 py-3 text-sm">
                        <div className="w-14 shrink-0 rounded bg-ink py-1 text-center text-bg">
                          <div className="font-display text-xl font-bold leading-none">{e.date.slice(8, 10)}/{e.date.slice(5, 7)}</div>
                          <div className="text-[11px]">{e.time}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{e.siteName}</p>
                          <p className="truncate text-xs text-muted">{e.clientName}</p>
                          <p className="mt-1 flex flex-wrap gap-1">
                            <Badge>{num(e.volume, 1)} m³{e.fck && ` · FCK ${e.fck}`}</Badge>
                            {e.pump && <Badge tone="info">Bomba</Badge>}
                            {e.truck ? <Badge><Truck className="h-3 w-3" /> {e.truck}</Badge> : <Badge tone="warn">Sem caminhão</Badge>}
                            <Badge tone={e.status === 'Confirmada' ? 'ok' : 'neutral'}>{e.status}</Badge>
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader title="Contas a receber" subtitle="Contratado, cobrado e efetivamente recebido são indicadores distintos." action={<Wallet className="h-5 w-5 text-brand" />} />
              <div className="space-y-3 p-5">
                <Flow label="Cobrado (parcelas emitidas)" value={d.billedCents} max={d.billedCents} />
                <Flow label="Recebido (pagamentos confirmados)" value={d.receivedCents} max={d.billedCents} tone="ok" />
                <Flow label="Em aberto" value={d.openCents} max={d.billedCents} tone="grey" />
                <Flow label="Vencido" value={d.overdueCents} max={d.billedCents} tone="red" />
                {d.overdue.length > 0 && (
                  <div className="rounded-md border border-brand/30 bg-brand-soft p-3 text-sm">
                    <p className="mb-1 flex items-center gap-1 font-bold text-brand"><CircleAlert className="h-4 w-4" /> Parcelas vencidas</p>
                    <ul className="space-y-1">
                      {d.overdue.map((r) => (
                        <li key={r.id} className="flex justify-between gap-2">
                          <span className="truncate">{clients.find((c) => c.id === r.clientId)?.name} · venc. {dateBR(r.dueDate)}</span>
                          <span className="font-semibold tabular">{brlCents(r.openCents)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Contas a pagar" action={<Link to="/financeiro" className="text-sm font-semibold text-brand hover:underline">Abrir financeiro</Link>} />
              <div className="space-y-3 p-5">
                <Flow label="Em aberto" value={operational.payableOpenCents} max={operational.payableOpenCents + operational.payablePaidCents} tone="grey" />
                <Flow label="Pago" value={operational.payablePaidCents} max={operational.payableOpenCents + operational.payablePaidCents} tone="ok" />
                <Flow label="Custos lançados nas obras" value={operational.costsCents} max={operational.contractedCents} tone="red" />
                <div className="border-t border-line pt-3">
                  <p className="text-xs text-muted">Contratado nas obras</p>
                  <p className="font-display text-xl font-bold tabular">{brlCents(operational.contractedCents)}</p>
                  <p className="mt-1 text-xs text-muted">Saldo após despesas: <strong className="tabular">{brlCents(operational.balanceCents)}</strong></p>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Atividades recentes" />
              {recentActivities.length === 0 ? (
                <p className="p-5 text-sm text-muted">Nenhuma atividade registrada.</p>
              ) : (
                <ol className="space-y-3 p-5 text-sm">
                  {recentActivities.map((activity) => (
                    <li key={activity.id} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                      <div className="min-w-0">
                        <p className="font-medium">{activity.text}</p>
                        <p className="text-xs text-muted">{activity.ref} · {activity.by === 'u-local' ? 'Sessão local' : activity.by} · {dateBR(activity.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}

function Kpi({ label, value, def, accent, tone }: { label: string; value: ReactNode; def: string; accent?: boolean; tone?: 'red' }) {
  return (
    <div className={cx('relative min-w-0 overflow-hidden rounded-lg border p-4', accent ? 'border-ink bg-ink text-bg' : 'border-line bg-surface', tone === 'red' && 'border-brand/40')}>
      {accent && <span className="stripe absolute right-0 top-0 h-full w-3 opacity-80" />}
      <dt className={cx('text-xs font-bold uppercase tracking-wide', accent ? 'text-bg/60' : 'text-muted')}>{label}</dt>
      <dd className={cx('font-display mt-1 truncate text-2xl font-extrabold tabular sm:text-3xl', tone === 'red' && 'text-brand')}>{value}</dd>
      <dd className={cx('mt-0.5 text-xs', accent ? 'text-bg/60' : 'text-muted')}>{def}</dd>
    </div>
  )
}

function Flow({ label, value, max, tone }: { label: string; value: number; max: number; tone?: 'ok' | 'grey' | 'red' }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular">{brlCents(value)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-surface-2">
        <div className={cx('h-2 rounded-full', tone === 'ok' ? 'bg-ok' : tone === 'grey' ? 'bg-muted' : tone === 'red' ? 'bg-brand' : 'bg-ink')} style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}
