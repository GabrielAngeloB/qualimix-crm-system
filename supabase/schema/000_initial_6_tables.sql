-- ============================================================================
-- QUALIMIX CRM — esquema inicial enxuto para Supabase / PostgreSQL
-- Revisado com base na estrutura funcional do repositório hello-there.
--
-- IMPORTANTE:
-- 1) Execute uma única vez em um projeto Supabase NOVO/vazio.
-- 2) Não é uma migração para o banco antigo e não apaga dados existentes.
-- 3) O navegador usa apenas a publishable key + JWT do usuário; RLS protege
--    as tabelas. A chave secreta/service_role fica exclusivamente no servidor.
-- 4) Orçamentos só podem ser gravados pelo servidor, que deve executar
--    src/lib/quote.ts (computeQuote) e persistir o resultado recalculado.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. TABELAS — 6 NO TOTAL
-- IDs de negócio são TEXT para aceitar os IDs string já usados pelo frontend.
-- O Supabase gera UUIDs em texto quando o cliente não envia um ID.
-- --------------------------------------------------------------------------

-- 1/9 — Usuários e permissões. A identidade vem do Supabase Auth.
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  perfil text not null default 'consulta'
    check (perfil in ('administrador', 'comercial', 'operacao', 'financeiro', 'consulta')),
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- FUNÇÕES DE APOIO (criadas após existir a tabela perfis)
-- --------------------------------------------------------------------------

create or replace function public.is_active_user()
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
  );
$$;

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
      and p.perfil = any (_roles)
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- O usuário recém-criado no Supabase Auth começa inativo e como consulta.
-- Um administrador precisa ativá-lo e atribuir o perfil correto.
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
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Novo usuário'
    ),
    'consulta',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.has_role(text[]) from public, anon;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.has_role(text[]) to authenticated;


-- 2/9 — Clientes.
create table public.clientes (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  nome_fantasia text not null default '',
  documento text,
  telefone text not null default '',
  whatsapp text not null default '',
  email text not null default '',
  endereco text not null default '',
  cidade text not null default '',
  regiao text not null default '',
  tipo text not null default 'Outro',
  origem text not null default 'Outros',
  responsavel_id uuid references public.perfis(id) on delete set null,
  observacoes text not null default '',
  ativo boolean not null default true,
  is_demo boolean not null default false,
  created_by uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_documento_formato check (
    documento is null or documento ~ '^([0-9]{11}|[0-9]{14})$'
  )
);

create unique index clientes_documento_unico
  on public.clientes (documento)
  where documento is not null and documento <> '';

create index clientes_nome_idx on public.clientes (lower(nome));
create index clientes_responsavel_idx on public.clientes (responsavel_id);

-- 3/9 — Obras vinculadas a um cliente.
create table public.obras (
  id text primary key default gen_random_uuid()::text,
  cliente_id text not null references public.clientes(id) on delete restrict,
  nome text not null,
  endereco text not null default '',
  cidade text not null default '',
  regiao text not null default '',
  contato_nome text not null default '',
  contato_telefone text not null default '',
  tipo_servico text not null default '',
  observacoes_acesso text not null default '',
  restricoes text not null default '',
  ativa boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obras_id_cliente_unicos unique (id, cliente_id)
);

create index obras_cliente_idx on public.obras (cliente_id);
create index obras_nome_idx on public.obras (lower(nome));

-- 4/9 — Oportunidades. Histórico e relatórios ficam como listas JSONB,
-- acompanhando o formato que o frontend já usa, sem uma tabela extra.
create table public.oportunidades (
  id text primary key default gen_random_uuid()::text,
  titulo text not null,
  cliente_id text not null references public.clientes(id) on delete restrict,
  obra_id text,
  etapa text not null default 'novo'
    check (etapa in ('novo', 'atendimento', 'levantamento', 'elaboracao', 'enviado', 'negociacao', 'fechado', 'perdido')),
  valor_estimado numeric(14,2) check (valor_estimado is null or valor_estimado >= 0),
  responsavel_id uuid references public.perfis(id) on delete set null,
  origem text not null default 'Outros',
  entrou_em date not null default current_date,
  ultimo_contato date,
  proximo_contato date,
  proxima_acao text not null default '',
  motivo_perda text,
  historico jsonb not null default '[]'::jsonb
    check (jsonb_typeof(historico) = 'array'),
  relatorios jsonb not null default '[]'::jsonb
    check (jsonb_typeof(relatorios) = 'array'),
  is_demo boolean not null default false,
  created_by uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oportunidades_obra_do_cliente_fk
    foreign key (obra_id, cliente_id) references public.obras(id, cliente_id) on delete restrict
);

create index oportunidades_cliente_idx on public.oportunidades (cliente_id);
create index oportunidades_etapa_idx on public.oportunidades (etapa);
create index oportunidades_retorno_idx on public.oportunidades (proximo_contato)
  where etapa not in ('fechado', 'perdido');
create index oportunidades_responsavel_idx on public.oportunidades (responsavel_id);

-- 5/9 — Catálogo de produtos/serviços.
-- Os preços oficiais ficam NULL até confirmação; preço_demo é fictício.
create table public.produtos (
  id text primary key,
  codigo text not null unique,
  nome text not null,
  categoria text not null
    check (categoria in ('concreto', 'piso', 'bombeamento', 'frete', 'estadia', 'servico', 'material', 'equipamento')),
  unidade text not null
    check (unidade in ('m³', 'm²', 'un', 'h', 'km', 'viagem', 'diária')),
  descricao text not null default '',
  preco_base numeric(14,2) check (preco_base is null or preco_base >= 0),
  preco_demo numeric(14,2) check (preco_demo is null or preco_demo >= 0),
  fck smallint,
  acabamento text,
  ativo boolean not null default true,
  valido_desde date,
  observacoes_internas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index produtos_categoria_idx on public.produtos (categoria);
create index produtos_ativo_idx on public.produtos (ativo);

-- 6/9 — Orçamentos.
-- Itens, medições, adicionais e condições ficam no objeto dados_orcamento.
-- resultado_calculo é o snapshot produzido pelo computeQuote no servidor.
create sequence public.orcamento_numero_seq start with 1 increment by 1;

create table public.orcamentos (
  id text primary key default gen_random_uuid()::text,
  numero text not null default (
    'ORC-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.orcamento_numero_seq')::text, 4, '0')
  ),
  versao integer not null default 1 check (versao >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validade date not null default (current_date + 15),
  enviado_em timestamptz,
  status text not null default 'Rascunho'
    check (status in (
      'Rascunho', 'Aguardando informações', 'Aguardando aprovação',
      'Aprovado internamente', 'Enviado ao cliente', 'Em negociação',
      'Aceito', 'Recusado', 'Expirado', 'Cancelado'
    )),
  tipo text not null default 'concreto'
    check (tipo in ('concreto', 'piso', 'combinado')),
  cliente_id text not null references public.clientes(id) on delete restrict,
  obra_id text not null,
  responsavel_id uuid not null references public.perfis(id) on delete restrict,
  oportunidade_id text references public.oportunidades(id) on delete set null,
  dados_orcamento jsonb not null default '{}'::jsonb
    check (jsonb_typeof(dados_orcamento) = 'object'),
  resultado_calculo jsonb
    check (resultado_calculo is null or jsonb_typeof(resultado_calculo) = 'object'),
  total_centavos bigint check (total_centavos is null or total_centavos >= 0),
  volume_concreto numeric(14,3) not null default 0 check (volume_concreto >= 0),
  area_piso numeric(14,3) not null default 0 check (area_piso >= 0),
  fck smallint,
  pode_emitir boolean not null default false,
  precisa_aprovacao boolean not null default false,
  versao_motor_calculo text,
  calculado_em timestamptz,
  is_demo boolean not null default false,
  created_by uuid references public.perfis(id) on delete set null default auth.uid(),
  constraint orcamentos_numero_versao_unicos unique (numero, versao),
  constraint orcamentos_obra_do_cliente_fk
    foreign key (obra_id, cliente_id) references public.obras(id, cliente_id) on delete restrict
);

create index orcamentos_cliente_idx on public.orcamentos (cliente_id);
create index orcamentos_obra_idx on public.orcamentos (obra_id);
create index orcamentos_oportunidade_idx on public.orcamentos (oportunidade_id);
create index orcamentos_status_data_idx on public.orcamentos (status, created_at desc);
create index orcamentos_responsavel_idx on public.orcamentos (responsavel_id);

-- 3. DADOS INICIAIS DO CATÁLOGO
-- Preços oficiais não confirmados continuam NULL.
-- Valores de demonstração permanecem explicitamente separados.
-- --------------------------------------------------------------------------

insert into public.produtos
  (id, codigo, nome, categoria, unidade, descricao, preco_base, preco_demo, fck, acabamento, ativo)
values
  ('c-fck20', 'CON-20', 'Concreto usinado FCK 20 MPa', 'concreto', 'm³', 'Concreto usinado convencional, resistência característica de 20 MPa', null, 395.00, 20, null, true),
  ('c-fck25', 'CON-25', 'Concreto usinado FCK 25 MPa', 'concreto', 'm³', 'Concreto usinado convencional, resistência característica de 25 MPa', null, 420.00, 25, null, true),
  ('c-fck30', 'CON-30', 'Concreto usinado FCK 30 MPa', 'concreto', 'm³', 'Concreto usinado convencional, resistência característica de 30 MPa', null, 450.00, 30, null, true),
  ('p-polido', 'PIS-POL', 'Piso de concreto polido', 'piso', 'm²', 'Execução de piso com acabamento polido', null, 68.00, null, 'polido', true),
  ('p-sarraf', 'PIS-SAR', 'Piso de concreto sarrafeado', 'piso', 'm²', 'Execução de piso com acabamento sarrafeado', null, 42.00, null, 'sarrafeado', true),
  ('s-bomba', 'SRV-BOM', 'Bombeamento (item avulso)', 'bombeamento', 'un', 'Serviço de bombeamento lançado como item. Prefira a regra de bombeamento.', null, 900.00, null, null, true),
  ('s-frete', 'SRV-FRE', 'Frete (item avulso)', 'frete', 'viagem', 'Frete lançado como item. Prefira a regra de frete.', null, 180.00, null, null, true),
  ('s-estadia', 'SRV-EST', 'Estadia (item avulso)', 'estadia', 'h', 'Hora adicional de caminhão na obra', null, 220.00, null, null, true),
  ('s-lancamento', 'SRV-LAN', 'Serviço extra de lançamento', 'servico', 'h', 'Mão de obra adicional de lançamento', null, 150.00, null, null, true),
  ('m-fibra', 'MAT-FIB', 'Adição de fibra', 'material', 'm³', 'Adição de fibra ao concreto', null, 38.00, null, null, true)
on conflict (id) do nothing;

-- --------------------------------------------------------------------------
-- 4. TRIGGERS DE updated_at E CRIAÇÃO DE PERFIL NO AUTH
-- --------------------------------------------------------------------------

create trigger auth_user_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create trigger perfis_updated_at before update on public.perfis
  for each row execute function public.set_updated_at();
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.set_updated_at();
create trigger obras_updated_at before update on public.obras
  for each row execute function public.set_updated_at();
create trigger oportunidades_updated_at before update on public.oportunidades
  for each row execute function public.set_updated_at();
create trigger produtos_updated_at before update on public.produtos
  for each row execute function public.set_updated_at();
create trigger orcamentos_updated_at before update on public.orcamentos
  for each row execute function public.set_updated_at();
-- --------------------------------------------------------------------------
-- 5. RLS — ACESSO NEGADO POR PADRÃO
-- Nenhuma política para DELETE: registros são desativados/cancelados, não
-- apagados pelo frontend. A chave service_role ignora RLS e só fica no server.
-- --------------------------------------------------------------------------

alter table public.perfis enable row level security;
alter table public.clientes enable row level security;
alter table public.obras enable row level security;
alter table public.oportunidades enable row level security;
alter table public.produtos enable row level security;
alter table public.orcamentos enable row level security;



-- Perfis: cada pessoa vê o próprio perfil; pessoas ativas podem consultar
-- nomes e funções da equipe. A API não pode promover ninguém a administrador.
create policy perfis_select on public.perfis
  for select to authenticated
  using (id = (select auth.uid()) or public.is_active_user());

-- Clientes e obras: leitura para equipe ativa; escrita para admin/comercial.
create policy clientes_select on public.clientes
  for select to authenticated
  using (public.is_active_user());
create policy clientes_insert on public.clientes
  for insert to authenticated
  with check (public.has_role(array['administrador', 'comercial']));
create policy clientes_update on public.clientes
  for update to authenticated
  using (public.has_role(array['administrador', 'comercial']))
  with check (public.has_role(array['administrador', 'comercial']));

create policy obras_select on public.obras
  for select to authenticated
  using (public.is_active_user());
create policy obras_insert on public.obras
  for insert to authenticated
  with check (public.has_role(array['administrador', 'comercial']));
create policy obras_update on public.obras
  for update to authenticated
  using (public.has_role(array['administrador', 'comercial']))
  with check (public.has_role(array['administrador', 'comercial']));

-- Oportunidades: alterações restritas ao comercial/admin.
create policy oportunidades_select on public.oportunidades
  for select to authenticated
  using (public.is_active_user());
create policy oportunidades_insert on public.oportunidades
  for insert to authenticated
  with check (public.has_role(array['administrador', 'comercial']));
create policy oportunidades_update on public.oportunidades
  for update to authenticated
  using (public.has_role(array['administrador', 'comercial']))
  with check (public.has_role(array['administrador', 'comercial']));

-- Catálogo: equipe ativa lê; somente administrador altera.
create policy produtos_select on public.produtos
  for select to authenticated
  using (public.is_active_user());
create policy produtos_insert on public.produtos
  for insert to authenticated
  with check (public.has_role(array['administrador']));
create policy produtos_update on public.produtos
  for update to authenticated
  using (public.has_role(array['administrador']))
  with check (public.has_role(array['administrador']));

-- Orçamentos: leitura por usuários ativos. Escrita somente pelo servidor,
-- após autenticar o usuário, conferir perfil e recalcular com computeQuote.
create policy orcamentos_select on public.orcamentos
  for select to authenticated
  using (public.is_active_user());

-- --------------------------------------------------------------------------
-- 6. PRIVILÉGIOS DA DATA API
-- Removemos permissões de anon e liberamos somente o necessário ao JWT.
-- --------------------------------------------------------------------------

grant usage on schema public to authenticated;

revoke all on table public.perfis, public.clientes, public.obras, public.oportunidades, public.produtos, public.orcamentos from anon, authenticated;

-- Leitura do próprio perfil/equipe.
grant select on public.perfis to authenticated;

-- CRUD sem DELETE nas entidades de CRM (o RLS decide quem pode escrever).
grant select, insert, update on public.clientes, public.obras,
  public.oportunidades to authenticated;

-- Catálogo.
grant select, insert, update on public.produtos to authenticated;

-- Orçamentos são somente leitura no browser.
grant select on public.orcamentos to authenticated;


-- O servidor usa a chave secreta/service_role. Nunca a exponha em VITE_*.
grant all privileges on table public.perfis, public.clientes, public.obras, public.oportunidades, public.produtos, public.orcamentos to service_role;
grant usage, select on sequence public.orcamento_numero_seq to service_role;

-- --------------------------------------------------------------------------
-- 7. VIEWS ÚTEIS PARA TELAS E INDICADORES (3 views)
-- Todas usam security_invoker para respeitar as políticas RLS do usuário.
-- Configurações comerciais continuam em src/data/settings.ts, como no site atual;
-- persistência editável de configurações fica para quando a tela permitir edição.
-- --------------------------------------------------------------------------

create or replace view public.vw_clientes_resumo
with (security_invoker = true)
as
with obras_por_cliente as (
  select cliente_id, count(*)::integer as total_obras
  from public.obras
  where ativa = true
  group by cliente_id
), oportunidades_por_cliente as (
  select
    cliente_id,
    count(*) filter (where etapa not in ('fechado', 'perdido'))::integer as oportunidades_abertas,
    count(*)::integer as total_oportunidades
  from public.oportunidades
  group by cliente_id
), orcamentos_por_cliente as (
  select
    cliente_id,
    count(*)::integer as total_orcamentos,
    count(*) filter (where status in ('Enviado ao cliente', 'Em negociação'))::integer as orcamentos_em_aberto
  from public.orcamentos
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
left join orcamentos_por_cliente q on q.cliente_id = c.id;

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
left join public.oportunidades o on o.etapa = e.etapa
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
left join public.perfis p on p.id = q.responsavel_id;

-- Views só recebem permissões depois de terem sido criadas.
grant select on public.vw_clientes_resumo,
  public.vw_funil_resumo,
  public.vw_orcamentos_resumo to authenticated;

commit;

-- --------------------------------------------------------------------------
-- 8. PRIMEIRO ADMINISTRADOR (execute manualmente após criar o usuário Auth)
-- Substitua o UUID pelo id real exibido em Authentication > Users.
-- --------------------------------------------------------------------------
-- update public.perfis
-- set perfil = 'administrador', ativo = true
-- where id = 'UUID-DO-USUARIO-AQUI';