import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clients as seedClients,
  opportunities as seedOpps,
  quotes as seedQuotes,
  sites as seedSites,
  type Client,
  type Opportunity,
  type QuoteRecord,
  type Site,
} from './fixtures'
import {
  buildReceivables,
  evaluateAll,
  quoteContext,
  type EvaluatedQuote,
  type ReceivableRow,
} from './derived'
import type { QuoteContext } from '../lib/quote'

/**
 * Estado da sessão. Nesta etapa os registros vêm de fixtures e as inclusões
 * ficam na memória do navegador até a etapa de banco de dados (ver PLAN.md).
 */
export interface Toast {
  id: number
  tone: 'ok' | 'erro' | 'info'
  title: string
  body?: string
}

interface Store {
  demoMode: boolean
  setDemoMode: (v: boolean) => void
  ctx: QuoteContext
  clients: Client[]
  sites: Site[]
  quotes: EvaluatedQuote[]
  opportunities: Opportunity[]
  receivables: ReceivableRow[]
  addClient: (c: Client, site?: Site) => void
  updateOpportunity: (id: string, patch: Partial<Opportunity>, historyText?: string) => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState(true)
  const [extraClients, setExtraClients] = useState<Client[]>([])
  const [extraSites, setExtraSites] = useState<Site[]>([])
  const [opps, setOpps] = useState<Opportunity[]>(seedOpps)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('qmx-demo')
    if (saved === '0') setDemoModeState(false)
  }, [])

  const setDemoMode = useCallback((v: boolean) => {
    setDemoModeState(v)
    localStorage.setItem('qmx-demo', v ? '1' : '0')
  }, [])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((xs) => [...xs, { ...t, id }])
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), 5000)
  }, [])
  const dismissToast = useCallback(
    (id: number) => setToasts((xs) => xs.filter((x) => x.id !== id)),
    [],
  )

  const value = useMemo<Store>(() => {
    const ctx = quoteContext(demoMode)
    const keep = <T extends { demo: boolean }>(xs: T[]) =>
      demoMode ? xs : xs.filter((x) => !x.demo)
    const quotes = evaluateAll(keep(seedQuotes as QuoteRecord[]), ctx)
    return {
      demoMode,
      setDemoMode,
      ctx,
      clients: [...extraClients, ...keep(seedClients)],
      sites: [...extraSites, ...keep(seedSites)],
      quotes,
      opportunities: keep(opps),
      receivables: demoMode ? buildReceivables(quotes) : [],
      addClient: (c, site) => {
        setExtraClients((xs) => [c, ...xs])
        if (site) setExtraSites((xs) => [site, ...xs])
      },
      updateOpportunity: (id, patch, historyText) =>
        setOpps((xs) =>
          xs.map((o) =>
            o.id === id
              ? {
                  ...o,
                  ...patch,
                  history: historyText
                    ? [
                        { at: new Date().toISOString(), by: 'u-adm', text: historyText },
                        ...o.history,
                      ]
                    : o.history,
                }
              : o,
          ),
        ),
      toasts,
      toast,
      dismissToast,
    }
  }, [demoMode, extraClients, extraSites, opps, toasts, toast, dismissToast, setDemoMode])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const s = useContext(StoreCtx)
  if (!s) throw new Error('useStore fora do StoreProvider')
  return s
}
