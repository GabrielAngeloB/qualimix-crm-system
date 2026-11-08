-- Índices parciais para as consultas mais frequentes do CRM.
-- Não alteram registros; aceleram listagens de dados reais por data de criação.
-- Execute uma única vez no SQL Editor do Supabase.

begin;

create index if not exists clientes_recentes_idx
  on public.clientes (created_at desc, id desc)
  where is_demo = false;

create index if not exists obras_recentes_idx
  on public.obras (created_at desc, id desc)
  where is_demo = false and ativa = true;

create index if not exists oportunidades_recentes_idx
  on public.oportunidades (created_at desc, id desc)
  where is_demo = false;

create index if not exists orcamentos_recentes_idx
  on public.orcamentos (created_at desc, id desc)
  where is_demo = false;

commit;

analyze public.clientes;
analyze public.obras;
analyze public.oportunidades;
analyze public.orcamentos;
