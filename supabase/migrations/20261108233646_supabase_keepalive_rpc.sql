-- Health-check sem leitura ou alteração de dados comerciais.
-- Aplicada diretamente no projeto Supabase em 08/11/2026.
create or replace function public.keepalive()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'checked_at', pg_catalog.now()
  );
$function$;

comment on function public.keepalive() is
  'Health-check leve para atividade periódica do Supabase; não lê nem altera dados comerciais.';

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon;
