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
})
