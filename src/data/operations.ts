import type { QuoteRecord } from './fixtures'

export type WorkOrderStatus =
  | 'Aguardando programação'
  | 'Programada'
  | 'Em execução'
  | 'Concluída'
  | 'Cancelada'

export type ScheduleStatus =
  | 'Planejada'
  | 'Confirmada'
  | 'Em preparação'
  | 'Em execução'
  | 'Concluída'
  | 'Reagendada'
  | 'Cancelada'

export interface WorkOrder {
  id: string
  number: string
  quoteId: string
  opportunityId: string | null
  clientId: string
  siteId: string
  description: string
  contractedCents: number
  status: WorkOrderStatus
  createdAt: string
  valueHistory?: { at: string; fromCents: number; toCents: number }[]
  demo: false
}

export interface ScheduleEvent {
  id: string
  workOrderId: string
  quoteId: string
  clientId: string
  siteId: string
  date: string
  time: string
  service: string
  volumeM3: number
  fck: number | null
  pump: boolean
  truck: string
  status: ScheduleStatus
  notes: string
  demo: false
}

export type ProfessionalRateUnit = 'serviço' | 'hora' | 'diária' | 'm²' | 'm³'

export interface Professional {
  id: string
  name: string
  document: string
  phone: string
  serviceType: string
  rateCents: number | null
  rateUnit: ProfessionalRateUnit
  paymentMethod: string
  active: boolean
  notes: string
  createdAt: string
  demo: false
}

export type ExpenseCategory =
  | 'Mão de obra'
  | 'Material'
  | 'Equipamento'
  | 'Frete'
  | 'Bombeamento'
  | 'Combustível'
  | 'Terceirizado'
  | 'Outros'

export interface JobExpense {
  id: string
  workOrderId: string
  professionalId: string | null
  category: ExpenseCategory
  description: string
  amountCents: number
  unitRateCents?: number | null
  quantity?: number | null
  rateUnit?: ProfessionalRateUnit | null
  incurredAt: string
  createdAt: string
  demo: false
}

export interface FinancialPayment {
  id: string
  paidAt: string
  amountCents: number
  method: string
  note: string
}

export type FinancialKind = 'receber' | 'pagar'
export type FinancialStatus = 'Em aberto' | 'Parcial' | 'Pago' | 'Vencido' | 'Cancelado'

export interface FinancialEntry {
  id: string
  kind: FinancialKind
  workOrderId: string | null
  quoteId: string | null
  clientId: string | null
  professionalId: string | null
  description: string
  amountCents: number
  issuedAt: string
  dueDate: string
  method: string
  status: FinancialStatus
  payments: FinancialPayment[]
  createdAt: string
  demo: false
}

export interface OperationalData {
  quotes: QuoteRecord[]
  workOrders: WorkOrder[]
  schedule: ScheduleEvent[]
  professionals: Professional[]
  expenses: JobExpense[]
  financial: FinancialEntry[]
}

export const emptyOperationalData = (): OperationalData => ({
  quotes: [],
  workOrders: [],
  schedule: [],
  professionals: [],
  expenses: [],
  financial: [],
})

export function openAmountCents(entry: FinancialEntry): number {
  const paid = entry.payments.reduce((sum, payment) => sum + payment.amountCents, 0)
  return Math.max(0, entry.amountCents - paid)
}

export function financialStatus(
  amountCents: number,
  paidCents: number,
  dueDate: string,
  today: string,
  cancelled = false,
): FinancialStatus {
  if (cancelled) return 'Cancelado'
  if (paidCents >= amountCents) return 'Pago'
  if (dueDate < today) return 'Vencido'
  if (paidCents > 0) return 'Parcial'
  return 'Em aberto'
}

export function refreshFinancialStatus(entry: FinancialEntry, today: string): FinancialEntry {
  return {
    ...entry,
    status: financialStatus(
      entry.amountCents,
      entry.payments.reduce((sum, payment) => sum + payment.amountCents, 0),
      entry.dueDate,
      today,
      entry.status === 'Cancelado',
    ),
  }
}

export function jobCostCents(workOrderId: string, expenses: JobExpense[]): number {
  return expenses
    .filter((expense) => expense.workOrderId === workOrderId)
    .reduce((sum, expense) => sum + expense.amountCents, 0)
}

export function jobBalanceCents(
  order: WorkOrder,
  expenses: JobExpense[],
): number {
  return order.contractedCents - jobCostCents(order.id, expenses)
}

export interface WorkOrderAmountRevision {
  order: WorkOrder
  receivable: FinancialEntry | null
}

export function reviseWorkOrderAmount(
  order: WorkOrder,
  amountCents: number,
  receivable: FinancialEntry | undefined,
  at: string,
): WorkOrderAmountRevision {
  if (!validateMoneyCents(amountCents)) throw new Error('O valor contratado precisa ser maior que zero.')
  if (order.status === 'Cancelada') throw new Error('Pedido cancelado não pode ter o valor alterado.')
  if (receivable?.status === 'Cancelado') throw new Error('A conta a receber deste pedido está cancelada.')
  const paidCents = receivable?.payments.reduce((sum, payment) => sum + payment.amountCents, 0) ?? 0
  if (amountCents < paidCents) throw new Error('O novo valor não pode ficar abaixo do total já recebido.')

  const revisedOrder: WorkOrder = amountCents === order.contractedCents
    ? order
    : {
        ...order,
        contractedCents: amountCents,
        valueHistory: [
          ...(order.valueHistory ?? []),
          { at, fromCents: order.contractedCents, toCents: amountCents },
        ],
      }

  const revisedReceivable = receivable
    ? {
        ...receivable,
        amountCents,
        status: financialStatus(amountCents, paidCents, receivable.dueDate, at.slice(0, 10)),
      }
    : null

  return { order: revisedOrder, receivable: revisedReceivable }
}

export function validateMoneyCents(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

export function canDeleteDraftQuote(
  status: string,
  hasWorkOrder: boolean,
  hasFinancialEntries: boolean,
  hasScheduleEvents: boolean,
): boolean {
  return status === 'Rascunho' && !hasWorkOrder && !hasFinancialEntries && !hasScheduleEvents
}

export function validateProfessionalProfile(name: string, rateCents: number | null): boolean {
  return name.trim().length >= 3 && (rateCents === null || validateMoneyCents(rateCents))
}

export function calculateUnitCostCents(unitRateCents: number, quantity: number): number | null {
  if (!validateMoneyCents(unitRateCents) || !Number.isFinite(quantity) || quantity <= 0) return null
  const total = Math.round(unitRateCents * quantity)
  return validateMoneyCents(total) ? total : null
}

export function validateDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function validateTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export type CommercialTaskStatus = 'Pendente' | 'Concluída' | 'Cancelada'
export type CommercialTaskPriority = 'Baixa' | 'Normal' | 'Alta'

export interface CommercialTask {
  id: string
  opportunityId: string | null
  title: string
  notes: string
  dueDate: string
  dueTime: string | null
  priority: CommercialTaskPriority
  status: CommercialTaskStatus
  createdAt: string
  completedAt: string | null
  demo: false
}

export function validateCommercialTask(task: CommercialTask): boolean {
  const validPriority = ['Baixa', 'Normal', 'Alta'].includes(task.priority)
  const validStatus = ['Pendente', 'Concluída', 'Cancelada'].includes(task.status)
  const validCreatedAt = Number.isFinite(Date.parse(task.createdAt))
  const validCompletedAt = task.completedAt === null || Number.isFinite(Date.parse(task.completedAt))

  return Boolean(
    task.id.trim() &&
    task.title.trim().length >= 3 &&
    task.title.trim().length <= 120 &&
    task.notes.length <= 2000 &&
    (!task.dueDate || validateDate(task.dueDate)) &&
    (task.dueTime === null || validateTime(task.dueTime)) &&
    validPriority &&
    validStatus &&
    validCreatedAt &&
    validCompletedAt &&
    (task.status !== 'Concluída' || task.completedAt !== null),
  )
}

export function commercialTaskTiming(
  task: CommercialTask,
  today: string,
): 'Atrasada' | 'Hoje' | 'Futura' | 'Sem prazo' | 'Concluída' | 'Cancelada' {
  if (task.status === 'Concluída') return 'Concluída'
  if (task.status === 'Cancelada') return 'Cancelada'
  if (!task.dueDate) return 'Sem prazo'
  if (task.dueDate < today) return 'Atrasada'
  if (task.dueDate === today) return 'Hoje'
  return 'Futura'
}

export function orderFromAcceptedQuote(
  quote: QuoteRecord,
  totalCents: number,
  opportunityId: string | null,
  createdAt: string,
  id: string,
  number: string,
): WorkOrder {
  if (quote.demo) throw new Error('Orçamentos de demonstração não podem gerar pedidos reais.')
  if (quote.status !== 'Aceito') throw new Error('Somente orçamentos aceitos podem gerar pedidos.')
  if (!quote.clientId || !quote.siteId) throw new Error('O orçamento precisa ter cliente e obra vinculados.')
  if (!validateMoneyCents(totalCents)) throw new Error('O total do orçamento não é válido para contratação.')

  return {
    id,
    number,
    quoteId: quote.id,
    opportunityId,
    clientId: quote.clientId,
    siteId: quote.siteId,
    description: `Pedido originado do orçamento ${quote.number}`,
    contractedCents: totalCents,
    status: 'Aguardando programação',
    createdAt,
    demo: false,
  }
}
