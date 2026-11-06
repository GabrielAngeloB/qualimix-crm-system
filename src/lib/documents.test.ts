import { describe, expect, it } from 'vitest'
import { formatDocument, formatPhone, isValidCNPJ, isValidCPF, toWhatsAppNumber, validateDocument, whatsappUrl } from './documents'

describe('documentos', () => {
  it('valida CPF pelos dígitos verificadores', () => {
    expect(isValidCPF('123.456.789-09')).toBe(true)
    expect(isValidCPF('123.456.789-00')).toBe(false)
    expect(isValidCPF('111.111.111-11')).toBe(false)
  })
  it('valida CNPJ pelos dígitos verificadores', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true)
    expect(isValidCNPJ('11.222.333/0001-80')).toBe(false)
  })
  it('documento vazio é opcional; tamanho errado é inválido', () => {
    expect(validateDocument('')).toBeNull()
    expect(validateDocument('1234')).toMatch(/CPF/)
  })
  it('formata CPF, CNPJ e telefone', () => {
    expect(formatDocument('12345678909')).toBe('123.456.789-09')
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81')
    expect(formatPhone('11999990101')).toBe('(11) 99999-0101')
  })
})

describe('WhatsApp', () => {
  it('normaliza para 55 + DDD + número', () => {
    expect(toWhatsAppNumber('(11) 99999-0101')).toBe('5511999990101')
    expect(toWhatsAppNumber('5511999990101')).toBe('5511999990101')
    expect(toWhatsAppNumber('123')).toBeNull()
  })
  it('gera link wa.me com mensagem codificada', () => {
    expect(whatsappUrl('11999990101', 'Olá, R$ 10,00')).toBe('https://wa.me/5511999990101?text=Ol%C3%A1%2C%20R%24%2010%2C00')
    expect(whatsappUrl('', 'x')).toBeNull()
  })
})
