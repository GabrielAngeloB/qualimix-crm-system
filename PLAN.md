# Roteiro do produto — Qualimix CRM

O CRM é construído em marcos independentes. Cada marco deixa o sistema utilizável e prepara o seguinte. O motor de cálculo de orçamentos (`src/lib/quote.ts`) já está pronto e testado, e será reutilizado no servidor.

## Marco 1 — Produto navegável e motor de orçamentos ✅

- Identidade visual (branco/preto/vermelho, títulos condensados, tema claro e escuro), menu lateral por módulos e layout responsivo.
- Painel gerencial com indicadores calculados a partir dos registros, gráficos e listas de acompanhamento.
- Gerador de orçamentos: calculadoras de volume (m³) e área (m²) com vários elementos e margem, itens do catálogo, frete, bombeamento, estadia, volume mínimo, descontos, condições e validade. Bloqueia proposta definitiva com preço pendente e sinaliza o que exige aprovação.
- Proposta em A4 com impressão/“Salvar como PDF” e compartilhamento pelo WhatsApp com mensagem editável.
- Lista de orçamentos com pesquisa, filtros, ordenação, paginação e duplicação com preços atuais.
- Clientes e obras: pesquisa por nome/CPF/CNPJ/telefone, cadastro rápido com validação de documento e alerta de duplicidade, visão consolidada do cliente.
- Funil comercial em colunas e em tabela, motivos de perda, fechamento explícito, follow-ups atrasados e histórico.
- Configurações (somente leitura) mostrando tudo que ainda depende da Qualimix.
- Dados de demonstração isolados em `src/data/fixtures.ts`, com botão para ocultá-los.
- Testes de cálculos, regras comerciais, formatação, documentos e indicadores.

## Marco 2 — Banco de dados e persistência

- PostgreSQL com Drizzle, usando provedor gerenciado ou instância própria: `db/schema.ts` e migrações versionadas.
- Tabelas: `users`, `clients`, `sites`, `lead_sources`, `regions`, `funnel_stages`, `opportunities`, `opportunity_events`, `tasks`, `catalog_items`, `catalog_price_history`, `commercial_rules`, `payment_methods`, `company_settings`, `quotes`, `quote_versions` (snapshot imutável de itens, preços e regras), `quote_events`, `audit_log`.
- Coluna `is_demo` em todos os registros de negócio; ação de administrador para carregar ou limpar dados de demonstração sem tocar em registros reais.
- Server functions com validação de entrada; o servidor recalcula cada orçamento com `computeQuote` antes de salvar.
- Substituir as fixtures pelo carregamento a partir do banco (mesmos tipos).

## Marco 3 — Autenticação, permissões e auditoria

- Autenticação independente de provedor (OIDC ou solução compatível com sessões seguras), com perfis Administrador, Comercial, Operação, Financeiro e Consulta.
- Permissões verificadas no servidor em toda leitura e escrita, não apenas na interface.
- Criação do primeiro administrador por convite (sem senha padrão).
- Registro de auditoria para preços, descontos, exceções, cancelamentos e baixas financeiras.
- Minimização de dados pessoais (LGPD): perfis Consulta não veem documentos e telefones completos.

## Marco 4 — Configurações editáveis

- Edição de catálogo (preço, vigência, status) com histórico de preços.
- Regras de frete, bombeamento, volume mínimo, estadia, pisos e limite de desconto.
- Formas de pagamento aceitas, validade padrão, numeração, regiões, origens de lead e etapas do funil.
- Dados institucionais e upload do logo oficial (armazenamento de objetos compatível com S3).
- Indicação clara do que é obrigatório para liberar cada funcionalidade.

## Marco 5 — Ciclo completo do orçamento

- Numeração sequencial única no banco, versões com snapshot e histórico de alterações.
- Fluxo de status: rascunho → aprovação interna → emissão → envio registrado → negociação → aceite/recusa → expiração automática.
- Aprovação de descontos e preços manuais por usuário autorizado, com registro de quem aprovou.
- PDF gerado no servidor e guardado por versão (armazenamento de objetos compatível com S3), com link de compartilhamento assinado e com prazo.
- Confirmação explícita de envio pelo WhatsApp.

## Marco 6 — Pedidos, agenda e caminhões

- Conversão idempotente de orçamento aceito em pedido (chave única por versão aceita).
- Agenda de concretagens mensal, semanal e diária, com status operacionais.
- Cadastro de caminhões próprios e de parceiros, com capacidade obrigatória antes do uso.
- Divisão do volume em viagens, detecção de conflito de horários e de recursos.
- Registro de conclusão e ocorrências pela equipe.

## Marco 7 — Financeiro

- Contas a receber geradas a partir do pedido, sem duplicar cobranças ao reprocessar.
- Pagamentos parciais, quitação, baixa manual e cancelamento auditados.
- Relatórios de a receber, recebido no período, vencido e previsto; contratado × cobrado × recebido.
- Estrutura pronta para integração bancária futura (boleto/Pix), sem marcar pago sem confirmação.

## Marco 8 — Tarefas, notificações e qualidade final

- Tarefas comerciais e lembretes de retorno.
- Agendador externo (cron diário): orçamentos perto da validade, vencimentos, follow-ups atrasados e concretagens próximas (com e-mail quando configurado).
- Painel lendo do banco com acesso aos registros de origem de cada indicador.
- Testes de permissões e de conversões entre módulos; testes end-to-end dos 18 cenários de aceite.
