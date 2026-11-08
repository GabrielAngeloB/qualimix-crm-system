-- Qualimix CRM — autenticação própria com PostgreSQL.
-- Migração aditiva. NÃO reaplica o SQL base e NÃO apaga dados comerciais.
-- Senhas são scrypt com salt aleatório e nunca são gravadas em texto puro.

begin;

-- A autenticação do app passa a ser independente do Supabase Auth.
-- Mantemos os UUIDs de perfis porque clientes/orçamentos já os referenciam.
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

-- O app usa só dois papéis. Convertemos os perfis anteriores sem mexer
-- nas relações de clientes, oportunidades, orçamentos ou frota.
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

alter table public.perfis
  alter column perfil set default 'user';

alter table public.perfis
  add constraint perfis_perfil_check check (perfil in ('admin', 'user'));

-- Conta e hash de senha. O UUID corresponde ao mesmo UUID da tabela perfis.
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

-- Limite persistente de tentativas: funciona entre instâncias/serverless.
-- A chave é SHA-256(IP + username), portanto o IP não fica salvo em claro.
create table if not exists public.login_tentativas (
  chave text primary key check (chave ~ '^[a-f0-9]{64}$'),
  tentativas integer not null default 0 check (tentativas >= 0),
  bloqueado_ate timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists login_tentativas_updated_at_idx
  on public.login_tentativas (updated_at);

-- Hashes e tentativas nunca devem ser acessíveis pela Data API pública.
alter table public.usuarios enable row level security;
alter table public.login_tentativas enable row level security;

revoke all on public.usuarios, public.login_tentativas from anon, authenticated;

commit;
