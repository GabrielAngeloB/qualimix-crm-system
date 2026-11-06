/**
 * Cálculos derivados dos dados de demonstração. Os indicadores do painel são
 * sempre calculados a partir dos registros (nunca números soltos), com as
 * mesmas funções do gerador de orçamentos.
 */
import {
  computeQuote,
  summarizeMeasures,
  type QuoteContext,
  type QuoteResult,
} from '../lib/quote'
import { daysBetween } from '../lib/format'
import {
  catalog,
  demoRules,
  officialRules,
  paymentMethods,
} from './settings'
import {
  receivableSeeds,
  today,
  type QuoteRecord,
} from './fixtures'

export function quoteContext(demoMode: boolean): QuoteContext {
  return {
    catalog,
    rules: demoMode ? demoRules : officialRules,
    demoPrices: demoMode,
    enabledPaymentMethodIds: paymentMethods
      .filter((m) => (demoMode ? m.enabledDemo : m.enabledOfficial === true))
      .map((m) => m.id),
  }
}

export function evaluateRecord(r: QuoteRecord, ctx: QuoteContext): QuoteResult {
  const volume = summarizeMeasures(r.volumeElements, r.volumeMargin, 'volume')
  const area = summarizeMeasures(r.areaElements, r.areaMargin, 'area')
  return computeQuote(
    {
      clientId: r.clientId,
      siteId: r.siteId,
      lines: r.lines,
      volume,
      area,
      extras: r.extras,
      paymentMethodIds: r.paymentMethodIds,
    },
    ctx,
  )
}

export interface EvaluatedQuote extends QuoteRecord {
  result: QuoteResult
  fck: number | null
}

export function evaluateAll(records: QuoteRecord[], ctx: QuoteContext): EvaluatedQuote[] {
  return records.map((r) => {
    const concrete = r.lines.find((l) => l.category === 'concreto')
    const fck = concrete ? (catalog.find((c) => c.id === concrete.catalogId)?.fck ?? null) : null
    return { ...r, result: evaluateRecord(r, ctx), fck }
  })
}

export type ReceivableStatus = 'A receber' | 'Parcialmente pago' | 'Pago' | 'Vencido' | 'Cancelado'

export interface ReceivableRow {
  id: string
  quoteId: string
  clientId: string
  description: string
  originalCents: number
  paidCents: number
  openCents: number
  issuedAt: string
  dueDate: string
  method: string
  status: ReceivableStatus
}

export function receivableStatus(
  originalCents: number,
  paidCents: number,
  dueDate: string,
  cancelled: boolean,
): ReceivableStatus {
  if (cancelled) return 'Cancelado'
  if (paidCents >= originalCents) return 'Pago'
  if (daysBetween(today, dueDate) < 0) return 'Vencido'
  if (paidCents > 0) return 'Parcialmente pago'
  return 'A receber'
}

export function buildReceivables(quotes: EvaluatedQuote[]): ReceivableRow[] {
  return receivableSeeds.flatMap((s) => {
    const qd = quotes.find((x) => x.id === s.quoteId)
    if (!qd || qd.result.totalCents === null) return []
    const originalCents = Math.round(qd.result.totalCents * s.share)
    const paidCents = Math.round(originalCents * s.paidShare)
    return [
      {
        id: s.id,
        quoteId: s.quoteId,
        clientId: qd.clientId,
        description: s.description,
        originalCents,
        paidCents,
        openCents: originalCents - paidCents,
        issuedAt: s.issuedAt,
        dueDate: s.dueDate,
        method: s.method,
        status: receivableStatus(originalCents, paidCents, s.dueDate, s.cancelled),
      },
    ]
  })
}

export const SENT_STATUSES = ['Enviado ao cliente', 'Em negociação', 'Aceito', 'Recusado', 'Expirado']
