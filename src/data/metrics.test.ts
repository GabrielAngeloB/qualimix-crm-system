import { describe, expect, it } from 'vitest'
import { buildReceivables, evaluateAll, quoteContext, receivableStatus } from './derived'
import { computeDashboard } from './metrics'
import { opportunities, quotes, today } from './fixtures'

const ctx = quoteContext(true)

describe('painel', () => {
  const evaluated = evaluateAll(quotes, ctx)

  it('não conta o mesmo orçamento duas vezes quando há versões', () => {
    const base = computeDashboard(evaluated, opportunities, [], { today, days: 365, ownerId: '' })
    const v2 = { ...evaluated[0], version: 2 }
    const withVersion = computeDashboard([...evaluated, v2], opportunities, [], { today, days: 365, ownerId: '' })
    expect(withVersion.createdCount).toBe(base.createdCount)
    expect(withVersion.contractedCents).toBe(base.contractedCents)
  })

  it('valor contratado considera apenas orçamentos aceitos', () => {
    const d = computeDashboard(evaluated, opportunities, [], { today, days: 365, ownerId: '' })
    const accepted = evaluated.filter((q) => q.status === 'Aceito').reduce((s, q) => s + (q.result.totalCents ?? 0), 0)
    expect(d.contractedCents).toBe(accepted)
    expect(d.quotedCents).toBeGreaterThan(d.contractedCents)
  })

  it('sem dados, os indicadores ficam zerados e a conversão indisponível', () => {
    const d = computeDashboard([], [], [], { today, days: 90, ownerId: '' })
    expect(d.createdCount).toBe(0)
    expect(d.conversion).toBeNull()
  })

  it('todos os orçamentos de demonstração têm total calculável', () => {
    for (const q of evaluated) expect(q.result.totalCents, q.number).not.toBeNull()
  })
})

describe('contas a receber', () => {
  it('saldo = original − pago e parcelas derivadas do total do orçamento', () => {
    const rows = buildReceivables(evaluateAll(quotes, ctx))
    for (const r of rows) expect(r.openCents).toBe(r.originalCents - r.paidCents)
  })
  it('status: pago, parcial, vencido, cancelado', () => {
    expect(receivableStatus(100, 100, '2000-01-01', false)).toBe('Pago')
    expect(receivableStatus(100, 40, '2999-01-01', false)).toBe('Parcialmente pago')
    expect(receivableStatus(100, 40, '2000-01-01', false)).toBe('Vencido')
    expect(receivableStatus(100, 0, '2999-01-01', true)).toBe('Cancelado')
  })
})
