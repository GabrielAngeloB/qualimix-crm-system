import { describe, expect, it } from 'vitest'
import { addDays, brl, dateBR, num, parseDecimal, roundHalfUp, toCents } from './format'

const nb = (s: string) => s.replace(/ | /g, ' ')

describe('formatação brasileira', () => {
  it('moeda BRL e números pt-BR', () => {
    expect(nb(brl(1234.5))).toBe('R$ 1.234,50')
    expect(num(19.656, 3)).toBe('19,656')
  })
  it('valor ausente é "Pendente", nunca R$ 0,00', () => {
    expect(brl(null)).toBe('Pendente')
  })
  it('datas DD/MM/AAAA', () => {
    expect(dateBR('2026-03-09')).toBe('09/03/2026')
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02')
  })
  it('lê decimais com vírgula ou ponto; vazio é null', () => {
    expect(parseDecimal('1.234,56')).toEqual({ ok: true, value: 1234.56 })
    expect(parseDecimal('12.5')).toEqual({ ok: true, value: 12.5 })
    expect(parseDecimal('')).toEqual({ ok: true, value: null })
    expect(parseDecimal('12,5,3').ok).toBe(false)
  })
  it('arredondamento comercial meio-para-cima sem erro binário', () => {
    expect(roundHalfUp(2.675, 2)).toBe(2.68)
    expect(roundHalfUp(1.005, 2)).toBe(1.01)
    expect(toCents(1.005)).toBe(101)
    expect(toCents(0.1 + 0.2)).toBe(30)
  })
})
