import type { Client, Opportunity } from '../data/fixtures'

/** Cria o lead inicial do funil a partir do cadastro de um cliente. */
export function createOpportunityFromClient(
  client: Client,
  id: string,
  enteredAt: string,
  createdAt = new Date().toISOString(),
): Opportunity {
  const title = client.name.trim() || client.tradeName.trim() || 'Novo cliente sem identificação'

  return {
    id,
    title,
    clientId: client.id,
    siteId: null,
    stage: 'novo',
    estimatedValue: null,
    ownerId: client.ownerId,
    source: client.source.trim() || 'Não informado',
    createdAt,
    enteredAt,
    lastContact: null,
    nextContact: null,
    nextAction: 'Realizar primeiro contato',
    lossReason: null,
    quoteId: null,
    history: [{
      at: createdAt,
      by: client.ownerId,
      text: 'Lead criado automaticamente a partir do cadastro do cliente.',
    }],
    demo: false,
  }
}
