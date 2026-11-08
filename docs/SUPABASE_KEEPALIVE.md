# Supabase Keepalive

O projeto possui uma RPC pública e estritamente limitada, `public.keepalive()`, usada apenas como health-check periódico. Ela retorna um JSON com o horário da execução e **não consulta nem altera tabelas do CRM**.

## Agendamento

O workflow `.github/workflows/supabase-keepalive.yml` chama a RPC a cada três dias, às 12:00 UTC, usando GitHub Actions.

Depois de integrar o workflow à branch padrão do repositório, configure em **GitHub → Settings → Secrets and variables → Actions**:

- `SUPABASE_URL`: URL do projeto Supabase (ex.: `https://<project-ref>.supabase.co`).
- `SUPABASE_ANON_KEY`: chave publicável/anon do projeto. Nunca use `service_role` ou uma secret key.

O workflow também pode ser executado manualmente em **Actions → Supabase keepalive → Run workflow**.

## Limitações

- O agendamento do GitHub Actions pode sofrer atrasos ou indisponibilidade; não é garantia contratual contra pausa.
- A chamada deve ser executada com sucesso e o workflow precisa estar na branch padrão para o evento `schedule` funcionar.
- O health-check não substitui backup, monitoramento, nem plano pago se o projeto precisar permanecer sempre ativo.
- Não há escrita em dados comerciais, geração de registros fictícios ou alteração de timestamps de clientes.
