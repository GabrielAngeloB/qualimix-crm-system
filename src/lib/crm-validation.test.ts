import { describe, expect, it } from 'vitest'
import {
  isValidIsoDate,
  normalizeBrazilPhone,
  parseOptionalAmount,
  phoneValidationError,
  validateClientFields,
  validateLeadFields,
  validateOptionalDecimal,
} from './crm-validation'

const validClient = {
  name: 'Construtora Almeida Ltda',
  tradeName: 'Almeida Obras',
  type: 'Construtora',
  document: '529.982.247-25',
  phone: '(61) 99999-9999',
  whatsapp: '(61) 99999-9999',
  email: 'contato@almeida.com.br',
  address: 'Rua das Flores, 100',
  city: 'Sobradinho - DF',
  region: 'Região Norte',
  source: 'Indicação',
  notes: '',
}

describe('CRM field validation', () => {
  it('accepts valid client fields and normalizes a Brazilian phone with country code', () => {
    expect(validateClientFields(validClient)).toEqual({})
    expect(normalizeBrazilPhone('+55 (61) 99999-9999')).toBe('61999999999')
    expect(phoneValidationError('+55 (61) 99999-9999', true)).toBeNull()
  })

  it('rejects invalid document, phone, email, and unsupported select values', () => {
    const errors = validateClientFields({
      ...validClient,
      document: '111.111.111-11',
      phone: '123',
      email: 'email-invalido',
      type: 'Categoria inventada',
      region: 'Região inexistente',
      source: 'Origem inventada',
    })
    expect(errors.document).toMatch(/CPF inválido/)
    expect(errors.phone).toBeTruthy()
    expect(errors.email).toBeTruthy()
    expect(errors.type).toBeTruthy()
    expect(errors.region).toBeTruthy()
    expect(errors.source).toBeTruthy()
  })

  it('rejects duplicate CPF/CNPJ and validates optional job details', () => {
    const errors = validateClientFields(
      { ...validClient, siteName: 'Residencial Jardim', sitePhone: '9999', siteRestrictions: 'x'.repeat(501) },
      [{ id: 'existing', document: '52998224725' }],
    )
    expect(errors.document).toMatch(/já está cadastrado/)
    expect(errors.siteAddress).toBeTruthy()
    expect(errors.sitePhone).toBeTruthy()
    expect(errors.siteRestrictions).toBeTruthy()
  })

  it('accepts Brazilian decimal values and rejects negative or malformed lead estimates', () => {
    expect(parseOptionalAmount('25.000,50')).toBe(25000.5)
    expect(validateLeadFields({
      title: 'Concretagem da laje',
      clientId: 'client-1',
      siteId: '',
      source: 'WhatsApp 1',
      estimatedValue: '25.000,50',
    })).toEqual({})

    expect(validateLeadFields({
      title: 'A',
      clientId: '',
      siteId: '',
      source: 'desconhecido',
      estimatedValue: '-10',
    })).toEqual({
      title: 'Informe um título entre 3 e 180 caracteres.',
      clientId: 'Selecione um cliente ativo.',
      source: 'Selecione a origem do contato.',
      estimatedValue: 'O valor deve ser positivo e caber no limite do sistema.',
    })
  })

  it('rejects lead estimates with more than two decimal places', () => {
    const errors = validateLeadFields({
      title: 'Concretagem da laje',
      clientId: 'client-1',
      siteId: '',
      source: 'Indicação',
      estimatedValue: '25.1234',
    })
    expect(errors.estimatedValue).toMatch(/duas casas decimais/)
  })

  it('validates decimal measurement bounds and real ISO dates', () => {
    expect(validateOptionalDecimal('12,5', 'Comprimento', { positive: true })).toBeNull()
    expect(validateOptionalDecimal('-1', 'Comprimento', { positive: true })).toBeTruthy()
    expect(validateOptionalDecimal('2,5', 'Quantidade', { integer: true })).toBeTruthy()
    expect(isValidIsoDate('2026-11-08')).toBe(true)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
  })
})
