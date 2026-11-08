-- Qualimix CRM — autenticação própria no servidor com Scrypt.
-- Execute APÓS o SQL base qualimix_supabase_revisado_9_tabelas.sql.
-- Não remove registros de clientes, obras, oportunidades ou orçamentos.

begin;

-- O perfil deixa de depender de auth.users. Os IDs antigos são preservados;
-- usuários antigos precisarão ser recriados pelo novo bootstrap/admin.
do $$
declare item record;
begin
  for item in
    select conname
      from pg_constraint
     where conrelid = 'public.perfis'::regclass
       and contype = 'f'
       and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.perfis drop constraint %I', item.conname);
  end loop;
end $$;

drop trigger if exists auth_user_create_profile on auth.users;

-- Tabela de credenciais separada do perfil operacional.
-- A senha fica armazenada exclusivamente como hash Scrypt com salt individual.
create table if not exists public.usuarios (
  id uuid primary key references public.perfis(id) on delete cascade,
  username text not null,
  senha_hash text not null,
  session_version integer not null default 0 check (session_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_username_formato
    check (username = lower(username) and username ~ '^[a-z0-9][a-z0-9._-]{2,29}$')
);

create unique index if not exists usuarios_username_unico
  on public.usuarios (lower(username));

-- Bloqueio persistente de tentativas por usuário + IP.
create table if not exists public.login_tentativas (
  username text not null,
  ip_hash text not null,
  falhas integer not null default 0 check (falhas >= 0),
  bloqueado_ate timestamptz,
  updated_at timestamptz not null default now(),
  primary key (username, ip_hash)
);
create index if not exists login_tentativas_updated_idx
  on public.login_tentativas (updated_at);

drop trigger if exists usuarios_updated_at on public.usuarios;
create trigger usuarios_updated_at
  before update on public.usuarios
  for each row execute function public.set_updated_at();

alter table public.usuarios enable row level security;
alter table public.login_tentativas enable row level security;
revoke all on table public.usuarios from public, anon, authenticated;
revoke all on table public.login_tentativas from public, anon, authenticated;

commit;

select
  to_regclass('public.usuarios') as tabela_usuarios,
  to_regclass('public.login_tentativas') as tabela_rate_limit,
  (select count(*) from pg_constraint
    where conrelid = 'public.perfis'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass) as fks_restantes_para_auth_users;
