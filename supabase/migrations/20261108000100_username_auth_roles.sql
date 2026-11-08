-- Qualimix CRM: username + ADMIN/USER usando Supabase Auth.
-- Execute após o SQL base de 9 tabelas. Senhas continuam exclusivamente no Auth.
begin;

alter table public.perfis
  add column if not exists username text,
  add column if not exists bootstrap_claim boolean not null default false;

create unique index if not exists perfis_bootstrap_claim_unico
  on public.perfis (bootstrap_claim) where bootstrap_claim = true;

-- Migra os perfis antigos para os dois papéis solicitados.
update public.perfis
set perfil = case when perfil = 'administrador' then 'admin' else 'user' end;

alter table public.perfis
  alter column perfil set default 'user';

do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.perfis'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%perfil%'
  loop
    execute format('alter table public.perfis drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.perfis
  add constraint perfis_perfil_check check (perfil in ('admin', 'user'));

alter table public.perfis
  add constraint perfis_username_formato
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');

create unique index if not exists perfis_username_unico
  on public.perfis (lower(username))
  where username is not null;

-- O Auth cria o perfil inativo; a inicialização/admin o ativa explicitamente.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, perfil, ativo)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      'Novo usuário'
    ),
    'user',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Compatibilidade com as políticas já presentes no SQL base:
-- 'administrador' significa admin; os perfis antigos de equipe significam user.
create or replace function public.has_role(_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.id = (select auth.uid())
      and p.ativo = true
      and (
        (p.perfil = 'admin' and 'administrador' = any (_roles))
        or
        (p.perfil = 'user' and _roles && array['comercial','operacao','financeiro','consulta','user']::text[])
      )
  );
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.has_role(text[]) from public, anon;
grant execute on function public.has_role(text[]) to authenticated;

commit;
