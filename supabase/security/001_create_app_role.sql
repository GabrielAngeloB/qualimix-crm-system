-- QUALIMIX CRM — papel PostgreSQL restrito para o servidor.
-- Execute UMA VEZ no SQL Editor do Supabase, conectado como postgres.
-- Gere uma senha aleatória forte e substitua o placeholder abaixo.
-- Não versione uma cópia que contenha a senha real.
--
-- IMPORTANTE:
-- * A aplicação usa autenticação própria no servidor (public.usuarios + cookie).
-- * DATABASE_URL fica exclusivamente no servidor (Vercel/local), nunca em VITE_*.
-- * O papel não é SUPERUSER e não recebe BYPASSRLS; as permissões são explícitas.
-- * O servidor valida o usuário e o perfil antes de executar cada operação.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'qualimix_app') then
    execute 'create role qualimix_app login password ''SUBSTITUA_POR_UMA_SENHA_ALEATORIA_FORTE''';
  else
    execute 'alter role qualimix_app login password ''SUBSTITUA_POR_UMA_SENHA_ALEATORIA_FORTE''';
  end if;
end
$;

-- A role técnica não deve herdar privilégios de outros papéis.
alter role qualimix_app noinherit;

-- CREATE ROLE usa os padrões seguros do PostgreSQL: sem superuser,
-- sem criar bancos/papéis e sem BYPASSRLS.
grant connect on database postgres to qualimix_app;
grant usage on schema public to qualimix_app;

-- Autenticação customizada e administração de contas.
grant select, insert on public.perfis to qualimix_app;
grant update (ativo) on public.perfis to qualimix_app;
grant select, insert on public.usuarios to qualimix_app;
grant update (session_version) on public.usuarios to qualimix_app;
grant select, insert, update, delete on public.login_tentativas to qualimix_app;

-- CRM comercial.
grant select, insert, update on public.clientes, public.obras, public.oportunidades to qualimix_app;
grant select on public.produtos to qualimix_app;
grant select, insert on public.orcamentos to qualimix_app;

-- Frota existente (consultada no painel, sem CRUD exposto nesta branch).
grant select on public.veiculos, public.motoristas, public.frota_registros to qualimix_app;

-- Operação: os endpoints server-side validam o papel antes de gravar.
grant select, insert, update on public.pedidos to qualimix_app;
grant select, insert, update on public.profissionais to qualimix_app;
grant select, insert on public.despesas to qualimix_app;
grant select, insert, update on public.lancamentos_financeiros to qualimix_app;
grant select, insert on public.pagamentos_financeiros to qualimix_app;
grant select, insert, update on public.agenda_eventos to qualimix_app;
grant select, insert, update on public.tarefas_comerciais to qualimix_app;

-- Views invoker: o papel precisa de SELECT nas tabelas-base acima.
grant select on public.vw_clientes_resumo,
  public.vw_funil_resumo,
  public.vw_orcamentos_resumo,
  public.vw_frota_resumo,
  public.vw_financeiro_resumo,
  public.vw_pedidos_resumo,
  public.vw_profissionais_resumo,
  public.vw_agenda_resumo,
  public.vw_tarefas_resumo to qualimix_app;

grant usage, select on sequence public.orcamento_numero_seq,
  public.pedido_numero_seq to qualimix_app;

-- Os triggers updated_at precisam executar esta função durante UPDATE.
grant execute on function public.set_updated_at() to qualimix_app;
grant execute on function public.validar_baixa_financeira(),
  public.atualizar_status_lancamento() to qualimix_app;

-- A autenticação da aplicação é própria: a autorização de cada pessoa ocorre
-- nas Server Functions, antes do SQL. O papel técnico não é usado pelo browser.
-- As policies abaixo dão ao papel apenas a visibilidade necessária ao servidor;
-- GRANT continua limitando quais comandos/colunas ele pode executar.
do $$
declare tab text;
begin
  foreach tab in array array[
    'perfis','usuarios','login_tentativas',
    'clientes','obras','oportunidades','produtos','orcamentos',
    'veiculos','motoristas','frota_registros',
    'pedidos','profissionais','despesas','lancamentos_financeiros',
    'pagamentos_financeiros','agenda_eventos','tarefas_comerciais'
  ] loop
    execute format('drop policy if exists qualimix_app_access on public.%I', tab);
    execute format(
      'create policy qualimix_app_access on public.%I for all to qualimix_app using (true) with check (true)',
      tab
    );
  end loop;
end
$$;

commit;

-- Verifique os atributos e confirme que o papel não é privilegiado.
select rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolcanlogin
from pg_roles
where rolname = 'qualimix_app';

-- Resultado esperado:
-- rolsuper=false, rolcreatedb=false, rolcreaterole=false,
-- rolbypassrls=false e rolcanlogin=true.
