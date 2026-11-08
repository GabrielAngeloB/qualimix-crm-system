import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  redirect,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StoreProvider } from "../data/store";
import { AppShell } from "../components/AppShell";
import { getAuthSession } from "../lib/auth.functions";
import type { AuthProfile } from "../lib/auth.server";

const siteName = "Qualimix CRM — Gestão comercial e operacional";
const siteDescription =
  "CRM da Qualimix: clientes, obras, funil comercial, orçamentos de concreto usinado e pisos, agenda de concretagens e contas a receber.";

const themeScript = `try{var t=localStorage.getItem('qmx-theme');if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';document.documentElement.dataset.theme=t||'light'}catch(e){}`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-ink">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-ink">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted">A página que você procura não existe ou foi movida.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-muted">
          Algo deu errado. Tente novamente ou volte ao painel.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            Voltar ao painel
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  authProfile?: AuthProfile | null;
}>()({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/login" || location.pathname === "/bootstrap") {
      return { authProfile: null };
    }

    const session = await getAuthSession();
    if (!session.authenticated || !session.profile) {
      throw redirect({ to: "/login" });
    }

    return { authProfile: session.profile };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: siteName },
      { name: "description", content: siteDescription },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: siteName },
      { property: "og:description", content: siteDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
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
  );
}

function RootComponent() {
  const { queryClient, authProfile } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPublicAuthRoute = pathname === "/login" || pathname === "/bootstrap";

  return (
    <QueryClientProvider client={queryClient}>
      {isPublicAuthRoute ? (
        <Outlet />
      ) : authProfile ? (
        <StoreProvider>
          <AppShell profile={authProfile}>
            <Outlet />
          </AppShell>
        </StoreProvider>
      ) : (
        <main className="grid min-h-screen place-items-center bg-surface-2 text-sm text-muted">
          Validando sessão…
        </main>
      )}
    </QueryClientProvider>
  );
}
