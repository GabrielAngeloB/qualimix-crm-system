import { clientTypes, leadSources, regions } from '../data/settings'
import { onlyDigits, validateDocument } from './documents'
import { parseDecimal } from './format'

type AnyRecord = Record<string, unknown>

const value = (record: AnyRecord, key: string): string => {
  const raw = record[key]
  if (raw === undefined || raw === null) return ''
  return typeof raw === 'string' ? raw.trim() : '\u0000'
}

export function normalizeBrazilPhone(raw: string): string {
  return onlyDigits(raw).replace(/^55(?=\d{10,11}$)/, '')
}

export function phoneValidationError(raw: string, required = false): string | null {
  const digits = normalizeBrazilPhone(raw)
  if (!digits) return required ? 'Informe o telefone com DDD.' : null
  if (digits.length !== 10 && digits.length !== 11) {
    return 'Use DDD + número: 10 dígitos para fixo ou 11 para celular.'
  }
  return null
}

export function emailValidationError(raw: string): string | null {
  const email = raw.trim()
  if (!email) return null
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return 'Informe um e-mail válido, como contato@empresa.com.br.'
  }
  return null
}

export function validateClientFields(
  input: AnyRecord,
  existing: readonly { id?: string; document?: string | null }[] = [],
): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = value(input, 'name')
  const tradeName = value(input, 'tradeName')
  const type = value(input, 'type')
  const document = value(input, 'document')
  const phone = value(input, 'phone')
  const whatsapp = value(input, 'whatsapp')
  const email = value(input, 'email')
  const address = value(input, 'address')
  const city = value(input, 'city')
  const region = value(input, 'region')
  const source = value(input, 'source')
  const notes = value(input, 'notes')

  if (name === '\u0000' || name.length < 3 || name.length > 160) errors.name = 'Informe um nome ou razão social entre 3 e 160 caracteres.'
  if (tradeName === '\u0000' || tradeName.length > 120) errors.tradeName = 'O nome fantasia deve ter até 120 caracteres.'
  if (!clientTypes.includes(type as (typeof clientTypes)[number])) errors.type = 'Selecione um tipo de cliente válido.'
  if (document === '\u0000') errors.document = 'Documento inválido.'
  else {
    const documentError = validateDocument(document)
    if (documentError) errors.document = documentError
    const digits = onlyDigits(document)
    if (digits && existing.some((client) => client.document && onlyDigits(client.document) === digits)) {
      errors.document = 'Esse CPF/CNPJ já está cadastrado.'
    }
  }
  if (phone === '\u0000' || phoneValidationError(phone, true)) errors.phone = phoneValidationError(phone, true) ?? 'Telefone inválido.'
  if (whatsapp === '\u0000' || phoneValidationError(whatsapp)) errors.whatsapp = phoneValidationError(whatsapp) ?? 'WhatsApp inválido.'
  if (email === '\u0000' || email.length > 254 || emailValidationError(email)) errors.email = emailValidationError(email) ?? 'E-mail inválido.'
  if (address === '\u0000' || address.length > 200) errors.address = 'O endereço deve ter até 200 caracteres.'
  if (city === '\u0000' || city.length > 100) errors.city = 'A cidade deve ter até 100 caracteres.'
  if (!regions.includes(region)) errors.region = 'Selecione uma região de atendimento válida.'
  if (!leadSources.includes(source as (typeof leadSources)[number])) errors.source = 'Selecione uma origem válida.'
  if (notes === '\u0000' || notes.length > 2000) errors.notes = 'As observações devem ter até 2.000 caracteres.'

  const siteName = value(input, 'siteName')
  const siteAddress = value(input, 'siteAddress')
  const siteContact = value(input, 'siteContact')
  const sitePhone = value(input, 'sitePhone')
  const siteRestrictions = value(input, 'siteRestrictions')
  const hasSiteDetails = [siteName, siteAddress, siteContact, sitePhone, siteRestrictions].some(Boolean)

  if (hasSiteDetails && (siteName === '\u0000' || siteName.length < 3 || siteName.length > 160)) {
    errors.siteName = 'Informe a identificação da obra (3 a 160 caracteres).'
  }
  if (siteName && siteAddress.length === 0) errors.siteAddress = 'Informe o endereço para identificar onde fica a obra.'
  if (siteAddress === '\u0000' || siteAddress.length > 200) errors.siteAddress = 'O endereço da obra deve ter até 200 caracteres.'
  if (siteContact === '\u0000' || siteContact.length > 120) errors.siteContact = 'O nome do contato deve ter até 120 caracteres.'
  if (sitePhone === '\u0000' || phoneValidationError(sitePhone)) errors.sitePhone = phoneValidationError(sitePhone) ?? 'Telefone do contato inválido.'
  if (siteRestrictions === '\u0000' || siteRestrictions.length > 500) errors.siteRestrictions = 'As restrições devem ter até 500 caracteres.'

  return errors
}

export function validateLeadFields(input: AnyRecord): Record<string, string> {
  const errors: Record<string, string> = {}
  const title = value(input, 'title')
  const clientId = value(input, 'clientId')
  const siteId = value(input, 'siteId')
  const source = value(input, 'source')
  const estimatedValue = value(input, 'estimatedValue')

  if (title === '\u0000' || title.length < 3 || title.length > 180) errors.title = 'Informe um título entre 3 e 180 caracteres.'
  if (clientId === '\u0000' || !clientId || clientId.length > 80) errors.clientId = 'Selecione um cliente ativo.'
  if (siteId === '\u0000' || siteId.length > 80) errors.siteId = 'Selecione uma obra válida.'
  if (!leadSources.includes(source as (typeof leadSources)[number])) errors.source = 'Selecione a origem do contato.'
  if (estimatedValue === '\u0000') errors.estimatedValue = 'Informe um valor numérico válido.'
  else if (estimatedValue) {
    const parsed = parseDecimal(estimatedValue)
    if (!parsed.ok || parsed.value === null) errors.estimatedValue = 'Use um valor numérico, por exemplo 25.000,00.'
    else if (parsed.value < 0 || parsed.value > 999_999_999_999.99) errors.estimatedValue = 'O valor deve ser positivo e caber no limite do sistema.'
  }
  return errors
}

export function parseOptionalAmount(raw: string): number | null {
  if (!raw.trim()) return null
  const parsed = parseDecimal(raw)
  if (!parsed.ok || parsed.value === null) throw new Error('Valor numérico inválido.')
  return parsed.value
}

export function validateOptionalDecimal(
  raw: string,
  label: string,
  options: { min?: number; max?: number; integer?: boolean; positive?: boolean } = {},
): string | null {
  if (!raw.trim()) return null
  const parsed = parseDecimal(raw)
  if (!parsed.ok || parsed.value === null) return `${label}: use um número válido (ex.: 12,5).`
  const { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false, positive = false } = options
  if (positive ? parsed.value <= min : parsed.value < min) return `${label}: valor fora do limite permitido.`
  if (parsed.value > max) return `${label}: valor acima do limite permitido.`
  if (integer && !Number.isInteger(parsed.value)) return `${label}: informe um número inteiro.`
  return null
}

export function isValidIsoDate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false
  const date = new Date(`${raw}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === raw
}
