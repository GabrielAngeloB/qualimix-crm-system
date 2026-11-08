import { describe, expect, it } from 'vitest'
import { quotes } from './fixtures'
import { computeOperationalDashboard } from './metrics'
import {
  calculateUnitCostCents,
  financialStatus,
  jobBalanceCents,
  jobCostCents,
  openAmountCents,
  orderFromAcceptedQuote,
  reviseWorkOrderAmount,
  validateDate,
  validateMoneyCents,
  validateTime,
  validateCommercialTask,
  commercialTaskTiming,
  type CommercialTask,
  type FinancialEntry,
  type JobExpense,
  type ScheduleEvent,
  type WorkOrder,
} from './operations'

const today = '2026-11-08'

const entry: FinancialEntry = {
  id: 'fin-1',
  kind: 'receber',
  workOrderId: 'ped-1',
  quoteId: 'quote-1',
  clientId: 'client-1',
  professionalId: null,
  description: 'Parcela 1',
  amountCents: 10000,
  issuedAt: today,
  dueDate: '2026-11-10',
  method: 'Pix',
  status: 'Em aberto',
  payments: [
    { id: 'pay-1', paidAt: today, amountCents: 2500, method: 'Pix', note: 'Entrada' },
  ],
  createdAt: today,
  demo: false,
}

const order: WorkOrder = {
  id: 'ped-1',
  number: 'PED-2026-0001',
  quoteId: 'quote-1',
  opportunityId: 'lead-1',
  clientId: 'client-1',
  siteId: 'site-1',
  description: 'Obra',
  contractedCents: 50000,
  status: 'Aguardando programação',
  createdAt: today,
  demo: false,
}

const expenses: JobExpense[] = [
  { id: 'desp-1', workOrderId: 'ped-1', professionalId: null, category: 'Material', description: 'Material', amountCents: 12000, incurredAt: today, createdAt: today, demo: false },
  { id: 'desp-2', workOrderId: 'ped-1', professionalId: 'prof-1', category: 'Mão de obra', description: 'Equipe', amountCents: 8000, incurredAt: today, createdAt: today, demo: false },
  { id: 'desp-3', workOrderId: 'ped-2', professionalId: null, category: 'Frete', description: 'Outro pedido', amountCents: 5000, incurredAt: today, createdAt: today, demo: false },
]

const payableEntry: FinancialEntry = {
  ...entry,
  id: 'fin-2',
  kind: 'pagar',
  clientId: null,
  professionalId: 'prof-1',
  description: 'Mão de obra',
  amountCents: 5000,
  dueDate: '2026-11-01',
  payments: [],
}

const scheduleEvent: ScheduleEvent = {
  id: 'ag-1',
  workOrderId: order.id,
  quoteId: order.quoteId,
  clientId: order.clientId,
  siteId: order.siteId,
  date: '2026-11-09',
  time: '08:00',
  service: 'Concretagem',
  volumeM3: 12,
  fck: 25,
  pump: true,

  status: 'Planejada',
  notes: '',
  demo: false,
}

describe('regras operacionais', () => {
  it('gera indicadores operacionais a partir dos pedidos, custos, agenda e caixa', () => {
    const result = computeOperationalDashboard([order], expenses, [entry, payableEntry], [scheduleEvent], today)
    expect(result.workOrderCount).toBe(1)
    expect(result.scheduledCount).toBe(1)
    expect(result.contractedCents).toBe(50000)
    expect(result.costsCents).toBe(25000)
    expect(result.balanceCents).toBe(25000)
    expect(result.receivablePaidCents).toBe(2500)
    expect(result.receivableOpenCents).toBe(7500)
    expect(result.payableOpenCents).toBe(5000)
    expect(result.overdueCents).toBe(5000)
  })

  it('calcula saldo e custo apenas das despesas vinculadas ao pedido', () => {
    expect(jobCostCents(order.id, expenses)).toBe(20000)
    expect(jobBalanceCents(order, expenses)).toBe(30000)
  })

  it('calcula saldo em aberto e status financeiro com baixas parciais', () => {
    expect(openAmountCents(entry)).toBe(7500)
    expect(financialStatus(entry.amountCents, 2500, entry.dueDate, today)).toBe('Parcial')
    expect(financialStatus(entry.amountCents, 2500, '2026-11-01', today)).toBe('Vencido')
    expect(financialStatus(entry.amountCents, entry.amountCents, entry.dueDate, today)).toBe('Pago')
    expect(financialStatus(entry.amountCents, 0, '2026-11-01', today)).toBe('Vencido')
    expect(financialStatus(entry.amountCents, 0, entry.dueDate, today, true)).toBe('Cancelado')
  })

  it('calcula mão de obra por tarifa unitária e quantidade com arredondamento em centavos', () => {
    expect(calculateUnitCostCents(12500, 3)).toBe(37500)
    expect(calculateUnitCostCents(999, 1.5)).toBe(1499)
    expect(calculateUnitCostCents(0, 2)).toBeNull()
    expect(calculateUnitCostCents(1000, 0)).toBeNull()
  })

  it('valida calendário e valores monetários positivos em centavos', () => {
    expect(validateDate('2026-11-08')).toBe(true)
    expect(validateDate('2026-02-30')).toBe(false)
    expect(validateDate('08/11/2026')).toBe(false)
    expect(validateTime('23:59')).toBe(true)
    expect(validateTime('24:00')).toBe(false)
    expect(validateMoneyCents(1)).toBe(true)
    expect(validateMoneyCents(0)).toBe(false)
    expect(validateMoneyCents(1.5)).toBe(false)
  })

  it('revisa o valor contratado, preserva baixas e atualiza a conta a receber', () => {
    const revised = reviseWorkOrderAmount(order, 75000, entry, '2026-11-08T12:00:00.000Z')
    expect(revised.order.contractedCents).toBe(75000)
    expect(revised.order.valueHistory).toEqual([
      { at: '2026-11-08T12:00:00.000Z', fromCents: 50000, toCents: 75000 },
    ])
    expect(revised.receivable?.amountCents).toBe(75000)
    expect(revised.receivable?.payments).toEqual(entry.payments)
    expect(revised.receivable?.status).toBe('Parcial')
  })

  it('bloqueia reduzir o contrato abaixo do recebido ou alterar conta cancelada', () => {
    expect(() => reviseWorkOrderAmount(order, 2000, entry, '2026-11-08T12:00:00.000Z')).toThrow(/já recebido/)
    expect(() => reviseWorkOrderAmount(order, 75000, { ...entry, status: 'Cancelado' }, '2026-11-08T12:00:00.000Z')).toThrow(/cancelada/)
  })

  it('converte somente orçamento real aceito em pedido vinculado', () => {
    const quote = { ...quotes[0], demo: false, status: 'Aceito' as const }
    const created = orderFromAcceptedQuote(quote, 123456, 'lead-1', today, 'ped-new', 'PED-2026-0002')
    expect(created.quoteId).toBe(quote.id)
    expect(created.opportunityId).toBe('lead-1')
    expect(created.contractedCents).toBe(123456)
    expect(created.demo).toBe(false)
  })

  it('bloqueia pedidos de orçamentos demo ou não aceitos', () => {
    expect(() => orderFromAcceptedQuote(quotes[0], 10000, null, today, 'id', 'PED-1')).toThrow(/demonstração/)
    const pending = { ...quotes[0], demo: false, status: 'Rascunho' as const }
    expect(() => orderFromAcceptedQuote(pending, 10000, null, today, 'id', 'PED-1')).toThrow(/aceitos/)
  })
})


describe('tarefas comerciais', () => {
  const task: CommercialTask = {
    id: 'task-1',
    opportunityId: 'lead-1',
    title: 'Retornar sobre o orçamento',
    notes: 'Confirmar recebimento da proposta.',
    dueDate: '2026-11-10',
    dueTime: '09:30',
    priority: 'Alta',
    status: 'Pendente',
    createdAt: '2026-11-08T12:00:00.000Z',
    completedAt: null,
    demo: false,
  }

  it('valida tarefa com oportunidade, data, horário e prioridade', () => {
    expect(validateCommercialTask(task)).toBe(true)
    expect(validateCommercialTask({ ...task, title: '  ' })).toBe(false)
    expect(validateCommercialTask({ ...task, dueDate: '2026-02-30' })).toBe(false)
    expect(validateCommercialTask({ ...task, dueTime: '25:90' })).toBe(false)
    expect(validateCommercialTask({ ...task, notes: 'x'.repeat(2001) })).toBe(false)
  })

  it('classifica tarefa atrasada, de hoje e futura sem confundir tarefas encerradas', () => {
    expect(commercialTaskTiming({ ...task, dueDate: '2026-11-07' }, '2026-11-08')).toBe('Atrasada')
    expect(commercialTaskTiming({ ...task, dueDate: '2026-11-08' }, '2026-11-08')).toBe('Hoje')
    expect(commercialTaskTiming(task, '2026-11-08')).toBe('Futura')
    expect(commercialTaskTiming({ ...task, status: 'Concluída', completedAt: '2026-11-08T13:00:00.000Z' }, '2026-11-08')).toBe('Concluída')
    expect(commercialTaskTiming({ ...task, status: 'Cancelada' }, '2026-11-08')).toBe('Cancelada')
  })
})
