-- QUALIMIX CRM — índices para ordenação cronológica
-- Seguro para executar em banco já existente; não altera nem remove registros.

CREATE INDEX IF NOT EXISTS oportunidades_created_at_desc_idx
  ON public.oportunidades (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS clientes_created_at_desc_idx
  ON public.clientes (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS obras_created_at_desc_idx
  ON public.obras (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS orcamentos_created_at_desc_idx
  ON public.orcamentos (created_at DESC, id DESC);
