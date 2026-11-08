import { BUSINESS_TIME_ZONE, isoDateInTimeZone, timeInTimeZone } from './clock'

/** Formatação no padrão brasileiro (pt-BR, BRL, DD/MM/AAAA) e fuso de Brasília. */

const brlFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function brl(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return 'Pendente'
  // eslint-disable-next-line no-irregular-whitespace -- normaliza o NBSP retornado pelo Intl.NumberFormat.
  return brlFmt.format(value).replace(/ /g, ' ')
}

/** Valores em centavos → BRL */
export function brlCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return 'Pendente'
  return brl(cents / 100)
}

export function num(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function pct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Data ISO (AAAA-MM-DD ou completa) → DD/MM/AAAA */
export function dateBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: BUSINESS_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function dateTimeBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
  const parts = Object.fromEntries(
    dateTimeFmt.formatToParts(dt)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return parts.day + '/' + parts.month + '/' + parts.year + ' ' + parts.hour + ':' + parts.minute
}

/** Horário HH:mm em Brasília para exibir instantes (incluindo salvamentos recentes). */
export function timeBR(value: Date = new Date()): string {
  return timeInTimeZone(value)
}

/** Converte um instante para a data do calendário de Brasília. */
export function isoDate(d: Date): string {
  return isoDateInTimeZone(d)
}

/** Soma dias de calendário, sem depender do fuso horário do navegador/servidor. */
export function addDays(iso: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error('A quantidade de dias precisa ser um número inteiro.')
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.getUTCFullYear() + '-' +
    String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(dt.getUTCDate()).padStart(2, '0')
}

/** Diferença em dias de calendário, sem efeito de horário de verão ou fuso local. */
export function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = toIso.slice(0, 10).split('-').map(Number)
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  return Math.round((b - a) / 86_400_000)
}

export type ParsedNumber =
  | { ok: true; value: number | null }
  | { ok: false; error: string }

/**
 * Lê números digitados no padrão brasileiro ("1.234,56", "12,5") ou com ponto
 * decimal ("12.5"). Campo vazio → value null (não é zero).
 */
export function parseDecimal(raw: string | null | undefined): ParsedNumber {
  const s = (raw ?? '').trim().replace(/\s/g, '')
  if (s === '') return { ok: true, value: null }
  let normalized = s
  if (s.includes(',')) normalized = s.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized))
    return { ok: false, error: 'Número inválido' }
  const value = Number(normalized)
  if (!Number.isFinite(value)) return { ok: false, error: 'Número inválido' }
  return { ok: true, value }
}

/** Arredondamento comercial "meio para cima" sem erro de ponto flutuante. */
export function roundHalfUp(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)
  if (String(abs).includes('e')) {
    const f = 10 ** decimals
    return (sign * Math.round(abs * f)) / f
  }
  const rounded = Number(
    Math.round(Number(`${abs}e${decimals}`)) + `e-${decimals}`,
  )
  return sign * rounded
}

/** Converte reais em centavos inteiros com arredondamento comercial. */
export function toCents(value: number): number {
  return Math.round(roundHalfUp(value, 2) * 100)
}
