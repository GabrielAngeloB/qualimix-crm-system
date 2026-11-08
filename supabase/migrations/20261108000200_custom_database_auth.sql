-- Qualimix CRM — autenticação própria com PostgreSQL.
-- Migração aditiva: preserva clientes, obras, oportunidades, orçamentos e frota.
-- Execute depois do esquema base de 9 tabelas. Não armazena senhas em texto puro.

begin;

-- A aplicação deixa de depender de auth.users. Os UUIDs em perfis são mantidos,
-- pois clientes, oportunidades, orçamentos e frota já apontam para essa tabela.
do $$
declare fk record;
begin
  for fk in
    select conname
      from pg_constraint
     where conrelid = 'public.perfis'::regclass
       and contype = 'f'
       and confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.perfis drop constraint %I', fk.conname);
  end loop;
end $$;

-- Normaliza papéis antigos sem alterar a identidade nem os registros vinculados.
do $$
declare chk record;
begin
  for chk in
    select conname
      from pg_constraint
     where conrelid = 'public.perfis'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%perfil%'
  loop
    execute format('alter table public.perfis drop constraint %I', chk.conname);
  end loop;
end $$;

update public.perfis
   set perfil = case
     when perfil in ('admin', 'administrador') then 'admin'
     else 'user'
   end;

alter table public.perfis alter column perfil set default 'user';
alter table public.perfis
  add constraint perfis_perfil_check check (perfil in ('admin', 'user'));

-- Credenciais próprias do CRM. A mesma chave UUID liga a conta ao perfil
-- comercial já referenciado pelas tabelas existentes.
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
  on public.usuarios (username);

create index if not exists usuarios_updated_at_idx
  on public.usuarios (updated_at desc);

-- Bloqueio persistente de tentativas por usuário e IP anonimizado com HMAC.
create table if not exists public.login_tentativas (
  username text not null,
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  falhas integer not null default 0 check (falhas >= 0),
  bloqueado_ate timestamptz,
  updated_at timestamptz not null default now(),
  primary key (username, ip_hash)
);

create index if not exists login_tentativas_updated_at_idx
  on public.login_tentativas (updated_at);

-- Essas tabelas nunca devem ser expostas pela Data API.
alter table public.usuarios enable row level security;
alter table public.login_tentativas enable row level security;
revoke all on public.usuarios, public.login_tentativas from anon, authenticated;

commit;
