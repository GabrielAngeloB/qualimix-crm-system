/** Formatação no padrão brasileiro (pt-BR, BRL, DD/MM/AAAA). */

const brlFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function brl(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return 'Pendente'
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

export function dateTimeBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
  return `${dateBR(iso)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return isoDate(dt)
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso.slice(0, 10) + 'T00:00:00')
  const b = new Date(toIso.slice(0, 10) + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
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
