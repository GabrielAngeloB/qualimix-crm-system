-- Mantém o total histórico de oportunidades, mas não conta oportunidades arquivadas como abertas.

create or replace view public.vw_clientes_resumo
with (security_invoker = true)
as
with obras_por_cliente as (
  select obras.cliente_id, count(*)::integer as total_obras
  from public.obras
  where obras.ativa = true and obras.is_demo = false
  group by obras.cliente_id
),
oportunidades_por_cliente as (
  select
    oportunidades.cliente_id,
    count(*) filter (
      where oportunidades.etapa not in ('fechado', 'perdido')
        and oportunidades.arquivada = false
    )::integer as oportunidades_abertas,
    count(*)::integer as total_oportunidades
  from public.oportunidades
  where oportunidades.is_demo = false
  group by oportunidades.cliente_id
),
orcamentos_por_cliente as (
  select
    orcamentos.cliente_id,
    count(*)::integer as total_orcamentos,
    count(*) filter (
      where orcamentos.status = any (array['Enviado ao cliente', 'Em negociação'])
    )::integer as orcamentos_em_aberto
  from public.orcamentos
  where orcamentos.is_demo = false
  group by orcamentos.cliente_id
)
select
  c.id, c.nome, c.nome_fantasia, c.documento, c.telefone, c.whatsapp, c.email,
  c.cidade, c.regiao, c.tipo, c.origem, c.ativo, c.created_at,
  coalesce(o.total_obras, 0) as total_obras,
  coalesce(op.total_oportunidades, 0) as total_oportunidades,
  coalesce(op.oportunidades_abertas, 0) as oportunidades_abertas,
  coalesce(q.total_orcamentos, 0) as total_orcamentos,
  coalesce(q.orcamentos_em_aberto, 0) as orcamentos_em_aberto
from public.clientes c
left join obras_por_cliente o on o.cliente_id = c.id
left join oportunidades_por_cliente op on op.cliente_id = c.id
left join orcamentos_por_cliente q on q.cliente_id = c.id
where c.is_demo = false;
