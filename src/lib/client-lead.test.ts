import { describe, expect, it } from 'vitest'
import type { Client } from '../data/fixtures'
import { createOpportunityFromClient } from './client-lead'

const client = (patch: Partial<Client> = {}): Client => ({
  id: 'client-1',
  name: 'Construtora Exemplo',
  tradeName: '',
  document: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  city: '',
  region: '',
  type: 'Não informado',
  source: 'Instagram',
  ownerId: 'local-user',
  notes: '',
  createdAt: '2026-11-08',
  active: true,
  demo: false,
  ...patch,
})

describe('lead criado a partir do cliente', () => {
  it('sempre inicia em Novo lead e preserva a origem informada', () => {
    const opportunity = createOpportunityFromClient(client(), 'lead-1', '2026-11-08', '2026-11-08T12:00:00.000Z')

    expect(opportunity).toMatchObject({
      id: 'lead-1',
      title: 'Construtora Exemplo',
      clientId: 'client-1',
      stage: 'novo',
      source: 'Instagram',
      estimatedValue: null,
      siteId: null,
      demo: false,
      nextAction: 'Realizar primeiro contato',
    })
    expect(opportunity.history[0].text).toContain('automaticamente')
  })

  it('usa Não informado quando a origem não foi preenchida', () => {
    const opportunity = createOpportunityFromClient(client({ source: '' }), 'lead-2', '2026-11-08', '2026-11-08T12:00:00.000Z')
    expect(opportunity.source).toBe('Não informado')
  })

  it('permite cliente sem dados de identificação sem deixar título vazio', () => {
    const opportunity = createOpportunityFromClient(client({ name: '', tradeName: '', source: '' }), 'lead-3', '2026-11-08', '2026-11-08T12:00:00.000Z')
    expect(opportunity.title).toBe('Novo cliente sem identificação')
    expect(opportunity.stage).toBe('novo')
  })
})
