
begin;

-- Descarta a view da frota e recria a view da agenda sem o campo de caminhão.
drop view if exists public.vw_frota_resumo;
drop view if exists public.vw_agenda_resumo;

-- Remove a trava temporária que dependia de caminhões.
drop index if exists public.agenda_caminhao_horario_unico;

-- A agenda continua vinculada a pedido, orçamento, cliente e obra.
alter table public.agenda_eventos drop column if exists caminhao;

create view public.vw_agenda_resumo
with (security_invoker = true)
as
select
  a.id, a.pedido_id, a.orcamento_id, a.cliente_id, a.obra_id,
  a.data, a.hora, a.servico, a.volume_m3, a.fck, a.bomba,
  a.status, a.observacoes, a.created_at, a.updated_at,
  p.numero as pedido_numero, c.nome as cliente_nome, o.nome as obra_nome,
  q.numero as orcamento_numero
from public.agenda_eventos a
join public.pedidos p on p.id = a.pedido_id
join public.clientes c on c.id = a.cliente_id
join public.obras o on o.id = a.obra_id and o.cliente_id = a.cliente_id
join public.orcamentos q on q.id = a.orcamento_id
where a.is_demo = false;

-- Não há chaves estrangeiras externas apontando para estas tabelas.
-- A tabela de registros é removida antes das tabelas referenciadas.
drop table if exists public.frota_registros;
drop table if exists public.motoristas;
drop table if exists public.veiculos;

commit;
