import { describe, expect, it } from 'vitest'
import { createDefaultSettings, normalizeSettings, pendingSettings, validateSettings } from './settings'

describe('app settings', () => {
  it('creates an independent copy of default settings', () => {
    const first = createDefaultSettings()
    const second = createDefaultSettings()
    first.company.tradeName = 'Outra marca'
    first.catalog[0].basePrice = 123
    expect(second.company.tradeName).toBe('Qualimix')
    expect(second.catalog[0].basePrice).toBeNull()
  })

  it('preserves defaults when stored settings are incomplete', () => {
    const restored = normalizeSettings({ company: { tradeName: 'Empresa teste' }, officialRules: { freight: { fixed: 100 } } })
    expect(restored.company.tradeName).toBe('Empresa teste')
    expect(restored.company.email).toBeNull()
    expect(restored.officialRules.freight.fixed).toBe(100)
    expect(restored.officialRules.freight.perKm).toBeNull()
    expect(restored.catalog.length).toBeGreaterThan(0)
  })

  it('reports pending values using the saved settings, not static defaults', () => {
    const configured = createDefaultSettings()
    configured.catalog.forEach((item) => { item.basePrice = 100 })
    configured.company.legalName = 'Empresa Ltda.'
    configured.company.cnpj = '00000000000000'
    configured.company.address = 'Endereço informado'
    configured.officialRules.freight.fixed = 50
    configured.officialRules.pumping.fixed = 80
    configured.officialRules.minVolume.m3 = 1
    configured.officialRules.stay.perHour = 20
    configured.officialRules.validityDays = 7
    configured.paymentMethods[0].enabledOfficial = true
    expect(pendingSettings(configured)).toEqual([])
  })

  it('rejects duplicate catalog codes and empty business names', () => {
    const configured = createDefaultSettings()
    configured.catalog[1].code = configured.catalog[0].code
    expect(() => validateSettings(configured)).toThrow(/códigos repetidos/i)
    configured.catalog[1].code = 'CON-25'
    configured.company.tradeName = ' '
    expect(() => validateSettings(configured)).toThrow(/nome comercial/i)
  })

  it('validates the editable official commercial rules', () => {
    const configured = createDefaultSettings()
    configured.officialRules.maxDiscountPctWithoutApproval = 100
    configured.officialRules.validityDays = 365
    configured.officialRules.quantityDecimals = 4
    configured.officialRules.minVolume.chargeDifference = true
    expect(() => validateSettings(configured)).not.toThrow()

    configured.officialRules.maxDiscountPctWithoutApproval = 100.01
    expect(() => validateSettings(configured)).toThrow(/desconto sem aprovação/i)
    configured.officialRules.maxDiscountPctWithoutApproval = 10
    configured.officialRules.validityDays = 366
    expect(() => validateSettings(configured)).toThrow(/validade padrão/i)
    configured.officialRules.validityDays = 30
    configured.officialRules.quantityDecimals = 5
    expect(() => validateSettings(configured)).toThrow(/casas decimais/i)
  })

  it('keeps support lists valid and protects the default lead source', () => {
    const configured = createDefaultSettings()
    configured.leadSources[0] = 'Origem alterada'
    expect(() => validateSettings(configured)).toThrow(/Não informado/i)

    configured.leadSources[0] = 'Não informado'
    configured.regions.push(configured.regions[0])
    expect(() => validateSettings(configured)).toThrow(/nomes repetidos/i)

    configured.regions.pop()
    configured.lossReasons[0] = ' '
    expect(() => validateSettings(configured)).toThrow(/nomes vazios/i)
  })

  it('requires freight region rules to match the support region list', () => {
    const configured = createDefaultSettings()
    configured.officialRules.freight.regions[0].name = 'Região inexistente'
    expect(() => validateSettings(configured)).toThrow(/regiões de frete/i)
  })

})
