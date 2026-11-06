import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  Settings,
  SquareKanban,
  Sun,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useStore } from '../data/store'
import { currentUser } from '../data/fixtures'
import { formatDocument, onlyDigits } from '../lib/documents'
import { LogoSlot, Toaster, cx } from './ui'

type NavItem = { label: string; icon: typeof Users; to?: string; soon?: string }
const nav: { group: string; items: NavItem[] }[] = [
  { group: 'Visão geral', items: [{ label: 'Painel', icon: LayoutDashboard, to: '/' }] },
  {
    group: 'Comercial',
    items: [
      { label: 'Clientes e obras', icon: Users, to: '/clientes' },
      { label: 'Funil comercial', icon: SquareKanban, to: '/funil' },
      { label: 'Orçamentos', icon: FileText, to: '/orcamentos' },
    ],
  },
  {
    group: 'Operação',
    items: [
      { label: 'Pedidos', icon: ClipboardList, soon: 'Em breve' },
      { label: 'Agenda de concretagens', icon: CalendarDays, soon: 'Em breve' },
      { label: 'Caminhões', icon: Truck, soon: 'Em breve' },
    ],
  },
  { group: 'Financeiro', items: [{ label: 'Contas a receber', icon: Wallet, soon: 'Em breve' }] },
  { group: 'Administração', items: [{ label: 'Configurações', icon: Settings, to: '/configuracoes' }] },
]

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('qmx-theme', next)
  }
  return { theme, toggle }
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const path = useRouterState({ select: (s) => s.location.pathname })
  const { demoMode, setDemoMode } = useStore()
  const { theme, toggle } = useTheme()

  useEffect(() => setMenuOpen(false), [path])

  const sidebar = (
    <nav aria-label="Módulos" className="flex h-full flex-col bg-[#0b0b0b] text-white">
      <div className="flex items-center justify-between px-5 pb-6 pt-5">
        <LogoSlot onDark />
        <button className="lg:hidden text-white/70" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {nav.map((g) => (
          <div key={g.group} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{g.group}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.to && (it.to === '/' ? path === '/' : path.startsWith(it.to))
                const inner = (
                  <>
                    <it.icon className={cx('h-[18px] w-[18px] shrink-0', active ? 'text-brand' : '')} />
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.soon && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/50">{it.soon}</span>}
                  </>
                )
                return (
                  <li key={it.label}>
                    {it.to ? (
                      <Link
                        to={it.to as "/"}
                        className={cx(
                          'relative flex items-center gap-3 rounded-md px-3 py-2 text-[15px] font-medium transition-colors',
                          active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                        )}
                      >
                        {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand" />}
                        {inner}
                      </Link>
                    ) : (
                      <span aria-disabled="true" title="Módulo previsto no roteiro do produto" className="flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-[15px] font-medium text-white/35">
                        {inner}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span>
            <span className="block font-semibold">Dados de demonstração</span>
            <span className="block text-xs text-white/45">{demoMode ? 'Fictícios visíveis' : 'Ocultos'}</span>
          </span>
          <input type="checkbox" className="peer sr-only" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/20 transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-brand" />
        </label>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="anim-fade absolute inset-y-0 left-0 w-[280px]">{sidebar}</div>
        </div>
      )}
      <div className="min-w-0">
        {demoMode && (
          <div className="no-print flex items-center gap-3 bg-ink px-4 py-1.5 text-xs text-bg">
            <span className="stripe h-3 w-8 shrink-0 rounded-sm" />
            <span className="truncate">
              <strong className="uppercase tracking-wider">Ambiente de demonstração</strong> — clientes, obras e valores exibidos são fictícios.
            </span>
          </div>
        )}
        <header className="no-print sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur md:px-6">
          <button className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
            <Menu className="h-6 w-6" />
          </button>
          <GlobalSearch />
          <button onClick={toggle} className="grid h-10 w-10 place-items-center rounded-md border border-line hover:bg-surface-2" aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}>
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-ink font-display text-sm font-bold text-bg">AD</div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{currentUser.name}</div>
              <div className="text-xs text-muted">{currentUser.role}</div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
      <Toaster />
    </div>
  )
}

function GlobalSearch() {
  const { clients, sites, quotes } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return null
    const digits = onlyDigits(term)
    const c = clients
      .filter((x) => x.name.toLowerCase().includes(term) || x.tradeName.toLowerCase().includes(term) || (digits.length >= 3 && (x.document.includes(digits) || x.phone.includes(digits) || x.whatsapp.includes(digits))))
      .slice(0, 5)
    const s = sites.filter((x) => x.name.toLowerCase().includes(term) || x.address.toLowerCase().includes(term)).slice(0, 4)
    const o = quotes.filter((x) => x.number.toLowerCase().includes(term)).slice(0, 4)
    return { c, s, o }
  }, [q, clients, sites, quotes])

  const go = (fn: () => void) => {
    setOpen(false)
    setQ('')
    fn()
  }
  const empty = results && !results.c.length && !results.s.length && !results.o.length

  return (
    <div ref={ref} className="relative flex-1 max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar cliente, CPF/CNPJ, telefone, obra ou nº do orçamento"
        aria-label="Pesquisa global"
        className="h-10 w-full rounded-md border border-line bg-surface-2 pl-9 pr-3 text-[15px] outline-none focus:border-ink focus:bg-surface"
      />
      {open && results && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-2xl">
          {empty && <p className="p-3 text-sm text-muted">Nenhum resultado para “{q}”.</p>}
          {results.c.length > 0 && <SearchGroup label="Clientes" />}
          {results.c.map((c) => (
            <button key={c.id} onClick={() => go(() => navigate({ to: '/clientes', search: { id: c.id } }))} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-2">
              <Users className="h-4 w-4 text-muted" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <span className="text-xs text-muted tabular">{c.document ? formatDocument(c.document) : ''}</span>
            </button>
          ))}
          {results.s.length > 0 && <SearchGroup label="Obras" />}
          {results.s.map((s) => (
            <button key={s.id} onClick={() => go(() => navigate({ to: '/clientes', search: { id: s.clientId } }))} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-2">
              <Building2 className="h-4 w-4 text-muted" />
              <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
              <span className="truncate text-xs text-muted">{s.city}</span>
            </button>
          ))}
          {results.o.length > 0 && <SearchGroup label="Orçamentos" />}
          {results.o.map((o) => (
            <button key={o.id} onClick={() => go(() => navigate({ to: '/orcamentos', search: { q: o.number } }))} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-2">
              <FileText className="h-4 w-4 text-muted" />
              <span className="flex-1 font-medium tabular">{o.number}</span>
              <span className="text-xs text-muted">{o.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const SearchGroup = ({ label }: { label: string }) => (
  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
)
