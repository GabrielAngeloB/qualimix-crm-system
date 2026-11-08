import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clients as seedClients, opportunities as seedOpps, quotes as seedQuotes, sites as seedSites,
  type Client, type Opportunity, type QuoteRecord, type Site,
} from './fixtures'
import { buildReceivables, evaluateAll, quoteContext, type EvaluatedQuote, type ReceivableRow } from './derived'
import type { QuoteContext } from '../lib/quote'
import { loadCrmData, persistClient, persistOpportunity, persistQuote, type QuoteSaveInput } from '../lib/crm.functions'

export interface Toast { id:number; tone:'ok'|'erro'|'info'; title:string; body?:string }
interface Store {
  demoMode:boolean; setDemoMode:(v:boolean)=>void; ctx:QuoteContext
  clients:Client[]; sites:Site[]; quotes:EvaluatedQuote[]; opportunities:Opportunity[]
  receivables:ReceivableRow[]; loading:boolean
  addClient:(c:Client,site?:Site)=>void
  updateOpportunity:(id:string,patch:Partial<Opportunity>,historyText?:string)=>void
  saveQuote:(input:QuoteSaveInput)=>Promise<{id:string;number:string;version:number}>
  refresh:()=>Promise<void>
  toasts:Toast[]; toast:(t:Omit<Toast,'id'>)=>void; dismissToast:(id:number)=>void
}
const StoreCtx=createContext<Store|null>(null)

export function StoreProvider({children}:{children:ReactNode}) {
  const [demoMode,setDemoModeState]=useState(false)
  const [dbData,setDbData]=useState<{clients:Client[];sites:Site[];opportunities:Opportunity[];quotes:QuoteRecord[]}>({clients:[],sites:[],opportunities:[],quotes:[]})
  const [opps,setOpps]=useState<Opportunity[]>(seedOpps)
  const [loading,setLoading]=useState(true)
  const [toasts,setToasts]=useState<Toast[]>([])

  const refresh=useCallback(async()=>{
    setLoading(true)
    try { setDbData(await loadCrmData()) }
    finally { setLoading(false) }
  },[])

  useEffect(()=>{
    try { if(localStorage.getItem('qmx-demo')==='1') setDemoModeState(true) } catch {}
    void refresh().catch((error)=> {
      const id=Date.now()
      setToasts((xs)=>[...xs,{id,tone:'erro',title:'Falha ao carregar o CRM',body:error instanceof Error?error.message:'Verifique a conexão com o banco.'}])
    })
  },[refresh])

  const setDemoMode=useCallback((v:boolean)=>{
    setDemoModeState(v)
    try { localStorage.setItem('qmx-demo',v?'1':'0') } catch {}
  },[])
  const toast=useCallback((t:Omit<Toast,'id'>)=>{
    const id=Date.now()+Math.random()
    setToasts((xs)=>[...xs,{...t,id}])
    setTimeout(()=>setToasts((xs)=>xs.filter((x)=>x.id!==id)),5000)
  },[])
  const dismissToast=useCallback((id:number)=>setToasts((xs)=>xs.filter((x)=>x.id!==id)),[])

  const addClient=useCallback((client:Client,site?:Site)=>{
    void persistClient({data:{client,site}}).then(async()=>{
      await refresh()
      toast({tone:'ok',title:'Cliente cadastrado',body:'Dados salvos no banco de dados.'})
    }).catch((error)=>{
      toast({tone:'erro',title:'Não foi possível cadastrar o cliente',body:error instanceof Error?error.message:'Erro de gravação.'})
    })
  },[refresh,toast])

  const updateOpportunity=useCallback((id:string,patch:Partial<Opportunity>,historyText?:string)=>{
    const update=(xs:Opportunity[])=>xs.map((o)=>o.id===id?{...o,...patch,history:historyText?[{at:new Date().toISOString(),by:'current-user',text:historyText},...o.history]:o.history}:o)
    if(dbData.opportunities.some((o)=>o.id===id)){
      setDbData((current)=>({...current,opportunities:update(current.opportunities)}))
      void persistOpportunity({data:{id,patch,historyText}}).catch((error)=>{
        toast({tone:'erro',title:'Não foi possível atualizar a oportunidade',body:error instanceof Error?error.message:'Erro de gravação.'})
        void refresh()
      })
    } else setOpps(update)
  },[dbData.opportunities,refresh,toast])

  const saveQuote=useCallback(async(input:QuoteSaveInput)=>{
    const saved=await persistQuote({data:input})
    await refresh()
    toast({tone:'ok',title:'Orçamento salvo',body:`${saved.number} · versão ${saved.version}`})
    return saved
  },[refresh,toast])

  const value=useMemo<Store>(()=>{
    const ctx=quoteContext(demoMode)
    const keep=<T extends {demo:boolean}>(xs:T[])=>demoMode?xs:xs.filter((x)=>!x.demo)
    const quotes=evaluateAll([...dbData.quotes,...keep(seedQuotes as QuoteRecord[])],ctx)
    return {
      demoMode,setDemoMode,ctx,
      clients:[...dbData.clients,...keep(seedClients)],
      sites:[...dbData.sites,...keep(seedSites)],
      quotes,
      opportunities:[...dbData.opportunities,...keep(opps)],
      receivables:demoMode?buildReceivables(quotes):[],
      loading,addClient,updateOpportunity,saveQuote,refresh,
      toasts,toast,dismissToast,
    }
  },[demoMode,setDemoMode,dbData,opps,loading,addClient,updateOpportunity,saveQuote,refresh,toasts,toast,dismissToast])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}
export function useStore(){const store=useContext(StoreCtx);if(!store)throw new Error('useStore fora do StoreProvider');return store}
