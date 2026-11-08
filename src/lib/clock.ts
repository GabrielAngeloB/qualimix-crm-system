/**
 * Fuso horário oficial utilizado pelo Qualimix CRM.
 * Todas as datas de calendário e horários apresentados pelo sistema seguem Brasília,
 * independentemente do fuso configurado no computador ou no servidor.
 */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo'

type ClockValue = Date | number

function asDate(value: ClockValue): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Data inválida para conversão de fuso horário.')
  return date
}

function partsInTimeZone(value: ClockValue, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    ...options,
  }).formatToParts(asDate(value))
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
}

/** Retorna AAAA-MM-DD no fuso de Brasília (UTC−03:00). */
export function isoDateInTimeZone(value: ClockValue = new Date()): string {
  const parts = partsInTimeZone(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return parts.year + '-' + parts.month + '-' + parts.day
}

/** Retorna HH:mm no fuso de Brasília, com relógio de 24 horas. */
export function timeInTimeZone(value: ClockValue = new Date()): string {
  const parts = partsInTimeZone(value, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return parts.hour + ':' + parts.minute
}

/** Data atual de negócio, sempre calculada em Brasília. */
export function todayInSaoPaulo(value: ClockValue = new Date()): string {
  return isoDateInTimeZone(value)
}

/** Compatibilidade para componentes legados; novos usos devem chamar todayInSaoPaulo(). */
export const today = todayInSaoPaulo()
