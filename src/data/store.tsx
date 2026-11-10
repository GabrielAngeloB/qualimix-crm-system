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
  saveProfessionalOnServer, saveScheduleEventOnServer, saveTaskOnServer, cancelWorkOrderOnServer,
  type OperationalRecords,
} from '../lib/operations.functions'
import {
  loadCrmData, persistClient, updateClientOnServer, setClientActiveOnServer, persistOpportunity, persistQuote,
  createOpportunity as createOpportunityOnServer, setOpportunityArchived as setOpportunityArchivedOnServer,
  type OpportunityCreateInput, type QuoteSaveInput, type CrmData, type CrmViews,
} from '../lib/crm.functions'
import { createDefaultSettings, type AppSettings } from './settings'
import {
  loadSettings,
  saveSettings as saveSettingsOnServer,
  saveProduct as saveProductOnServer,
  type LoadedSettings,
  type SaveProductInput,
} from '../lib/settings.functions'

export interface Toast { id: number; tone: 'ok' | 'erro' | 'info'; title: string; body?: string }
interface Store {
  demoMode: boolean; setDemoMode: (v: boolean) => void; ctx: QuoteContext
  clients: Client[]; sites: Site[]; quotes: EvaluatedQuote[]; opportunities: Opportunity[]
  team: TeamUser[]; currentUserId: string; currentRole: string; views: CrmViews & OperationalRecords['views']
  products: CrmData['products']
  receivables: ReceivableRow[]; loading: boolean
  workOrders: WorkOrder[]; scheduleEvents: ScheduleEvent[]; professionals: Professional[]
  expenses: JobExpense[]; financialEntries: FinancialEntry[]; tasks: CommercialTask[]
  createWorkOrderFromQuote: (quoteId: string, dueDate: string, method: string) => Promise<WorkOrder>
  updateWorkOrderAmount: (id: string, amountCents: number) => Promise<void>
  cancelWorkOrder: (id: string, reason: string) => Promise<void>
  jobBalance: (id: string) => number | null
  addExpense: (expense: JobExpense, dueDate: string, method: string) => Promise<void>
  registerPayment: (entryId: string, payment: FinancialPayment) => Promise<void>
  cancelFinancialEntry: (entryId: string) => Promise<void>
  saveProfessional: (professional: Professional) => Promise<void>
  addScheduleEvent: (event: ScheduleEvent) => Promise<void>
  saveTask: (task: CommercialTask) => Promise<void>
  addClient: (c: Client, site?: Site) => Promise<void>
  updateClient: (client: Client) => Promise<void>
  archiveClient: (id: string) => Promise<void>
  restoreClient: (id: string) => Promise<void>
  updateOpportunity: (id: string, patch: Partial<Opportunity>, historyText?: string) => void
  setOpportunityArchived: (id: string, archived: boolean) => Promise<void>
  createOpportunity: (input: OpportunityCreateInput) => Promise<void>
  saveQuote: (input: QuoteSaveInput) => Promise<{ id: string; number: string; version: number }>
  settings: AppSettings
  settingsReady: boolean
  saveSettings: (settings: AppSettings) => Promise<void>
  saveProduct: (product: SaveProductInput) => Promise<void>
  workspaceReady: boolean
  addQuote: (quote: QuoteRecord) => void
  updateQuote: (quote: QuoteRecord) => void
  refresh: () => Promise<void>
  toasts: Toast[]; toast: (t: Omit<Toast, 'id'>) => void; dismissToast: (id: number) => void
}
type StoreData = Omit<CrmData, 'views'> & Omit<OperationalRecords, 'views'> & {
  views: CrmViews & OperationalRecords['views']
  settings: LoadedSettings | null
}
const emptyViews: CrmViews & OperationalRecords['views'] = {
  clients: [], funnel: [], quotes: [],
  finance: [], orders: [], professionals: [], schedule: [], tasks: [],
}
const emptyData: StoreData = {
  clients: [], sites: [], opportunities: [], quotes: [], products: [], team: [],
  currentUserId: '', currentRole: '', views: emptyViews,
  workOrders: [], scheduleEvents: [], professionals: [], expenses: [], financialEntries: [], tasks: [],
  settings: null,
}
const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [demoModeState, setDemoModeState] = useState(false)
  const [dbData, setDbData] = useState<StoreData>(emptyData)
  const [opps, setOpps] = useState<Opportunity[]>(seedOpps)
  const [localQuotes, setLocalQuotes] = useState<QuoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [crm, operational, settings] = await Promise.all([
        loadCrmData(),
        loadOperationalRecords(),
        loadSettings(),
      ])
      setDbData({ ...crm, ...operational, settings, views: { ...crm.views, ...operational.views } })
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

  const updateClient = useCallback(async (client: Client) => {
    await updateClientOnServer({ data: client })
    await refresh()
    toast({ tone: 'ok', title: 'Cliente atualizado', body: 'Dados cadastrais salvos sem alterar os vínculos históricos.' })
  }, [refresh, toast])

  const archiveClient = useCallback(async (id: string) => {
    await setClientActiveOnServer({ data: { id, active: false } })
    await refresh()
    toast({ tone: 'ok', title: 'Cliente arquivado', body: 'Obras, orçamentos, pedidos e histórico foram preservados.' })
  }, [refresh, toast])

  const restoreClient = useCallback(async (id: string) => {
    await setClientActiveOnServer({ data: { id, active: true } })
    await refresh()
    toast({ tone: 'ok', title: 'Cliente reativado', body: 'O cliente voltou à lista de ativos.' })
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
  const addQuote = useCallback((quote: QuoteRecord) => {
    setLocalQuotes((quotes) => [...quotes.filter((item) => item.id !== quote.id), quote])
  }, [])
  const updateQuote = useCallback((quote: QuoteRecord) => {
    setLocalQuotes((quotes) => quotes.map((item) => item.id === quote.id ? quote : item))
  }, [])

  const createWorkOrderFromQuote = useCallback(async (quoteId: string, dueDate: string, method: string) => {
    const order = await createWorkOrderFromQuoteOnServer({ data: { quoteId, dueDate, method } })
    await refresh()
    return order
  }, [refresh])

  const updateWorkOrderAmount = useCallback(async (id: string, amountCents: number) => {
    await updateWorkOrderAmountOnServer({ data: { id, amountCents } })
    await refresh()
  }, [refresh])

  const cancelWorkOrder = useCallback(async (id: string, reason: string) => {
    await cancelWorkOrderOnServer({ data: { id, reason } })
    await refresh()
  }, [refresh])

  const setOpportunityArchived = useCallback(async (id: string, archived: boolean) => {
    await setOpportunityArchivedOnServer({ data: { id, archived } })
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

  const saveSettings = useCallback(async (settings: AppSettings) => {
    const current = dbData.settings
    if (!current?.settingsReady || !current.settingsUpdatedAt) {
      throw new Error('As configurações persistidas ainda não foram carregadas. Verifique a migration e o seed.')
    }
    await saveSettingsOnServer({
      data: { settings, expectedUpdatedAt: current.settingsUpdatedAt },
    })
    await refresh()
    toast({ tone: 'ok', title: 'Configurações salvas', body: 'As alterações foram persistidas no banco de dados.' })
  }, [dbData.settings, refresh, toast])

  const saveProduct = useCallback(async (product: SaveProductInput) => {
    await saveProductOnServer({ data: product })
    await refresh()
    toast({ tone: 'ok', title: 'Produto atualizado', body: 'O catálogo foi atualizado no banco de dados.' })
  }, [refresh, toast])

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
    // Os defaults só são usados enquanto a linha persistida ainda não estiver pronta.
    const settings = dbData.settings?.settingsReady
      ? dbData.settings
      : createDefaultSettings()
    const ctx = quoteContext(demoMode, settings)
    const clients = demoMode ? [...dbData.clients, ...seedClients] : dbData.clients
    const sites = demoMode ? [...dbData.sites, ...seedSites] : dbData.sites
    const quoteRecords = demoMode
      ? [...dbData.quotes, ...localQuotes, ...(seedQuotes as QuoteRecord[])]
      : [...dbData.quotes, ...localQuotes]
    const opportunities = sortNewestFirst(demoMode ? [...dbData.opportunities, ...opps.filter((item) => item.demo)] : dbData.opportunities)
    return {
      demoMode, setDemoMode, ctx, clients, sites,
      quotes: evaluateAll(quoteRecords, ctx), opportunities,
      team: demoMode ? [...dbData.team, ...seedTeam] : dbData.team,
      currentUserId: dbData.currentUserId, currentRole: dbData.currentRole, views: dbData.views,
      products: settings.catalog,
      settings, settingsReady: dbData.settings?.settingsReady === true, workspaceReady: !loading,
      saveSettings, saveProduct,
      addQuote, updateQuote,
      receivables: demoMode ? buildReceivables(evaluateAll(quoteRecords, ctx)) : [],
      workOrders: dbData.workOrders, scheduleEvents: dbData.scheduleEvents,
      professionals: dbData.professionals, expenses: dbData.expenses,
      financialEntries: dbData.financialEntries, tasks: dbData.tasks,
      createWorkOrderFromQuote, updateWorkOrderAmount, cancelWorkOrder,
      jobBalance: (id: string) => {
        const order = dbData.workOrders.find((item) => item.id === id)
        return order ? jobBalanceCents(order, dbData.expenses) : null
      },
      addExpense, registerPayment, cancelFinancialEntry, saveProfessional, addScheduleEvent, saveTask,
      loading, addClient, updateClient, archiveClient, restoreClient, updateOpportunity, setOpportunityArchived, createOpportunity, saveQuote, refresh,
      toasts, toast, dismissToast,
    }
  }, [demoMode, setDemoMode, dbData, opps, localQuotes, loading, addClient, updateClient, archiveClient, restoreClient, updateOpportunity, createOpportunity, saveQuote, addQuote, updateQuote,
    createWorkOrderFromQuote, updateWorkOrderAmount, cancelWorkOrder, setOpportunityArchived, addExpense, registerPayment, cancelFinancialEntry,
    saveProfessional, addScheduleEvent, saveTask, saveSettings, saveProduct, refresh, toasts, toast, dismissToast])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
export function useStore() {
  const store = useContext(StoreCtx)
  if (!store) throw new Error('useStore fora do StoreProvider')
  return store
}
