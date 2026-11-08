-- QUALIMIX CRM — usuário PostgreSQL restrito para o servidor web.
-- Execute como postgres DEPOIS do esquema base e da migration custom auth.
-- Antes de executar, gere uma senha aleatória longa e substitua o único placeholder.
-- Depois use qualimix_app (e essa senha) na variável DATABASE_URL da aplicação.
-- Este usuário não é superuser e não pode criar bancos, papéis ou tabelas.

begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'qualimix_app') then
    create role qualimix_app;
  end if;
end $$;

alter role qualimix_app
  with login
  password 'SUBSTITUA_POR_UMA_SENHA_ALEATORIA_FORTE'
  nosuperuser
  nocreatedb
  nocreaterole
  noinherit
  nobypassrls;

grant connect on database postgres to qualimix_app;
grant usage on schema public to qualimix_app;

-- Dados comerciais usados pelas telas existentes.
grant select, insert, update on public.perfis to qualimix_app;
grant select, insert, update on public.usuarios to qualimix_app;
grant select, insert, update, delete on public.login_tentativas to qualimix_app;

grant select, insert, update on public.clientes to qualimix_app;
grant select, insert, update on public.obras to qualimix_app;
grant select, insert, update on public.oportunidades to qualimix_app;
grant select on public.produtos to qualimix_app;
grant select, insert on public.orcamentos to qualimix_app;

-- Views e dependências necessárias para executá-las como invoker.
grant select on public.veiculos to qualimix_app;
grant select on public.motoristas to qualimix_app;
grant select on public.frota_registros to qualimix_app;

grant select on public.vw_clientes_resumo to qualimix_app;
grant select on public.vw_funil_resumo to qualimix_app;
grant select on public.vw_orcamentos_resumo to qualimix_app;
grant select on public.vw_frota_resumo to qualimix_app;

grant usage, select on sequence public.orcamento_numero_seq to qualimix_app;

-- A autenticação da aplicação é própria e validada no servidor.
-- A conexão técnica só recebe as permissões acima e políticas necessárias
-- para os endpoints server-side; ela nunca é disponibilizada ao navegador.
drop policy if exists qualimix_app_access on public.perfis;
create policy qualimix_app_access on public.perfis
  for all to qualimix_app using (true) with check (true);

drop policy if exists qualimix_app_access on public.usuarios;
create policy qualimix_app_access on public.usuarios
  for all to qualimix_app using (true) with check (true);

drop policy if exists qualimix_app_access on public.login_tentativas;
create policy qualimix_app_access on public.login_tentativas
  for all to qualimix_app using (true) with check (true);

drop policy if exists qualimix_app_access on public.clientes;
create policy qualimix_app_access on public.clientes
  for all to qualimix_app using (true) with check (true);

drop policy if exists qualimix_app_access on public.obras;
create policy qualimix_app_access on public.obras
  for all to qualimix_app using (true) with check (true);

drop policy if exists qualimix_app_access on public.oportunidades;
create policy qualimix_app_access on public.oportunidades
  for all to qualimix_app using (true) with check (true);

drop policy if exists qualimix_app_access on public.produtos;
create policy qualimix_app_access on public.produtos
  for select to qualimix_app using (true);

drop policy if exists qualimix_app_access on public.orcamentos;
create policy qualimix_app_access on public.orcamentos
  for select to qualimix_app using (true);

drop policy if exists qualimix_app_insert on public.orcamentos;
create policy qualimix_app_insert on public.orcamentos
  for insert to qualimix_app with check (true);

drop policy if exists qualimix_app_access on public.veiculos;
create policy qualimix_app_access on public.veiculos
  for select to qualimix_app using (true);

drop policy if exists qualimix_app_access on public.motoristas;
create policy qualimix_app_access on public.motoristas
  for select to qualimix_app using (true);

drop policy if exists qualimix_app_access on public.frota_registros;
create policy qualimix_app_access on public.frota_registros
  for select to qualimix_app using (true);

commit;

-- Verifique o tipo de papel antes de substituir DATABASE_URL.
select
  rolname,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolbypassrls,
  rolcanlogin
from pg_roles
where rolname = 'qualimix_app';
