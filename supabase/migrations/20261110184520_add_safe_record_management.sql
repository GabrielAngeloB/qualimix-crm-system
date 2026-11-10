-- Gestão segura de registros: arquivamento de oportunidades e cancelamento auditável de pedidos.
-- Não remove registros nem altera vínculos históricos.

begin;

alter table public.oportunidades
  add column if not exists arquivada boolean not null default false,
  add column if not exists arquivada_em timestamptz,
  add column if not exists arquivada_por uuid references public.perfis(id) on delete set null;

create index if not exists oportunidades_ativas_etapa_idx
  on public.oportunidades (etapa, created_at desc)
  where is_demo = false and arquivada = false;

alter table public.pedidos
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por uuid references public.perfis(id) on delete set null,
  add column if not exists motivo_cancelamento text;

-- Mantém a visão do funil coerente com a lista padrão (somente oportunidades ativas).
create or replace view public.vw_funil_resumo
with (security_invoker = true)
as
select
  e.ordem,
  e.etapa,
  e.nome,
  count(o.id)::integer as quantidade,
  coalesce(sum(o.valor_estimado), 0)::numeric(14,2) as valor_estimado,
  count(o.id) filter (
    where o.proximo_contato < current_date
      and o.etapa not in ('fechado', 'perdido')
  )::integer as retornos_atrasados
from (values
  (1, 'novo', 'Novo lead'),
  (2, 'atendimento', 'Em atendimento'),
  (3, 'levantamento', 'Levantamento de informações'),
  (4, 'elaboracao', 'Orçamento em elaboração'),
  (5, 'enviado', 'Orçamento enviado'),
  (6, 'negociacao', 'Em negociação'),
  (7, 'fechado', 'Fechado'),
  (8, 'perdido', 'Perdido')
) as e(ordem, etapa, nome)
left join public.oportunidades o
  on o.etapa = e.etapa
 and o.is_demo = false
 and o.arquivada = false
group by e.ordem, e.etapa, e.nome
order by e.ordem;

commit;
