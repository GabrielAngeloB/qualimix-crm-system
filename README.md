# Qualimix CRM

CRM da Qualimix para gestão comercial e operacional de concreto usinado, concretagens e pisos de concreto. Interface em português do Brasil, com valores em BRL e datas no padrão brasileiro.

## Estado atual

- **Autenticação:** login próprio com usuário e senha. As credenciais ficam em `public.usuarios` como hashes Scrypt com salt individual; os perfis e papéis ficam em `public.perfis`. A sessão usa cookie assinado, HttpOnly e SameSite=Strict. Em produção, o cookie também usa Secure.
- **Banco:** PostgreSQL do projeto Supabase conectado. O navegador não recebe `DATABASE_URL`; consultas e gravações passam por Server Functions do TanStack Start.
- **Clientes e obras:** leitura de registros reais e respectivos resumos; o cadastro de clientes é exclusivo do administrador e grava cliente + primeira obra opcional em uma transação.
- **Funil comercial:** oportunidades reais associadas a clientes/obras, mudança de etapa, motivo de perda, follow-ups, histórico e vínculo com orçamento.
- **Orçamentos:** listagem e gravação no banco; o cálculo e a validação final são executados no servidor.
- **Pedidos:** conversão de orçamento real aceito em pedido, com vínculo comercial e criação da conta a receber.
- **Agenda operacional:** eventos vinculados a pedido, orçamento, cliente e obra.
- **Profissionais e Financeiro:** cadastro de profissionais, despesas, contas a pagar/receber, baixas parciais e histórico.
- **Tarefas:** tarefas comerciais vinculadas a oportunidades.
- **Configurações:** o catálogo de produtos ativo é lido da tabela `public.produtos`. Regras comerciais e dados institucionais que ainda dependem de confirmação da Qualimix permanecem como pendências, não como valores inventados.
- **Administração:** somente administrador pode cadastrar clientes e criar/gerenciar usuários.

## Limites conhecidos

- Não há uma tela de Frota no roteador, embora existam tabelas e a view `vw_frota_resumo` no banco.
- A tela de Clientes ainda não oferece edição do cadastro principal; o fluxo implementado cria clientes e, opcionalmente, a primeira obra.
- A listagem não tem formulário para editar orçamentos já existentes.
- Rascunhos de orçamento e preferência de tema usam armazenamento local do navegador; isso não substitui a persistência dos registros de negócio.

## Executar localmente

1. Copie `.env.example` para `.env`.
2. Configure no ambiente do servidor `DATABASE_URL` e `SUPABASE_CA_CERT_BASE64`. Não use prefixo `VITE_` para segredos.
3. Instale e inicie:

```bash
pnpm install
pnpm dev
```

A configuração de primeiro administrador, papel PostgreSQL restrito e variáveis de produção está em [DATABASE_AND_AUTH_SETUP.md](./DATABASE_AND_AUTH_SETUP.md).

## Validação

```bash
pnpm typecheck
pnpm test
pnpm lint
```

O gate de CI verifica instalação, typecheck/build e testes unitários. O lint global ainda contém problemas de formatação e regras em arquivos antigos; consulte [docs/INTEGRACAO_BANCO.md](./docs/INTEGRACAO_BANCO.md) para limitações e auditoria técnica.
