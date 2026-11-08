import { useMemo, useState, type ReactNode } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarDays, CircleAlert, FileText, Plus, Settings, Wallet } from 'lucide-react'
import { useStore } from '../data/store'
import { computeDashboard } from '../data/metrics'
import { activities, schedule, today } from '../data/fixtures'
import { pendingSettings } from '../data/settings'
import { brl, brlCents, dateBR, daysBetween, num, pct } from '../lib/format'
import { Badge, Card, CardHeader, EmptyState, PageHeader, cx, inputCls } from '../components/ui'
import { BarChart, ChartCard } from '../components/Charts'

export const Route = createFileRoute('/')({ component: Painel })

function Painel() {
  const { quotes, opportunities, receivables, clients, sites, demoMode, team, views, ctx, scheduleEvents, workOrders } = useStore()
  const [days, setDays] = useState(90)
  const [ownerId, setOwnerId] = useState('')
  const userName = (id: string) => team.find((member) => member.id === id)?.name ?? '—'
  const d = useMemo(() => computeDashboard(quotes, opportunities, receivables, { today, days, ownerId }), [quotes, opportunities, receivables, days, ownerId])
  const pend = pendingSettings(ctx.catalog)
  const clientOf = (quoteId: string) => {
    const q = quotes.find((x) => x.id === quoteId)
    return { client: clients.find((c) => c.id === q?.clientId), site: sites.find((s) => s.id === q?.siteId), q }
  }
  const upcoming = (demoMode
    ? schedule.map((e) => ({ id: e.id, date: e.date, time: e.time, quoteId: e.quoteId, volume: e.volume, fck: e.fck, pump: e.pump, status: e.status }))
    : scheduleEvents.map((e) => ({ id: e.id, date: e.date, time: e.time, quoteId: e.quoteId, volume: e.volumeM3, fck: e.fck, pump: e.pump, status: e.status }))
  ).filter((e) => daysBetween(today, e.date) >= 0 && e.status !== 'Cancelada')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const financeRows = views.finance ?? []
  const financeSummary = {
    billed: financeRows.filter((x) => x.tipo === 'receber').reduce((sum, x) => sum + Number(x.valor_centavos ?? 0), 0),
    received: financeRows.filter((x) => x.tipo === 'receber').reduce((sum, x) => sum + Number(x.total_pago_centavos ?? 0), 0),
    open: financeRows.filter((x) => x.tipo === 'receber' && x.status_calculado !== 'Cancelado').reduce((sum, x) => sum + Number(x.saldo_centavos ?? 0), 0),
    overdue: financeRows.filter((x) => x.tipo === 'receber' && x.status_calculado === 'Vencido').reduce((sum, x) => sum + Number(x.saldo_centavos ?? 0), 0),
  }
  const hasData = clients.length > 0 || quotes.length > 0 || opportunities.length > 0 || workOrders.length > 0 || scheduleEvents.length > 0

  return (
    <>
      <PageHeader
        eyebrow={`Hoje, ${dateBR(today)}`}
        title="Painel gerencial"
        description="Indicadores calculados a partir dos registros comerciais, operacionais e financeiros persistidos no banco."
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
              {team.filter((u) => u.role === 'Comercial' || u.role === 'Administrador').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <Link to="/orcamentos/novo" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-white shadow-sm shadow-brand/20 hover:bg-brand-strong">
              <Plus className="h-4 w-4" /> Novo orçamento
            </Link>
          </>
        }
      />

      <section className="mb-6 space-y-3">
        <div>
          <h2 className="font-display text-xl font-bold uppercase">Consultas do banco de dados</h2>
          <p className="text-xs text-muted">Dados carregados das views SQL comerciais, operacionais e financeiras do Supabase.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader title="Clientes" subtitle="vw_clientes_resumo" /><p className="px-5 pb-4 text-2xl font-bold tabular">{views.clients.length}</p></Card>
          <Card><CardHeader title="Orçamentos" subtitle="vw_orcamentos_resumo" /><p className="px-5 pb-4 text-2xl font-bold tabular">{views.quotes.length}</p></Card>
          <Card><CardHeader title="Oportunidades" subtitle="vw_funil_resumo" /><p className="px-5 pb-4 text-2xl font-bold tabular">{views.funnel.reduce((sum, row) => sum + Number(row.quantidade ?? 0), 0)}</p></Card>
          <Card><CardHeader title="Pedidos" subtitle="vw_pedidos_resumo" /><p className="px-5 pb-4 text-2xl font-bold tabular">{views.orders.length}</p></Card>
          <Card><CardHeader title="Contas financeiras" subtitle="vw_financeiro_resumo" /><p className="px-5 pb-4 text-2xl font-bold tabular">{views.finance.length}</p></Card>
          <Card><CardHeader title="Profissionais" subtitle="vw_profissionais_resumo" /><p className="px-5 pb-4 text-2xl font-bold tabular">{views.professionals.length}</p></Card>
          <Card><CardHeader title="Programações" subtitle="vw_agenda_resumo" /><p className="px-5 pb-4 text-2xl font-bold tabular">{views.schedule.length}</p></Card>
          <Card><CardHeader title="Tarefas pendentes" subtitle="vw_tarefas_resumo" /><p className="px-5 pb-4 text-2xl font-bold tabular">{views.tasks.filter((row) => row.status === 'Pendente').reduce((sum, row) => sum + Number(row.quantidade ?? 0), 0)}</p></Card>
        </div>
        <Card>
          <CardHeader title="Funil resumido no PostgreSQL" subtitle="Contagem e valor estimado por etapa, calculados pela view vw_funil_resumo." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase text-muted">
                <tr><th className="px-4 py-2">Etapa</th><th className="px-4 py-2 text-right">Oportunidades</th><th className="px-4 py-2 text-right">Valor estimado</th><th className="px-4 py-2 text-right">Retornos atrasados</th></tr>
              </thead>
              <tbody>
                {views.funnel.map((row) => (
                  <tr key={row.etapa} className="border-b border-line last:border-0">
                    <td className="px-4 py-2">{row.nome}</td>
                    <td className="px-4 py-2 text-right tabular">{row.quantidade}</td>
                    <td className="px-4 py-2 text-right tabular">{brl(Number(row.valor_estimado ?? 0))}</td>
                    <td className="px-4 py-2 text-right tabular">{row.retornos_atrasados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid gap-3 xl:grid-cols-2">
          <Card>
            <CardHeader title="Clientes — visão resumida" subtitle="vw_clientes_resumo · registros recentes" />
            {views.clients.length === 0 ? <p className="p-4 text-sm text-muted">Nenhum cliente na view.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="border-b border-line bg-surface-2 text-xs uppercase text-muted"><tr><th className="px-4 py-2">Cliente</th><th className="px-4 py-2 text-right">Obras</th><th className="px-4 py-2 text-right">Leads</th><th className="px-4 py-2 text-right">Orçamentos</th></tr></thead>
                  <tbody>{views.clients.slice(0, 6).map((row) => <tr key={row.id} className="border-b border-line last:border-0"><td className="px-4 py-2"><span className="block max-w-[220px] truncate font-medium">{row.nome}</span><span className="text-xs text-muted">{row.cidade || row.regiao || '—'}</span></td><td className="px-4 py-2 text-right tabular">{row.total_obras}</td><td className="px-4 py-2 text-right tabular">{row.total_oportunidades}</td><td className="px-4 py-2 text-right tabular">{row.total_orcamentos}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Orçamentos — visão resumida" subtitle="vw_orcamentos_resumo · registros recentes" />
            {views.quotes.length === 0 ? <p className="p-4 text-sm text-muted">Nenhum orçamento na view.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-sm">
                  <thead className="border-b border-line bg-surface-2 text-xs uppercase text-muted"><tr><th className="px-4 py-2">Número / cliente</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Total</th></tr></thead>
                  <tbody>{views.quotes.slice(0, 6).map((row) => <tr key={row.id} className="border-b border-line last:border-0"><td className="px-4 py-2"><span className="block font-semibold tabular">{row.numero}</span><span className="block max-w-[220px] truncate text-xs text-muted">{row.cliente_nome}</span></td><td className="px-4 py-2">{row.status}</td><td className="px-4 py-2 text-right tabular">{row.total_centavos == null ? '—' : brl(Number(row.total_centavos) / 100)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>

      {pend.length > 0 &&
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-warn/30 bg-warn-soft p-4 text-sm">
          <Settings className="h-5 w-5 shrink-0 text-warn" />
          <p className="min-w-0 flex-1">
            <strong>Configuração comercial pendente:</strong> {pend.slice(0, 4).join(', ')}{pend.length > 4 && ` e mais ${pend.length - 4}`}. Propostas definitivas com preços oficiais dependem desses dados.
          </p>
          <Link to="/configuracoes" className="font-semibold text-warn underline">Ver pendências</Link>
        </div>
      }

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
            <Kpi label="Concreto vendido" value={`${num(d.volumeM3, 1)} m³`} def="Volume dos orçamentos aceitos" />
            <Kpi label="Pisos vendidos" value={`${num(d.areaM2, 0)} m²`} def="Área dos orçamentos aceitos" />
            <Kpi label="Contas a receber" value={brlCents(demoMode ? d.openCents : financeSummary.open)} def={demoMode ? `${d.overdue.length} parcela(s) em atraso (demo)` : `${brlCents(financeSummary.overdue)} vencido`} />
          </dl>

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
              <CardHeader title="Próximas concretagens" action={<CalendarDays className="h-5 w-5 text-brand" />} />
              {upcoming.length === 0 ? (
                <p className="p-5 text-sm text-muted">'Nenhuma concretagem programada.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {upcoming.map((e) => {
                    const { client, site } = clientOf(e.quoteId)
                    return (
                      <li key={e.id} className="flex gap-3 px-5 py-3 text-sm">
                        <div className="w-14 shrink-0 rounded bg-ink py-1 text-center text-bg">
                          <div className="font-display text-xl font-bold leading-none">{e.date.slice(8, 10)}/{e.date.slice(5, 7)}</div>
                          <div className="text-[11px]">{e.time}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{site?.name}</p>
                          <p className="truncate text-xs text-muted">{client?.name}</p>
                          <p className="mt-1 flex flex-wrap gap-1">
                            <Badge>{num(e.volume, 1)} m³{e.fck && ` · FCK ${e.fck}`}</Badge>
                            {e.pump && <Badge tone="info">Bomba</Badge>}
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
                <Flow label="Cobrado (parcelas emitidas)" value={demoMode ? d.billedCents : financeSummary.billed} max={demoMode ? d.billedCents : financeSummary.billed} />
                <Flow label="Recebido (pagamentos confirmados)" value={demoMode ? d.receivedCents : financeSummary.received} max={demoMode ? d.billedCents : financeSummary.billed} tone="ok" />
                <Flow label="Em aberto" value={demoMode ? d.openCents : financeSummary.open} max={demoMode ? d.billedCents : financeSummary.billed} tone="grey" />
                <Flow label="Vencido" value={demoMode ? d.overdueCents : financeSummary.overdue} max={demoMode ? d.billedCents : financeSummary.billed} tone="red" />
                {demoMode && d.overdue.length > 0 && (
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
              <CardHeader title="Atividades recentes" />
              {!demoMode || activities.length === 0 ? (
                <p className="p-5 text-sm text-muted">{demoMode ? 'Nenhuma atividade registrada.' : 'A linha do tempo geral ainda não está integrada ao banco.'}</p>
              ) : (
                <ol className="space-y-3 p-5 text-sm">
                  {activities.map((a, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                      <div className="min-w-0">
                        <p className="font-medium">{a.text}</p>
                        <p className="text-xs text-muted">{a.ref} · {userName(a.by)} · {dateBR(a.at)}</p>
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
