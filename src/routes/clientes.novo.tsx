import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthSession } from '../lib/auth.functions'

export const Route = createFileRoute('/clientes/novo')({
  beforeLoad: async () => {
    const session = await getAuthSession()
    if (session.profile?.perfil !== 'admin') {
      throw redirect({ to: '/clientes' })
    }

    throw redirect({ to: '/clientes', search: { novo: '1' } })
  },
  component: () => null,
})
