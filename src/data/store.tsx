import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Client, Opportunity, QuoteRecord, Site } from './fixtures'
import {
  evaluateAll,
  evaluateRecord,
  quoteContext,
  type EvaluatedQuote,
  type ReceivableRow,
} from './derived'
import {
  calculateUnitCostCents,
  emptyOperationalData,
  reviseWorkOrderAmount,
  financialStatus,
  jobBalanceCents,
  openAmountCents,
  orderFromAcceptedQuote,
  validateDate,
  validateMoneyCents,
  validateTime,
  validateCommercialTask,
  type CommercialTask,
  type FinancialEntry,
  type FinancialPayment,
  type JobExpense,
  type OperationalData,
  type Professional,
  type ScheduleEvent,
  type WorkOrder,
} from './operations'
import type { QuoteContext } from '../lib/quote'
import type { QuoteStatus, StageId } from './settings'
import { localUserId } from './session'

const STORAGE_KEY = 'qmx-operational-workspace-v1'

type Workspace = OperationalData & {
  clients: Client[]
  sites: Site[]
  opportunities: Opportunity[]
  tasks: CommercialTask[]
}

function emptyWorkspace(): Workspace {
  return {
    ...emptyOperationalData(),
    clients: [],
    sites: [],
    opportunities: [],
    tasks: [],
  }
}

function readWorkspace(): Workspace {
  if (typeof window === 'undefined') return emptyWorkspace()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyWorkspace()
    const parsed = JSON.parse(raw) as Partial<Workspace>
    return {
      ...emptyWorkspace(),
      ...parsed,
      quotes: Array.isArray(parsed.quotes)
        ? parsed.quotes.filter((item) => !item.demo).map((quote) => ({ ...quote, ownerId: localUserId }))
        : [],
      workOrders: Array.isArray(parsed.workOrders) ? parsed.workOrders : [],
      schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [],
      professionals: Array.isArray(parsed.professionals) ? parsed.professionals : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      financial: Array.isArray(parsed.financial) ? parsed.financial : [],
      clients: Array.isArray(parsed.clients)
        ? parsed.clients.filter((item) => !item.demo).map((client) => ({ ...client, ownerId: localUserId }))
        : [],
      sites: Array.isArray(parsed.sites) ? parsed.sites.filter((item) => !item.demo) : [],
      opportunities: Array.isArray(parsed.opportunities)
        ? parsed.opportunities.filter((item) => !item.demo).map((opportunity) => ({
            ...opportunity,
            ownerId: localUserId,
            history: opportunity.history.map((event) => ({ ...event, by: localUserId })),
          }))
        : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter((task) => !task.demo) : [],
    }
  } catch {
    return emptyWorkspace()
  }
}

export interface Toast {
  id: number
  tone: 'ok' | 'erro' | 'info'
  title: string
  body?: string
}

interface Store {
  demoMode: boolean
  ctx: QuoteContext
  clients: Client[]
  sites: Site[]
  quotes: EvaluatedQuote[]
  opportunities: Opportunity[]
  receivables: ReceivableRow[]
  workOrders: WorkOrder[]
  scheduleEvents: ScheduleEvent[]
  professionals: Professional[]
  expenses: JobExpense[]
  financialEntries: FinancialEntry[]
  tasks: CommercialTask[]
  storageMode: 'browser-local'
  workspaceReady: boolean
  addClient: (c: Client, site?: Site) => void
  addOpportunity: (opportunity: Opportunity) => void
  updateOpportunity: (id: string, patch: Partial<Opportunity>, historyText?: string) => void
  addQuote: (quote: QuoteRecord) => void
  updateQuote: (quote: QuoteRecord) => void
  updateQuoteStatus: (id: string, status: QuoteStatus) => void
  createWorkOrderFromQuote: (quoteId: string, dueDate: string, method: string) => WorkOrder
  updateWorkOrderAmount: (workOrderId: string, amountCents: number) => void
  addScheduleEvent: (event: ScheduleEvent) => void
  saveProfessional: (professional: Professional) => void
  addExpense: (expense: JobExpense, dueDate: string, method: string) => void
  registerPayment: (entryId: string, payment: FinancialPayment) => void
  cancelFinancialEntry: (entryId: string) => void
  saveTask: (task: CommercialTask) => void
  jobBalance: (workOrderId: string) => number | null
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const demoMode = false
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    setWorkspace(readWorkspace())
    setWorkspaceLoaded(true)
  }, [])

  useEffect(() => {
    if (!workspaceLoaded) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
    } catch {
      // Quota/private-mode failures should not crash the CRM interface.
    }
  }, [workspace, workspaceLoaded])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((xs) => [...xs, { ...t, id }])
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 5000)
  }, [])
  const dismissToast = useCallback(
    (id: number) => setToasts((xs) => xs.filter((x) => x.id !== id)),
    [],
  )

  const visible = useMemo(() => {
    const keep = <T extends { demo: boolean }>(xs: T[]) => xs.filter((item) => !item.demo)
    const ctx = quoteContext(false)
    const quoteRecords = keep(workspace.quotes)
    const quotes = evaluateAll(quoteRecords, ctx)
    const clients = keep(workspace.clients)
    const sites = keep(workspace.sites)
    const opportunities = keep(workspace.opportunities)
    const financialReceivables = workspace.financial
      .filter((entry) => entry.kind === 'receber' && !entry.demo)
      .map((entry) => {
        const paidCents = entry.payments.reduce((sum, payment) => sum + payment.amountCents, 0)
        const status = financialStatus(entry.amountCents, paidCents, entry.dueDate, new Date().toISOString().slice(0, 10), entry.status === 'Cancelado')
        return {
          id: entry.id,
          quoteId: entry.quoteId ?? '',
          clientId: entry.clientId ?? '',
          description: entry.description,
          originalCents: entry.amountCents,
          paidCents,
          openCents: openAmountCents(entry),
          issuedAt: entry.issuedAt,
          dueDate: entry.dueDate,
          method: entry.method,
          payments: entry.payments.map((payment) => ({ paidAt: payment.paidAt, amountCents: payment.amountCents })),
          status: status === 'Parcial' ? 'Parcialmente pago' : status === 'Em aberto' ? 'A receber' : status,
        } as ReceivableRow
      })
    return {
      ctx,
      clients,
      sites,
      quotes,
      opportunities,
      workOrders: keep(workspace.workOrders),
      scheduleEvents: keep(workspace.schedule),
      professionals: keep(workspace.professionals),
      expenses: keep(workspace.expenses),
      financialEntries: keep(workspace.financial),
      tasks: keep(workspace.tasks),
      receivables: financialReceivables,
    }
  }, [workspace])

  const value = useMemo<Store>(() => ({
    demoMode,
    ctx: visible.ctx,
    clients: visible.clients,
    sites: visible.sites,
    quotes: visible.quotes,
    opportunities: visible.opportunities,
    receivables: visible.receivables,
    workOrders: visible.workOrders,
    scheduleEvents: visible.scheduleEvents,
    professionals: visible.professionals,
    expenses: visible.expenses,
    financialEntries: visible.financialEntries,
    tasks: visible.tasks,
    storageMode: 'browser-local',
    workspaceReady: workspaceLoaded,
    addClient: (client, site) => setWorkspace((current) => ({
      ...current,
      clients: [client, ...current.clients.filter((item) => item.id !== client.id)],
      sites: site ? [site, ...current.sites.filter((item) => item.id !== site.id)] : current.sites,
    })),
    addOpportunity: (opportunity) => {
      if (opportunity.demo) throw new Error('Novas oportunidades devem ser registradas como dados reais.')
      if (opportunity.title.trim().length < 3) throw new Error('Informe o nome da oportunidade.')
      if (!workspace.clients.some((client) => client.id === opportunity.clientId && !client.demo)) throw new Error('Selecione um cliente real cadastrado.')
      if (opportunity.siteId && !workspace.sites.some((site) => site.id === opportunity.siteId && site.clientId === opportunity.clientId && !site.demo)) throw new Error('A obra selecionada não pertence ao cliente.')
      if (workspace.opportunities.some((item) => item.id === opportunity.id)) throw new Error('Esta oportunidade já existe.')
      setWorkspace((current) => ({ ...current, opportunities: [opportunity, ...current.opportunities] }))
    },
    updateOpportunity: (id, patch, historyText) => setWorkspace((current) => ({
      ...current,
      opportunities: current.opportunities.map((opportunity) => opportunity.id === id
        ? {
            ...opportunity,
            ...patch,
            history: historyText
              ? [{ at: new Date().toISOString(), by: localUserId, text: historyText }, ...opportunity.history]
              : opportunity.history,
          }
        : opportunity),
    })),
    addQuote: (quote) => {
      if (quote.demo) throw new Error('Orçamentos reais não podem ser salvos como demonstração.')
      if (!quote.clientId || !quote.siteId) throw new Error('Selecione cliente e obra antes de salvar.')
      if (!workspace.clients.some((client) => client.id === quote.clientId && !client.demo)) throw new Error('O orçamento precisa usar um cliente real cadastrado.')
      if (!workspace.sites.some((site) => site.id === quote.siteId && site.clientId === quote.clientId && !site.demo)) throw new Error('A obra selecionada não pertence ao cliente.')
      if (workspace.quotes.some((item) => item.id === quote.id)) throw new Error('Este orçamento já foi registrado.')
      if (quote.opportunityId && !workspace.opportunities.some((item) => item.id === quote.opportunityId && !item.demo)) throw new Error('A oportunidade vinculada não foi encontrada.')
      setWorkspace((current) => {
        const exists = current.quotes.some((item) => item.id === quote.id)
        if (exists) throw new Error('Este orçamento já foi registrado.')
        const opportunities = quote.opportunityId
          ? current.opportunities.map((item) => item.id === quote.opportunityId
            ? { ...item, quoteId: quote.id, stage: 'elaboracao' as StageId, history: [{ at: new Date().toISOString(), by: quote.ownerId, text: `Orçamento ${quote.number} salvo como rascunho` }, ...item.history] }
            : item)
          : current.opportunities
        return { ...current, quotes: [quote, ...current.quotes], opportunities }
      })
    },
    updateQuote: (quote) => {
      if (quote.demo) throw new Error('Orçamentos reais não podem ser atualizados como demonstração.')
      const existing = workspace.quotes.find((item) => item.id === quote.id)
      if (!existing) throw new Error('O rascunho não foi encontrado neste navegador.')
      if (existing.status !== 'Rascunho') throw new Error('Somente orçamentos em rascunho podem ser editados.')
      if (!workspace.clients.some((client) => client.id === quote.clientId && !client.demo)) throw new Error('O orçamento precisa usar um cliente real cadastrado.')
      if (!workspace.sites.some((site) => site.id === quote.siteId && site.clientId === quote.clientId && !site.demo)) throw new Error('A obra selecionada não pertence ao cliente.')
      if (quote.opportunityId && !workspace.opportunities.some((item) => item.id === quote.opportunityId && !item.demo)) throw new Error('A oportunidade vinculada não foi encontrada.')
      setWorkspace((current) => ({
        ...current,
        quotes: current.quotes.map((item) => item.id === quote.id ? quote : item),
        opportunities: quote.opportunityId
          ? current.opportunities.map((item) => item.id === quote.opportunityId
            ? { ...item, quoteId: quote.id, history: [{ at: new Date().toISOString(), by: quote.ownerId, text: `Rascunho ${quote.number} atualizado` }, ...item.history] }
            : item)
          : current.opportunities,
      }))
    },
    updateQuoteStatus: (id, status) => {
      if (workspace.workOrders.some((order) => order.quoteId === id) && status !== 'Aceito') {
        throw new Error('Este orçamento já gerou um pedido. Cancele ou regularize o pedido antes de alterar o status comercial.')
      }
      setWorkspace((current) => {
        const quote = current.quotes.find((item) => item.id === id)
        const opportunity = quote?.opportunityId
          ? current.opportunities.find((item) => item.id === quote.opportunityId)
          : undefined
        const nextStage: StageId | null = status === 'Enviado ao cliente'
          ? 'enviado'
          : status === 'Em negociação'
            ? 'negociacao'
            : status === 'Aceito'
              ? 'fechado'
              : null
        return {
          ...current,
          quotes: current.quotes.map((item) => item.id === id ? { ...item, status } : item),
          opportunities: opportunity && nextStage
            ? current.opportunities.map((item) => item.id === opportunity.id
              ? { ...item, stage: nextStage, history: [{ at: new Date().toISOString(), by: item.ownerId, text: `Status do orçamento atualizado: ${status}` }, ...item.history] }
              : item)
            : current.opportunities,
        }
      })
    },
    createWorkOrderFromQuote: (quoteId, dueDate, method) => {
      if (!validateDate(dueDate)) throw new Error('Informe um vencimento válido para a primeira cobrança.')
      if (!method.trim()) throw new Error('Selecione a forma de pagamento.')
      const quote = workspace.quotes.find((item) => item.id === quoteId)
      if (!quote) throw new Error('Orçamento não encontrado.')
      if (quote.demo) throw new Error('Desative o modo de demonstração e selecione um orçamento real.')
      if (workspace.workOrders.some((order) => order.quoteId === quoteId)) throw new Error('Este orçamento já foi convertido em pedido.')
      const ctx = quoteContext(false)
      const result = evaluateRecord(quote, ctx)
      if (result.totalCents === null) throw new Error('O orçamento ainda possui valores pendentes.')
      const opportunity = workspace.opportunities.find((item) => item.quoteId === quoteId)
      const order = orderFromAcceptedQuote(quote, result.totalCents, opportunity?.id ?? null, new Date().toISOString(), `ped-${crypto.randomUUID()}`, `PED-${new Date().getFullYear()}-${String(workspace.workOrders.length + 1).padStart(4, '0')}`)
      const entry: FinancialEntry = {
        id: `fin-${crypto.randomUUID()}`,
        kind: 'receber',
        workOrderId: order.id,
        quoteId: quote.id,
        clientId: quote.clientId,
        professionalId: null,
        description: `Cobrança inicial ${order.number}`,
        amountCents: result.totalCents,
        issuedAt: new Date().toISOString().slice(0, 10),
        dueDate,
        method,
        status: 'Em aberto',
        payments: [],
        createdAt: new Date().toISOString(),
        demo: false,
      }
      setWorkspace((current) => ({
        ...current,
        workOrders: [order, ...current.workOrders],
        financial: [entry, ...current.financial],
        opportunities: opportunity
          ? current.opportunities.map((item) => item.id === opportunity.id
            ? { ...item, stage: 'fechado', history: [{ at: new Date().toISOString(), by: item.ownerId, text: `Pedido ${order.number} criado a partir do orçamento aceito` }, ...item.history] }
            : item)
          : current.opportunities,
      }))
      return order
    },
    updateWorkOrderAmount: (workOrderId, amountCents) => {
      const order = workspace.workOrders.find((item) => item.id === workOrderId)
      if (!order) throw new Error('Pedido não encontrado.')
      const receivables = workspace.financial.filter((entry) => entry.kind === 'receber' && entry.workOrderId === workOrderId)
      if (receivables.length > 1) throw new Error('Este pedido possui mais de uma conta a receber. Ajuste as parcelas antes de alterar o valor contratado.')
      const now = new Date().toISOString()
      const revision = reviseWorkOrderAmount(order, amountCents, receivables[0], now)
      if (revision.order === order) return
      setWorkspace((current) => ({
        ...current,
        workOrders: current.workOrders.map((item) => item.id === workOrderId ? revision.order : item),
        financial: revision.receivable
          ? current.financial.map((entry) => entry.id === revision.receivable?.id ? revision.receivable! : entry)
          : current.financial,
      }))
    },
    addScheduleEvent: (event) => {
      if (!validateDate(event.date) || !validateTime(event.time)) throw new Error('Informe data e horário válidos.')
      const linkedOrder = workspace.workOrders.find((order) => order.id === event.workOrderId)
      if (!linkedOrder) throw new Error('Selecione um pedido válido.')
      if (event.quoteId !== linkedOrder.quoteId || event.clientId !== linkedOrder.clientId || event.siteId !== linkedOrder.siteId) throw new Error('O cliente, a obra e o orçamento da agenda precisam corresponder ao pedido.')
      if (event.volumeM3 < 0 || !Number.isFinite(event.volumeM3)) throw new Error('O volume informado não é válido.')
      if (event.truck && workspace.schedule.some((item) => item.id !== event.id && item.date === event.date && item.time === event.time && item.truck === event.truck && !['Cancelada', 'Concluída'].includes(item.status))) {
        throw new Error('Já existe uma programação para este caminhão neste horário.')
      }
      setWorkspace((current) => {
        const schedule = [event, ...current.schedule.filter((item) => item.id !== event.id)]
        const linkedEvents = schedule.filter((item) => item.workOrderId === event.workOrderId)
        const nextOrderStatus = linkedEvents.some((item) => item.status === 'Em execução')
          ? 'Em execução'
          : linkedEvents.some((item) => item.status === 'Planejada' || item.status === 'Confirmada' || item.status === 'Em preparação' || item.status === 'Reagendada')
            ? 'Programada'
            : linkedEvents.some((item) => item.status === 'Concluída')
              ? 'Concluída'
              : 'Aguardando programação'
        return {
          ...current,
          schedule,
          workOrders: current.workOrders.map((order) => order.id === event.workOrderId ? { ...order, status: nextOrderStatus } : order),
        }
      })
    },
    saveProfessional: (professional) => {
      if (professional.name.trim().length < 3) throw new Error('Informe o nome completo do profissional.')
      if (!professional.serviceType.trim()) throw new Error('Informe o serviço executado.')
      if (!validateMoneyCents(professional.rateCents)) throw new Error('O custo padrão deve ser maior que zero.')
      const documentDigits = professional.document.replace(/\D/g, '')
      if (documentDigits && workspace.professionals.some((item) => item.id !== professional.id && item.document.replace(/\D/g, '') === documentDigits)) throw new Error('Já existe um profissional com este documento.')
      setWorkspace((current) => ({
        ...current,
        professionals: [professional, ...current.professionals.filter((item) => item.id !== professional.id)],
      }))
    },
    addExpense: (expense, dueDate, method) => {
      if (!workspace.workOrders.some((order) => order.id === expense.workOrderId)) throw new Error('Selecione uma obra/pedido válido.')
      if (expense.professionalId && !workspace.professionals.some((professional) => professional.id === expense.professionalId && professional.active)) throw new Error('O profissional vinculado não está cadastrado ou ativo.')
      if (expense.professionalId && expense.category !== 'Mão de obra') throw new Error('Despesas vinculadas a profissionais devem usar a categoria Mão de obra.')
      if (expense.professionalId && (
        !expense.rateUnit ||
        calculateUnitCostCents(expense.unitRateCents ?? 0, expense.quantity ?? 0) === null
      )) throw new Error('A mão de obra precisa ter tarifa unitária, quantidade e unidade registrados.')
      if (expense.professionalId && calculateUnitCostCents(expense.unitRateCents ?? 0, expense.quantity ?? 0) !== expense.amountCents) throw new Error('O total da mão de obra não corresponde à tarifa multiplicada pela quantidade.')
      if (!expense.description.trim()) throw new Error('Informe a descrição da despesa.')
      if (!validateMoneyCents(expense.amountCents)) throw new Error('O valor da despesa deve ser maior que zero.')
      if (!validateDate(expense.incurredAt) || !validateDate(dueDate)) throw new Error('Informe datas válidas para a despesa e vencimento.')
      if (!method.trim()) throw new Error('Informe a forma de pagamento.')
      const payable: FinancialEntry = {
        id: `fin-${crypto.randomUUID()}`,
        kind: 'pagar',
        workOrderId: expense.workOrderId,
        quoteId: workspace.workOrders.find((order) => order.id === expense.workOrderId)?.quoteId ?? null,
        clientId: null,
        professionalId: expense.professionalId,
        description: expense.description,
        amountCents: expense.amountCents,
        issuedAt: expense.incurredAt,
        dueDate,
        method,
        status: 'Em aberto',
        payments: [],
        createdAt: new Date().toISOString(),
        demo: false,
      }
      setWorkspace((current) => ({
        ...current,
        expenses: [expense, ...current.expenses],
        financial: [payable, ...current.financial],
      }))
    },
    registerPayment: (entryId, payment) => {
      if (!validateMoneyCents(payment.amountCents) || !validateDate(payment.paidAt) || !payment.method.trim()) throw new Error('Confira valor, data e forma de pagamento.')
      const entry = workspace.financial.find((item) => item.id === entryId)
      if (!entry || entry.status === 'Cancelado') throw new Error('Conta não encontrada ou cancelada.')
      if (payment.amountCents > openAmountCents(entry)) throw new Error('A baixa não pode ser maior que o saldo em aberto.')
      setWorkspace((current) => ({
        ...current,
        financial: current.financial.map((item) => item.id === entryId
          ? { ...item, payments: [...item.payments, payment], status: financialStatus(item.amountCents, item.payments.reduce((sum, p) => sum + p.amountCents, 0) + payment.amountCents, item.dueDate, new Date().toISOString().slice(0, 10)) }
          : item),
      }))
    },
    cancelFinancialEntry: (entryId) => setWorkspace((current) => ({
      ...current,
      financial: current.financial.map((item) => item.id === entryId ? { ...item, status: 'Cancelado' } : item),
    })),
    saveTask: (task) => {
      if (task.demo) throw new Error('Tarefas reais não podem ser registradas como demonstração.')
      if (!validateCommercialTask(task)) throw new Error('Confira título, prazo, horário e prioridade da tarefa.')
      if (task.opportunityId && !workspace.opportunities.some((item) => item.id === task.opportunityId && !item.demo)) {
        throw new Error('A oportunidade vinculada não foi encontrada.')
      }
      const existingTask = workspace.tasks.find((item) => item.id === task.id)
      const now = new Date().toISOString()
      const savedTask: CommercialTask = {
        ...task,
        title: task.title.trim(),
        notes: task.notes.trim(),
        completedAt: task.status === 'Concluída' ? task.completedAt ?? now : null,
      }
      setWorkspace((current) => ({
        ...current,
        tasks: [savedTask, ...current.tasks.filter((item) => item.id !== savedTask.id)],
        opportunities: current.opportunities.map((opportunity) => {
          const shouldClearPrevious =
            existingTask?.opportunityId === opportunity.id &&
            (savedTask.opportunityId !== opportunity.id || savedTask.status !== 'Pendente') &&
            opportunity.nextContact === existingTask.dueDate &&
            opportunity.nextAction === existingTask.title
          if (shouldClearPrevious) {
            return {
              ...opportunity,
              nextContact: null,
              nextAction: 'Definir próximo passo',
              history: [{ at: now, by: localUserId, text: `Tarefa encerrada: ${existingTask.title}` }, ...opportunity.history],
            }
          }
          if (savedTask.opportunityId === opportunity.id && savedTask.status === 'Pendente') {
            return {
              ...opportunity,
              nextContact: savedTask.dueDate,
              nextAction: savedTask.title,
              history: [{
                at: now,
                by: localUserId,
                text: `Tarefa agendada: ${savedTask.title} · ${savedTask.dueDate}${savedTask.dueTime ? ` às ${savedTask.dueTime}` : ''}`,
              }, ...opportunity.history],
            }
          }
          return opportunity
        }),
      }))
    },
    jobBalance: (workOrderId) => {
      const order = workspace.workOrders.find((item) => item.id === workOrderId)
      return order ? jobBalanceCents(order, workspace.expenses) : null
    },
    toasts,
    toast,
    dismissToast,
  }), [visible, workspace, workspaceLoaded, toasts, toast, dismissToast])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const store = useContext(StoreCtx)
  if (!store) throw new Error('useStore fora do StoreProvider')
  return store
}
