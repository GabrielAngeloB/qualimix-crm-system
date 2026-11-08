import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clients as seedClients, opportunities as seedOpps, quotes as seedQuotes,
  sites as seedSites, team as seedTeam,
  type Client, type Opportunity, type QuoteRecord, type Site, type TeamUser,
} from './fixtures'
import { buildReceivables, evaluateAll, quoteContext, type EvaluatedQuote, type ReceivableRow } from './derived'
import { sortNewestFirst } from './ordering'
import type { QuoteContext } from '../lib/quote'
import {
  type WorkOrder, type ScheduleEvent, type Professional, type JobExpense,
  type FinancialEntry, type FinancialPayment, type CommercialTask,
  jobBalanceCents,
} from './operations'
import {
  loadOperationalRecords, createWorkOrderFromQuoteOnServer, updateWorkOrderAmountOnServer,
  addExpenseOnServer, registerPaymentOnServer, cancelFinancialEntryOnServer,
  saveProfessionalOnServer, saveScheduleEventOnServer, saveTaskOnServer,
  type OperationalRecords,
} from '../lib/operations.functions'
import {
  loadCrmData, persistClient, persistOpportunity, persistQuote,
  createOpportunity as createOpportunityOnServer,
  type OpportunityCreateInput, type QuoteSaveInput, type CrmData, type CrmViews,
} from '../lib/crm.functions'

export interface Toast { id: number; tone: 'ok' | 'erro' | 'info'; title: string; body?: string }
interface Store {
  demoMode: boolean; setDemoMode: (v: boolean) => void; ctx: QuoteContext
  clients: Client[]; sites: Site[]; quotes: EvaluatedQuote[]; opportunities: Opportunity[]
  team: TeamUser[]; currentUserId: string; currentRole: string; views: CrmViews & OperationalRecords['views']
  receivables: ReceivableRow[]; loading: boolean
  workOrders: WorkOrder[]; scheduleEvents: ScheduleEvent[]; professionals: Professional[]
  expenses: JobExpense[]; financialEntries: FinancialEntry[]; tasks: CommercialTask[]
  createWorkOrderFromQuote: (quoteId: string, dueDate: string, method: string) => Promise<WorkOrder>
  updateWorkOrderAmount: (id: string, amountCents: number) => Promise<void>
  jobBalance: (id: string) => number | null
  addExpense: (expense: JobExpense, dueDate: string, method: string) => Promise<void>
  registerPayment: (entryId: string, payment: FinancialPayment) => Promise<void>
  cancelFinancialEntry: (entryId: string) => Promise<void>
  saveProfessional: (professional: Professional) => Promise<void>
  addScheduleEvent: (event: ScheduleEvent) => Promise<void>
  saveTask: (task: CommercialTask) => Promise<void>
  addClient: (c: Client, site?: Site) => Promise<void>
  updateOpportunity: (id: string, patch: Partial<Opportunity>, historyText?: string) => void
  createOpportunity: (input: OpportunityCreateInput) => Promise<void>
  saveQuote: (input: QuoteSaveInput) => Promise<{ id: string; number: string; version: number }>
  refresh: () => Promise<void>
  toasts: Toast[]; toast: (t: Omit<Toast, 'id'>) => void; dismissToast: (id: number) => void
}
type StoreData = Omit<CrmData, 'views'> & Omit<OperationalRecords, 'views'> & {
  views: CrmViews & OperationalRecords['views']
}
const emptyViews: CrmViews & OperationalRecords['views'] = {
  clients: [], funnel: [], quotes: [],
  finance: [], orders: [], professionals: [], schedule: [], tasks: [],
}
const emptyData: StoreData = {
  clients: [], sites: [], opportunities: [], quotes: [], products: [], team: [],
  currentUserId: '', currentRole: '', views: emptyViews,
  workOrders: [], scheduleEvents: [], professionals: [], expenses: [], financialEntries: [], tasks: [],
}
const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [demoModeState, setDemoModeState] = useState(false)
  const [dbData, setDbData] = useState<StoreData>(emptyData)
  const [opps, setOpps] = useState<Opportunity[]>(seedOpps)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [crm, operational] = await Promise.all([loadCrmData(), loadOperationalRecords()])
      setDbData({ ...crm, ...operational, views: { ...crm.views, ...operational.views } })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (import.meta.env.DEV) {
      try { if (localStorage.getItem('qmx-demo') === '1') setDemoModeState(true) } catch { /* storage opcional */ }
    }
    void refresh().catch((error) => {
      const id = Date.now()
      setToasts((xs) => [...xs, {
        id, tone: 'erro', title: 'Falha ao carregar o CRM',
        body: error instanceof Error ? error.message : 'Verifique a conexão do banco no servidor.',
      }])
    })
  }, [refresh])

  const demoMode = import.meta.env.DEV && demoModeState
  const setDemoMode = useCallback((value: boolean) => {
    if (!import.meta.env.DEV) return
    setDemoModeState(value)
    try { localStorage.setItem('qmx-demo', value ? '1' : '0') } catch { /* storage opcional */ }
  }, [])

  const toast = useCallback((item: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((xs) => [...xs, { ...item, id }])
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 5000)
  }, [])
  const dismissToast = useCallback((id: number) => setToasts((xs) => xs.filter((x) => x.id !== id)), [])

  const addClient = useCallback(async (client: Client, site?: Site) => {
    await persistClient({ data: { client, site } })
    await refresh()
    toast({ tone: 'ok', title: 'Cliente cadastrado', body: 'Dados salvos no banco de dados.' })
  }, [refresh, toast])

  const updateOpportunity = useCallback((id: string, patch: Partial<Opportunity>, historyText?: string) => {
    const update = (items: Opportunity[]) => items.map((item) => item.id === id
      ? { ...item, ...patch, history: historyText ? [{ at: new Date().toISOString(), by: dbData.currentUserId, text: historyText }, ...item.history] : item.history }
      : item)
    if (dbData.opportunities.some((item) => item.id === id)) {
      setDbData((current) => ({ ...current, opportunities: update(current.opportunities) }))
      void persistOpportunity({ data: { id, patch, historyText } }).catch((error) => {
        toast({ tone: 'erro', title: 'Não foi possível atualizar a oportunidade', body: error instanceof Error ? error.message : 'Erro de gravação.' })
        void refresh()
      })
    } else if (demoMode) setOpps(update)
  }, [dbData.currentUserId, dbData.opportunities, demoMode, refresh, toast])

  const createOpportunity = useCallback(async (input: OpportunityCreateInput) => {
    await createOpportunityOnServer({ data: input })
    await refresh()
    toast({ tone: 'ok', title: 'Lead cadastrado', body: 'Oportunidade salva no banco de dados.' })
  }, [refresh, toast])

  const saveQuote = useCallback(async (input: QuoteSaveInput) => {
    const saved = await persistQuote({ data: input })
    await refresh()
    toast({ tone: 'ok', title: 'Orçamento salvo', body: saved.number + ' · versão ' + saved.version })
    return saved
  }, [refresh, toast])

  const createWorkOrderFromQuote = useCallback(async (quoteId: string, dueDate: string, method: string) => {
    const order = await createWorkOrderFromQuoteOnServer({ data: { quoteId, dueDate, method } })
    await refresh()
    return order
  }, [refresh])

  const updateWorkOrderAmount = useCallback(async (id: string, amountCents: number) => {
    await updateWorkOrderAmountOnServer({ data: { id, amountCents } })
    await refresh()
  }, [refresh])

  const addExpense = useCallback(async (expense: JobExpense, dueDate: string, method: string) => {
    await addExpenseOnServer({ data: { ...expense, dueDate, method } })
    await refresh()
  }, [refresh])

  const registerPayment = useCallback(async (entryId: string, payment: FinancialPayment) => {
    await registerPaymentOnServer({ data: { entryId, ...payment } })
    await refresh()
  }, [refresh])

  const cancelFinancialEntry = useCallback(async (entryId: string) => {
    await cancelFinancialEntryOnServer({ data: { id: entryId } })
    await refresh()
  }, [refresh])

  const saveProfessional = useCallback(async (professional: Professional) => {
    await saveProfessionalOnServer({ data: professional })
    await refresh()
  }, [refresh])

  const addScheduleEvent = useCallback(async (event: ScheduleEvent) => {
    await saveScheduleEventOnServer({ data: event })
    await refresh()
  }, [refresh])

  const saveTask = useCallback(async (task: CommercialTask) => {
    await saveTaskOnServer({ data: task })
    await refresh()
  }, [refresh])

  const value = useMemo<Store>(() => {
    const ctx = quoteContext(demoMode, dbData.products.length ? dbData.products : undefined)
    const clients = demoMode ? [...dbData.clients, ...seedClients] : dbData.clients
    const sites = demoMode ? [...dbData.sites, ...seedSites] : dbData.sites
    const quoteRecords = demoMode ? [...dbData.quotes, ...(seedQuotes as QuoteRecord[])] : dbData.quotes
    const opportunities = sortNewestFirst(demoMode ? [...dbData.opportunities, ...opps.filter((item) => item.demo)] : dbData.opportunities)
    return {
      demoMode, setDemoMode, ctx, clients, sites,
      quotes: evaluateAll(quoteRecords, ctx), opportunities,
      team: demoMode ? [...dbData.team, ...seedTeam] : dbData.team,
      currentUserId: dbData.currentUserId, currentRole: dbData.currentRole, views: dbData.views,
      receivables: demoMode ? buildReceivables(evaluateAll(quoteRecords, ctx)) : [],
      workOrders: dbData.workOrders, scheduleEvents: dbData.scheduleEvents,
      professionals: dbData.professionals, expenses: dbData.expenses,
      financialEntries: dbData.financialEntries, tasks: dbData.tasks,
      createWorkOrderFromQuote, updateWorkOrderAmount,
      jobBalance: (id: string) => {
        const order = dbData.workOrders.find((item) => item.id === id)
        return order ? jobBalanceCents(order, dbData.expenses) : null
      },
      addExpense, registerPayment, cancelFinancialEntry, saveProfessional, addScheduleEvent, saveTask,
      loading, addClient, updateOpportunity, createOpportunity, saveQuote, refresh,
      toasts, toast, dismissToast,
    }
  }, [demoMode, setDemoMode, dbData, opps, loading, addClient, updateOpportunity, createOpportunity, saveQuote,
    createWorkOrderFromQuote, updateWorkOrderAmount, addExpense, registerPayment, cancelFinancialEntry,
    saveProfessional, addScheduleEvent, saveTask, refresh, toasts, toast, dismissToast])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
export function useStore() {
  const store = useContext(StoreCtx)
  if (!store) throw new Error('useStore fora do StoreProvider')
  return store
}
