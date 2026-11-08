# Qualimix CRM — PostgreSQL e autenticação

## Arquitetura

- O navegador nunca recebe DATABASE_URL.
- Todas as consultas e gravações passam por Server Functions do TanStack Start.
- PostgreSQL é acessado pelo driver postgres, com consultas parametrizadas.
- O login próprio usa Scrypt (salt aleatório por senha) e cookie assinado HttpOnly, SameSite=Strict e Secure em produção.
- public.usuarios guarda username, hash da senha e versão da sessão. public.perfis mantém nome, papel e estado e continua sendo referenciada pelas tabelas comerciais.
- VITE_SUPABASE_PUBLISHABLE_KEY não autentica este login. A persistência e autenticação atuais usam DATABASE_URL apenas no servidor.

## Aplicação no banco — ordem obrigatória

Faça backup antes de qualquer alteração.

1. **Confira o esquema:** o SQL base está versionado em `supabase/schema/000_initial_9_tables.sql`. Execute-o somente em um projeto Supabase vazio. Se as nove tabelas e quatro views já existem no banco de produção, pule esta etapa. Não rode o SQL base novamente em produção.
2. **Autenticação:** execute `supabase/migrations/20261108000200_custom_server_auth.sql` no SQL Editor. O resultado deve mostrar `fks_restantes_para_auth_users = 0` e as tabelas `usuarios` e `login_tentativas`.
3. **Views sem demonstração:** execute `supabase/migrations/20261108000300_filter_demo_rows_from_views.sql`. Ela atualiza as quatro views para excluir linhas com `is_demo=true`, sem apagar dados.
4. **Credencial restrita:** gere uma senha aleatória forte, substitua o placeholder em `supabase/security/001_create_app_role.sql` e execute esse script como `postgres`. Ele cria `qualimix_app` sem privilégios de superusuário, concede somente os acessos usados pelo CRM e cria as políticas RLS para essa conexão técnica.
5. **Atualize DATABASE_URL:** use a conexão PostgreSQL do usuário `qualimix_app`, não a conta `postgres`. Mantenha o mesmo nome da variável. Codifique caracteres especiais da senha em formato URL. Para hospedagens sem acesso IPv6 à conexão direta, use o Session Pooler do Supabase.
6. **Verifique:** o script da credencial deve retornar `rolsuper=false`, `rolcreatedb=false`, `rolcreaterole=false`, `rolbypassrls=false` e `rolcanlogin=true`.

A migration de autenticação preserva os registros de clientes, obras, oportunidades, orçamentos e os UUIDs de `perfis`. Ela remove somente o vínculo de `perfis` com `auth.users` e o trigger que criava perfis pelo Auth. Senhas do Supabase Auth não podem ser extraídas nem convertidas; as contas antigas precisam receber novas credenciais pelo bootstrap ou pela tela de administração.

**Importante sobre RLS:** como o login é próprio e as consultas usam uma conexão PostgreSQL do servidor, as políticas RLS não recebem o JWT do usuário final. A política `qualimix_app` autoriza a conexão técnica restrita; a autorização de cada pessoa é verificada pelas Server Functions antes de cada operação. Nunca exponha `DATABASE_URL` ao browser.

## Variáveis

Configure no servidor local e na Vercel:
- DATABASE_URL: URL PostgreSQL do projeto Supabase. Use o host/porta recomendados pelo Supabase para a hospedagem; se a conexão direta não for acessível, use a URL do Session Pooler.
- VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY podem permanecer no .env porque já fazem parte da configuração do projeto, mas este branch de autenticação/persistência não as utiliza. Elas não substituem nem devem conter DATABASE_URL.

Não coloque a senha do banco no Git, em variável VITE_ ou no navegador. A senha PostgreSQL antiga foi exposta durante a configuração: redefina a senha do usuário postgres, use uma senha nova para qualimix_app e atualize .env e a variável de produção antes de habilitar o acesso externo.

## Primeiro administrador

O token de bootstrap é derivado do valor completo da DATABASE_URL. Gere-o somente depois de configurar a URL final do usuário qualimix_app (incluindo senha e host/pooler definitivos), no terminal da pasta do projeto:

```powershell
node --env-file=.env -e "const c=require('node:crypto'); console.log(c.createHmac('sha256',process.env.DATABASE_URL).update('qualimix-crm/first-admin/v1').digest('hex'))"
```

Abra /bootstrap, informe nome, usuário, senha de pelo menos 12 caracteres e o token gerado. O endpoint serializa a inicialização no PostgreSQL e só permite criar o administrador se ainda não existir um administrador com senha. Sem conhecer DATABASE_URL não é possível derivar o token.

## Usuários

O administrador entra em Administração > Usuários e cria as contas comuns. O servidor gera o hash Scrypt, nunca armazena senha em texto puro, valida o papel no servidor e revoga sessões ao desativar usuário. A ação de desativar revoga todas as sessões e preserva os vínculos históricos.

## Lead de teste

Depois de aplicar a migration e criar o primeiro administrador, execute o arquivo `supabase/examples/test_lead.sql` no SQL Editor do Supabase. Ele cria um cliente e um lead com marcador `[TESTE CRM]`, sem sobrescrever registros existentes. O lead entra como `is_demo=false` e deve aparecer em Clientes, Funil e na view `vw_funil_resumo` após atualizar o site.

## Dados e views

As telas comerciais carregam registros reais de clientes, obras, oportunidades e orçamentos. As views vw_clientes_resumo, vw_funil_resumo, vw_orcamentos_resumo e vw_frota_resumo são disponibilizadas para consulta no servidor. Módulos que o projeto ainda marca como “Em breve” (pedidos, agenda e contas a receber) não são apresentados como persistidos.

O catálogo e as regras comerciais oficiais ainda dependem dos valores confirmados pela Qualimix. Preços de demonstração não são usados em produção nem transformados em preços reais automaticamente.

## Verificações pendentes

Após configurar DATABASE_URL e executar a migration, rode pnpm install, pnpm typecheck, pnpm test e pnpm build. Teste login, logout, bloqueio de tentativas, criação/desativação de usuários, cadastro de cliente/obra, funil e gravação/leitura de orçamento em homologação antes de publicar.
