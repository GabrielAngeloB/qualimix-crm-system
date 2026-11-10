-- Índices parciais para as novas FKs de autoria de arquivamento/cancelamento.
create index if not exists oportunidades_arquivada_por_idx
  on public.oportunidades (arquivada_por)
  where arquivada_por is not null;

create index if not exists pedidos_cancelado_por_idx
  on public.pedidos (cancelado_por)
  where cancelado_por is not null;
