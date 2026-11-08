# Qualimix CRM — banco de dados e autenticação

## Estado da implementação

Este repositório nasceu sem banco ou autenticação. O projeto usa TanStack Start, React 19 e TypeScript. A integração usa Supabase Auth + PostgreSQL e mantém o motor de cálculo `src/lib/quote.ts` como fonte da regra comercial.

## Arquitetura de autenticação

- O Supabase Auth armazena e verifica as senhas. A aplicação não cria tabela de senha nem armazena hash próprio.
- O usuário digita um nome de usuário. No servidor, o nome é resolvido para um e-mail técnico no domínio reservado `auth.qualimix.invalid`, compatível com `signInWithPassword`.
- O perfil em `public.perfis` contém `username`, `nome`, `perfil` (`admin` ou `user`) e `ativo`.
- A sessão é mantida em cookie HttpOnly, SameSite=Lax e Secure em produção, usando `@supabase/ssr`.
- A chave `SUPABASE_SERVICE_ROLE_KEY` só é lida no servidor. Nunca a coloque em variável `VITE_*`, HTML ou código executado no navegador.
- A página de usuários é apenas interface. Cada operação administrativa valida novamente a sessão e o perfil no servidor.

## Instalação

1. Crie um projeto Supabase.
2. Execute primeiro o SQL base enxuto de 9 tabelas já fornecido para o Qualimix.
3. Execute a migration `supabase/migrations/20261108000100_username_auth_roles.sql`.
4. Instale as dependências já declaradas no package.json e regenere o lockfile:
   ```bash
   pnpm install
   ```
5. Copie `.env.example` para `.env` e preencha as variáveis no ambiente local e no provedor de hospedagem.
6. Reinicie o servidor de desenvolvimento.

## Primeiro administrador

1. Gere um segredo aleatório com pelo menos 32 caracteres.
2. Defina-o como `BOOTSTRAP_ADMIN_SECRET` somente no ambiente do servidor.
3. Abra `https://SEU-DOMINIO/bootstrap` (ou `http://localhost:3000/bootstrap` localmente) e informe nome, username, senha e o segredo de bootstrap.
4. A criação só funciona enquanto não existir nenhum perfil `admin`. O endpoint cria a conta no Supabase Auth e promove o perfil. Se a criação do perfil falhar, tenta excluir a conta Auth criada.
5. Depois do bootstrap, remova `BOOTSTRAP_ADMIN_SECRET` do ambiente e faça novo deploy/restart.

A senha deve ter ao menos 12 caracteres. O username é normalizado para minúsculas e aceita 3–30 caracteres: letras, números, ponto, hífen e sublinhado.

## Usuários comuns

O administrador autenticado cria usuários em Administração > Usuários. O sistema cria a identidade no Supabase Auth com confirmação interna e grava o perfil como `user`. Não há cadastro público. A ativação/desativação é aplicada no perfil; a exclusão remove a identidade Auth e, pela FK, o perfil.

## Papéis

- `admin`: pode gerenciar usuários e executar operações administrativas.
- `user`: usa as funcionalidades comuns autorizadas pelas políticas RLS.

A UI não é uma fronteira de segurança. As funções do servidor e as políticas RLS continuam verificando o usuário. Não promova usuários editando o frontend.

## Variáveis

| Variável | Onde usar | Segredo? |
|---|---|---|
| `SUPABASE_URL` | Servidor | Não |
| `SUPABASE_ANON_KEY` | Servidor/cliente conforme integração | Não é chave privilegiada |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente servidor | **Sim** |
| `BOOTSTRAP_ADMIN_SECRET` | Somente servidor e temporário | **Sim** |

## Limitações que exigem configuração/validação externa

- O projeto Supabase e suas chaves precisam ser fornecidos no ambiente de execução. O bootstrap inicial fica em `/bootstrap`.
- O SQL base deve corresponder à versão de 9 tabelas usada como referência. Não execute o SQL base em banco que já tenha tabelas ou dados sem revisar a migração.
- O banco atual não possui tabelas de agenda, pedidos ou contas a receber. Esses módulos estão marcados como “Em breve” no projeto e não devem ser simulados como dados persistidos.
- A migration de autenticação converte os papéis antigos para ADMIN/USER. Revise usuários já existentes antes de aplicá-la em produção.
- O endpoint aplica bloqueio temporário por username após cinco falhas no mesmo processo. Isso é defesa adicional, não substitui rate limiting distribuído no gateway/hosting; em deploy serverless/multirréplica, configure também limite por IP no provedor.
- O `pnpm-lock.yaml` precisa ser regenerado com `pnpm install` após a inclusão das dependências.
- Após configurar as chaves, execute typecheck, testes e testes reais de login/RLS em um projeto Supabase de homologação.
