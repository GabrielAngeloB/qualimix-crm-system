# Qualimix CRM — PostgreSQL e autenticação

## Arquitetura

- O navegador nunca recebe DATABASE_URL.
- Todas as consultas e gravações passam por Server Functions do TanStack Start.
- PostgreSQL é acessado pelo driver postgres, com consultas parametrizadas.
- O login próprio usa Scrypt (salt aleatório por senha) e cookie assinado HttpOnly, SameSite=Strict e Secure em produção.
- public.usuarios guarda username, hash da senha e versão da sessão. public.perfis mantém nome, papel e estado e continua sendo referenciada pelas tabelas comerciais.
- VITE_SUPABASE_PUBLISHABLE_KEY não autentica este login. A persistência e autenticação atuais usam DATABASE_URL apenas no servidor.

## Aplicação no banco

1. Faça backup do banco.
2. Confirme que o esquema de 9 tabelas já existe. Não execute o SQL inicial em cima de uma base com dados.
3. Execute supabase/migrations/20261108000200_custom_server_auth.sql no SQL Editor do Supabase.
4. Confirme no resultado que fks_restantes_para_auth_users é zero e que usuarios e login_tentativas existem.

A migration não apaga clientes, obras, oportunidades nem orçamentos. Ela remove somente o vínculo de perfis com auth.users e o trigger que criava perfis pelo Auth. Contas antigas não migram senha: será necessário criar novo usuário pelo bootstrap ou pela tela de administração.

## Variáveis

Configure no servidor local e na Vercel:
- DATABASE_URL: URL PostgreSQL do projeto Supabase. Use o host/porta recomendados pelo Supabase para a hospedagem; se a conexão direta não for acessível, use a URL do Session Pooler.
- VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY podem continuar no .env se outras partes do frontend precisarem delas; a autenticação e persistência descritas aqui não dependem delas.

Não coloque a senha do banco no Git, em variável VITE_ ou no navegador. A senha de conexão foi exposta durante a configuração: redefina-a no Supabase e atualize .env e a variável de produção antes de habilitar o acesso externo.

## Primeiro administrador

O token de bootstrap é derivado da credencial de banco atual. Depois de rotacionar a senha, gere o token no terminal na pasta do projeto:

```powershell
node --env-file=.env -e "const c=require('node:crypto'); console.log(c.createHmac('sha256',process.env.DATABASE_URL).update('qualimix-crm/first-admin/v1').digest('hex'))"
```

Abra /bootstrap, informe nome, usuário, senha de pelo menos 12 caracteres e o token gerado. O endpoint serializa a inicialização no PostgreSQL e só permite criar o administrador se ainda não existir um administrador com senha. Sem conhecer DATABASE_URL não é possível derivar o token.

## Usuários

O administrador entra em Administração > Usuários e cria as contas comuns. O servidor gera o hash Scrypt, nunca armazena senha em texto puro, valida o papel no servidor e revoga sessões ao desativar usuário. A ação Excluir é lógica (desativa a conta) para preservar vínculos históricos.

## Dados e views

As telas comerciais carregam registros reais de clientes, obras, oportunidades e orçamentos. As views vw_clientes_resumo, vw_funil_resumo, vw_orcamentos_resumo e vw_frota_resumo são disponibilizadas para consulta no servidor. Módulos que o projeto ainda marca como “Em breve” (pedidos, agenda e contas a receber) não são apresentados como persistidos.

O catálogo e as regras comerciais oficiais ainda dependem dos valores confirmados pela Qualimix. Preços de demonstração não são usados em produção nem transformados em preços reais automaticamente.

## Verificações pendentes

Após configurar DATABASE_URL e executar a migration, rode pnpm install, pnpm typecheck, pnpm test e pnpm build. Teste login, logout, bloqueio de tentativas, criação/desativação de usuários, cadastro de cliente/obra, funil e gravação/leitura de orçamento em homologação antes de publicar.
