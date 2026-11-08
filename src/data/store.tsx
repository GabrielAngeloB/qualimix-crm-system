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
  loadCrmData, persistClient, persistOpportunity, persistQuote,
  createOpportunity as createOpportunityOnServer,
  type OpportunityCreateInput, type QuoteSaveInput, type CrmData, type CrmViews,
} from '../lib/crm.functions'

export interface Toast { id: number; tone: 'ok' | 'erro' | 'info'; title: string; body?: string }
interface Store {
  demoMode: boolean; setDemoMode: (v: boolean) => void; ctx: QuoteContext
  clients: Client[]; sites: Site[]; quotes: EvaluatedQuote[]; opportunities: Opportunity[]
  team: TeamUser[]; currentUserId: string; views: CrmViews
  receivables: ReceivableRow[]; loading: boolean
  addClient: (c: Client, site?: Site) => Promise<void>
  updateOpportunity: (id: string, patch: Partial<Opportunity>, historyText?: string) => void
  createOpportunity: (input: OpportunityCreateInput) => Promise<void>
  saveQuote: (input: QuoteSaveInput) => Promise<{ id: string; number: string; version: number }>
  refresh: () => Promise<void>
  toasts: Toast[]; toast: (t: Omit<Toast, 'id'>) => void; dismissToast: (id: number) => void
}
const emptyViews: CrmViews = { clients: [], funnel: [], quotes: [], fleet: [] }
const emptyData: CrmData = {
  clients: [], sites: [], opportunities: [], quotes: [], products: [], team: [],
  currentUserId: '', views: emptyViews,
}
const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [demoModeState, setDemoModeState] = useState(false)
  const [dbData, setDbData] = useState<CrmData>(emptyData)
  const [opps, setOpps] = useState<Opportunity[]>(seedOpps)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setDbData(await loadCrmData()) }
    finally { setLoading(false) }
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
      currentUserId: dbData.currentUserId, views: dbData.views,
      // Contas a receber ainda não têm tabela de produção no esquema atual.
      receivables: demoMode ? buildReceivables(evaluateAll(quoteRecords, ctx)) : [],
      loading, addClient, updateOpportunity, createOpportunity, saveQuote, refresh,
      toasts, toast, dismissToast,
    }
  }, [demoMode, setDemoMode, dbData, opps, loading, addClient, updateOpportunity, createOpportunity, saveQuote, refresh, toasts, toast, dismissToast])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
export function useStore() {
  const store = useContext(StoreCtx)
  if (!store) throw new Error('useStore fora do StoreProvider')
  return store
}
