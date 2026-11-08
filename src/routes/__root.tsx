import { HeadContent, Outlet, Scripts, createRootRoute, redirect, useRouterState } from '@tanstack/react-router'
import { getAuthSession } from '../lib/auth.functions'

import '../styles.css'
import { StoreProvider } from '../data/store'
import { AppShell } from '../components/AppShell'

const siteName = 'Qualimix CRM — Gestão comercial e operacional'
const siteDescription =
  'CRM da Qualimix: clientes, obras, funil comercial, orçamentos de concreto usinado e pisos, agenda de concretagens e contas a receber.'

const themeScript = `try{var t=localStorage.getItem('qmx-theme');if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';document.documentElement.dataset.theme=t||'light'}catch(e){}`

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login' || location.pathname === '/bootstrap') return
    const session = await getAuthSession()
    if (!session.authenticated) throw redirect({ to: '/login' })

    const profile = session.profile
    if (!profile) throw redirect({ to: '/login' })
    const pathPermissions: Record<string, string[]> = {
      '/clientes': ['comercial', 'consulta'],
      '/funil': ['comercial', 'consulta'],
      '/tarefas': ['comercial', 'consulta'],
      '/orcamentos': ['comercial', 'consulta'],
      '/pedidos': ['comercial', 'operacao', 'financeiro', 'consulta'],
      '/agenda': ['operacao', 'consulta'],
      '/profissionais': ['operacao', 'financeiro', 'consulta'],
      '/financeiro': ['financeiro', 'consulta'],
      '/configuracoes': [],
      '/usuarios': [],
    }
    const requiredRoles = Object.entries(pathPermissions)
      .find(([prefix]) => location.pathname === prefix || location.pathname.startsWith(prefix + '/'))?.[1]
    const isAdmin = profile.perfil === 'admin'
    if (!isAdmin && requiredRoles && !requiredRoles.includes(profile.role)) {
      throw redirect({ to: '/' })
    }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: siteName },
      { name: 'description', content: siteDescription },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: siteName },
      { property: 'og:description', content: siteDescription },
      { property: 'og:type', content: 'website' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const publicPage = path === '/login' || path === '/bootstrap'
  if (publicPage) return <Outlet />
  return (
    <StoreProvider>
      <AppShell><Outlet /></AppShell>
    </StoreProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
