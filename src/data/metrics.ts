/**
 * Indicadores do painel. Definições:
 * - Orçamentos criados: números distintos criados no período (versões não somam).
 * - Enviados: orçamentos com data de envio no período.
 * - Aceitos: orçamentos com status "Aceito" criados no período.
 * - Taxa de conversão: aceitos ÷ enviados no período.
 * - Valor orçado: total dos orçamentos criados no período (exceto cancelados).
 * - Valor contratado: total dos orçamentos aceitos (pedidos efetivamente fechados).
 * - Cobrado: soma das parcelas emitidas; Recebido: pagamentos confirmados.
 */
import type { EvaluatedQuote, ReceivableRow } from './derived'
import type { Opportunity } from './fixtures'
import { addDays, daysBetween } from '../lib/format'

export interface DashboardFilter {
  today: string
  days: number
  ownerId: string
}

export function computeDashboard(
  quotesAll: EvaluatedQuote[],
  oppsAll: Opportunity[],
  receivables: ReceivableRow[],
  f: DashboardFilter,
) {
  const from = addDays(f.today, -f.days)
  const inPeriod = (iso: string | null) => !!iso && iso >= from && iso <= f.today
  // Uma linha por número de orçamento (última versão)
  const latest = new Map<string, EvaluatedQuote>()
  for (const q of quotesAll) {
    const cur = latest.get(q.number)
    if (!cur || q.version > cur.version) latest.set(q.number, q)
  }
  const quotes = [...latest.values()].filter((q) => !f.ownerId || q.ownerId === f.ownerId)
  const opps = oppsAll.filter((o) => !f.ownerId || o.ownerId === f.ownerId)

  const created = quotes.filter((q) => inPeriod(q.createdAt) && q.status !== 'Cancelado')
  const sent = quotes.filter((q) => inPeriod(q.sentAt))
  const accepted = created.filter((q) => q.status === 'Aceito')
  const cents = (xs: EvaluatedQuote[]) => xs.reduce((s, q) => s + (q.result.totalCents ?? 0), 0)

  const fckMap = new Map<number, number>()
  for (const q of accepted)
    if (q.fck !== null) fckMap.set(q.fck, (fckMap.get(q.fck) ?? 0) + q.result.concreteVolume)
  const byFck = [...fckMap.entries()].sort((a, b) => a[0] - b[0]).map(([fck, m3]) => ({ label: `FCK ${fck}`, m3 }))

  const sourceMap = new Map<string, { leads: number; closed: number }>()
  for (const o of opps.filter((o) => inPeriod(o.enteredAt))) {
    const s = sourceMap.get(o.source) ?? { leads: 0, closed: 0 }
    s.leads++
    if (o.stage === 'fechado') s.closed++
    sourceMap.set(o.source, s)
  }
  const bySource = [...sourceMap.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.leads - a.leads)

  // Histórico mensal (6 meses)
  const months: { key: string; label: string; quoted: number; contracted: number }[] = []
  const [y, m] = f.today.split('-').map(Number)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('. de ', '/').replace('.', '')
    months.push({ key, label, quoted: 0, contracted: 0 })
  }
  for (const q of quotes) {
    if (q.status === 'Cancelado') continue
    const mo = months.find((x) => q.createdAt.startsWith(x.key))
    if (!mo) continue
    mo.quoted += (q.result.totalCents ?? 0) / 100
    if (q.status === 'Aceito') mo.contracted += (q.result.totalCents ?? 0) / 100
  }

  const recv = receivables.filter((r) => !f.ownerId || quotes.some((q) => q.id === r.quoteId))
  const openRecv = recv.filter((r) => r.status !== 'Pago' && r.status !== 'Cancelado')
  const overdueRecv = openRecv.filter((r) => r.status === 'Vencido')
  const receivedInPeriod = recv.filter((r) => r.paidCents > 0 && inPeriod(r.dueDate)).reduce((s, r) => s + r.paidCents, 0)

  const pendingReturn = quotes
    .filter((q) => q.status === 'Enviado ao cliente' || q.status === 'Em negociação')
    .map((q) => ({ q, idle: q.sentAt ? daysBetween(q.sentAt, f.today) : 0, expiresIn: daysBetween(f.today, q.validUntil) }))
    .sort((a, b) => a.expiresIn - b.expiresIn)

  return {
    leads: opps.filter((o) => inPeriod(o.enteredAt)).length,
    createdCount: created.length,
    sentCount: sent.length,
    acceptedCount: accepted.length,
    conversion: sent.length ? accepted.length / sent.length : null,
    quotedCents: cents(created),
    contractedCents: cents(accepted),
    volumeM3: accepted.reduce((s, q) => s + q.result.concreteVolume, 0),
    areaM2: accepted.reduce((s, q) => s + q.result.floorArea, 0),
    byFck,
    bySource,
    months,
    billedCents: recv.filter((r) => r.status !== 'Cancelado').reduce((s, r) => s + r.originalCents, 0),
    receivedCents: recv.reduce((s, r) => s + r.paidCents, 0),
    receivedInPeriod,
    openCents: openRecv.reduce((s, r) => s + r.openCents, 0),
    overdueCents: overdueRecv.reduce((s, r) => s + r.openCents, 0),
    overdue: overdueRecv,
    openRecv,
    pendingReturn,
  }
}
