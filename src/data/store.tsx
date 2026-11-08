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
  canDeleteDraftQuote,
  emptyOperationalData,
  reviseWorkOrderAmount,
  financialStatus,
  jobBalanceCents,
  openAmountCents,
  orderFromAcceptedQuote,
  validateDate,
  validateMoneyCents,
  validateProfessionalProfile,
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
import { createDefaultSettings, normalizeSettings, validateSettings, type AppSettings, type QuoteStatus, type StageId } from './settings'
import { localUserId } from './session'

const STORAGE_KEY = 'qmx-operational-workspace-v1'
const SETTINGS_STORAGE_KEY = 'qmx-app-settings-v1'

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

function readSettings(): AppSettings {
  if (typeof window === 'undefined') return createDefaultSettings()
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    return raw ? normalizeSettings(JSON.parse(raw)) : createDefaultSettings()
  } catch {
    return createDefaultSettings()
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
  settings: AppSettings
  settingsReady: boolean
  saveSettings: (settings: AppSettings) => void
  addClient: (c: Client, site?: Site) => void
  updateClient: (client: Client) => void
  registerClientWithLead: (c: Client, site: Site | undefined, opportunity: Opportunity) => void
  addOpportunity: (opportunity: Opportunity) => void
  updateOpportunity: (id: string, patch: Partial<Opportunity>, historyText?: string) => void
  addQuote: (quote: QuoteRecord) => void
  updateQuote: (quote: QuoteRecord) => void
  removeDraftQuote: (quoteId: string) => void
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
  const [settings, setSettings] = useState<AppSettings>(() => createDefaultSettings())
  const [settingsReady, setSettingsReady] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    setWorkspace(readWorkspace())
    setWorkspaceLoaded(true)
    setSettings(readSettings())
    setSettingsReady(true)
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
    const ctx = quoteContext(false, settings)
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
  }, [workspace, settings])

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
    settings,
    settingsReady,
    saveSettings: (nextSettings) => {
      const validated = validateSettings(nextSettings)
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(validated))
      } catch {
        throw new Error('Não foi possível salvar as configurações neste navegador. Verifique o espaço disponível.')
      }
      setSettings(validated)
    },
    addClient: (client, site) => setWorkspace((current) => ({
      ...current,
      clients: [client, ...current.clients.filter((item) => item.id !== client.id)],
      sites: site ? [site, ...current.sites.filter((item) => item.id !== site.id)] : current.sites,
    })),
    updateClient: (client) => {
      if (client.demo) throw new Error('Cadastros de demonstração não podem ser alterados.')
      if (!workspace.clients.some((item) => item.id === client.id && !item.demo)) throw new Error('Cliente não encontrado neste navegador.')
      const documentDigits = client.document.replace(/\D/g, '')
      if (documentDigits && workspace.clients.some((item) => item.id !== client.id && !item.demo && item.document.replace(/\D/g, '') === documentDigits)) {
        throw new Error('Já existe outro cliente com este CPF/CNPJ.')
      }
      setWorkspace((current) => ({
        ...current,
        clients: current.clients.map((item) => item.id === client.id ? { ...client, document: documentDigits } : item),
      }))
    },
    registerClientWithLead: (client, site, opportunity) => {
      if (opportunity.demo || opportunity.stage !== 'novo' || opportunity.clientId !== client.id) {
        throw new Error('O lead automático precisa pertencer ao novo cliente e iniciar em Novo lead.')
      }
      setWorkspace((current) => {
        if (current.clients.some((item) => item.id === client.id)) return current
        const alreadyHasLead = current.opportunities.some((item) => !item.demo && item.clientId === client.id)
        return {
          ...current,
          clients: [client, ...current.clients],
          sites: site ? [site, ...current.sites] : current.sites,
          opportunities: alreadyHasLead ? current.opportunities : [opportunity, ...current.opportunities],
        }
      })
    },
    addOpportunity: (opportunity) => {
      if (opportunity.demo) throw new Error('Novas oportunidades devem ser registradas como dados reais.')
      if (opportunity.title.trim().length < 3) throw new Error('Informe o nome da oportunidade.')
      if (!workspace.clients.some((client) => client.id === opportunity.clientId && !client.demo)) throw new Error('Selecione um cliente real cadastrado.')
      if (opportunity.siteId && !workspace.sites.some((site) => site.id === opportunity.siteId && site.clientId === opportunity.clientId && !site.demo)) throw new Error('A obra selecionada não pertence ao cliente.')
      if (workspace.opportunities.some((item) => item.id === opportunity.id)) throw new Error('Esta oportunidade já existe.')
      setWorkspace((current) => ({ ...current, opportunities: [opportunity, ...current.opportunities] }))
    },
    updateOpportunity: (id, patch, historyText) => {
      const existing = workspace.opportunities.find((item) => item.id === id && !item.demo)
      if (!existing) throw new Error('Oportunidade não encontrada.')
      const nextClientId = patch.clientId ?? existing.clientId
      const nextSiteId = patch.siteId === undefined ? existing.siteId : patch.siteId
      const identityChanged = nextClientId !== existing.clientId || nextSiteId !== existing.siteId
      if (identityChanged) {
        if (!workspace.clients.some((client) => client.id === nextClientId && !client.demo)) throw new Error('Selecione um cliente cadastrado.')
        if (nextSiteId && !workspace.sites.some((site) => site.id === nextSiteId && site.clientId === nextClientId && !site.demo)) throw new Error('A obra selecionada não pertence ao cliente.')
        const linkedQuotes = workspace.quotes.filter((quote) => quote.opportunityId === id || quote.id === existing.quoteId)
        const linkedOrders = workspace.workOrders.filter((order) => order.opportunityId === id || linkedQuotes.some((quote) => quote.id === order.quoteId))
        if (linkedQuotes.some((quote) => quote.clientId !== nextClientId || quote.siteId !== nextSiteId)) {
          throw new Error('Não é possível trocar cliente ou obra de uma oportunidade que já possui orçamento vinculado. Crie outra oportunidade para o novo vínculo.')
        }
        if (linkedOrders.some((order) => order.clientId !== nextClientId || order.siteId !== nextSiteId)) {
          throw new Error('Não é possível trocar cliente ou obra de uma oportunidade que já gerou pedido.')
        }
      }
      setWorkspace((current) => ({
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
      }))
    },
    addQuote: (quote) => {
      if (quote.demo) throw new Error('Orçamentos reais não podem ser salvos como demonstração.')
      if (quote.validUntil && !validateDate(quote.validUntil)) throw new Error('A validade do rascunho precisa ser uma data válida.')
      if (!quote.clientId || !quote.siteId) throw new Error('Selecione cliente e obra antes de salvar.')
      if (!workspace.clients.some((client) => client.id === quote.clientId && !client.demo && client.active)) throw new Error('O orçamento precisa usar um cliente ativo cadastrado.')
      if (!workspace.sites.some((site) => site.id === quote.siteId && site.clientId === quote.clientId && !site.demo)) throw new Error('A obra selecionada não pertence ao cliente.')
      if (workspace.quotes.some((item) => item.id === quote.id)) throw new Error('Este orçamento já foi registrado.')
      if (quote.opportunityId) {
        const linkedOpportunity = workspace.opportunities.find((item) => item.id === quote.opportunityId && !item.demo)
        if (!linkedOpportunity) throw new Error('A oportunidade vinculada não foi encontrada.')
        if (linkedOpportunity.clientId !== quote.clientId) throw new Error('A oportunidade e o orçamento precisam pertencer ao mesmo cliente. Desvincule o lead antes de trocar o cliente.')
        if (linkedOpportunity.quoteId && linkedOpportunity.quoteId !== quote.id) throw new Error('Esta oportunidade já possui outro orçamento vinculado.')
      }
      setWorkspace((current) => {
        const exists = current.quotes.some((item) => item.id === quote.id)
        if (exists) throw new Error('Este orçamento já foi registrado.')
        const opportunities = quote.opportunityId
          ? current.opportunities.map((item) => item.id === quote.opportunityId
            ? { ...item, siteId: quote.siteId, quoteId: quote.id, stage: 'elaboracao' as StageId, history: [{ at: new Date().toISOString(), by: quote.ownerId, text: `Orçamento ${quote.number} salvo como rascunho` }, ...item.history] }
            : item)
          : current.opportunities
        return { ...current, quotes: [quote, ...current.quotes], opportunities }
      })
    },
    updateQuote: (quote) => {
      if (quote.demo) throw new Error('Orçamentos reais não podem ser atualizados como demonstração.')
      if (quote.validUntil && !validateDate(quote.validUntil)) throw new Error('A validade do rascunho precisa ser uma data válida.')
      const existing = workspace.quotes.find((item) => item.id === quote.id)
      if (!existing) throw new Error('O rascunho não foi encontrado neste navegador.')
      if (existing.status !== 'Rascunho') throw new Error('Somente orçamentos em rascunho podem ser editados.')
      if (!workspace.clients.some((client) => client.id === quote.clientId && !client.demo && client.active)) throw new Error('O orçamento precisa usar um cliente ativo cadastrado.')
      if (!workspace.sites.some((site) => site.id === quote.siteId && site.clientId === quote.clientId && !site.demo)) throw new Error('A obra selecionada não pertence ao cliente.')
      const previousOpportunityId = existing.opportunityId ?? workspace.opportunities.find((item) => item.quoteId === quote.id)?.id ?? null
      const nextOpportunity = quote.opportunityId ? workspace.opportunities.find((item) => item.id === quote.opportunityId && !item.demo) : undefined
      if (quote.opportunityId && !nextOpportunity) throw new Error('A oportunidade vinculada não foi encontrada.')
      if (nextOpportunity && nextOpportunity.clientId !== quote.clientId) throw new Error('A oportunidade e o orçamento precisam pertencer ao mesmo cliente. Troque o cliente ou desvincule o lead antes de salvar.')
      if (nextOpportunity?.quoteId && nextOpportunity.quoteId !== quote.id) throw new Error('Esta oportunidade já possui outro orçamento vinculado.')
      if (nextOpportunity && workspace.quotes.some((item) => item.id !== quote.id && item.opportunityId === nextOpportunity.id)) throw new Error('Esta oportunidade já está vinculada a outro orçamento.')
      setWorkspace((current) => ({
        ...current,
        quotes: current.quotes.map((item) => item.id === quote.id ? quote : item),
        opportunities: current.opportunities.map((item) => {
          if (previousOpportunityId && item.id === previousOpportunityId && previousOpportunityId !== quote.opportunityId && item.quoteId === quote.id) {
            return { ...item, quoteId: null, history: [{ at: new Date().toISOString(), by: quote.ownerId, text: `Rascunho ${quote.number} desvinculado desta oportunidade` }, ...item.history] }
          }
          if (quote.opportunityId && item.id === quote.opportunityId) {
            return {
              ...item,
              siteId: quote.siteId,
              quoteId: quote.id,
              ...(previousOpportunityId !== quote.opportunityId ? { stage: 'elaboracao' as StageId } : {}),
              history: [{ at: new Date().toISOString(), by: quote.ownerId, text: `Rascunho ${quote.number} atualizado` }, ...item.history],
            }
          }
          return item
        }),
      }))
    },
    removeDraftQuote: (quoteId) => {
      const quote = workspace.quotes.find((item) => item.id === quoteId && !item.demo)
      if (!quote) throw new Error('Rascunho não encontrado.')
      const linkedOrders = workspace.workOrders.filter((order) => order.quoteId === quoteId)
      const linkedOrderIds = new Set(linkedOrders.map((order) => order.id))
      const hasFinancialEntries = workspace.financial.some((entry) => entry.quoteId === quoteId || (entry.workOrderId !== null && linkedOrderIds.has(entry.workOrderId)))
      const hasScheduleEvents = workspace.schedule.some((event) => event.quoteId === quoteId || linkedOrderIds.has(event.workOrderId))
      if (!canDeleteDraftQuote(quote.status, linkedOrders.length > 0, hasFinancialEntries, hasScheduleEvents)) {
        throw new Error('Só é possível excluir rascunho sem pedido, agenda ou lançamento financeiro associado.')
      }
      setWorkspace((current) => ({
        ...current,
        quotes: current.quotes.filter((item) => item.id !== quoteId),
        opportunities: current.opportunities.map((item) => item.quoteId === quoteId || item.id === quote.opportunityId
          ? {
              ...item,
              quoteId: item.quoteId === quoteId ? null : item.quoteId,
              history: [{ at: new Date().toISOString(), by: localUserId, text: `Rascunho ${quote.number} excluído` }, ...item.history],
            }
          : item),
      }))
    },
    updateQuoteStatus: (id, status) => {
      const targetQuote = workspace.quotes.find((item) => item.id === id)
      if (!targetQuote) throw new Error('Orçamento não encontrado.')
      if (['Enviado ao cliente', 'Em negociação', 'Aceito'].includes(status) && (!targetQuote?.validUntil || !validateDate(targetQuote.validUntil))) {
        throw new Error('Preencha uma validade válida antes de enviar, negociar ou aceitar a proposta.')
      }
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
      const quote = workspace.quotes.find((item) => item.id === quoteId)
      if (!quote) throw new Error('Orçamento não encontrado.')
      if (quote.demo) throw new Error('Desative o modo de demonstração e selecione um orçamento real.')
      if (workspace.workOrders.some((order) => order.quoteId === quoteId)) throw new Error('Este orçamento já foi convertido em pedido.')
      const ctx = quoteContext(false, settings)
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
        method: method.trim() || 'Não informado',
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
      if (!validateProfessionalProfile(professional.name, professional.rateCents)) {
        throw new Error('Informe um nome com pelo menos 3 caracteres e, se houver custo de referência, um valor maior que zero.')
      }
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
      const hasLaborBreakdown = expense.unitRateCents != null || expense.quantity != null
      if (expense.professionalId && hasLaborBreakdown && (
        !expense.rateUnit ||
        calculateUnitCostCents(expense.unitRateCents ?? 0, expense.quantity ?? 0) === null
      )) throw new Error('Para detalhar a mão de obra, informe tarifa unitária, quantidade e unidade.')
      if (expense.professionalId && hasLaborBreakdown && calculateUnitCostCents(expense.unitRateCents ?? 0, expense.quantity ?? 0) !== expense.amountCents) throw new Error('O total da mão de obra não corresponde à tarifa multiplicada pela quantidade.')
      if (!validateMoneyCents(expense.amountCents)) throw new Error('O valor da despesa deve ser maior que zero.')
      if (!validateDate(expense.incurredAt) || !validateDate(dueDate)) throw new Error('Informe datas válidas para a despesa e vencimento.')
      const payable: FinancialEntry = {
        id: `fin-${crypto.randomUUID()}`,
        kind: 'pagar',
        workOrderId: expense.workOrderId,
        quoteId: workspace.workOrders.find((order) => order.id === expense.workOrderId)?.quoteId ?? null,
        clientId: null,
        professionalId: expense.professionalId,
        description: expense.description.trim() || 'Despesa sem descrição',
        amountCents: expense.amountCents,
        issuedAt: expense.incurredAt,
        dueDate,
        method: method.trim() || 'Não informado',
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
              nextContact: savedTask.dueDate || null,
              nextAction: savedTask.title,
              history: [{
                at: now,
                by: localUserId,
                text: `Tarefa agendada: ${savedTask.title}${savedTask.dueDate ? ` · ${savedTask.dueDate}` : ' · sem prazo'}${savedTask.dueTime ? ` às ${savedTask.dueTime}` : ''}`,
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
  }), [visible, workspace, workspaceLoaded, settings, settingsReady, toasts, toast, dismissToast])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const store = useContext(StoreCtx)
  if (!store) throw new Error('useStore fora do StoreProvider')
  return store
}
