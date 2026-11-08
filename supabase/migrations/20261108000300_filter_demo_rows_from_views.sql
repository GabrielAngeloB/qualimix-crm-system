-- Qualimix CRM — garantir que as views de produção não contem dados de demonstração.
-- Execute depois do esquema base e pode ser aplicada também em bancos já existentes.
-- Não altera nem apaga registros; apenas filtra is_demo=true das views.

begin;

create or replace view public.vw_clientes_resumo
with (security_invoker = true)
as
with obras_por_cliente as (
  select cliente_id, count(*)::integer as total_obras
  from public.obras
  where ativa = true and is_demo = false
  group by cliente_id
), oportunidades_por_cliente as (
  select
    cliente_id,
    count(*) filter (where etapa not in ('fechado', 'perdido'))::integer as oportunidades_abertas,
    count(*)::integer as total_oportunidades
  from public.oportunidades
  where is_demo = false
  group by cliente_id
), orcamentos_por_cliente as (
  select
    cliente_id,
    count(*)::integer as total_orcamentos,
    count(*) filter (where status in ('Enviado ao cliente', 'Em negociação'))::integer as orcamentos_em_aberto
  from public.orcamentos
  where is_demo = false
  group by cliente_id
)
select
  c.id,
  c.nome,
  c.nome_fantasia,
  c.documento,
  c.telefone,
  c.whatsapp,
  c.email,
  c.cidade,
  c.regiao,
  c.tipo,
  c.origem,
  c.ativo,
  c.created_at,
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
  on o.etapa = e.etapa and o.is_demo = false
group by e.ordem, e.etapa, e.nome
order by e.ordem;

create or replace view public.vw_orcamentos_resumo
with (security_invoker = true)
as
select
  q.id,
  q.numero,
  q.versao,
  q.created_at,
  q.validade,
  q.enviado_em,
  q.status,
  q.tipo,
  q.cliente_id,
  c.nome as cliente_nome,
  q.obra_id,
  o.nome as obra_nome,
  q.responsavel_id,
  p.nome as responsavel_nome,
  q.oportunidade_id,
  q.total_centavos,
  q.volume_concreto,
  q.area_piso,
  q.fck,
  q.pode_emitir,
  q.precisa_aprovacao,
  q.is_demo
from public.orcamentos q
join public.clientes c on c.id = q.cliente_id
join public.obras o on o.id = q.obra_id
left join public.perfis p on p.id = q.responsavel_id
where q.is_demo = false
  and c.is_demo = false
  and o.is_demo = false;

create or replace view public.vw_frota_resumo
with (security_invoker = true)
as
select
  v.id,
  v.placa,
  v.tipo,
  v.modelo,
  v.capacidade_m3,
  v.hodometro_km,
  v.proxima_manutencao_km,
  v.status,
  v.crlv_vence_em,
  v.seguro_vence_em,
  v.ativo,
  count(r.id) filter (where r.tipo = 'viagem')::integer as total_viagens,
  max(r.data_referencia) filter (where r.tipo = 'abastecimento') as ultimo_abastecimento,
  max(r.data_referencia) filter (where r.tipo = 'manutencao') as ultima_manutencao
from public.veiculos v
left join public.frota_registros r
  on r.veiculo_id = v.id and r.is_demo = false
where v.is_demo = false
group by v.id;

commit;
