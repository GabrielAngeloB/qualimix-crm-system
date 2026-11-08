import { describe, expect, it } from 'vitest'
import { BUSINESS_TIME_ZONE, isoDateInTimeZone, timeInTimeZone, todayInSaoPaulo } from './clock'

describe('fuso horário de negócio', () => {
  it('fixa a zona oficial do CRM em Brasília', () => {
    expect(BUSINESS_TIME_ZONE).toBe('America/Sao_Paulo')
  })

  it('calcula o dia de Brasília mesmo quando a data UTC já virou o dia seguinte', () => {
    const instant = new Date('2026-11-09T02:30:00.000Z')
    expect(isoDateInTimeZone(instant)).toBe('2026-11-08')
    expect(todayInSaoPaulo(instant)).toBe('2026-11-08')
  })

  it('formata o horário de Brasília independentemente do fuso do processo', () => {
    expect(timeInTimeZone(new Date('2026-11-09T02:30:00.000Z'))).toBe('23:30')
  })
})
